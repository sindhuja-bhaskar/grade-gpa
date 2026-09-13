/**
 * Historical performance analysis (docs/reqs.md §27, §28).
 *
 * Trends are derived only from recorded data; missing history is reported as
 * missing and never filled in (§28, BR-20).
 */

import { roundPercent } from "./decimal";
import type { AssessmentInput, SubjectProgress } from "./types";

export interface AssessmentPoint {
  componentCode: string;
  label: string;
  sequence: number;
  percent: number;
}

/** Percentage scored in each recorded assessment, in the order they were sat. */
export function assessmentSeries(
  assessments: AssessmentInput[],
): AssessmentPoint[] {
  return assessments
    .filter((a) => a.status === "AVAILABLE" && a.studentMark !== null)
    .sort((a, b) => a.component.localeCompare(b.component) || a.sequence - b.sequence)
    .map((a) => ({
      componentCode: a.componentCode,
      label: a.label,
      sequence: a.sequence,
      percent: roundPercent((a.studentMark! / a.maxMarks) * 100),
    }));
}

/**
 * Percentage scored on everything except the most recent assessment — the
 * baseline the classifier compares against to detect a trend (§26 "Improving").
 * Null when fewer than two assessments have been recorded.
 */
export function previousAssessedPercent(
  assessments: AssessmentInput[],
): number | null {
  const series = assessmentSeries(assessments);
  if (series.length < 2) return null;
  const earlier = series.slice(0, -1);
  const total = earlier.reduce((sum, point) => sum + point.percent, 0);
  return roundPercent(total / earlier.length);
}

export interface SubjectStanding {
  subjectId: string;
  name: string;
  assessedPercent: number | null;
}

/** Strongest subjects first; subjects without data are excluded, not ranked 0. */
export function strongestSubjects(
  subjects: Array<{ subjectId: string; name: string; progress: SubjectProgress }>,
  limit = 3,
): SubjectStanding[] {
  return subjects
    .filter((s) => s.progress.assessedPercent !== null)
    .map((s) => ({
      subjectId: s.subjectId,
      name: s.name,
      assessedPercent: s.progress.assessedPercent,
    }))
    .sort((a, b) => (b.assessedPercent ?? 0) - (a.assessedPercent ?? 0))
    .slice(0, limit);
}
