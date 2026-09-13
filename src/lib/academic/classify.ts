/**
 * Performance classification (docs/reqs.md §24).
 *
 * A category is not a grade (BR-13) and is never produced for a subject with
 * nothing recorded: with no data there is nothing to classify, and inventing a
 * category would be exactly the fabrication BR-20 forbids. Such a subject is
 * reported as AWAITING_DATA instead.
 */

import {
  CATEGORY_BANDS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TARGET_RULES,
  TREND_SENSITIVITY_PERCENT,
} from "./config/performance";
import { requiredMarksForTarget } from "./planning";
import type { PerformanceCategory, SubjectProgress } from "./types";

export type Trend = "IMPROVING" | "STEADY" | "DECLINING";

export interface ClassificationInput {
  progress: SubjectProgress;
  /** Target final mark out of 100, when the student has set one (§21). */
  targetFinalMark?: number | null;
  /** Percentage scored earlier in the subject, for trend detection (§26, §28). */
  previousAssessedPercent?: number | null;
}

export interface Classification {
  /** Null only when no assessment has been recorded yet. */
  category: PerformanceCategory | null;
  status: "CLASSIFIED" | "AWAITING_DATA";
  label: string;
  assessedPercent: number | null;
  /** Plain-language rules that produced this category (§39.7). */
  reasons: string[];
  trend: Trend | null;
  target: {
    targetFinalMark: number;
    requiredPercent: number | null;
    attainable: boolean;
    alreadySecured: boolean;
  } | null;
}

function categoryForPercent(percent: number): PerformanceCategory {
  const band =
    CATEGORY_BANDS.find((candidate) => percent >= candidate.minAssessedPercent) ??
    CATEGORY_BANDS[CATEGORY_BANDS.length - 1]!;
  return band.category;
}

/** Move `steps` places down the category order, stopping at HIGH_RISK. */
function demote(category: PerformanceCategory, steps: number): PerformanceCategory {
  const index = CATEGORY_ORDER.indexOf(category);
  return CATEGORY_ORDER[Math.min(index + steps, CATEGORY_ORDER.length - 1)]!;
}

/** Never worse than `floor`. */
function atLeast(
  category: PerformanceCategory,
  floor: PerformanceCategory,
): PerformanceCategory {
  return CATEGORY_ORDER.indexOf(category) > CATEGORY_ORDER.indexOf(floor)
    ? floor
    : category;
}

export function classifySubject(input: ClassificationInput): Classification {
  const { progress, targetFinalMark, previousAssessedPercent } = input;

  if (progress.assessedPercent === null) {
    return {
      category: null,
      status: "AWAITING_DATA",
      label: "Awaiting first assessment",
      assessedPercent: null,
      reasons: [
        "No assessment has been recorded yet, so there is nothing to classify.",
      ],
      trend: null,
      target: null,
    };
  }

  const assessedPercent = progress.assessedPercent;
  const reasons: string[] = [];
  let category = categoryForPercent(assessedPercent);
  reasons.push(
    `Scored ${assessedPercent}% of the ${progress.completedWeight} marks assessed so far.`,
  );

  let target: Classification["target"] = null;
  if (typeof targetFinalMark === "number") {
    const requirement = requiredMarksForTarget(progress, targetFinalMark);
    target = {
      targetFinalMark,
      requiredPercent: requirement.requiredPercent,
      attainable: requirement.attainable,
      alreadySecured: requirement.alreadySecured,
    };

    if (requirement.alreadySecured) {
      category = atLeast(category, TARGET_RULES.securedFloor);
      reasons.push(`A final mark of ${targetFinalMark} is already secured.`);
    } else if (!requirement.attainable) {
      category = "HIGH_RISK";
      reasons.push(
        `A final mark of ${targetFinalMark} is no longer reachable — at most ` +
          `${progress.maxAchievableFinalMark} remains achievable.`,
      );
    } else if (
      requirement.requiredPercent !== null &&
      requirement.requiredPercent >= TARGET_RULES.severeRequiredPercent
    ) {
      category = demote(category, 2);
      reasons.push(
        `Reaching ${targetFinalMark} now needs ${requirement.requiredPercent}% ` +
          `of every remaining assessment.`,
      );
    } else if (
      requirement.requiredPercent !== null &&
      requirement.requiredPercent >= TARGET_RULES.demandingRequiredPercent
    ) {
      category = demote(category, 1);
      reasons.push(
        `Reaching ${targetFinalMark} needs ${requirement.requiredPercent}% of ` +
          `the remaining assessments, which leaves little margin.`,
      );
    } else if (requirement.requiredPercent !== null) {
      reasons.push(
        `Reaching ${targetFinalMark} needs ${requirement.requiredPercent}% of ` +
          `the remaining assessments.`,
      );
    }
  }

  const trend = detectTrend(assessedPercent, previousAssessedPercent);
  if (trend === "IMPROVING") {
    reasons.push("Performance has improved compared with earlier assessments.");
  } else if (trend === "DECLINING") {
    reasons.push("Performance has slipped compared with earlier assessments.");
  }

  return {
    category,
    status: "CLASSIFIED",
    label: CATEGORY_LABELS[category],
    assessedPercent,
    reasons,
    trend,
    target,
  };
}

export function detectTrend(
  current: number | null,
  previous: number | null | undefined,
): Trend | null {
  if (current === null || previous === null || previous === undefined) return null;
  const delta = current - previous;
  if (delta > TREND_SENSITIVITY_PERCENT) return "IMPROVING";
  if (delta < -TREND_SENSITIVITY_PERCENT) return "DECLINING";
  return "STEADY";
}
