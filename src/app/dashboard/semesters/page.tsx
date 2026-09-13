import Link from "next/link";
import { computeGpa } from "@/lib/academic";
import { getSessionUser } from "@/lib/auth/session";
import { listSemesters } from "@/lib/services/semesters";
import { DeleteForm } from "@/components/forms/DeleteForm";
import { Notice } from "@/components/Notice";
import { SemesterForm } from "@/components/forms/SemesterForm";
import { redirect } from "next/navigation";
import {
  createSemesterAction,
  deleteSemesterAction,
  updateSemesterAction,
} from "../actions";

/**
 * Semester CRUD (docs/reqs.md §9, §27, §30).
 *
 * Semesters are the top of the academic hierarchy, so this is where a student
 * starts — including entering semesters they have already finished (BR-11).
 */
export default async function SemestersPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { removed } = await searchParams;

  const semesters = await listSemesters(user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Semesters</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Add the semester you are in now, and any earlier ones you want on record.
      </p>

      {removed ? (
        <Notice>
          Semester deleted: <strong>{removed}</strong>, along with its subjects
          and their assessment marks.
        </Notice>
      ) : null}

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Add a semester</h2>
        <div className="mt-3">
          <SemesterForm action={createSemesterAction} submitLabel="Add semester" />
        </div>
      </section>

      <section className="mt-6 space-y-4">
        {semesters.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No semesters yet. Add one above to start recording subjects.
          </p>
        ) : (
          semesters.map((semester) => {
            const completed = semester.subjects
              .filter((subject) => subject.gradePoint !== null)
              .map((subject) => ({
                credits: subject.credits,
                gradePoint: subject.gradePoint!,
              }));
            const gpa = computeGpa(completed);

            return (
              <article
                key={semester.id}
                className="rounded-xl border border-[var(--color-line)] bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">
                    Semester {semester.semesterNumber} ({semester.academicYear})
                  </h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    {semester.subjects.length} subject(s) · GPA{" "}
                    {gpa.value === null ? "not yet available" : gpa.value.toFixed(2)}
                  </p>
                </div>

                <div className="mt-4">
                  <SemesterForm
                    action={updateSemesterAction.bind(null, semester.id)}
                    submitLabel="Save changes"
                    defaults={{
                      academicYear: semester.academicYear,
                      semesterNumber: semester.semesterNumber,
                      gpaTarget: semester.gpaTarget,
                    }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--color-line)] pt-4">
                  <Link
                    href="/dashboard/subjects"
                    className="text-sm text-[var(--color-accent)]"
                  >
                    Manage subjects
                  </Link>
                  <DeleteForm
                    action={deleteSemesterAction.bind(null, semester.id)}
                    label="Delete semester"
                    confirm={
                      `Delete semester ${semester.semesterNumber} (${semester.academicYear})?\n\n` +
                      `Its ${semester.subjects.length} subject(s) and all of their assessment marks ` +
                      `will be deleted too. This cannot be undone.`
                    }
                  />
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
