import { describe, expect, it } from "vitest";
import {
  markValue,
  number,
  optionalNumber,
  optionalText,
  text,
} from "../form";

function formWith(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

describe("form readers (§12, §37)", () => {
  it("distinguishes a blank mark from a mark of zero (BR-04, BR-05)", () => {
    const form = formWith({ blank: "", zero: "0", scored: "42.5" });

    // Blank clears the mark: the assessment goes back to "not available".
    expect(markValue(form, "blank")).toBeNull();
    // A typed zero is a real mark and must survive as 0, not become null.
    expect(markValue(form, "zero")).toBe(0);
    expect(markValue(form, "scored")).toBe(42.5);
    // A field the form never rendered is absent, not zero.
    expect(markValue(form, "missing")).toBeNull();
  });

  it("reports a missing required number as NaN, never as zero", () => {
    const form = formWith({ credits: "", target: "8.5" });

    // NaN makes the schema say "expected a number"; 0 would silently store a
    // subject worth no credits.
    expect(number(form, "credits")).toBeNaN();
    expect(number(form, "target")).toBe(8.5);
  });

  it("treats an empty optional field as absent", () => {
    const form = formWith({ code: "  ", strength: "", year: " 2025-26 " });

    expect(optionalText(form, "code")).toBeNull();
    expect(optionalNumber(form, "strength")).toBeNull();
    expect(text(form, "year")).toBe("2025-26");
  });

  it("keeps an optional zero, which is a value like any other", () => {
    const form = formWith({ weight: "0" });
    expect(optionalNumber(form, "weight")).toBe(0);
  });
});
