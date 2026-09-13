import { signOut } from "@/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";

/**
 * POST /api/auth/logout — end the session (§8.1).
 *
 * Auth.js clears the cookie; the `signOut` event in src/auth.ts deletes the
 * Session row, so the token cannot be replayed afterwards.
 */
export const POST = withErrorHandling(async () => {
  await signOut({ redirect: false });
  return ok({ loggedOut: true });
});
