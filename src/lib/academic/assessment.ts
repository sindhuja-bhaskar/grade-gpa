/**
 * Assessment calculation (docs/reqs.md §11, §12, §13, §17).
 *
 * The rule this module exists to protect: an assessment with no recorded mark
 * is *unavailable*, not zero (§12.1, BR-04). It is excluded from earned marks
 * and from the assessed weight, and it shows up only as remaining weight.
 */

import { getScheme, requiredComponents } from "./config/schemes";
import { roundMark, roundPercent } from "./decimal";
import type {
  ComponentContribution,
  ComponentSpec,
  SubjectInput,
  SubjectProgress,
} from "./types";

/**
 * Weight of one component in the final 100-mark course total, after applying
 * the theory/lab split for combined courses (§17.3).
 */
export function effectiveWeight(
  subject: Pick<
    SubjectInput,
    "courseType" | "theoryWeightPercent" | "labWeightPercent"
  >,
  component: Pick<ComponentSpec, "component" | "weight">,
): number {
  const scheme = getScheme(subject.courseType);
  const split = resolveSplit(subject, scheme.split);
  const share = component.component === "THEORY" ? split.theory : split.lab;
  // Deliberately unrounded: totals are rounded once, at the end of
  // computeProgress, so component-level rounding cannot accumulate.
  return (component.weight * share) / 100;
}

function resolveSplit(
  subject: Pick<SubjectInput, "theoryWeightPercent" | "labWeightPercent">,
  fallback: { theory: number; lab: number },
): { theory: number; lab: number } {
  // A subject may override the scheme default (§11.2). Both halves must be set
  // and sum to 100, otherwise the scheme default stands.
  const { theoryWeightPercent: theory, labWeightPercent: lab } = subject;
  if (
    typeof theory === "number" &&
    typeof lab === "number" &&
    Math.abs(theory + lab - 100) < 0.001
  ) {
    return { theory, lab };
  }
  return fallback;
}

/**
 * Where a subject stands right now. Reports assessed work only: nothing is
 * extrapolated, and `finalMark` stays null until every component is recorded
 * (§18.1, BR-01, BR-21).
 */
export function computeProgress(subject: SubjectInput): SubjectProgress {
  const specs = requiredComponents(subject.courseType);
  const byCode = new Map(subject.assessments.map((a) => [a.componentCode, a]));

  // Raw (unrounded) figures first; rounding happens once per reported value so
  // that component-level rounding never accumulates into the course total.
  const raw = specs.map((spec) => {
    const recorded = byCode.get(spec.code);
    const weight = effectiveWeight(subject, spec);
    const hasMark =
      recorded?.status === "AVAILABLE" &&
      recorded.studentMark !== null &&
      recorded.studentMark !== undefined;

    const studentMark = hasMark ? recorded!.studentMark! : null;
    const maxMarks = recorded?.maxMarks ?? spec.maxMarks;

    return {
      spec,
      label: recorded?.label ?? spec.label,
      maxMarks,
      weight,
      studentMark,
      earned: studentMark === null ? null : (studentMark / maxMarks) * weight,
    };
  });

  const components: ComponentContribution[] = raw.map((entry) => ({
    componentCode: entry.spec.code,
    label: entry.label,
    component: entry.spec.component,
    sequence: entry.spec.sequence,
    maxMarks: entry.maxMarks,
    effectiveWeight: roundMark(entry.weight),
    status: entry.studentMark === null ? "NOT_AVAILABLE" : "AVAILABLE",
    studentMark: entry.studentMark,
    earned: entry.earned === null ? null : roundMark(entry.earned),
    ...(entry.spec.minimumMarkPercent === undefined
      ? {}
      : {
          minimumMarkPercent: entry.spec.minimumMarkPercent,
          minimumMarkMet:
            entry.studentMark === null
              ? null
              : (entry.studentMark / entry.maxMarks) * 100 >=
                entry.spec.minimumMarkPercent,
        }),
  }));

  const assessed = raw.filter((entry) => entry.studentMark !== null);
  const earnedRaw = assessed.reduce((total, entry) => total + (entry.earned ?? 0), 0);
  const completedWeightRaw = assessed.reduce((total, entry) => total + entry.weight, 0);
  const remainingWeightRaw = raw
    .filter((entry) => entry.studentMark === null)
    .reduce((total, entry) => total + entry.weight, 0);

  const earnedMarks = roundMark(earnedRaw);
  const completedWeight = roundMark(completedWeightRaw);
  const remainingWeight = roundMark(remainingWeightRaw);
  const isComplete = raw.every((entry) => entry.studentMark !== null);

  return {
    components,
    earnedMarks,
    completedWeight,
    remainingWeight,
    maxAchievableFinalMark: roundMark(earnedRaw + remainingWeightRaw),
    assessedPercent:
      completedWeightRaw > 0
        ? roundPercent((earnedRaw / completedWeightRaw) * 100)
        : null,
    isComplete,
    finalMark: isComplete ? earnedMarks : null,
  };
}

/** Components with no recorded mark yet, in the order they are sat (§23). */
export function remainingComponents(
  progress: SubjectProgress,
): ComponentContribution[] {
  return progress.components
    .filter((c) => c.status === "NOT_AVAILABLE")
    .sort((a, b) => a.component.localeCompare(b.component) || a.sequence - b.sequence);
}

/**
 * Minimum-mark requirements that have been missed (§11.2, §17.2). Reported
 * separately: they never silently change the calculated grade.
 */
export function unmetMinimums(
  progress: SubjectProgress,
): ComponentContribution[] {
  return progress.components.filter((c) => c.minimumMarkMet === false);
}
