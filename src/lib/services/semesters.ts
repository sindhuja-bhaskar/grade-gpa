import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import type {
  SemesterCreateInput,
  SemesterUpdateInput,
} from "@/lib/validation/schemas";
import { requireOwnedSemester } from "./ownership";

/** Semester CRUD (docs/reqs.md §9, §27, §30). */

export function listSemesters(userId: string) {
  return prisma.semester.findMany({
    where: { userId },
    orderBy: [{ academicYear: "asc" }, { semesterNumber: "asc" }],
    include: {
      subjects: { include: { assessments: { orderBy: { sequence: "asc" } } } },
    },
  });
}

export async function getSemester(userId: string, semesterId: string) {
  await requireOwnedSemester(userId, semesterId);
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: {
      subjects: { include: { assessments: { orderBy: { sequence: "asc" } } } },
    },
  });
  if (!semester) throw ApiError.notFound("Semester");
  return semester;
}

export async function createSemester(userId: string, input: SemesterCreateInput) {
  const duplicate = await prisma.semester.findFirst({
    where: {
      userId,
      academicYear: input.academicYear,
      semesterNumber: input.semesterNumber,
    },
    select: { id: true },
  });
  // §37: no duplicate semester entries for the same user.
  if (duplicate) {
    throw ApiError.conflict(
      `Semester ${input.semesterNumber} of ${input.academicYear} already exists.`,
    );
  }

  return prisma.semester.create({
    data: {
      userId,
      academicYear: input.academicYear,
      semesterNumber: input.semesterNumber,
      gpaTarget: input.gpaTarget ?? null,
    },
  });
}

export async function updateSemester(
  userId: string,
  semesterId: string,
  input: SemesterUpdateInput,
) {
  await requireOwnedSemester(userId, semesterId);
  return prisma.semester.update({
    where: { id: semesterId },
    data: {
      ...(input.academicYear === undefined
        ? {}
        : { academicYear: input.academicYear }),
      ...(input.semesterNumber === undefined
        ? {}
        : { semesterNumber: input.semesterNumber }),
      ...(input.gpaTarget === undefined ? {} : { gpaTarget: input.gpaTarget }),
    },
  });
}

export async function deleteSemester(userId: string, semesterId: string) {
  await requireOwnedSemester(userId, semesterId);
  // Subjects and their assessments cascade (§30.4).
  await prisma.semester.delete({ where: { id: semesterId } });
}
