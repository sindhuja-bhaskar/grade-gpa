/**
 * Performance-category thresholds and priority weights (docs/reqs.md §24, §25).
 *
 * §24 requires these thresholds to be explicit and testable rather than buried
 * in the classifier, and §39.7 requires every category to be explainable.
 */

import type { PerformanceCategory } from "../types";

export interface CategoryBand {
  category: PerformanceCategory;
  /** Inclusive lower bound of the percentage scored on assessed work. */
  minAssessedPercent: number;
  label: string;
}

export const CATEGORY_BANDS: CategoryBand[] = [
  { category: "EXCELLENT", minAssessedPercent: 90, label: "Excellent Performance" },
  { category: "STRONG", minAssessedPercent: 80, label: "Strong Performance" },
  { category: "ON_TRACK", minAssessedPercent: 70, label: "On Track" },
  { category: "NEEDS_ATTENTION", minAssessedPercent: 60, label: "Needs Attention" },
  { category: "NEEDS_IMPROVEMENT", minAssessedPercent: 50, label: "Needs Improvement" },
  { category: "HIGH_RISK", minAssessedPercent: 0, label: "High Risk" },
];

/** Order used when a rule needs to demote a category by one or more steps. */
export const CATEGORY_ORDER: PerformanceCategory[] = CATEGORY_BANDS.map(
  (band) => band.category,
);

export const CATEGORY_LABELS: Record<PerformanceCategory, string> =
  Object.fromEntries(
    CATEGORY_BANDS.map((band) => [band.category, band.label]),
  ) as Record<PerformanceCategory, string>;

/**
 * Target-aware adjustments (§24: the category "may consider target
 * requirements ... remaining assessment weight").
 */
export const TARGET_RULES = {
  /** Required average on remaining work above this is treated as at risk. */
  demandingRequiredPercent: 90,
  /** ...and above this, as seriously at risk. */
  severeRequiredPercent: 95,
  /** A target already secured by earned marks cannot be classified as at risk. */
  securedFloor: "ON_TRACK" as PerformanceCategory,
} as const;

/** Weights used to rank subjects needing attention (§25). */
export const PRIORITY_WEIGHTS = {
  /** How far short of target the subject currently sits. */
  targetGap: 1.0,
  /** Credits carry more consequence for GPA, so they raise priority. */
  credits: 0.35,
  /** Weight still unassessed — how much can still be changed. */
  remainingOpportunity: 0.25,
} as const;

/** Below this percentage, a trend counts as improving/declining (§26, §28). */
export const TREND_SENSITIVITY_PERCENT = 2;
