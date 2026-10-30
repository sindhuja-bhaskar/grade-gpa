import { parseBody, parseQuery, withUser, withPermission } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createSubject, listSubjects } from "@/lib/services/subjects";
import { subjectCreateSchema, subjectQuerySchema } from "@/lib/validation/schemas";

/** GET /api/subjects[?semesterId=&status=] — the student's subjects (§10, §30.2). */
export const GET = withUser(async (request, { user }) => {
  const query = parseQuery(request, subjectQuerySchema);
  return ok(await listSubjects(user.id, query));
});

/**
 * POST /api/subjects — create a subject. Its assessment components are created
 * with it, all NOT_AVAILABLE until marks are entered (§11, §12).
 */
export const POST = withPermission("records:write", async (request, { user }) => {
  const input = await parseBody(request, subjectCreateSchema);
  return created(await createSubject(user.id, input));
});
