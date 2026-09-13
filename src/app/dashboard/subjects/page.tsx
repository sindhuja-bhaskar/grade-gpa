import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Notice } from "@/components/Notice";
import { SubjectForm } from "@/components/forms/SubjectForm";
import { getSessionUser } from "@/lib/auth/session";
import { buildOverview } from "@/lib/services/analytics";
import { createSubjectAction } from "../actions";

/**
 * Subject list and creation (docs/reqs.md §10, §27, §30).
 *
 * A subject is created with the full set of assessment components its course
 * type requires, all unrecorded — marks are then entered on the subject's own
 * page as they are released (§11).
 */
export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { removed } = await searchParams;

  const overview = await buildOverview(user.id);
  const semesterOptions = overview.semesters.map((semester) => ({
    id: semester.id,
    label: semester.label,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Open a subject to enter marks as its assessments are released.
      </p>

      {removed ? (
        <Notice>
          Subject deleted: <strong>{removed}</strong>, along with its assessments.
        </Notice>
      ) : null}

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Add a subject</h2>
        {semesterOptions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Add a{" "}
            <Link href="/dashboard/semesters" className="text-[var(--color-accent)]">
              semester
            </Link>{" "}
            first — every subject belongs to one.
          </p>
        ) : (
          <div className="mt-3">
            <SubjectForm
              action={createSubjectAction}
              submitLabel="Add subject"
              semesters={semesterOptions}
            />
          </div>
        )}
      </section>

      <div className="mt-8 space-y-8">
        {overview.semesters.length === 0 ? null : (
          overview.semesters.map((semester) => (
            <section key={semester.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{semester.label}</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  GPA:{" "}
                  {semester.gpa.value === null
                    ? "Not yet available"
                    : semester.gpa.value.toFixed(2)}
                </p>
              </div>

              <ul className="mt-3 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-white">
                {semester.subjects.length === 0 ? (
                  <li className="p-4 text-sm text-[var(--color-muted)]">
                    No subjects in this semester yet.
                  </li>
                ) : (
                  semester.subjects.map((subject) => (
                    <li
                      key={subject.id}
                      className="flex flex-wrap items-center gap-3 p-4"
                    >
                      <div className="min-w-48 flex-1">
                        <Link
                          href={`/dashboard/subjects/${subject.id}`}
                          className="font-medium text-[var(--color-accent)]"
                        >
                          {subject.name}
                        </Link>
                        <p className="text-xs text-[var(--color-muted)]">
                          {subject.credits} credits ·{" "}
                          {subject.courseType.toLowerCase().replace(/_/g, " ")} ·{" "}
                          {subject.gradingType.toLowerCase()} grading
                        </p>
                      </div>

                      {subject.official ? (
                        <span className="text-sm tabular-nums">
                          Final {subject.official.finalMark} · Grade{" "}
                          <strong>{subject.official.grade}</strong> (
                          {subject.official.gradePoint} points)
                        </span>
                      ) : (
                        <>
                          <span className="text-sm tabular-nums text-[var(--color-muted)]">
                            {subject.progress.completedWeight === 0
                              ? "No marks recorded"
                              : `${subject.progress.earnedMarks} / ${subject.progress.completedWeight} assessed`}
                          </span>
                          <CategoryBadge
                            category={subject.classification.category}
                            label={subject.classification.label}
                          />
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
