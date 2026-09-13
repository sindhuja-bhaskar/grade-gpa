import type { NextRequest } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { parseBody, withErrorHandling } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";

/**
 * POST /api/auth/login — start a session (§8.1, §31).
 *
 * A REST-shaped wrapper over the Auth.js credentials flow, so the endpoint the
 * SRS names stays available to API clients while Auth.js remains the single
 * implementation of sign-in. Browser clients may equally use signIn() or the
 * Auth.js endpoints under /api/auth.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const limit = rateLimit(clientKey(request, "login"), 10, 60);
  if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfterSeconds);

  const input = await parseBody(request, loginSchema);

  try {
    await signIn("credentials", { ...input, redirect: false });
  } catch (error) {
    // Auth.js reports every credentials failure the same way; so do we — an
    // unauthenticated caller does not learn whether the email is registered.
    if (error instanceof AuthError) {
      throw ApiError.unauthorized("Email or password is incorrect.");
    }
    throw error;
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: input.email.toLowerCase() },
    select: { id: true, email: true, name: true },
  });

  return ok(user);
});
