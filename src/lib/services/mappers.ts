import "server-only";

import type { Assessment, Subject } from "@/generated/prisma/client";
import type { AssessmentInput, SubjectInput } from "@/lib/academic";

/**
 * Database rows → calculation-engine inputs (docs/reqs.md §36).
 *
 * The engine never imports Prisma; this is the single translation point, so a
 * schema change stays out of the academic rules.
 */

export type SubjectWithAssessments = Subject & { assessments: Assessment[] };

export function toAssessmentInput(row: Assessment): AssessmentInput {
  return {
    componentCode: row.componentCode,
    label: row.label,
    component: row.component,
    sequence: row.sequence,
    maxMarks: row.maxMarks,
    weight: row.weight,
    status: row.status,
    studentMark: row.studentMark,
    classAverage: row.classAverage,
    standardDeviation: row.standardDeviation,
  };
}

export function toSubjectInput(row: SubjectWithAssessments): SubjectInput {
  return {
    id: row.id,
    name: row.name,
    credits: row.credits,
    courseType: row.courseType,
    gradingType: row.gradingType,
    classStrength: row.classStrength,
    theoryWeightPercent: row.theoryWeightPercent,
    labWeightPercent: row.labWeightPercent,
    assessments: row.assessments.map(toAssessmentInput),
  };
}
