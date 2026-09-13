"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth/session";
import {
  markValue,
  number,
  optionalNumber,
  optionalText,
  runFormAction,
  text,
} from "@/lib/actions/form";
import type { FormState } from "@/lib/actions/form-state";
import {
  assessmentUpdateSchema,
  goalCreateSchema,
  semesterCreateSchema,
  semesterUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
} from "@/lib/validation/schemas";
import {
  createSemester,
  deleteSemester,
  getSemester,
  updateSemester,
} from "@/lib/services/semesters";
import {
  createSubject,
  deleteSubject,
  getSubject,
  updateSubject,
} from "@/lib/services/subjects";
import { updateAssessment } from "@/lib/services/assessments";
import { createGoal, deleteGoal } from "@/lib/services/goals";
import { ZodError } from "zod";
import { ApiError } from "@/lib/api/errors";

/**
 * CRUD Server Actions for the dashboard (docs/reqs.md §30).
 *
 * Each one authenticates, validates with the same schema the REST API uses,
 * and calls the same service — the services own the ownership checks (§8.2),
 * so a form cannot reach another student's record any more than a request can.
 *
 * A "use server" module may only export async functions, so shared constants
 * live in src/lib/actions/form-state.ts.
 */

// ─── Semesters (§9, §21) ───────────────────────────────────────────────────

export async function createSemesterAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const input = semesterCreateSchema.parse({
      academicYear: text(form, "academicYear"),
      semesterNumber: number(form, "semesterNumber"),
      gpaTarget: optionalNumber(form, "gpaTarget"),
    });

    await createSemester(user.id, input);
    revalidatePath("/dashboard/semesters");
    revalidatePath("/dashboard");
    return `Semester ${input.semesterNumber} of ${input.academicYear} added.`;
  });
}

export async function updateSemesterAction(
  semesterId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const input = semesterUpdateSchema.parse({
      academicYear: text(form, "academicYear"),
      semesterNumber: number(form, "semesterNumber"),
      gpaTarget: optionalNumber(form, "gpaTarget"),
    });

    await updateSemester(user.id, semesterId, input);
    revalidatePath("/dashboard/semesters");
    revalidatePath("/dashboard");
    return "Semester updated.";
  });
}

export async function deleteSemesterAction(
  semesterId: string,
  _previous: FormState,
  _form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const semester = await getSemester(user.id, semesterId);
    await deleteSemester(user.id, semesterId);

    revalidatePath("/dashboard/semesters");
    revalidatePath("/dashboard");

    // The card holding this button is about to disappear, so the confirmation
    // is carried to the reloaded page instead of rendered into a dead node.
    const label = `Semester ${semester.semesterNumber} (${semester.academicYear})`;
    redirect(`/dashboard/semesters?removed=${encodeURIComponent(label)}`);
  });
}

// ─── Subjects (§10, §30) ───────────────────────────────────────────────────

export async function createSubjectAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const input = subjectCreateSchema.parse({
      semesterId: text(form, "semesterId"),
      name: text(form, "name"),
      code: optionalText(form, "code"),
      credits: number(form, "credits"),
      courseType: text(form, "courseType"),
      gradingType: text(form, "gradingType"),
      classStrength: optionalNumber(form, "classStrength"),
      theoryWeightPercent: optionalNumber(form, "theoryWeightPercent"),
      labWeightPercent: optionalNumber(form, "labWeightPercent"),
    });

    const subject = await createSubject(user.id, input);
    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard");
    return `${subject.name} added with ${subject.assessments.length} assessment components, all awaiting marks.`;
  });
}

export async function updateSubjectAction(
  subjectId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const input = subjectUpdateSchema.parse({
      name: text(form, "name"),
      code: optionalText(form, "code"),
      credits: number(form, "credits"),
      courseType: text(form, "courseType"),
      gradingType: text(form, "gradingType"),
      classStrength: optionalNumber(form, "classStrength"),
      theoryWeightPercent: optionalNumber(form, "theoryWeightPercent"),
      labWeightPercent: optionalNumber(form, "labWeightPercent"),
    });

    await updateSubject(user.id, subjectId, input);
    revalidatePath(`/dashboard/subjects/${subjectId}`);
    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard");
    return "Subject updated.";
  });
}

export async function deleteSubjectAction(
  subjectId: string,
  _previous: FormState,
  _form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const subject = await getSubject(user.id, subjectId);
    await deleteSubject(user.id, subjectId);

    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard");

    // Delete is usually triggered from the subject's own page, which no longer
    // exists once the record is gone — staying put would 404. Confirmation is
    // carried to the list instead.
    redirect(`/dashboard/subjects?removed=${encodeURIComponent(subject.name)}`);
  });
}

// ─── Marks (§11, §12, §14) ─────────────────────────────────────────────────

/**
 * Saves the whole mark grid for a subject in one go.
 *
 * A blank box means the assessment has not happened or has not been released:
 * the mark is cleared and the component returns to "not available". `0` is a
 * mark of zero. The two are never conflated (§12.1, BR-04, BR-05).
 */
export async function saveMarksAction(
  subjectId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();

    const ids = form.getAll("assessmentId").map(String);
    if (ids.length === 0) throw ApiError.validation("Nothing to save.");

    let recorded = 0;
    let cleared = 0;

    for (const id of ids) {
      try {
        const input = assessmentUpdateSchema.parse({
          studentMark: markValue(form, `mark-${id}`),
          classAverage: markValue(form, `average-${id}`),
          standardDeviation: markValue(form, `deviation-${id}`),
        });

        await updateAssessment(user.id, id, input);
        if (input.studentMark === null) cleared += 1;
        else recorded += 1;
      } catch (error) {
        // The grid saves every component at once, so an error has to say which
        // row it belongs to — otherwise the student sees "not valid" with no
        // way to tell which mark caused it.
        throw locateIssues(error, id);
      }
    }

    revalidatePath(`/dashboard/subjects/${subjectId}`);
    revalidatePath("/dashboard/subjects");
    revalidatePath("/dashboard");

    return `Saved. ${recorded} assessment(s) recorded, ${cleared} left as not available.`;
  });
}

/** Field names in the grid are suffixed with the assessment id; issue paths
 *  are rewritten to match so each message lands on its own cell. */
const GRID_FIELDS: Record<string, string> = {
  studentMark: "mark",
  classAverage: "average",
  standardDeviation: "deviation",
};

function locateIssues(error: unknown, assessmentId: string): unknown {
  const apiError =
    error instanceof ZodError ? ApiError.fromZod(error) : error;
  if (!(apiError instanceof ApiError) || apiError.issues.length === 0) {
    return error;
  }

  return ApiError.validation(
    apiError.message,
    apiError.issues.map((issue) => ({
      path: `${GRID_FIELDS[issue.path] ?? issue.path}-${assessmentId}`,
      message: issue.message,
    })),
  );
}

// ─── Goals (§21, §22) ──────────────────────────────────────────────────────

export async function saveGoalAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    const input = goalCreateSchema.parse({
      scope: text(form, "scope"),
      targetValue: number(form, "targetValue"),
      semesterId: optionalText(form, "semesterId"),
    });

    await createGoal(user.id, input);
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return input.scope === "OVERALL"
      ? `Target CGPA set to ${input.targetValue}.`
      : `Semester target set to ${input.targetValue}.`;
  });
}

export async function deleteGoalAction(
  goalId: string,
  _previous: FormState,
  _form: FormData,
): Promise<FormState> {
  return runFormAction(async () => {
    const user = await requireUser();
    await deleteGoal(user.id, goalId);

    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    redirect("/dashboard/goals?removed=target");
  });
}

// ─── Session ───────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
