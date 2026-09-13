/**
 * Explicit fixed-point rounding (§33, §39.2).
 *
 * Academic values are rounded deliberately at defined points rather than left
 * to whatever floating-point arithmetic produced, so the same inputs always
 * render the same number and stored results match displayed ones.
 */

/** Round half-away-from-zero to `places` decimals. */
export function round(value: number, places = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  const scaled = value * factor;
  // Correct for representations like 2.675 * 100 === 267.49999999999997.
  const corrected = Math.round(Number(scaled.toPrecision(12)));
  return corrected / factor;
}

/** Marks and weighted contributions: two decimals. */
export const roundMark = (value: number): number => round(value, 2);

/** GPA, CGPA and grade points: two decimals (§19, §20). */
export const roundGpa = (value: number): number => round(value, 2);

/** Percentages shown to the student: one decimal. */
export const roundPercent = (value: number): number => round(value, 1);

/** Clamp into a range; used for target marks that must stay within bounds. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
