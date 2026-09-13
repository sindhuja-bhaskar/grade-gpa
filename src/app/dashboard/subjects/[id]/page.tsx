import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DeleteForm } from "@/components/forms/DeleteForm";
import { MarkGrid, type MarkRow } from "@/components/forms/MarkGrid";
import { SubjectForm } from "@/components/forms/SubjectForm";
import { findComponent } from "@/lib/academic";
import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { analyseSubjectForUser } from "@/lib/services/analytics";
import { getSubject } from "@/lib/services/subjects";
import {
  deleteSubjectAction,
  saveMarksAction,
  updateSubjectAction,
} from "../../actions";

/**
 * One subject: mark entry, current standing, editing and deletion
 * (docs/reqs.md §11–§14, §18, §23, §30).
 *
 * The page is careful about one thing above all: while the subject is ongoing
 * it shows assessed marks and a performance status, and no grade anywhere
 * (§18.1, BR-01). The grade appears only once every component is recorded.
 */
export default async function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  let subject;
  let analysis;
  try {
    [subject, analysis] = await Promise.all([
      getSubject(user.id, id),
      analyseSubjectForUser(user.id, id),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const rows: MarkRow[] = subject.assessments.map((assessment) => ({
    assessmentId: assessment.id,
    label: assessment.label,
    component: assessment.component,
    maxMarks: assessment.maxMarks,
    weight: assessment.weight,
    studentMark: assessment.studentMark,
    classAverage: assessment.classAverage,
    standardDeviation: assessment.standardDeviation,
    classAverageApplicable:
      findComponent(subject.courseType, assessment.componentCode)
        ?.classAverageApplicable ?? true,
  }));

  const hasRecordedMarks = subject.assessments.some(
    (assessment) => assessment.status === "AVAILABLE",
  );
  const { progress, classification, requirement, official } = analysis;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/dashboard/subjects" className="text-sm text-[var(--color-accent)]">
        ← All subjects
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {subject.code ? `${subject.code} · ` : ""}
            {subject.credits} credits ·{" "}
            {subject.courseType.toLowerCase().replace(/_/g, " ")} ·{" "}
            {subject.gradingType.toLowerCase()} grading
          </p>
        </div>
        {official ? (
          <div className="text-right">
            <p className="text-sm text-[var(--color-muted)]">Official result</p>
            <p className="text-lg font-semibold tabular-nums">
              {official.finalMark} · {official.grade} ({official.gradePoint} points)
            </p>
          </div>
        ) : (
          <CategoryBadge
            category={classification.category}
            label={classification.label}
          />
        )}
      </header>

      {!official ? (
        <section className="mt-5 rounded-xl border border-[var(--color-line)] bg-white p-5">
          <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <Figure
              label="Earned so far"
              value={
                progress.completedWeight === 0
                  ? "Nothing assessed yet"
                  : `${progress.earnedMarks} / ${progress.completedWeight}`
              }
            />
            <Figure label="Weight remaining" value={String(progress.remainingWeight)} />
            <Figure
              label="Highest still reachable"
              value={String(progress.maxAchievableFinalMark)}
            />
          </div>

          {classification.reasons.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-[var(--color-line)] pt-4 text-sm text-[var(--color-muted)]">
              {classification.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}

          {requirement && requirement.targets.length > 0 ? (
            <div className="mt-4 border-t border-[var(--color-line)] pt-4 text-sm">
              <p className="font-medium">
                To finish on {requirement.neededFromRemaining > 0 ? "target" : "target"}
                {analysis.targetFinalMark !== null
                  ? ` (${analysis.targetFinalMark} out of 100)`
                  : ""}
                :
              </p>
              <ul className="mt-2 space-y-1 text-[var(--color-muted)]">
                {requirement.targets.map((target) => (
                  <li key={target.componentCode}>
                    {target.label}: aim for{" "}
                    <span className="tabular-nums text-[var(--color-ink)]">
                      {target.range.low}–{target.range.high} / {target.maxMarks}
                    </span>
                    {target.exceedsMaximum ? " — beyond what this assessment can give" : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {requirement.explanation}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Assessment marks</h2>
        <div className="mt-3">
          <MarkGrid action={saveMarksAction.bind(null, subject.id)} rows={rows} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Subject details</h2>
        <div className="mt-3">
          <SubjectForm
            action={updateSubjectAction.bind(null, subject.id)}
            submitLabel="Save changes"
            lockCourseType={hasRecordedMarks}
            defaults={{
              name: subject.name,
              code: subject.code,
              credits: subject.credits,
              courseType: subject.courseType,
              gradingType: subject.gradingType,
              classStrength: subject.classStrength,
              theoryWeightPercent: subject.theoryWeightPercent,
              labWeightPercent: subject.labWeightPercent,
            }}
          />
        </div>

        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <DeleteForm
            action={deleteSubjectAction.bind(null, subject.id)}
            label="Delete subject"
            confirm={
              `Delete ${subject.name}?\n\n` +
              `Its ${subject.assessments.length} assessment components and any marks ` +
              `recorded against them will be deleted too. This cannot be undone.`
            }
          />
        </div>
      </section>
    </main>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-1 tabular-nums">{value}</p>
    </div>
  );
}
