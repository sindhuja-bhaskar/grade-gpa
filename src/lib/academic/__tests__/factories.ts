import { requiredComponents } from "../config/schemes";
import type { AssessmentInput, CourseType, SubjectInput } from "../types";

/** Marks keyed by component code; anything omitted stays NOT_AVAILABLE. */
export type MarkMap = Record<
  string,
  number | { mark: number; classAverage?: number; standardDeviation?: number }
>;

export function makeSubject(
  courseType: CourseType,
  marks: MarkMap = {},
  overrides: Partial<SubjectInput> = {},
): SubjectInput {
  const assessments: AssessmentInput[] = requiredComponents(courseType).map(
    (spec) => {
      const entry = marks[spec.code];
      const recorded =
        typeof entry === "number" ? { mark: entry } : entry ?? undefined;
      return {
        componentCode: spec.code,
        label: spec.label,
        component: spec.component,
        sequence: spec.sequence,
        maxMarks: spec.maxMarks,
        weight: spec.weight,
        status: recorded ? "AVAILABLE" : "NOT_AVAILABLE",
        studentMark: recorded ? recorded.mark : null,
        classAverage: recorded?.classAverage ?? null,
        standardDeviation: recorded?.standardDeviation ?? null,
      };
    },
  );

  return {
    id: "subject-1",
    name: "Computer Networks",
    credits: 3,
    courseType,
    gradingType: "ABSOLUTE",
    assessments,
    ...overrides,
  };
}

/** Every component at the same percentage — useful for split arithmetic. */
export function marksAtPercent(
  courseType: CourseType,
  percentByComponent: { THEORY?: number; LAB?: number },
): MarkMap {
  const marks: MarkMap = {};
  for (const spec of requiredComponents(courseType)) {
    const percent = percentByComponent[spec.component];
    if (percent === undefined) continue;
    marks[spec.code] = (percent / 100) * spec.maxMarks;
  }
  return marks;
}
