import { parseQuery, withUser } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { requiredGpaForTarget } from "@/lib/academic";
import { buildOverview } from "@/lib/services/analytics";
import { planningQuerySchema } from "@/lib/validation/schemas";

/**
 * GET /api/cgpa[?targetCgpa=&futureCredits=] — official CGPA, and the GPA a
 * target CGPA would require (§20, §22).
 *
 * `targetCgpa` overrides the saved goal for a what-if calculation;
 * `futureCredits` overrides the credits currently in progress.
 */
export const GET = withUser(async (request, { user }) => {
  const query = parseQuery(request, planningQuerySchema);
  const overview = await buildOverview(user.id);

  const targetCgpa = query.targetCgpa ?? overview.targetPlan?.targetCgpa ?? null;
  const futureCredits =
    query.futureCredits ?? overview.targetPlan?.futureCredits ?? 0;

  return ok({
    cgpa: overview.cgpa,
    available: overview.cgpa.value !== null,
    progression: overview.cgpaProgression,
    plan:
      targetCgpa === null
        ? null
        : {
            targetCgpa,
            futureCredits,
            result: requiredGpaForTarget({
              currentGradePoints: overview.cgpa.totalGradePoints,
              completedCredits: overview.cgpa.totalCredits,
              futureCredits,
              targetCgpa,
            }),
          },
  });
});
