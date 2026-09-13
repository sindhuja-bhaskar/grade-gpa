import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * Session access for route handlers and server components (docs/reqs.md §8).
 *
 * A thin layer over Auth.js so that handlers, services and pages depend on this
 * small interface rather than on the auth library directly. Session validation
 * — including the server-side revocation check — happens inside `auth()`; see
 * src/auth.ts for how that is wired.
 */

export interface SessionUser {
  id: string;
  email: string;
}

/** The signed-in student, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return {
    id,
    email: session.user.email ?? "",
  };
}

/**
 * §31: a missing or invalid session is 401. Reaching another student's record
 * is 403 — the two stay distinct.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthorized();
  return user;
}

/**
 * Extends the current session's expiry (§8.1). The sliding window in the Auth.js
 * `jwt` callback does this automatically as a session ages; this is the explicit
 * REST equivalent, behind POST /api/auth/refresh.
 */
export async function touchSession(): Promise<{ expiresAt: Date } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const current = await prisma.session.findFirst({
    where: { userId, expires: { gt: new Date() } },
    orderBy: { expires: "desc" },
    select: { id: true },
  });
  if (!current) return null;

  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 30);
  const expires = new Date(Date.now() + ttlDays * 86400 * 1000);
  await prisma.session.update({ where: { id: current.id }, data: { expires } });
  return { expiresAt: expires };
}
