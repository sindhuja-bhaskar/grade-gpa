import { parseBody, withUser } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createGoal, listGoals } from "@/lib/services/goals";
import { goalCreateSchema } from "@/lib/validation/schemas";

/** GET /api/goals — semester GPA targets and the overall CGPA target (§21). */
export const GET = withUser(async (_request, { user }) => {
  return ok(await listGoals(user.id));
});

/** POST /api/goals — set (or replace) a target for a scope (§21). */
export const POST = withUser(async (request, { user }) => {
  const input = await parseBody(request, goalCreateSchema);
  return created(await createGoal(user.id, input));
});
