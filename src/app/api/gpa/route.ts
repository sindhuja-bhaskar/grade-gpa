import { parseQuery, withUser } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { buildOverview } from "@/lib/services/analytics";
import { z } from "zod";

const querySchema = z.object({ semesterId: z.string().min(1).optional() });

/**
 * GET /api/gpa[?semesterId=] — official semester GPA (§19).
 *
 * A semester with no completed course reports `value: null`, which the UI shows
 * as "Not yet available" — never 0.00 (BR-22).
 */
export const GET = withUser(async (request, { user }) => {
  const { semesterId } = parseQuery(request, querySchema);
  const overview = await buildOverview(user.id);

  const semesters = semesterId
    ? overview.semesters.filter((semester) => semester.id === semesterId)
    : overview.semesters;

  return ok(
    semesters.map((semester) => ({
      semesterId: semester.id,
      label: semester.label,
      gpaTarget: semester.gpaTarget,
      gpa: semester.gpa,
      available: semester.gpa.value !== null,
    })),
  );
});
