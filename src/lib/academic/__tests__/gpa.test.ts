import { describe, expect, it } from "vitest";
import { cgpaProgression, computeGpa, gpaBySemester } from "../gpa";

describe("GPA and CGPA (§19, §20, BR-22)", () => {
  it("weights grade points by credits", () => {
    const result = computeGpa([
      { credits: 3, gradePoint: 9 },
      { credits: 4, gradePoint: 8 },
      { credits: 3, gradePoint: 10 },
    ]);

    // (27 + 32 + 30) / 10 = 8.9
    expect(result.value).toBe(8.9);
    expect(result.totalCredits).toBe(10);
    expect(result.totalGradePoints).toBe(89);
  });

  it("is 'not yet available', not 0.00, with no completed courses (BR-22)", () => {
    const result = computeGpa([]);

    expect(result.value).toBeNull();
    expect(result.completedCourses).toBe(0);
  });

  it("counts a genuine F as zero grade points", () => {
    const result = computeGpa([
      { credits: 3, gradePoint: 0 },
      { credits: 3, gradePoint: 10 },
    ]);

    expect(result.value).toBe(5);
  });

  it("reports GPA per semester and a running CGPA (§28)", () => {
    const semesters = [
      { key: "s1", label: "Semester 1", courses: [{ credits: 4, gradePoint: 8 }] },
      { key: "s2", label: "Semester 2", courses: [{ credits: 4, gradePoint: 10 }] },
      { key: "s3", label: "Semester 3", courses: [] },
    ];

    expect(gpaBySemester(semesters).map((s) => s.gpa.value)).toEqual([8, 10, null]);
    // Semester 3 has nothing completed, so the CGPA carries forward.
    expect(cgpaProgression(semesters).map((s) => s.cgpa)).toEqual([8, 9, 9]);
  });
});
