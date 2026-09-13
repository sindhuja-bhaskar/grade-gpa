"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { IDLE, type FormState } from "@/lib/actions/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export interface MarkRow {
  assessmentId: string;
  label: string;
  component: "THEORY" | "LAB";
  maxMarks: number;
  weight: number;
  studentMark: number | null;
  classAverage: number | null;
  standardDeviation: number | null;
  /** Assignments never need class-average information (§14, BR-08). */
  classAverageApplicable: boolean;
}

/**
 * Progressive mark entry (docs/reqs.md §11, §12, §14).
 *
 * The whole scheme is shown at once and saved together, because the thing a
 * student needs to see is which components are recorded and which are not.
 *
 * The rule made visible here: an empty box is "not available", *not* zero.
 * Clearing a box returns that assessment to not-available; typing 0 records a
 * mark of zero (BR-04, BR-05).
 */
export function MarkGrid({ action, rows }: { action: Action; rows: MarkRow[] }) {
  const [state, submit] = useActionState(action, IDLE);

  return (
    <form action={submit} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
            <tr>
              <th className="pb-2 pr-4 font-medium">Assessment</th>
              <th className="pb-2 pr-4 font-medium">Weight</th>
              <th className="pb-2 pr-4 font-medium">Mark</th>
              <th className="pb-2 pr-4 font-medium">Class average</th>
              <th className="pb-2 font-medium">Std deviation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assessmentId} className="border-t border-[var(--color-line)]">
                <td className="py-2 pr-4">
                  <input type="hidden" name="assessmentId" value={row.assessmentId} />
                  <span className="font-medium">{row.label}</span>
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    out of {row.maxMarks}
                    {row.component === "LAB" ? " · lab" : ""}
                  </span>
                </td>
                <td className="py-2 pr-4 tabular-nums text-[var(--color-muted)]">
                  {row.weight}
                </td>
                <td className="py-2 pr-4">
                  <NumberCell
                    name={`mark-${row.assessmentId}`}
                    value={row.studentMark}
                    max={row.maxMarks}
                    placeholder="—"
                    error={state.issues?.[`mark-${row.assessmentId}`]}
                  />
                </td>
                <td className="py-2 pr-4">
                  {row.classAverageApplicable ? (
                    <NumberCell
                      name={`average-${row.assessmentId}`}
                      value={row.classAverage}
                      max={row.maxMarks}
                      placeholder="optional"
                      error={state.issues?.[`average-${row.assessmentId}`]}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">
                      not applicable
                    </span>
                  )}
                </td>
                <td className="py-2">
                  {row.classAverageApplicable ? (
                    <NumberCell
                      name={`deviation-${row.assessmentId}`}
                      value={row.standardDeviation}
                      placeholder="optional"
                      error={state.issues?.[`deviation-${row.assessmentId}`]}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Leave a mark blank if the assessment has not happened or has not been
        released — blank means <strong>not available</strong>, and counts towards
        nothing. Enter <strong>0</strong> only for a mark of zero that was
        actually awarded. Clearing a saved mark puts it back to not available.
      </p>

      <div className="flex items-center gap-3">
        <SubmitButton>Save marks</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function NumberCell({
  name,
  value,
  max,
  placeholder,
  error,
}: {
  name: string;
  value: number | null;
  max?: number;
  placeholder: string;
  error?: string;
}) {
  return (
    <>
      <input
        type="number"
        name={name}
        step="0.01"
        min={0}
        max={max}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`w-24 rounded-lg border bg-white px-2 py-1.5 tabular-nums outline-none focus:border-[var(--color-accent)] ${
          error ? "border-[var(--color-risk)]" : "border-[var(--color-line)]"
        }`}
      />
      {error ? (
        <span className="mt-1 block max-w-40 text-xs text-[var(--color-risk)]">
          {error}
        </span>
      ) : null}
    </>
  );
}
