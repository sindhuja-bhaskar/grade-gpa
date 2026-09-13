import "server-only";

import { randomUUID } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/schemas";

/**
 * Authentication (docs/reqs.md §8, §33, §35) built on Auth.js v5.
 *
 * ## Why the session is configured the way it is
 *
 * §8.1 asks for sessions that expire and can be renewed, and the project wants
 * sessions that can be revoked server-side. Auth.js refuses its `database`
 * session strategy when credentials are the only sign-in method
 * (@auth/core/lib/utils/assert.js — "Signing in with credentials only supported
 * if JWT strategy is enabled"), so that cannot be configured directly.
 *
 * Instead, the two halves are assembled here using supported APIs:
 *
 *   - a `Session` row is created on sign-in and its token is carried in the
 *     JWT (`sid`), so the cookie is never self-sufficient;
 *   - every request re-reads that row (the `jwt` callback runs on each `auth()`
 *     call). A deleted or expired row invalidates the session immediately,
 *     which is the revocability a bare JWT cannot offer;
 *   - the row's expiry slides while the student keeps working, so a session
 *     does not die mid-entry (§8.1) and does not live indefinitely either.
 *
 * The deviation from a stock Auth.js database session is therefore only in what
 * the cookie carries — a signed token holding the session id, rather than an
 * opaque one — not in where session state lives or in what can revoke it.
 */

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_DAYS ?? 30) * 86400;

/** Refresh the stored expiry once a session is more than half-way through. */
const SLIDE_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

// Session and JWT shapes are augmented in src/types/auth.d.ts.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Required behind any host that is not Vercel (§34: the app may be deployed
  // anywhere), otherwise Auth.js refuses to trust the incoming host header.
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_TTL_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        // Same outcome whether the email is unknown or the password is wrong:
        // an unauthenticated caller does not get to learn which (§35).
        if (!user?.passwordHash) return null;
        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        // Fresh sign-in: open a server-side session and carry only its token.
        const sessionToken = randomUUID();
        await prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
          },
        });
        token.sub = user.id;
        token.sid = sessionToken;
        return token;
      }

      if (!token.sid) return null;

      const stored = await prisma.session.findUnique({
        where: { sessionToken: token.sid },
        select: { id: true, userId: true, expires: true },
      });

      // Revoked, deleted with the account, or expired — end it here, so a valid
      // signature alone is never enough to stay signed in.
      if (!stored || stored.expires <= new Date()) {
        return null;
      }

      const remaining = stored.expires.getTime() - Date.now();
      if (remaining < SLIDE_AFTER_SECONDS * 1000) {
        await prisma.session.update({
          where: { id: stored.id },
          data: { expires: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
        });
      }

      token.sub = stored.userId;
      return token;
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signOut(message) {
      // Signing out deletes the row, so the token cannot be replayed.
      const sid = "token" in message ? message.token?.sid : undefined;
      if (sid) {
        await prisma.session.deleteMany({ where: { sessionToken: sid } });
      }
    },
  },
});

/** Ends every session for a user — used when the account is deleted. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
