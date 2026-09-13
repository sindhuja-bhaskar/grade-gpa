import { redirect } from "next/navigation";
import { requiredGpaForTarget } from "@/lib/academic";
import { getSessionUser } from "@/lib/auth/session";
import { listGoals } from "@/lib/services/goals";
import { buildOverview } from "@/lib/services/analytics";
import { Notice } from "@/components/Notice";
import { DeleteForm } from "@/components/forms/DeleteForm";
import { GoalForm } from "@/components/forms/GoalForm";
import { deleteGoalAction, saveGoalAction } from "../actions";

/**
 * Academic targets (docs/reqs.md §21, §22).
 *
 * Setting a CGPA target immediately shows what the credits still in progress
 * would have to average — and says so as a requirement, never as a forecast
 * (BR-15), including when the target has moved out of reach.
 */
export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { removed } = await searchParams;

  const [goals, overview] = await Promise.all([
    listGoals(user.id),
    buildOverview(user.id),
  ]);

  const overall = goals.find((goal) => goal.scope === "OVERALL") ?? null;
  const semesterGoals = goals.filter((goal) => goal.scope === "SEMESTER");
  const semesterOptions = overview.semesters.map((semester) => ({
    id: semester.id,
    label: semester.label,
  }));

  const futureCredits = overview.ongoingSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  );
  const plan = overall
    ? requiredGpaForTarget({
        currentGradePoints: overview.cgpa.totalGradePoints,
        completedCredits: overview.cgpa.totalCredits,
        futureCredits,
        targetCgpa: overall.targetValue,
      })
    : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Targets</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        A target drives the recommended marks shown against each subject.
      </p>

      {removed ? <Notice>Target removed.</Notice> : null}

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Overall CGPA target</h2>
        <div className="mt-3 max-w-xs">
          <GoalForm
            action={saveGoalAction}
            scope="OVERALL"
            defaultValue={overall?.targetValue ?? null}
          />
        </div>

        {plan ? (
          <div className="mt-4 border-t border-[var(--color-line)] pt-4 text-sm">
            <p>
              <span className="font-medium">
                {plan.requiredGpa === null
                  ? "No requirement to show"
                  : `Required future GPA: ${plan.requiredGpa.toFixed(2)}`}
              </span>
            </p>
            <p className="mt-1 text-[var(--color-muted)]">{plan.explanation}</p>
          </div>
        ) : null}

        {overall ? (
          <div className="mt-4">
            <DeleteForm
              action={deleteGoalAction.bind(null, overall.id)}
              label="Remove target"
              confirm="Remove the overall CGPA target?"
            />
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-white p-5">
        <h2 className="text-sm font-semibold">Semester GPA target</h2>
        {semesterOptions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Add a semester first.
          </p>
        ) : (
          <div className="mt-3 max-w-md">
            <GoalForm
              action={saveGoalAction}
              scope="SEMESTER"
              semesters={semesterOptions}
            />
          </div>
        )}

        {semesterGoals.length > 0 ? (
          <ul className="mt-5 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
            {semesterGoals.map((goal) => {
              const semester = overview.semesters.find(
                (candidate) => candidate.id === goal.semesterId,
              );
              return (
                <li
                  key={goal.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    {semester?.label ?? "Semester"} —{" "}
                    <strong className="tabular-nums">
                      {goal.targetValue.toFixed(2)}
                    </strong>
                  </span>
                  <DeleteForm
                    action={deleteGoalAction.bind(null, goal.id)}
                    label="Remove"
                    confirm={`Remove the target for ${semester?.label ?? "this semester"}?`}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
