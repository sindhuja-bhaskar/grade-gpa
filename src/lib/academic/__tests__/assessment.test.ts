import { describe, expect, it } from "vitest";
import { computeProgress, remainingComponents, unmetMinimums } from "../assessment";
import { officialGrade } from "../grade";
import { makeSubject, marksAtPercent } from "./factories";

describe("assessment calculation (§11, §12, §13)", () => {
  it("reproduces the worked example in §12.2", () => {
    // CAT-I 42/50, CAT-II unavailable, A1 9/10, A2 8/10, A3 and FAT unavailable.
    const progress = computeProgress(
      makeSubject("THEORY", { CAT_I: 42, ASSIGNMENT_1: 9, ASSIGNMENT_2: 8 }),
    );

    expect(progress.earnedMarks).toBe(29.6);
    expect(progress.completedWeight).toBe(35);
    expect(progress.remainingWeight).toBe(65);
    expect(progress.maxAchievableFinalMark).toBe(94.6);
  });

  it("excludes unavailable assessments instead of scoring them zero (BR-04)", () => {
    const progress = computeProgress(makeSubject("THEORY", { CAT_I: 42 }));

    const catTwo = progress.components.find((c) => c.componentCode === "CAT_II");
    expect(catTwo?.status).toBe("NOT_AVAILABLE");
    expect(catTwo?.earned).toBeNull();
    // Had CAT-II been treated as zero, completedWeight would be 30, not 15.
    expect(progress.completedWeight).toBe(15);
    expect(progress.assessedPercent).toBe(84);
  });

  it("counts a genuine zero as an assessed mark (BR-05)", () => {
    const progress = computeProgress(makeSubject("THEORY", { CAT_I: 0 }));

    expect(progress.completedWeight).toBe(15);
    expect(progress.earnedMarks).toBe(0);
    expect(progress.assessedPercent).toBe(0);
  });

  it("has no assessed percentage before any mark is recorded", () => {
    const progress = computeProgress(makeSubject("THEORY"));

    expect(progress.assessedPercent).toBeNull();
    expect(progress.completedWeight).toBe(0);
    expect(progress.remainingWeight).toBe(100);
  });

  it("stays ongoing until every component is recorded (BR-21)", () => {
    const almost = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 45,
        CAT_II: 45,
        ASSIGNMENT_1: 10,
        ASSIGNMENT_2: 10,
        ASSIGNMENT_3: 10,
      }),
    );
    // 60% of the weight is recorded, but FAT is not — still ongoing.
    expect(almost.completedWeight).toBe(60);
    expect(almost.isComplete).toBe(false);
    expect(almost.finalMark).toBeNull();
    expect(officialGrade(almost)).toBeNull();

    const complete = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 45,
        CAT_II: 45,
        ASSIGNMENT_1: 10,
        ASSIGNMENT_2: 10,
        ASSIGNMENT_3: 10,
        FAT: 80,
      }),
    );
    expect(complete.isComplete).toBe(true);
    expect(complete.finalMark).toBe(89);
    expect(officialGrade(complete)).toEqual({ grade: "A", gradePoint: 9 });
  });

  it("applies the theory/lab split from §17.3", () => {
    const progress = computeProgress(
      makeSubject(
        "THEORY_AND_LAB",
        marksAtPercent("THEORY_AND_LAB", { THEORY: 78, LAB: 92 }),
      ),
    );

    // 0.75 × 78 + 0.25 × 92 = 58.5 + 23.0 = 81.5 → Grade A
    expect(progress.finalMark).toBe(81.5);
    expect(officialGrade(progress)).toEqual({ grade: "A", gradePoint: 9 });
  });

  it("honours a per-subject split override (§11.2)", () => {
    const progress = computeProgress(
      makeSubject(
        "THEORY_AND_LAB",
        marksAtPercent("THEORY_AND_LAB", { THEORY: 78, LAB: 92 }),
        { theoryWeightPercent: 50, labWeightPercent: 50 },
      ),
    );

    expect(progress.finalMark).toBe(85);
  });

  it("ignores an override that does not sum to 100 and keeps the scheme default", () => {
    const progress = computeProgress(
      makeSubject(
        "THEORY_AND_LAB",
        marksAtPercent("THEORY_AND_LAB", { THEORY: 78, LAB: 92 }),
        { theoryWeightPercent: 50, labWeightPercent: 30 },
      ),
    );

    expect(progress.finalMark).toBe(81.5);
  });

  it("reports a missed lab minimum separately from the grade (§11.2)", () => {
    const progress = computeProgress(
      makeSubject("LABORATORY", { LAB_CONTINUOUS: 80, LAB_FAT: 40 }),
    );

    expect(progress.finalMark).toBe(64);
    expect(unmetMinimums(progress).map((c) => c.componentCode)).toEqual([
      "LAB_FAT",
    ]);
  });

  it("lists remaining components in the order they are sat (§23)", () => {
    const progress = computeProgress(makeSubject("THEORY", { CAT_I: 42 }));

    expect(remainingComponents(progress).map((c) => c.componentCode)).toEqual([
      "CAT_II",
      "ASSIGNMENT_1",
      "ASSIGNMENT_2",
      "ASSIGNMENT_3",
      "FAT",
    ]);
  });
});
