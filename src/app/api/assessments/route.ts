import { parseBody, parseQuery, withUser } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createAssessment, listAssessments } from "@/lib/services/assessments";
import {
  assessmentCreateSchema,
  assessmentQuerySchema,
} from "@/lib/validation/schemas";

/** GET /api/assessments[?subjectId=] — assessments and their marks (§13). */
export const GET = withUser(async (request, { user }) => {
  const { subjectId } = parseQuery(request, assessmentQuerySchema);
  return ok(await listAssessments(user.id, subjectId));
});

/** POST /api/assessments — restore a component of a subject's scheme (§11). */
export const POST = withUser(async (request, { user }) => {
  const input = await parseBody(request, assessmentCreateSchema);
  return created(await createAssessment(user.id, input));
});
