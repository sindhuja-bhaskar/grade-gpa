import "server-only";

import { prisma } from "@/lib/db";
import type { GoalCreateInput, GoalUpdateInput } from "@/lib/validation/schemas";
import { requireOwnedGoal, requireOwnedSemester } from "./ownership";

/** Academic goals (docs/reqs.md §21, §30). */

export function listGoals(userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
  });
}

export async function createGoal(userId: string, input: GoalCreateInput) {
  if (input.semesterId) await requireOwnedSemester(userId, input.semesterId);

  // One goal per scope: an overall CGPA target, and one target per semester.
  const existing = await prisma.goal.findFirst({
    where: {
      userId,
      scope: input.scope,
      semesterId: input.scope === "OVERALL" ? null : input.semesterId,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.goal.update({
      where: { id: existing.id },
      data: { targetValue: input.targetValue },
    });
  }

  return prisma.goal.create({
    data: {
      userId,
      scope: input.scope,
      targetValue: input.targetValue,
      semesterId: input.scope === "OVERALL" ? null : (input.semesterId ?? null),
    },
  });
}

export async function updateGoal(
  userId: string,
  goalId: string,
  input: GoalUpdateInput,
) {
  await requireOwnedGoal(userId, goalId);
  return prisma.goal.update({
    where: { id: goalId },
    data: { targetValue: input.targetValue },
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  await requireOwnedGoal(userId, goalId);
  await prisma.goal.delete({ where: { id: goalId } });
}
