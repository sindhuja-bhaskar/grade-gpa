import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import {
  computeProgress,
  gradeForMark,
  requiredComponents,
  type CourseType,
} from "@/lib/academic";
import type {
  SubjectCreateInput,
  SubjectUpdateInput,
} from "@/lib/validation/schemas";
import { requireOwnedSemester, requireOwnedSubject } from "./ownership";
import { toSubjectInput, type SubjectWithAssessments } from "./mappers";

/** Subject CRUD and the ongoing → completed transition (§10, §18, §30, BR-21). */

const withAssessments = { assessments: { orderBy: { sequence: "asc" } } } as const;

export async function listSubjects(
  userId: string,
  filters: { semesterId?: string; status?: "ONGOING" | "COMPLETED" } = {},
): Promise<SubjectWithAssessments[]> {
  if (filters.semesterId) await requireOwnedSemester(userId, filters.semesterId);

  return prisma.subject.findMany({
    where: {
      semester: { userId, ...(filters.semesterId ? { id: filters.semesterId } : {}) },
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: withAssessments,
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getSubject(
  userId: string,
  subjectId: string,
): Promise<SubjectWithAssessments> {
  await requireOwnedSubject(userId, subjectId);
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: withAssessments,
  });
  if (!subject) throw ApiError.notFound("Subject");
  return subject;
}

/**
 * Creates a subject and, with it, the full set of assessments its course type
 * requires — all NOT_AVAILABLE until a mark is recorded (§11, §12). Weight and
 * maximum marks are copied from the scheme so later configuration changes do
 * not rewrite historical records (§27).
 */
export async function createSubject(
  userId: string,
  input: SubjectCreateInput,
): Promise<SubjectWithAssessments> {
  await requireOwnedSemester(userId, input.semesterId);

  return prisma.subject.create({
    data: {
      semesterId: input.semesterId,
      name: input.name,
      code: input.code ?? null,
      credits: input.credits,
      courseType: input.courseType,
      gradingType: input.gradingType,
      classStrength: input.classStrength ?? null,
      theoryWeightPercent: input.theoryWeightPercent ?? null,
      labWeightPercent: input.labWeightPercent ?? null,
      assessments: {
        create: requiredComponents(input.courseType).map((spec) => ({
          componentCode: spec.code,
          label: spec.label,
          component: spec.component,
          sequence: spec.sequence,
          maxMarks: spec.maxMarks,
          weight: spec.weight,
          status: "NOT_AVAILABLE" as const,
        })),
      },
    },
    include: withAssessments,
  });
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  input: SubjectUpdateInput,
): Promise<SubjectWithAssessments> {
  const existing = await getSubject(userId, subjectId);

  // Changing course type changes the whole assessment structure; recorded marks
  // would no longer map onto the new scheme, so it is refused while marks exist.
  if (input.courseType && input.courseType !== existing.courseType) {
    const recorded = existing.assessments.some(
        (assessment) => assessment.status === "AVAILABLE",
      );
    if (recorded) {
      throw ApiError.conflict(
        "Delete the recorded marks before changing this subject's course type — " +
          "the assessment structure differs between course types.",
      );
    }
    await replaceAssessments(subjectId, input.courseType);
  }

  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.credits === undefined ? {} : { credits: input.credits }),
      ...(input.courseType === undefined ? {} : { courseType: input.courseType }),
      ...(input.gradingType === undefined ? {} : { gradingType: input.gradingType }),
      ...(input.classStrength === undefined
        ? {}
        : { classStrength: input.classStrength }),
      ...(input.theoryWeightPercent === undefined
        ? {}
        : { theoryWeightPercent: input.theoryWeightPercent }),
      ...(input.labWeightPercent === undefined
        ? {}
        : { labWeightPercent: input.labWeightPercent }),
    },
  });

  return syncSubjectResult(subjectId);
}

export async function deleteSubject(
  userId: string,
  subjectId: string,
): Promise<void> {
  await requireOwnedSubject(userId, subjectId);
  // Assessments cascade with the subject (§30.4, documented in schema.prisma).
  await prisma.subject.delete({ where: { id: subjectId } });
}

async function replaceAssessments(subjectId: string, courseType: CourseType) {
  await prisma.assessment.deleteMany({ where: { subjectId } });
  await prisma.assessment.createMany({
    data: requiredComponents(courseType).map((spec) => ({
      subjectId,
      componentCode: spec.code,
      label: spec.label,
      component: spec.component,
      sequence: spec.sequence,
      maxMarks: spec.maxMarks,
      weight: spec.weight,
      status: "NOT_AVAILABLE" as const,
    })),
  });
}

/**
 * Recomputes a subject's official result after any change.
 *
 * The official grade is written only when every required component has a mark
 * (§18.2, BR-21); at any other time the grade fields are cleared, so a stale
 * grade can never be shown for an ongoing subject (BR-01).
 */
export async function syncSubjectResult(
  subjectId: string,
): Promise<SubjectWithAssessments> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: withAssessments,
  });
  if (!subject) throw ApiError.notFound("Subject");

  const progress = computeProgress(toSubjectInput(subject));

  if (progress.isComplete && progress.finalMark !== null) {
    const { grade, gradePoint } = gradeForMark(progress.finalMark);
    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        status: "COMPLETED",
        finalMark: progress.finalMark,
        grade,
        gradePoint,
        completedAt: subject.completedAt ?? new Date(),
      },
      include: withAssessments,
    });
  }

  if (subject.status === "COMPLETED" || subject.grade !== null) {
    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        status: "ONGOING",
        finalMark: null,
        grade: null,
        gradePoint: null,
        completedAt: null,
      },
      include: withAssessments,
    });
  }

  return subject;
}
