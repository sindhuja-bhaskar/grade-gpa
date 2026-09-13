import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { findComponent } from "@/lib/academic";
import type {
  AssessmentCreateInput,
  AssessmentUpdateInput,
} from "@/lib/validation/schemas";
import { requireOwnedAssessment, requireOwnedSubject } from "./ownership";
import { syncSubjectResult } from "./subjects";

/**
 * Assessment entry (docs/reqs.md §11–§14, §37).
 *
 * The distinction this file enforces: `studentMark: null` means the assessment
 * has not happened or has not been released — it is NOT_AVAILABLE and earns
 * nothing. `studentMark: 0` is a mark the student actually received (BR-04,
 * BR-05). Clearing a mark sends the assessment back to NOT_AVAILABLE.
 */

export async function listAssessments(userId: string, subjectId?: string) {
  if (subjectId) await requireOwnedSubject(userId, subjectId);

  return prisma.assessment.findMany({
    where: {
      subject: { semester: { userId } },
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: [{ subjectId: "asc" }, { component: "asc" }, { sequence: "asc" }],
  });
}

export async function getAssessment(userId: string, assessmentId: string) {
  const assessment = await requireOwnedAssessment(userId, assessmentId);
  return prisma.assessment.findUniqueOrThrow({ where: { id: assessment.id } });
}

/**
 * Adds an assessment component to a subject. Components are created with the
 * subject, so this is for restoring one that was deleted — the component code
 * must still belong to the subject's course structure (§37).
 */
export async function createAssessment(
  userId: string,
  input: AssessmentCreateInput,
) {
  await requireOwnedSubject(userId, input.subjectId);
  const subject = await prisma.subject.findUniqueOrThrow({
    where: { id: input.subjectId },
    select: { courseType: true },
  });

  const spec = findComponent(subject.courseType, input.componentCode);
  if (!spec) {
    throw ApiError.validation(
      `"${input.componentCode}" is not part of the assessment structure for a ` +
        `${subject.courseType.toLowerCase().replace(/_/g, " ")} course.`,
    );
  }

  validateMarks(input, spec.maxMarks);

  const hasMark = typeof input.studentMark === "number";
  await prisma.assessment.create({
    data: {
      subjectId: input.subjectId,
      componentCode: spec.code,
      label: spec.label,
      component: spec.component,
      sequence: spec.sequence,
      maxMarks: spec.maxMarks,
      weight: spec.weight,
      studentMark: input.studentMark ?? null,
      classAverage: input.classAverage ?? null,
      standardDeviation: input.standardDeviation ?? null,
      status: hasMark ? "AVAILABLE" : "NOT_AVAILABLE",
      recordedAt: hasMark ? new Date() : null,
    },
  });

  await syncSubjectResult(input.subjectId);
  return getAssessmentBySubjectComponent(input.subjectId, spec.code);
}

export async function updateAssessment(
  userId: string,
  assessmentId: string,
  input: AssessmentUpdateInput,
) {
  const existing = await requireOwnedAssessment(userId, assessmentId);
  validateMarks(input, existing.maxMarks);

  const markProvided = "studentMark" in input;
  const nextMark = markProvided ? (input.studentMark ?? null) : existing.studentMark;
  const hasMark = typeof nextMark === "number";

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(markProvided
        ? {
            studentMark: nextMark,
            status: hasMark ? "AVAILABLE" : "NOT_AVAILABLE",
            recordedAt: hasMark ? (existing.recordedAt ?? new Date()) : null,
          }
        : {}),
      ...("classAverage" in input ? { classAverage: input.classAverage ?? null } : {}),
      ...("standardDeviation" in input
        ? { standardDeviation: input.standardDeviation ?? null }
        : {}),
    },
  });

  await syncSubjectResult(existing.subjectId);
  return prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
}

/** Clears a recorded mark, returning the assessment to NOT_AVAILABLE (§30.4). */
export async function deleteAssessment(userId: string, assessmentId: string) {
  const existing = await requireOwnedAssessment(userId, assessmentId);
  await prisma.assessment.delete({ where: { id: assessmentId } });
  await syncSubjectResult(existing.subjectId);
}

function validateMarks(
  input: AssessmentUpdateInput,
  maxMarks: number,
): void {
  const issues = [];

  if (typeof input.studentMark === "number" && input.studentMark > maxMarks) {
    issues.push({
      path: "studentMark",
      message: `The mark cannot exceed the maximum of ${maxMarks}.`,
    });
  }
  if (typeof input.classAverage === "number" && input.classAverage > maxMarks) {
    issues.push({
      path: "classAverage",
      message: `The class average cannot exceed the maximum of ${maxMarks}.`,
    });
  }

  if (issues.length > 0) {
    throw ApiError.validation("The submitted marks are not valid.", issues);
  }
}

function getAssessmentBySubjectComponent(subjectId: string, componentCode: string) {
  return prisma.assessment.findUniqueOrThrow({
    where: { subjectId_componentCode: { subjectId, componentCode } },
  });
}
