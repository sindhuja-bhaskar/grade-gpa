import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { ApiError } from "./errors";
import { failure } from "./respond";

/**
 * Route-handler plumbing (docs/reqs.md §8.2, §31, §37).
 *
 * `withUser` re-checks the session inside every handler. Middleware rejects
 * unauthenticated traffic early, but authorization is enforced here as well —
 * §8.2 requires an ownership check on every request, not a UI-level one.
 */

export type RouteContext<P = Record<string, string>> = {
  params: Promise<P>;
};

export function withUser<P = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { user: SessionUser; params: P },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: RouteContext<P>,
  ): Promise<NextResponse> => {
    try {
      const user = await requireUser();
      const params = ((await context?.params) ?? {}) as P;
      return await handler(request, { user, params });
    } catch (error) {
      return failure(error);
    }
  };
}

/** Public routes (register, login, refresh, docs) still need error handling. */
export function withErrorHandling(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return failure(error);
    }
  };
}

/** Parses and validates a JSON body, or throws a 422 with field-level issues. */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw ApiError.validation("A JSON request body is required.");
  }

  const result = schema.safeParse(payload);
  if (!result.success) throw ApiError.fromZod(result.error);
  return result.data;
}

/** Validates query-string parameters with the same error shape. */
export function parseQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = schema.safeParse(entries);
  if (!result.success) throw ApiError.fromZod(result.error);
  return result.data;
}
