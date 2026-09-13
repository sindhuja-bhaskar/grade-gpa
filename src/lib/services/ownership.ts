import "server-only";

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * Ownership checks (docs/reqs.md §8.2, BR-19, §35.10).
 *
 * Every record is reached through its owner. A record that exists but belongs
 * to someone else returns 403, distinct from 404 and from the 401 an
 * unauthenticated request gets (§31).
 */

export async function requireOwnedSemester(userId: string, semesterId: string) {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { id: true, userId: true },
  });
  if (!semester) throw ApiError.notFound("Semester");
  if (semester.userId !== userId) throw ApiError.forbidden();
  return semester;
}

export async function requireOwnedSubject(userId: string, subjectId: string) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, semester: { select: { userId: true } } },
  });
  if (!subject) throw ApiError.notFound("Subject");
  if (subject.semester.userId !== userId) throw ApiError.forbidden();
  return subject;
}

export async function requireOwnedAssessment(
  userId: string,
  assessmentId: string,
) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { subject: { select: { id: true, semester: { select: { userId: true } } } } },
  });
  if (!assessment) throw ApiError.notFound("Assessment");
  if (assessment.subject.semester.userId !== userId) throw ApiError.forbidden();
  return assessment;
}

export async function requireOwnedGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, userId: true },
  });
  if (!goal) throw ApiError.notFound("Goal");
  if (goal.userId !== userId) throw ApiError.forbidden();
  return goal;
}
