import type { PerformanceCategory } from "@/lib/academic";

/**
 * A performance category is not a grade (§24, BR-13). The badge always reads as
 * a status ("Strong Performance"), never as a letter.
 */
const TONE: Record<PerformanceCategory, string> = {
  EXCELLENT: "bg-teal-50 text-[var(--color-excellent)] border-teal-200",
  STRONG: "bg-green-50 text-[var(--color-strong)] border-green-200",
  ON_TRACK: "bg-blue-50 text-[var(--color-ontrack)] border-blue-200",
  NEEDS_ATTENTION: "bg-amber-50 text-[var(--color-attention)] border-amber-200",
  NEEDS_IMPROVEMENT: "bg-orange-50 text-[var(--color-improvement)] border-orange-200",
  HIGH_RISK: "bg-red-50 text-[var(--color-risk)] border-red-200",
};

export function CategoryBadge({
  category,
  label,
}: {
  category: PerformanceCategory | null;
  label: string;
}) {
  const tone = category
    ? TONE[category]
    : "bg-slate-50 text-[var(--color-muted)] border-[var(--color-line)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
