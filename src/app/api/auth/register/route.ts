import type { NextRequest } from "next/server";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { parseBody, withErrorHandling } from "@/lib/api/handler";
import { created } from "@/lib/api/respond";
import { hashPassword } from "@/lib/auth/password";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { registerSchema } from "@/lib/validation/schemas";

/**
 * POST /api/auth/register — create an account and sign in (§8.1). Public.
 *
 * Auth.js has no registration flow of its own for credentials, so the account
 * is created here and the new session is opened through the same Auth.js
 * credentials path a normal sign-in uses.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const limit = rateLimit(clientKey(request, "register"), 5, 60);
  if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfterSeconds);

  const input = await parseBody(request, registerSchema);
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict("An account already exists for that email address.");
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  await signIn("credentials", {
    email,
    password: input.password,
    redirect: false,
  });

  return created(user);
});
