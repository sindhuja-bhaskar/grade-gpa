import { ApiError } from "@/lib/api/errors";
import { withErrorHandling } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { touchSession } from "@/lib/auth/session";

/**
 * POST /api/auth/refresh — extend the current session (§8.1).
 *
 * Sessions already slide as they age (see src/auth.ts), so a client never has
 * to call this; it is the explicit REST equivalent, kept because §8.1 names
 * renewal as part of the API surface.
 */
export const POST = withErrorHandling(async () => {
  const refreshed = await touchSession();
  if (!refreshed) {
    throw ApiError.unauthorized("No active session to refresh.");
  }
  return ok({ expiresAt: refreshed.expiresAt.toISOString() });
});
