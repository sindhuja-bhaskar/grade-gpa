/**
 * Grade calculation (docs/reqs.md §15, §16, §18).
 *
 * A grade only ever exists for a *completed* subject. `officialGrade` returns
 * null for anything else — the engine has no way to express "current grade"
 * for an ongoing subject, which is how BR-01 is enforced in code rather than
 * in the UI.
 */

import { gradeForMark } from "./config/grades";
import { roundMark, roundPercent } from "./decimal";
import type { GradeResult, SubjectInput, SubjectProgress } from "./types";

export { gradeForMark };

/**
 * The official grade for a subject, or null while it is ongoing (§18, BR-03).
 */
export function officialGrade(progress: SubjectProgress): GradeResult | null {
  if (!progress.isComplete || progress.finalMark === null) return null;
  return gradeForMark(progress.finalMark);
}

export type RelativeConfidence = "FULL" | "PARTIAL" | "UNAVAILABLE";

export interface RelativeAssessment {
  confidence: RelativeConfidence;
  /** Student mark minus class average, per assessment (§15.1). */
  relativeDifference: number | null;
  /** (mark − mean) / sd, when a standard deviation is available (§15.2). */
  zScore: number | null;
  /** Plain-language note; always states when information is incomplete (§15.3). */
  note: string;
}

/**
 * Relative-grading analysis for one assessment.
 *
 * §15.3 is the important part: without class statistics the system does not
 * claim a relative grade. It degrades to partial information or to nothing,
 * and always says which — it never invents a class average (§14, BR-20).
 */
export function relativeAssessment(assessment: {
  studentMark: number | null;
  classAverage?: number | null;
  standardDeviation?: number | null;
}): RelativeAssessment {
  const { studentMark } = assessment;
  const classAverage = assessment.classAverage ?? null;
  const standardDeviation = assessment.standardDeviation ?? null;

  if (studentMark === null || classAverage === null) {
    return {
      confidence: "UNAVAILABLE",
      relativeDifference: null,
      zScore: null,
      note: "No class average recorded, so relative standing cannot be assessed.",
    };
  }

  const relativeDifference = roundMark(studentMark - classAverage);

  if (standardDeviation === null || standardDeviation <= 0) {
    return {
      confidence: "PARTIAL",
      relativeDifference,
      zScore: null,
      note:
        `${relativeDifference >= 0 ? "Above" : "Below"} the class average by ` +
        `${Math.abs(relativeDifference)} marks. Based on incomplete class ` +
        `information — no standard deviation is available, so this is a ` +
        `planning indication, not a relative grade.`,
    };
  }

  const zScore = roundMark(relativeDifference / standardDeviation);
  return {
    confidence: "FULL",
    relativeDifference,
    zScore,
    note:
      `${relativeDifference >= 0 ? "Above" : "Below"} the class average by ` +
      `${Math.abs(relativeDifference)} marks (z = ${zScore}).`,
  };
}

/** Sample statistics used when a student enters raw class marks (§15). */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundMark(values.reduce((total, v) => total + v, 0) / values.length);
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = values.reduce((total, v) => total + v, 0) / values.length;
  const variance =
    values.reduce((total, v) => total + (v - average) ** 2, 0) /
    (values.length - 1);
  return roundMark(Math.sqrt(variance));
}

/**
 * Relative standing across a subject's recorded assessments, with an explicit
 * confidence level so the UI can label incomplete analysis (§15.3).
 */
export function subjectRelativeStanding(subject: SubjectInput): {
  confidence: RelativeConfidence;
  averageDifferencePercent: number | null;
  assessmentsWithClassData: number;
  note: string;
} {
  const withData = subject.assessments.filter(
    (a) =>
      a.status === "AVAILABLE" &&
      a.studentMark !== null &&
      a.classAverage !== null &&
      a.classAverage !== undefined,
  );

  if (withData.length === 0) {
    return {
      confidence: "UNAVAILABLE",
      averageDifferencePercent: null,
      assessmentsWithClassData: 0,
      note: "No class averages recorded for this subject.",
    };
  }

  const differencePercent =
    withData.reduce(
      (total, a) =>
        total + ((a.studentMark! - a.classAverage!) / a.maxMarks) * 100,
      0,
    ) / withData.length;

  const recorded = subject.assessments.filter(
    (a) => a.status === "AVAILABLE",
  ).length;
  const confidence: RelativeConfidence =
    withData.length === recorded && subject.classStrength ? "FULL" : "PARTIAL";

  return {
    confidence,
    averageDifferencePercent: roundPercent(differencePercent),
    assessmentsWithClassData: withData.length,
    note:
      confidence === "FULL"
        ? "Based on class averages for every recorded assessment."
        : "Based on incomplete class information — treat as an indication, not a relative grade.",
  };
}
