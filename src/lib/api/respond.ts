import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

/** JSON helpers shared by every route handler (docs/reqs.md §31). */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function failure(error: unknown): NextResponse {
  const apiError = toApiError(error);

  if (apiError.status >= 500) {
    // Log the cause server-side; never leak internals to the client (§35).
    console.error("[api] unhandled error", error);
  }

  return NextResponse.json(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.issues.length > 0 ? { issues: apiError.issues } : {}),
      },
    },
    { status: apiError.status },
  );
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return ApiError.fromZod(error);

  // Prisma unique-constraint violation → a conflict the student can act on.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return ApiError.conflict("A record with those details already exists.");
  }

  return new ApiError(
    500,
    "INTERNAL_ERROR",
    "Something went wrong while processing the request.",
  );
}
