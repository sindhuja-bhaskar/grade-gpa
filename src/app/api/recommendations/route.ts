import { withUser } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { buildOverview } from "@/lib/services/analytics";

/**
 * GET /api/recommendations — rule-based recommendations (§26, BR-14).
 *
 * Predefined messages selected by predefined conditions, each returned with the
 * rule that produced it (§39.7). Subjects without enough data return an
 * explicit "insufficient data" entry rather than invented advice (BR-20).
 */
export const GET = withUser(async (_request, { user }) => {
  const overview = await buildOverview(user.id);
  return ok({
    recommendations: overview.recommendations,
    priorities: overview.priorities,
    targetPlan: overview.targetPlan,
  });
});
