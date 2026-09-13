import { describe, expect, it } from "vitest";
import {
  gradeForMark,
  mean,
  relativeAssessment,
  standardDeviation,
  subjectRelativeStanding,
} from "../grade";
import { makeSubject } from "./factories";

describe("absolute grading boundaries (§16, §40)", () => {
  it.each([
    [100, "S", 10],
    [90, "S", 10],
    [89.99, "A", 9],
    [80, "A", 9],
    [79.99, "B", 8],
    [70, "B", 8],
    [69.99, "C", 7],
    [60, "C", 7],
    [59.99, "D", 6],
    [55, "D", 6],
    [54.99, "E", 5],
    [50, "E", 5],
    [49.99, "F", 0],
    [0, "F", 0],
  ])("a final mark of %s is grade %s (%s points)", (mark, grade, point) => {
    expect(gradeForMark(mark)).toEqual({ grade, gradePoint: point });
  });
});

describe("relative grading (§15)", () => {
  it("reports the difference from the class average (§15.1)", () => {
    const result = relativeAssessment({ studentMark: 42, classAverage: 36 });

    expect(result.relativeDifference).toBe(6);
    expect(result.confidence).toBe("PARTIAL");
    expect(result.note).toMatch(/incomplete class information/);
  });

  it("standardises performance when a deviation is available (§15.2)", () => {
    const result = relativeAssessment({
      studentMark: 42,
      classAverage: 36,
      standardDeviation: 4,
    });

    expect(result.zScore).toBe(1.5);
    expect(result.confidence).toBe("FULL");
  });

  it("claims nothing without a class average (§15.3, BR-20)", () => {
    const result = relativeAssessment({ studentMark: 42 });

    expect(result.confidence).toBe("UNAVAILABLE");
    expect(result.relativeDifference).toBeNull();
    expect(result.zScore).toBeNull();
  });

  it("flags subject-level standing built on partial class data", () => {
    const subject = makeSubject("THEORY", {
      CAT_I: { mark: 42, classAverage: 36 },
      ASSIGNMENT_1: 9,
    });

    const standing = subjectRelativeStanding(subject);
    expect(standing.assessmentsWithClassData).toBe(1);
    expect(standing.confidence).toBe("PARTIAL");
    expect(standing.averageDifferencePercent).toBe(12);
  });

  it("computes sample statistics, and nothing from too few points", () => {
    expect(mean([36, 40, 44])).toBe(40);
    expect(standardDeviation([36, 40, 44])).toBe(4);
    expect(standardDeviation([40])).toBeNull();
    expect(mean([])).toBeNull();
  });
});
