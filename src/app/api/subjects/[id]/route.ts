import { parseBody, withUser, withPermission } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import { analyseSubjectForUser } from "@/lib/services/analytics";
import {
  deleteSubject,
  getSubject,
  updateSubject,
} from "@/lib/services/subjects";
import { subjectUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

/**
 * GET /api/subjects/{id} — the subject with its current analysis. An ongoing
 * subject carries a performance status, never a grade (§18.1, BR-01).
 */
export const GET = withUser<Params>(async (_request, { user, params }) => {
  const [subject, analysis] = await Promise.all([
    getSubject(user.id, params.id),
    analyseSubjectForUser(user.id, params.id),
  ]);
  return ok({ ...subject, analysis });
});

export const PUT = withPermission<Params>("records:write", async (request, { user, params }) => {
  const input = await parseBody(request, subjectUpdateSchema);
  return ok(await updateSubject(user.id, params.id, input));
});

export const DELETE = withPermission<Params>("records:write", async (_request, { user, params }) => {
  await deleteSubject(user.id, params.id);
  return noContent();
});
