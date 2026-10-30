import "server-only";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { openTotpSecret, verifyTotp } from "@/lib/auth/totp";

/**
 * The one credential check (§35, DA3 Q2(b)): password, then — when the account
 * has an authenticator enrolled — a TOTP code. Auth.js's `authorize()` calls it,
 * so every sign-in path (REST /api/auth/login and Auth.js's own
 * /api/auth/callback/credentials) enforces the second factor identically.
 */

export type CredentialCheck =
  | { ok: true; user: { id: string; email: string; name: string | null } }
  | { ok: false; reason: "invalid" | "mfa_required" | "mfa_invalid" };

export function totpEncryptionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return secret;
}

export async function checkCredentials(input: {
  email: string;
  password: string;
  otp?: string;
}): Promise<CredentialCheck> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      totpSecret: true,
      totpEnabledAt: true,
      totpLastStep: true,
    },
  });

  // Same outcome whether the email is unknown or the password is wrong (§35).
  if (!user?.passwordHash) return { ok: false, reason: "invalid" };
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, reason: "invalid" };
  }

  const identity = { id: user.id, email: user.email, name: user.name };
  if (!user.totpEnabledAt || !user.totpSecret) return { ok: true, user: identity };

  if (!input.otp) return { ok: false, reason: "mfa_required" };

  const step = verifyTotp(
    openTotpSecret(user.totpSecret, totpEncryptionSecret()),
    input.otp,
    { afterStep: user.totpLastStep },
  );
  if (step === null) return { ok: false, reason: "mfa_invalid" };

  // Conditional update: two requests racing with the same code cannot both win.
  const consumed = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
    },
    data: { totpLastStep: step },
  });
  if (consumed.count === 0) return { ok: false, reason: "mfa_invalid" };

  return { ok: true, user: identity };
}
