import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

/**
 * Auth.js type augmentation.
 *
 * `session.user.id` is what every ownership check keys off (§8.2), and `sid`
 * carries the Session row's token so each request can re-check that the session
 * has not been revoked — see src/auth.ts.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string; role?: "STUDENT" | "ADVISOR" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    role?: "STUDENT" | "ADVISOR";
  }
}
