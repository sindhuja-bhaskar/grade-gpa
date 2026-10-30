import { parseBody, withUser, withPermission } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/respond";
import { createSemester, listSemesters } from "@/lib/services/semesters";
import { semesterCreateSchema } from "@/lib/validation/schemas";

/** GET /api/semesters — every semester belonging to the student (§9, §27). */
export const GET = withUser(async (_request, { user }) => {
  return ok(await listSemesters(user.id));
});

/** POST /api/semesters — add a semester, including a past one (§27, BR-11). */
export const POST = withPermission("records:write", async (request, { user }) => {
  const input = await parseBody(request, semesterCreateSchema);
  return created(await createSemester(user.id, input));
});
