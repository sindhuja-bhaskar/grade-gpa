import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryBadge } from "@/components/CategoryBadge";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { getSessionUser } from "@/lib/auth/session";
import { buildOverview } from "@/lib/services/analytics";

/**
 * Dashboard (docs/reqs.md §29).
 *
 * A server component: the overview is calculated on the server and only the
 * finished figures reach the browser, so the calculation engine and database
 * access stay server-only (§7, §41).
 */
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const overview = await buildOverview(user.id);
  const hasRecords = overview.semesters.length > 0;

  const trend = overview.gpaTrend.map((point, index) => ({
    label: `S${index + 1}`,
    gpa: point.gpa,
    cgpa: overview.cgpaProgression[index]?.cgpa ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Marks assessed so far, what your targets require, and where to put the
          effort next.
        </p>
      </header>

      {!hasRecords ? (
        <EmptyState />
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Official CGPA"
              value={overview.cgpa.value?.toFixed(2) ?? "Not yet available"}
              tone={overview.cgpa.value === null ? "muted" : "default"}
              caption={`${overview.cgpa.completedCourses} completed course(s), ${overview.cgpa.totalCredits} credits`}
            />
            <StatCard
              label="Target CGPA"
              value={overview.targetPlan?.targetCgpa.toFixed(2) ?? "Not set"}
              tone={overview.targetPlan ? "default" : "muted"}
              caption={
                overview.targetPlan
                  ? `${overview.targetPlan.futureCredits} credits in progress`
                  : "Set a target to plan the GPA it needs"
              }
            />
            <StatCard
              label="Required future GPA"
              value={
                overview.targetPlan?.result.requiredGpa?.toFixed(2) ??
                "Not available"
              }
              tone={overview.targetPlan?.result.attainable ? "default" : "muted"}
              caption={overview.targetPlan?.result.explanation}
            />
            <StatCard
              label="Subjects in progress"
              value={String(overview.ongoingSubjects.length)}
              caption="Ongoing subjects have a performance status, not a grade"
            />
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel title="Strongest subjects">
              {overview.strongest.length === 0 ? (
                <Muted>No assessed marks yet.</Muted>
              ) : (
                <ul className="space-y-2 text-sm">
                  {overview.strongest.map((subject) => (
                    <li key={subject.subjectId} className="flex justify-between">
                      <span>{subject.name}</span>
                      <span className="tabular-nums text-[var(--color-muted)]">
                        {subject.assessedPercent}% of assessed marks
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Priority subjects">
              {overview.priorities.length === 0 ? (
                <Muted>
                  Nothing needs urgent attention based on the marks recorded.
                </Muted>
              ) : (
                <ul className="space-y-3 text-sm">
                  {overview.priorities.slice(0, 3).map((subject) => (
                    <li key={subject.subjectId}>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-[var(--color-muted)]">{subject.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          <section className="mt-4">
            <Panel title="Ongoing subjects">
              {overview.ongoingSubjects.length === 0 ? (
                <Muted>No subjects are currently in progress.</Muted>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Subject</th>
                        <th className="pb-2 pr-4 font-medium">Marks assessed</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Next target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.ongoingSubjects.map((subject) => {
                        const next = subject.requirement?.targets[0];
                        return (
                          <tr
                            key={subject.id}
                            className="border-t border-[var(--color-line)]"
                          >
                            <td className="py-3 pr-4">
                              <span className="font-medium">{subject.name}</span>
                              <span className="ml-2 text-xs text-[var(--color-muted)]">
                                {subject.credits} credits
                              </span>
                            </td>
                            <td className="py-3 pr-4 tabular-nums">
                              {subject.progress.completedWeight === 0
                                ? "None yet"
                                : `${subject.progress.earnedMarks} / ${subject.progress.completedWeight}`}
                            </td>
                            <td className="py-3 pr-4">
                              <CategoryBadge
                                category={subject.classification.category}
                                label={subject.classification.label}
                              />
                            </td>
                            <td className="py-3 text-[var(--color-muted)]">
                              {next
                                ? `${next.label}: ${next.range.low}–${next.range.high} / ${next.maxMarks}`
                                : subject.targetFinalMark === null
                                  ? "Set a semester target"
                                  : "No assessments remaining"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-[var(--color-muted)]">
                    Marks shown are out of the weight assessed so far, not a final
                    course mark. Ongoing subjects do not have a grade.
                  </p>
                </div>
              )}
            </Panel>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Academic performance trend">
              <TrendChart data={trend} />
            </Panel>
            <Panel title="Recommendations">
              {overview.recommendations.length === 0 ? (
                <Muted>
                  Record assessment marks to receive recommendations.
                </Muted>
              ) : (
                <ul className="space-y-3 text-sm">
                  {overview.recommendations.slice(0, 5).map((item, index) => (
                    <li key={`${item.subjectId}-${item.code}-${index}`}>
                      <p className="font-medium">{item.subjectName}</p>
                      <p>{item.message}</p>
                      <p className="text-xs text-[var(--color-muted)]">{item.basis}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--color-muted)]">{children}</p>;
}

function EmptyState() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-[var(--color-line)] bg-white p-8">
      <h2 className="text-lg font-medium">No academic records yet</h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        Add a semester, then the subjects it contains. Each subject is created
        with the full set of assessments its course type requires — enter marks
        as they are released, and leave the rest untouched. Unavailable
        assessments are never counted as zero.
      </p>
      <p className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard/semesters"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white"
        >
          Add a semester
        </Link>
        <Link
          href="/dashboard/subjects"
          className="rounded-lg border border-[var(--color-line)] bg-white px-4 py-2 font-medium"
        >
          Add a subject
        </Link>
      </p>
    </div>
  );
}
