"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { IDLE, type FormState } from "@/lib/actions/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function SemesterForm({
  action,
  submitLabel,
  defaults,
}: {
  action: Action;
  submitLabel: string;
  defaults?: {
    academicYear?: string;
    semesterNumber?: number;
    gpaTarget?: number | null;
  };
}) {
  const [state, submit] = useActionState(action, IDLE);

  return (
    <form action={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Academic year"
          name="academicYear"
          placeholder="2025-26"
          defaultValue={defaults?.academicYear}
          error={state.issues?.academicYear}
          required
        />
        <Field
          label="Semester number"
          name="semesterNumber"
          type="number"
          min={1}
          max={12}
          defaultValue={defaults?.semesterNumber}
          error={state.issues?.semesterNumber}
          required
        />
        <Field
          label="GPA target"
          name="gpaTarget"
          type="number"
          step="0.01"
          min={0}
          max={10}
          defaultValue={defaults?.gpaTarget ?? ""}
          hint="Optional, 0–10"
          error={state.issues?.gpaTarget}
        />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
