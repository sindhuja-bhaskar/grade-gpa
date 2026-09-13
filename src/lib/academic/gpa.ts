/**
 * GPA and CGPA (docs/reqs.md §19, §20).
 *
 * Both return null — never 0.00 — when no completed course exists, so the
 * "unavailable is not zero" rule holds at semester and programme level too
 * (§19, BR-22). Only completed courses contribute (BR-16).
 */

import { roundGpa } from "./decimal";
import type { CompletedCourse } from "./types";

export interface GpaResult {
  /** Null means "not yet available" — display it as such, never as 0.00. */
  value: number | null;
  totalCredits: number;
  totalGradePoints: number;
  completedCourses: number;
}

export function computeGpa(courses: CompletedCourse[]): GpaResult {
  const totalCredits = courses.reduce((total, c) => total + c.credits, 0);
  const totalGradePoints = courses.reduce(
    (total, c) => total + c.credits * c.gradePoint,
    0,
  );

  return {
    value: totalCredits > 0 ? roundGpa(totalGradePoints / totalCredits) : null,
    totalCredits: roundGpa(totalCredits),
    totalGradePoints: roundGpa(totalGradePoints),
    completedCourses: courses.length,
  };
}

/** CGPA uses the same credit-weighted formula across all completed courses. */
export const computeCgpa = computeGpa;

/** Convenience for the dashboard: GPA per semester, oldest first (§28). */
export function gpaBySemester<T extends { key: string; label: string }>(
  semesters: Array<T & { courses: CompletedCourse[] }>,
): Array<T & { gpa: GpaResult }> {
  return semesters.map((semester) => ({
    ...semester,
    gpa: computeGpa(semester.courses),
  }));
}

/**
 * Running CGPA after each semester (§28). Semesters with nothing completed
 * carry the previous value forward rather than dropping the series to zero.
 */
export function cgpaProgression<T extends { key: string; label: string }>(
  semesters: Array<T & { courses: CompletedCourse[] }>,
): Array<T & { cgpa: number | null }> {
  const accumulated: CompletedCourse[] = [];
  return semesters.map((semester) => {
    accumulated.push(...semester.courses);
    return { ...semester, cgpa: computeGpa(accumulated).value };
  });
}
