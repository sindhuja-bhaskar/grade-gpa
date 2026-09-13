import { describe, expect, it } from "vitest";
import { computeProgress } from "../assessment";
import { classifySubject, detectTrend } from "../classify";
import { recommendForSubject, CATEGORY_MESSAGES } from "../recommend";
import { prioritizeSubjects } from "../prioritize";
import { previousAssessedPercent } from "../history";
import { makeSubject } from "./factories";

const strong = computeProgress(
  makeSubject("THEORY", { CAT_I: 42, ASSIGNMENT_1: 9, ASSIGNMENT_2: 8 }),
);
const weak = computeProgress(
  makeSubject("THEORY", { CAT_I: 20, ASSIGNMENT_1: 5, ASSIGNMENT_2: 4 }),
);

describe("performance categories (§24)", () => {
  it("classifies on the work assessed so far, not on a grade", () => {
    const result = classifySubject({ progress: strong });

    expect(result.assessedPercent).toBe(84.6);
    expect(result.category).toBe("STRONG");
    expect(result.label).toBe("Strong Performance");
    expect(result.reasons[0]).toMatch(/35 marks assessed so far/);
  });

  it("refuses to classify a subject with nothing recorded (BR-20)", () => {
    const result = classifySubject({ progress: computeProgress(makeSubject("THEORY")) });

    expect(result.status).toBe("AWAITING_DATA");
    expect(result.category).toBeNull();
  });

  it("drops to high risk when the target is out of reach", () => {
    const nearlyDone = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 45,
        CAT_II: 45,
        ASSIGNMENT_1: 9,
        ASSIGNMENT_2: 9,
        ASSIGNMENT_3: 9,
      }),
    );

    const result = classifySubject({ progress: nearlyDone, targetFinalMark: 98 });
    expect(result.category).toBe("HIGH_RISK");
    expect(result.target?.attainable).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/no longer reachable/);
  });

  it("demotes a strong subject whose target now demands near-perfect marks", () => {
    // 84.6% assessed would be STRONG, but a 90 target needs 92.9% of what is left.
    const result = classifySubject({ progress: strong, targetFinalMark: 90 });

    expect(result.target?.requiredPercent).toBe(92.9);
    expect(result.category).toBe("ON_TRACK");
  });

  it("never treats a secured target as at risk", () => {
    const result = classifySubject({ progress: weak, targetFinalMark: 10 });

    expect(result.target?.alreadySecured).toBe(true);
    expect(result.category).toBe("ON_TRACK");
  });

  it("detects trends only outside the sensitivity band", () => {
    expect(detectTrend(84, 70)).toBe("IMPROVING");
    expect(detectTrend(70, 84)).toBe("DECLINING");
    expect(detectTrend(71, 70)).toBe("STEADY");
    expect(detectTrend(71, null)).toBeNull();
  });

  it("compares against earlier assessments in the same subject (§28)", () => {
    const subject = makeSubject("THEORY", {
      CAT_I: 30, // 60%
      ASSIGNMENT_1: 9, // 90%
      ASSIGNMENT_2: 10, // 100%
    });
    const previous = previousAssessedPercent(subject.assessments);
    const result = classifySubject({
      progress: computeProgress(subject),
      previousAssessedPercent: previous,
    });

    expect(previous).toBe(75);
    expect(result.trend).toBe("IMPROVING");
  });
});

describe("recommendations (§26, BR-14)", () => {
  it("returns the predefined message for the category", () => {
    const classification = classifySubject({ progress: strong });
    const [first] = recommendForSubject(classification, strong);

    expect(first?.code).toBe("STRONG");
    expect(first?.message).toBe(CATEGORY_MESSAGES.STRONG);
    expect(first?.basis).toBeTruthy();
  });

  it("withholds recommendations when there is no data (§26)", () => {
    const empty = computeProgress(makeSubject("THEORY"));
    const result = recommendForSubject(classifySubject({ progress: empty }), empty);

    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("INSUFFICIENT_DATA");
  });

  it("adds a separate note for an unreachable target", () => {
    const classification = classifySubject({ progress: weak, targetFinalMark: 95 });
    const codes = recommendForSubject(classification, weak).map((r) => r.code);

    expect(codes).toContain("TARGET_UNREACHABLE");
  });

  it("reports a missed lab minimum as its own recommendation (§11.2)", () => {
    const lab = computeProgress(
      makeSubject("LABORATORY", { LAB_CONTINUOUS: 80, LAB_FAT: 30 }),
    );
    const codes = recommendForSubject(classifySubject({ progress: lab }), lab).map(
      (r) => r.code,
    );

    expect(codes).toContain("MINIMUM_MARK_AT_RISK");
  });
});

describe("subject prioritization (§25)", () => {
  it("ranks subjects needing attention and explains why", () => {
    const ranked = prioritizeSubjects([
      {
        subjectId: "cn",
        name: "Computer Networks",
        credits: 3,
        progress: strong,
        classification: classifySubject({ progress: strong }),
        targetFinalMark: 80,
      },
      {
        subjectId: "dbms",
        name: "DBMS",
        credits: 4,
        progress: weak,
        classification: classifySubject({ progress: weak }),
        targetFinalMark: 80,
      },
    ]);

    expect(ranked.map((s) => s.subjectId)).toEqual(["dbms"]);
    expect(ranked[0]?.reason).toMatch(/4-credit subject running/);
    expect(ranked[0]?.reason).toMatch(/65% of the assessment weight still to come/);
  });

  it("does not prioritize a subject with no assessments", () => {
    const empty = computeProgress(makeSubject("THEORY"));
    const ranked = prioritizeSubjects([
      {
        subjectId: "new",
        name: "Fresh Subject",
        credits: 4,
        progress: empty,
        classification: classifySubject({ progress: empty }),
      },
    ]);

    expect(ranked).toEqual([]);
  });
});
