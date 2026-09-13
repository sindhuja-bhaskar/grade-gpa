/**
 * Subject prioritization (docs/reqs.md §25).
 *
 * §25 is explicit that a bare score is not acceptable: every prioritized
 * subject carries the reason it was prioritized.
 */

import { PRIORITY_WEIGHTS } from "./config/performance";
import { roundMark } from "./decimal";
import type { Classification } from "./classify";
import type { SubjectProgress } from "./types";

export interface PriorityInput {
  subjectId: string;
  name: string;
  credits: number;
  progress: SubjectProgress;
  classification: Classification;
  targetFinalMark?: number | null;
}

export interface PrioritizedSubject {
  subjectId: string;
  name: string;
  credits: number;
  score: number;
  reason: string;
  category: Classification["category"];
}

/**
 * Rank subjects by how much attention they need, combining how far behind a
 * target the subject is, how many credits ride on it, and how much assessment
 * weight is still open to change.
 */
export function prioritizeSubjects(
  subjects: PriorityInput[],
): PrioritizedSubject[] {
  return subjects
    .map(score)
    .filter((subject) => subject.score > 0)
    .sort((a, b) => b.score - a.score);
}

function score(input: PriorityInput): PrioritizedSubject {
  const { progress, classification, credits } = input;
  const assessedPercent = progress.assessedPercent;

  if (assessedPercent === null) {
    return {
      subjectId: input.subjectId,
      name: input.name,
      credits,
      score: 0,
      reason: "No assessments recorded yet.",
      category: classification.category,
    };
  }

  const targetPercent =
    typeof input.targetFinalMark === "number" ? input.targetFinalMark : 75;
  const gap = Math.max(0, targetPercent - assessedPercent);
  const remainingShare =
    progress.remainingWeight /
    Math.max(1, progress.remainingWeight + progress.completedWeight);

  const raw =
    gap * PRIORITY_WEIGHTS.targetGap +
    credits * PRIORITY_WEIGHTS.credits * (gap > 0 ? 1 : 0) +
    remainingShare * 100 * PRIORITY_WEIGHTS.remainingOpportunity * (gap > 0 ? 1 : 0);

  return {
    subjectId: input.subjectId,
    name: input.name,
    credits,
    score: roundMark(raw),
    reason: reasonFor(input, gap, remainingShare, targetPercent),
    category: classification.category,
  };
}

function reasonFor(
  input: PriorityInput,
  gap: number,
  remainingShare: number,
  targetPercent: number,
): string {
  if (gap <= 0) {
    return `Performing at or above the ${targetPercent}% trajectory for this subject.`;
  }
  if (input.classification.target && !input.classification.target.attainable) {
    return `The target for this ${input.credits}-credit subject is no longer reachable; revise the target or protect the marks that remain.`;
  }
  const opportunity = Math.round(remainingShare * 100);
  return (
    `${input.credits}-credit subject running ${roundMark(gap)} points below its ` +
    `${targetPercent}% trajectory, with ${opportunity}% of the assessment weight ` +
    `still to come — the largest remaining opportunity to move your GPA.`
  );
}
