"use client";

import { useActionState } from "react";
import { Field, FormMessage, Select, SubmitButton } from "@/components/ui";
import { IDLE, type FormState } from "@/lib/actions/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

const COURSE_TYPES = [
  { value: "THEORY", label: "Theory" },
  { value: "LABORATORY", label: "Laboratory" },
  { value: "THEORY_AND_LAB", label: "Theory + Laboratory" },
];

const GRADING_TYPES = [
  { value: "ABSOLUTE", label: "Absolute" },
  { value: "RELATIVE", label: "Relative" },
];

/**
 * Create or edit a subject (§10).
 *
 * Course type is fixed once marks exist: the assessment structure differs
 * between course types, so recorded marks would no longer map onto it. The
 * service refuses that change and the reason is shown here.
 */
export function SubjectForm({
  action,
  submitLabel,
  semesters,
  defaults,
  lockCourseType,
}: {
  action: Action;
  submitLabel: string;
  semesters?: Array<{ id: string; label: string }>;
  defaults?: {
    semesterId?: string;
    name?: string;
    code?: string | null;
    credits?: number;
    courseType?: string;
    gradingType?: string;
    classStrength?: number | null;
    theoryWeightPercent?: number | null;
    labWeightPercent?: number | null;
  };
  lockCourseType?: boolean;
}) {
  const [state, submit] = useActionState(action, IDLE);

  return (
    <form action={submit} className="space-y-3">
      {semesters ? (
        <Select
          label="Semester"
          name="semesterId"
          options={semesters.map((semester) => ({
            value: semester.id,
            label: semester.label,
          }))}
          defaultValue={defaults?.semesterId}
          error={state.issues?.semesterId}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Subject name"
          name="name"
          placeholder="Computer Networks"
          defaultValue={defaults?.name}
          error={state.issues?.name}
          required
        />
        <Field
          label="Subject code"
          name="code"
          placeholder="BCSE308L"
          defaultValue={defaults?.code ?? ""}
          hint="Optional"
          error={state.issues?.code}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Credits"
          name="credits"
          type="number"
          step="0.5"
          min={0.5}
          defaultValue={defaults?.credits}
          error={state.issues?.credits}
          required
        />
        <Select
          label="Course type"
          name="courseType"
          options={COURSE_TYPES}
          defaultValue={defaults?.courseType ?? "THEORY"}
          error={state.issues?.courseType}
        />
        <Select
          label="Grading"
          name="gradingType"
          options={GRADING_TYPES}
          defaultValue={defaults?.gradingType ?? "ABSOLUTE"}
          error={state.issues?.gradingType}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Class strength"
          name="classStrength"
          type="number"
          min={1}
          defaultValue={defaults?.classStrength ?? ""}
          hint="Optional; used for relative grading"
          error={state.issues?.classStrength}
        />
        <Field
          label="Theory weight %"
          name="theoryWeightPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={defaults?.theoryWeightPercent ?? ""}
          hint="Theory + lab courses only"
          error={state.issues?.theoryWeightPercent}
        />
        <Field
          label="Lab weight %"
          name="labWeightPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={defaults?.labWeightPercent ?? ""}
          hint="Must total 100% with theory"
          error={state.issues?.labWeightPercent}
        />
      </div>

      {lockCourseType ? (
        <p className="text-xs text-[var(--color-muted)]">
          Marks are recorded for this subject, so its course type can only be
          changed after those marks are cleared — the assessment structure
          differs between course types.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
