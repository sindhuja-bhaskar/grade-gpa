import { parseBody, withPermission } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { deleteGoal, updateGoal } from "@/lib/services/goals";
import { goalUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const PUT = withPermission<Params>("records:write", async (request, { user, params }) => {
  const input = await parseBody(request, goalUpdateSchema);
  return ok(await updateGoal(user.id, params.id, input));
});

export const DELETE = withPermission<Params>("records:write", async (_request, { user, params }) => {
  await deleteGoal(user.id, params.id);
  return noContent();
});
