import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ApiError } from "@/lib/api/errors";
import { IDLE, type FormState } from "./form-state";

/**
 * Server Action plumbing for the CRUD pages (docs/reqs.md §30, §37).
 *
 * Forms post to Server Actions rather than to `fetch`, but the rules they hit
 * are the same ones the REST API enforces: the same Zod schemas, the same
 * services, the same ownership checks. Only the transport differs, so a rule
 * can never hold in one and not the other.
 */

export { IDLE, type FormState };

/** Runs an action, turning validation and authorization failures into state. */
export async function runFormAction(
  work: () => Promise<string | void>,
): Promise<FormState> {
  try {
    const message = await work();
    return { status: "success", ...(message ? { message } : {}) };
  } catch (error) {
    // redirect() and notFound() work by throwing; those must pass through
    // rather than be reported to the student as a failure.
    unstable_rethrow(error);

    if (error instanceof ZodError) return fromApiError(ApiError.fromZod(error));
    if (error instanceof ApiError) return fromApiError(error);

    console.error("[action] unhandled error", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }
}

function fromApiError(error: ApiError): FormState {
  return {
    status: "error",
    message: error.message,
    ...(error.issues.length > 0
      ? {
          issues: Object.fromEntries(
            error.issues.map((issue) => [issue.path, issue.message]),
          ),
        }
      : {}),
  };
}

// ─── FormData readers ──────────────────────────────────────────────────────
// FormData is all strings; these produce the types the Zod schemas expect and
// keep "" meaning "not provided" rather than 0 or an empty name.

export function text(form: FormData, field: string): string {
  return String(form.get(field) ?? "").trim();
}

export function optionalText(form: FormData, field: string): string | null {
  const value = text(form, field);
  return value === "" ? null : value;
}

export function number(form: FormData, field: string): number {
  const value = text(form, field);
  // NaN rather than 0 for an empty box: the schema then reports a missing
  // number instead of silently accepting zero credits or a zero target.
  return value === "" ? Number.NaN : Number(value);
}

export function optionalNumber(form: FormData, field: string): number | null {
  const value = text(form, field);
  return value === "" ? null : Number(value);
}

/**
 * A mark, where blank and zero mean genuinely different things (§12, BR-04,
 * BR-05): blank clears the mark back to "not available", `0` records a zero.
 */
export function markValue(form: FormData, field: string): number | null {
  const value = text(form, field);
  return value === "" ? null : Number(value);
}
