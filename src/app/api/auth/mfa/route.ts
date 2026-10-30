import { parseBody, withUser } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import {
  confirmEnrolment,
  disableMfa,
  getMfaStatus,
  startEnrolment,
} from "@/lib/services/mfa";
import { totpCodeSchema } from "@/lib/validation/schemas";

/**
 * /api/auth/mfa — TOTP authenticator enrolment (DA3, Q2(b)).
 *
 *   GET     whether a second factor is enabled
 *   POST    start enrolment: a new secret and its QR code
 *   PUT     confirm enrolment with a code from the app — this switches it on
 *   DELETE  disable, which also requires a current code
 */

export const GET = withUser(async (_request, { user }) =>
  ok(await getMfaStatus(user.id)),
);

export const POST = withUser(async (_request, { user }) =>
  ok(await startEnrolment(user.id)),
);

export const PUT = withUser(async (request, { user }) => {
  const { code } = await parseBody(request, totpCodeSchema);
  return ok(await confirmEnrolment(user.id, code));
});

export const DELETE = withUser(async (request, { user }) => {
  const { code } = await parseBody(request, totpCodeSchema);
  return ok(await disableMfa(user.id, code));
});
