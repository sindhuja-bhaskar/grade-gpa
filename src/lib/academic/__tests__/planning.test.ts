import { describe, expect, it } from "vitest";
import { computeProgress } from "../assessment";
import {
  requiredGpaForTarget,
  requiredMarksForGrade,
  requiredMarksForTarget,
} from "../planning";
import { makeSubject } from "./factories";

describe("required GPA for a target CGPA (§22)", () => {
  it("calculates the GPA needed across remaining credits", () => {
    const result = requiredGpaForTarget({
      currentGradePoints: 699, // 80 credits at 8.7375
      completedCredits: 80,
      futureCredits: 20,
      targetCgpa: 8.8,
    });

    // (8.8 × 100 − 699) / 20 = 9.05
    expect(result.requiredGpa).toBe(9.05);
    expect(result.attainable).toBe(true);
    expect(result.currentCgpa).toBe(8.74);
  });

  it("says a target is unattainable and gives the best CGPA still reachable (§22)", () => {
    const result = requiredGpaForTarget({
      currentGradePoints: 480, // 60 credits at 8.0
      completedCredits: 60,
      futureCredits: 10,
      targetCgpa: 9.5,
    });

    expect(result.attainable).toBe(false);
    expect(result.requiredGpa).toBeGreaterThan(10);
    expect(result.maxAchievableCgpa).toBe(8.29);
    expect(result.explanation).toMatch(/highest CGPA still reachable is 8.29/);
  });

  it("reports a target already secured by completed credits", () => {
    const result = requiredGpaForTarget({
      currentGradePoints: 540, // 60 credits at 9.0
      completedCredits: 60,
      futureCredits: 20,
      targetCgpa: 6,
    });

    expect(result.alreadyAchieved).toBe(true);
    expect(result.requiredGpa).toBe(0);
  });

  it("cannot plan without future credits, and says so", () => {
    const result = requiredGpaForTarget({
      currentGradePoints: 480,
      completedCredits: 60,
      futureCredits: 0,
      targetCgpa: 9,
    });

    expect(result.requiredGpa).toBeNull();
    expect(result.attainable).toBe(false);
    expect(result.explanation).toMatch(/No future credits/);
  });
});

describe("required marks in remaining assessments (§23)", () => {
  const progress = computeProgress(
    makeSubject("THEORY", { CAT_I: 42, ASSIGNMENT_1: 9, ASSIGNMENT_2: 8 }),
  );

  it("spreads the requirement across remaining assessments by weight", () => {
    const result = requiredMarksForTarget(progress, 80);

    // 80 − 29.6 = 50.4 needed from 65 remaining weight → 77.5%.
    expect(result.neededFromRemaining).toBe(50.4);
    expect(result.requiredPercent).toBe(77.5);
    expect(result.attainable).toBe(true);

    const catTwo = result.targets.find((t) => t.componentCode === "CAT_II");
    expect(catTwo).toMatchObject({ targetMark: 38.75, maxMarks: 50 });
    expect(catTwo?.range).toEqual({ low: 38.75, high: 43.75 });
    expect(catTwo?.exceedsMaximum).toBe(false);
  });

  it("never reports a target as a prediction", () => {
    expect(requiredMarksForTarget(progress, 80).explanation).toMatch(
      /planning targets, not predicted results/,
    );
  });

  it("flags a target that the remaining marks cannot reach (§23)", () => {
    const nearlyDone = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 20,
        CAT_II: 20,
        ASSIGNMENT_1: 5,
        ASSIGNMENT_2: 5,
        ASSIGNMENT_3: 5,
      }),
    );

    const result = requiredMarksForTarget(nearlyDone, 90);
    expect(result.attainable).toBe(false);
    expect(result.maxAchievableFinalMark).toBe(67);
    expect(result.explanation).toMatch(/highest final mark still reachable is 67/);
  });

  it("marks an individual assessment that cannot carry the target alone", () => {
    // Only FAT (40% weight) remains, but 45 weighted marks are still needed.
    const onlyFatLeft = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 20,
        CAT_II: 20,
        ASSIGNMENT_1: 6,
        ASSIGNMENT_2: 6,
        ASSIGNMENT_3: 6,
      }),
    );

    const result = requiredMarksForTarget(onlyFatLeft, 75);
    const fat = result.targets.find((t) => t.componentCode === "FAT");
    expect(result.attainable).toBe(false);
    expect(result.maxAchievableFinalMark).toBe(70);
    expect(fat?.exceedsMaximum).toBe(true);
    expect(fat?.targetMark).toBe(100); // clamped to the maximum

    // A target of exactly 70 is still reachable — full marks in FAT, no margin.
    const exact = requiredMarksForTarget(onlyFatLeft, 70);
    expect(exact.attainable).toBe(true);
    expect(exact.requiredPercent).toBe(100);
  });

  it("reports a target already secured by recorded marks", () => {
    const strong = computeProgress(
      makeSubject("THEORY", {
        CAT_I: 50,
        CAT_II: 50,
        ASSIGNMENT_1: 10,
        ASSIGNMENT_2: 10,
        ASSIGNMENT_3: 10,
      }),
    );

    const result = requiredMarksForTarget(strong, 55);
    expect(result.alreadySecured).toBe(true);
    expect(result.targets).toEqual([]);
  });

  it("plans against a target letter grade (§16, §23)", () => {
    const result = requiredMarksForGrade(progress, "A");

    expect(result?.neededFromRemaining).toBe(50.4); // grade A starts at 80
    expect(requiredMarksForGrade(progress, "Z")).toBeNull();
  });
});
