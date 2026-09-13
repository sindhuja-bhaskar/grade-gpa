/**
 * Rule-based recommendation engine (docs/reqs.md §26).
 *
 * Predefined messages selected by predefined conditions — not a chatbot, not a
 * model (BR-14, §5.2). Every recommendation carries the rule that produced it
 * so the UI can explain itself (§39.7).
 */

import type { Classification } from "./classify";
import type { PerformanceCategory, SubjectProgress } from "./types";

export type RecommendationCode =
  | PerformanceCategory
  | "IMPROVING"
  | "DECLINING"
  | "TARGET_UNREACHABLE"
  | "MINIMUM_MARK_AT_RISK"
  | "INSUFFICIENT_DATA";

export interface Recommendation {
  code: RecommendationCode;
  message: string;
  /** The rule that fired, for display alongside the message (§39.7). */
  basis: string;
}

/** Messages for each performance category, quoted from §26. */
export const CATEGORY_MESSAGES: Record<PerformanceCategory, string> = {
  EXCELLENT:
    "Your performance in this subject is excellent. Maintain your current level.",
  STRONG:
    "You are performing strongly in this subject. Maintain your current performance.",
  ON_TRACK: "Your current performance is on track for your target.",
  NEEDS_ATTENTION:
    "This subject requires additional attention to maintain your target.",
  NEEDS_IMPROVEMENT:
    "Your current performance is below your target trajectory. Consider prioritizing this subject.",
  HIGH_RISK:
    "Your current performance places your target at risk. This subject should receive higher attention.",
};

export const TREND_MESSAGES = {
  IMPROVING:
    "Your performance in this subject has improved compared with previous assessments.",
  DECLINING:
    "Your performance in this subject has slipped compared with previous assessments.",
} as const;

/**
 * Recommendations for one subject. Returns an empty-but-explicit result when
 * there is not enough data: §26 requires recommendations only where data
 * supports them.
 */
export function recommendForSubject(
  classification: Classification,
  progress: SubjectProgress,
): Recommendation[] {
  if (classification.status === "AWAITING_DATA" || classification.category === null) {
    return [
      {
        code: "INSUFFICIENT_DATA",
        message:
          "Record a mark for at least one assessment to receive recommendations for this subject.",
        basis: "No assessment recorded.",
      },
    ];
  }

  const recommendations: Recommendation[] = [
    {
      code: classification.category,
      message: CATEGORY_MESSAGES[classification.category],
      basis: classification.reasons[0] ?? "Performance category.",
    },
  ];

  if (classification.trend === "IMPROVING" || classification.trend === "DECLINING") {
    recommendations.push({
      code: classification.trend,
      message: TREND_MESSAGES[classification.trend],
      basis: "Compared with earlier assessments in this subject.",
    });
  }

  if (classification.target && !classification.target.attainable) {
    recommendations.push({
      code: "TARGET_UNREACHABLE",
      message:
        `A final mark of ${classification.target.targetFinalMark} can no longer be ` +
        `reached in this subject. The highest still achievable is ` +
        `${progress.maxAchievableFinalMark}. Consider revising the target for this subject.`,
      basis: "Required marks exceed the marks still available.",
    });
  }

  for (const component of progress.components) {
    if (component.minimumMarkMet === false) {
      recommendations.push({
        code: "MINIMUM_MARK_AT_RISK",
        message:
          `${component.label} is below its minimum requirement of ` +
          `${component.minimumMarkPercent}%. This requirement is assessed separately from your grade.`,
        basis: "Minimum-mark component below threshold.",
      });
    }
  }

  return recommendations;
}
