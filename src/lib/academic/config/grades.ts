/**
 * Absolute grade boundaries and grade points (docs/reqs.md §16).
 * Configuration, not literals scattered through the engine (§36).
 */

import type { GradeResult } from "../types";

export interface GradeBand {
  grade: string;
  /** Inclusive lower bound of the final mark, out of 100. */
  minMark: number;
  gradePoint: number;
}

/** Ordered from highest to lowest; the first band whose minMark is met wins. */
export const GRADE_BANDS: GradeBand[] = [
  { grade: "S", minMark: 90, gradePoint: 10 },
  { grade: "A", minMark: 80, gradePoint: 9 },
  { grade: "B", minMark: 70, gradePoint: 8 },
  { grade: "C", minMark: 60, gradePoint: 7 },
  { grade: "D", minMark: 55, gradePoint: 6 },
  { grade: "E", minMark: 50, gradePoint: 5 },
  { grade: "F", minMark: 0, gradePoint: 0 },
];

export const MAX_GRADE_POINT = 10;
export const MIN_PASSING_GRADE = "E";

export function bandForGrade(grade: string): GradeBand | undefined {
  return GRADE_BANDS.find((band) => band.grade === grade.toUpperCase());
}

export function gradeForMark(finalMark: number): GradeResult {
  const band =
    GRADE_BANDS.find((candidate) => finalMark >= candidate.minMark) ??
    GRADE_BANDS[GRADE_BANDS.length - 1]!;
  return { grade: band.grade, gradePoint: band.gradePoint };
}
