import { parseBody, withUser } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/respond";
import {
  deleteSemester,
  getSemester,
  updateSemester,
} from "@/lib/services/semesters";
import { semesterUpdateSchema } from "@/lib/validation/schemas";

type Params = { id: string };

export const GET = withUser<Params>(async (_request, { user, params }) => {
  return ok(await getSemester(user.id, params.id));
});

export const PUT = withUser<Params>(async (request, { user, params }) => {
  const input = await parseBody(request, semesterUpdateSchema);
  return ok(await updateSemester(user.id, params.id, input));
});

/** Deletes the semester and cascades to its subjects and assessments (§30.4). */
export const DELETE = withUser<Params>(async (_request, { user, params }) => {
  await deleteSemester(user.id, params.id);
  return noContent();
});
