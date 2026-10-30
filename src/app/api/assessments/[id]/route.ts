import { parseBody, withUser, withPermission } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import {
  deleteAssessment,
  getAssessment,
  updateAssessment,
} from "@/lib/services/assessments";
import { assessmentUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const GET = withUser<Params>(async (_request, { user, params }) => {
  return ok(await getAssessment(user.id, params.id));
});

/**
 * PUT /api/assessments/{id} — record or clear a mark (§11, §12).
 *
 * `"studentMark": null` returns the assessment to NOT_AVAILABLE; `0` records a
 * mark of zero. Recording the final outstanding component completes the subject
 * and writes its official grade (BR-21).
 */
export const PUT = withPermission<Params>("records:write", async (request, { user, params }) => {
  const input = await parseBody(request, assessmentUpdateSchema);
  return ok(await updateAssessment(user.id, params.id, input));
});

export const DELETE = withPermission<Params>("records:write", async (_request, { user, params }) => {
  await deleteAssessment(user.id, params.id);
  return noContent();
});
