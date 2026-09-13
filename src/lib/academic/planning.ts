/**
 * Target planning (docs/reqs.md §22, §23).
 *
 * Everything here is a *requirement*, never a prediction (BR-15). Each result
 * carries an explicit attainability flag, because §22 and §23 both require the
 * system to say plainly when a target has moved out of reach instead of
 * returning an impossible number or a bare error.
 */

import { GPA_RANGE, MAX_GRADE_POINT, bandForGrade } from "./config";
import { remainingComponents } from "./assessment";
import { clamp, roundGpa, roundMark, roundPercent } from "./decimal";
import type { ComponentContribution, SubjectProgress } from "./types";

// ─── §22 Required GPA for a target CGPA ────────────────────────────────────

export interface RequiredGpaInput {
  /** Σ(credits × grade point) already earned. */
  currentGradePoints: number;
  /** Credits already completed. */
  completedCredits: number;
  /** Credits still to be attempted. */
  futureCredits: number;
  targetCgpa: number;
}

export interface RequiredGpaResult {
  requiredGpa: number | null;
  /** False when the required GPA exceeds the 10-point maximum (§22). */
  attainable: boolean;
  /** True when the target is already secured by completed work alone. */
  alreadyAchieved: boolean;
  /** Best CGPA still reachable if every future credit scores 10 (§22). */
  maxAchievableCgpa: number | null;
  currentCgpa: number | null;
  explanation: string;
}

export function requiredGpaForTarget(
  input: RequiredGpaInput,
): RequiredGpaResult {
  const { currentGradePoints, completedCredits, futureCredits, targetCgpa } =
    input;
  const totalCredits = completedCredits + futureCredits;
  const currentCgpa =
    completedCredits > 0 ? roundGpa(currentGradePoints / completedCredits) : null;

  if (futureCredits <= 0) {
    const attainable = currentCgpa !== null && currentCgpa >= targetCgpa;
    return {
      requiredGpa: null,
      attainable,
      alreadyAchieved: attainable,
      maxAchievableCgpa: currentCgpa,
      currentCgpa,
      explanation:
        "No future credits have been entered, so there is nothing left to plan " +
        "against. Add upcoming semesters or subjects to calculate a required GPA.",
    };
  }

  const required =
    (targetCgpa * totalCredits - currentGradePoints) / futureCredits;
  const maxAchievableCgpa = roundGpa(
    (currentGradePoints + futureCredits * MAX_GRADE_POINT) / totalCredits,
  );

  if (required <= GPA_RANGE.min) {
    return {
      requiredGpa: GPA_RANGE.min,
      attainable: true,
      alreadyAchieved: true,
      maxAchievableCgpa,
      currentCgpa,
      explanation: `A CGPA of ${targetCgpa} is already secured by completed credits.`,
    };
  }

  const requiredGpa = roundGpa(required);
  if (requiredGpa > GPA_RANGE.max) {
    return {
      requiredGpa,
      attainable: false,
      alreadyAchieved: false,
      maxAchievableCgpa,
      currentCgpa,
      explanation:
        `A CGPA of ${targetCgpa} would need ${requiredGpa} across the remaining ` +
        `${futureCredits} credits, above the maximum of ${GPA_RANGE.max}. ` +
        `The highest CGPA still reachable is ${maxAchievableCgpa}.`,
    };
  }

  return {
    requiredGpa,
    attainable: true,
    alreadyAchieved: false,
    maxAchievableCgpa,
    currentCgpa,
    explanation:
      `Averaging ${requiredGpa} across the remaining ${futureCredits} credits ` +
      `would reach a CGPA of ${targetCgpa}. This is a requirement, not a prediction.`,
  };
}

// ─── §23 Required marks in remaining assessments ───────────────────────────

export interface AssessmentTarget {
  componentCode: string;
  label: string;
  maxMarks: number;
  effectiveWeight: number;
  /** Mark needed if the remaining requirement is spread evenly by weight. */
  targetMark: number;
  /** Recommended range (§23): the target, with a small working margin. */
  range: { low: number; high: number };
  /** True when even full marks here would not be enough on their own. */
  exceedsMaximum: boolean;
}

export interface RequiredMarksResult {
  /** Weighted marks still needed out of the remaining weight. */
  neededFromRemaining: number;
  remainingWeight: number;
  /** Average percentage required across all remaining assessments. */
  requiredPercent: number | null;
  attainable: boolean;
  alreadySecured: boolean;
  maxAchievableFinalMark: number;
  targets: AssessmentTarget[];
  explanation: string;
}

/** Width of the recommended band, as a percentage of an assessment's maximum. */
const RANGE_MARGIN_PERCENT = 10;

/**
 * What the student needs from the assessments that have not happened yet in
 * order to finish on `targetFinalMark` out of 100.
 *
 * The requirement is distributed across remaining assessments in proportion to
 * their weight, which is also the redistribution §23 asks for when a single
 * assessment can no longer carry the target alone.
 */
export function requiredMarksForTarget(
  progress: SubjectProgress,
  targetFinalMark: number,
): RequiredMarksResult {
  const remaining = remainingComponents(progress);
  const neededFromRemaining = roundMark(
    targetFinalMark - progress.earnedMarks,
  );

  if (neededFromRemaining <= 0) {
    return {
      neededFromRemaining: 0,
      remainingWeight: progress.remainingWeight,
      requiredPercent: 0,
      attainable: true,
      alreadySecured: true,
      maxAchievableFinalMark: progress.maxAchievableFinalMark,
      targets: [],
      explanation: `A final mark of ${targetFinalMark} is already secured by the marks recorded so far.`,
    };
  }

  if (progress.remainingWeight <= 0) {
    return {
      neededFromRemaining,
      remainingWeight: 0,
      requiredPercent: null,
      attainable: false,
      alreadySecured: false,
      maxAchievableFinalMark: progress.maxAchievableFinalMark,
      targets: [],
      explanation:
        "Every assessment has been recorded, so no further marks can change this subject's result.",
    };
  }

  const requiredPercent = roundPercent(
    (neededFromRemaining / progress.remainingWeight) * 100,
  );
  const attainable = neededFromRemaining <= progress.remainingWeight;

  const targets: AssessmentTarget[] = remaining.map((component) =>
    buildTarget(component, requiredPercent),
  );

  if (!attainable) {
    return {
      neededFromRemaining,
      remainingWeight: progress.remainingWeight,
      requiredPercent,
      attainable: false,
      alreadySecured: false,
      maxAchievableFinalMark: progress.maxAchievableFinalMark,
      targets,
      explanation:
        `A final mark of ${targetFinalMark} would need ${neededFromRemaining} ` +
        `weighted marks from ${progress.remainingWeight} still available. ` +
        `The highest final mark still reachable is ${progress.maxAchievableFinalMark}.`,
    };
  }

  return {
    neededFromRemaining,
    remainingWeight: progress.remainingWeight,
    requiredPercent,
    attainable: true,
    alreadySecured: false,
    maxAchievableFinalMark: progress.maxAchievableFinalMark,
    targets,
    explanation:
      `Averaging ${requiredPercent}% across the remaining assessments would ` +
      `finish on ${targetFinalMark}. These are planning targets, not predicted results.`,
  };
}

function buildTarget(
  component: ComponentContribution,
  requiredPercent: number,
): AssessmentTarget {
  const raw = (requiredPercent / 100) * component.maxMarks;
  const targetMark = roundMark(clamp(raw, 0, component.maxMarks));
  const margin = (RANGE_MARGIN_PERCENT / 100) * component.maxMarks;
  return {
    componentCode: component.componentCode,
    label: component.label,
    maxMarks: component.maxMarks,
    effectiveWeight: component.effectiveWeight,
    targetMark,
    range: {
      low: targetMark,
      high: roundMark(clamp(targetMark + margin, 0, component.maxMarks)),
    },
    exceedsMaximum: raw > component.maxMarks + 1e-9,
  };
}

/** The same calculation expressed against a target letter grade (§16, §23). */
export function requiredMarksForGrade(
  progress: SubjectProgress,
  grade: string,
): RequiredMarksResult | null {
  const band = bandForGrade(grade);
  if (!band) return null;
  return requiredMarksForTarget(progress, band.minMark);
}
