"use client";

import { useActionState } from "react";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui";
import { IDLE, type FormState } from "@/lib/actions/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * Set a target (§21). Saving a target for a scope that already has one replaces
 * it, so a student ends up with one CGPA target and one target per semester.
 */
export function GoalForm({
  action,
  scope,
  semesters,
  defaultValue,
  defaultSemesterId,
}: {
  action: Action;
  scope: "OVERALL" | "SEMESTER";
  semesters?: Array<{ id: string; label: string }>;
  defaultValue?: number | null;
  defaultSemesterId?: string;
}) {
  const [state, submit] = useActionState(action, IDLE);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="scope" value={scope} />

      {scope === "SEMESTER" && semesters ? (
        <Select
          label="Semester"
          name="semesterId"
          options={semesters.map((semester) => ({
            value: semester.id,
            label: semester.label,
          }))}
          defaultValue={defaultSemesterId}
          error={state.issues?.semesterId}
        />
      ) : null}

      <Field
        label={scope === "OVERALL" ? "Target CGPA" : "Target GPA"}
        name="targetValue"
        type="number"
        step="0.01"
        min={0}
        max={10}
        defaultValue={defaultValue ?? ""}
        hint="0–10"
        error={state.issues?.targetValue}
        required
      />

      <div className="flex items-center gap-3">
        <SubmitButton>Save target</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
