/**
 * Assessment weightage configuration (docs/reqs.md §11, §36).
 *
 * These are DEFAULTS, not constants: §6.1 and §11.1 require the real university
 * scheme to be confirmed before it is relied on, and §36 requires weights to
 * live in configuration rather than inside calculation functions. Change the
 * tables here — no calculation code needs to be touched.
 */

import type { ComponentSpec, CourseScheme, CourseType } from "../types";

const THEORY_COMPONENTS: ComponentSpec[] = [
  {
    code: "CAT_I",
    label: "CAT-I",
    component: "THEORY",
    sequence: 1,
    maxMarks: 50,
    weight: 15,
    classAverageApplicable: true,
  },
  {
    code: "CAT_II",
    label: "CAT-II",
    component: "THEORY",
    sequence: 2,
    maxMarks: 50,
    weight: 15,
    classAverageApplicable: true,
  },
  {
    code: "ASSIGNMENT_1",
    label: "Assignment 1",
    component: "THEORY",
    sequence: 3,
    maxMarks: 10,
    weight: 10,
    // §14 / BR-08: assignments never require class-average information.
    classAverageApplicable: false,
  },
  {
    code: "ASSIGNMENT_2",
    label: "Assignment 2",
    component: "THEORY",
    sequence: 4,
    maxMarks: 10,
    weight: 10,
    classAverageApplicable: false,
  },
  {
    code: "ASSIGNMENT_3",
    label: "Assignment 3",
    component: "THEORY",
    sequence: 5,
    maxMarks: 10,
    weight: 10,
    classAverageApplicable: false,
  },
  {
    code: "FAT",
    label: "FAT",
    component: "THEORY",
    sequence: 6,
    maxMarks: 100,
    weight: 40,
    classAverageApplicable: true,
  },
];

const LAB_COMPONENTS: ComponentSpec[] = [
  {
    code: "LAB_CONTINUOUS",
    label: "Continuous Lab Assessment",
    component: "LAB",
    sequence: 1,
    maxMarks: 100,
    weight: 60,
    classAverageApplicable: true,
  },
  {
    code: "LAB_FAT",
    label: "Lab FAT",
    component: "LAB",
    sequence: 2,
    maxMarks: 100,
    weight: 40,
    classAverageApplicable: true,
    // §11.2: a minimum-mark requirement that is reported separately from, and
    // does not silently alter, the calculated grade.
    minimumMarkPercent: 50,
  },
];

/** Default theory/lab split for combined courses (§11.2, §17.3). */
export const DEFAULT_THEORY_LAB_SPLIT = { theory: 75, lab: 25 } as const;

export const COURSE_SCHEMES: Record<CourseType, CourseScheme> = {
  THEORY: {
    courseType: "THEORY",
    components: THEORY_COMPONENTS,
    split: { theory: 100, lab: 0 },
  },
  LABORATORY: {
    courseType: "LABORATORY",
    components: LAB_COMPONENTS,
    split: { theory: 0, lab: 100 },
  },
  THEORY_AND_LAB: {
    courseType: "THEORY_AND_LAB",
    components: [...THEORY_COMPONENTS, ...LAB_COMPONENTS],
    split: { ...DEFAULT_THEORY_LAB_SPLIT },
  },
};

export interface SchemeIssue {
  scheme: CourseType;
  message: string;
}

/**
 * §37: weightages for a given course type must sum to 100%. Validated at the
 * configuration level — each component group sums to 100 within itself, and the
 * theory/lab split sums to 100 across the groups.
 */
export function validateScheme(scheme: CourseScheme): SchemeIssue[] {
  const issues: SchemeIssue[] = [];
  const sumOf = (component: "THEORY" | "LAB") =>
    scheme.components
      .filter((c) => c.component === component)
      .reduce((total, c) => total + c.weight, 0);

  for (const component of ["THEORY", "LAB"] as const) {
    const present = scheme.components.some((c) => c.component === component);
    const share = component === "THEORY" ? scheme.split.theory : scheme.split.lab;
    if (!present && share > 0) {
      issues.push({
        scheme: scheme.courseType,
        message: `${component} carries ${share}% of the course but has no components`,
      });
      continue;
    }
    if (!present) continue;
    const sum = sumOf(component);
    if (Math.abs(sum - 100) > 0.001) {
      issues.push({
        scheme: scheme.courseType,
        message: `${component} component weights sum to ${sum}%, expected 100%`,
      });
    }
  }

  const splitSum = scheme.split.theory + scheme.split.lab;
  if (Math.abs(splitSum - 100) > 0.001) {
    issues.push({
      scheme: scheme.courseType,
      message: `theory/lab split sums to ${splitSum}%, expected 100%`,
    });
  }

  const codes = new Set<string>();
  for (const component of scheme.components) {
    if (codes.has(component.code)) {
      issues.push({
        scheme: scheme.courseType,
        message: `duplicate component code "${component.code}"`,
      });
    }
    codes.add(component.code);
    if (component.maxMarks <= 0) {
      issues.push({
        scheme: scheme.courseType,
        message: `component "${component.code}" has a non-positive maximum mark`,
      });
    }
  }

  return issues;
}

export function validateAllSchemes(): SchemeIssue[] {
  return Object.values(COURSE_SCHEMES).flatMap(validateScheme);
}

export function getScheme(courseType: CourseType): CourseScheme {
  return COURSE_SCHEMES[courseType];
}

/**
 * The components a course type requires. A subject is only "completed" once
 * every one of these has a recorded mark (§18.2, BR-21).
 */
export function requiredComponents(courseType: CourseType): ComponentSpec[] {
  return [...getScheme(courseType).components].sort(
    (a, b) => a.component.localeCompare(b.component) || a.sequence - b.sequence,
  );
}

export function findComponent(
  courseType: CourseType,
  code: string,
): ComponentSpec | undefined {
  return getScheme(courseType).components.find((c) => c.code === code);
}
