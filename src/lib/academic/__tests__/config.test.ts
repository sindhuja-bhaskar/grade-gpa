import { describe, expect, it } from "vitest";
import {
  COURSE_SCHEMES,
  GRADE_BANDS,
  validateAllSchemes,
  validateScheme,
} from "../config";

describe("scheme configuration (§11, §37)", () => {
  it("every shipped scheme has component weights summing to 100%", () => {
    expect(validateAllSchemes()).toEqual([]);
  });

  it("rejects a scheme whose weights do not sum to 100%", () => {
    const broken = {
      ...COURSE_SCHEMES.THEORY,
      components: COURSE_SCHEMES.THEORY.components.slice(0, 2),
    };
    const issues = validateScheme(broken);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/sum to 30%/);
  });

  it("rejects a theory/lab split that does not sum to 100%", () => {
    const issues = validateScheme({
      ...COURSE_SCHEMES.THEORY_AND_LAB,
      split: { theory: 75, lab: 20 },
    });
    expect(issues.some((i) => i.message.includes("split sums to 95%"))).toBe(true);
  });

  it("grade bands are ordered high to low and end at F/0", () => {
    const marks = GRADE_BANDS.map((b) => b.minMark);
    expect([...marks].sort((a, b) => b - a)).toEqual(marks);
    expect(GRADE_BANDS.at(-1)).toMatchObject({ grade: "F", gradePoint: 0 });
  });
});
