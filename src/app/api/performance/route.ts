import { withUser } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { buildOverview } from "@/lib/services/analytics";

/**
 * GET /api/performance — ongoing-subject performance, priorities and trends
 * (§24, §25, §28, §29).
 *
 * Ongoing subjects report a performance category and assessed marks. They never
 * report a grade (§18.1, BR-01, BR-13).
 */
export const GET = withUser(async (_request, { user }) => {
  const overview = await buildOverview(user.id);

  return ok({
    ongoing: overview.ongoingSubjects.map((subject) => ({
      subjectId: subject.id,
      name: subject.name,
      credits: subject.credits,
      category: subject.classification.category,
      status: subject.classification.status,
      label: subject.classification.label,
      reasons: subject.classification.reasons,
      trend: subject.classification.trend,
      earnedMarks: subject.progress.earnedMarks,
      completedWeight: subject.progress.completedWeight,
      remainingWeight: subject.progress.remainingWeight,
      assessedPercent: subject.progress.assessedPercent,
      targetFinalMark: subject.targetFinalMark,
      requirement: subject.requirement,
      relativeStanding: subject.relativeStanding,
    })),
    priorities: overview.priorities,
    strongest: overview.strongest,
    gpaTrend: overview.gpaTrend,
    cgpaProgression: overview.cgpaProgression,
  });
});
