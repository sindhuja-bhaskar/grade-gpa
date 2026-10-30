import "server-only";

import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { totpEncryptionSecret } from "@/lib/auth/credentials";
import {
  generateTotpSecret,
  openTotpSecret,
  otpauthUri,
  sealTotpSecret,
  verifyTotp,
} from "@/lib/auth/totp";

/**
 * Authenticator-app enrolment (DA3, Q2(b)).
 *
 * Two steps, so a student cannot lock themselves out with a QR code they never
 * scanned: `startEnrolment` stores a pending secret, and only a correct code
 * from the app (`confirmEnrolment`) switches the second factor on.
 */

export async function getMfaStatus(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpEnabledAt: true, totpSecret: true },
  });
  return {
    enabled: user.totpEnabledAt !== null,
    enabledAt: user.totpEnabledAt,
    pending: user.totpEnabledAt === null && user.totpSecret !== null,
  };
}

export async function startEnrolment(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) {
    throw ApiError.conflict(
      "An authenticator is already enabled. Disable it before enrolling a new one.",
    );
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: sealTotpSecret(secret, totpEncryptionSecret()),
      totpLastStep: null,
    },
  });

  const uri = otpauthUri(secret, user.email);
  return {
    otpauthUri: uri,
    // Shown once, for manual entry when the QR code cannot be scanned.
    secret,
    qrCodeDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 240 }),
  };
}

async function verifyAgainstStored(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpSecret: true, totpLastStep: true, totpEnabledAt: true },
  });
  if (!user.totpSecret) {
    throw ApiError.validation("Start authenticator set-up first.");
  }
  const step = verifyTotp(
    openTotpSecret(user.totpSecret, totpEncryptionSecret()),
    code,
    { afterStep: user.totpLastStep },
  );
  if (step === null) {
    throw ApiError.validation("That code is not valid. Check the app and try again.");
  }
  return { step, enabled: user.totpEnabledAt !== null };
}

export async function confirmEnrolment(userId: string, code: string) {
  const { step, enabled } = await verifyAgainstStored(userId, code);
  if (enabled) throw ApiError.conflict("An authenticator is already enabled.");

  const user = await prisma.user.update({
    where: { id: userId },
    data: { totpEnabledAt: new Date(), totpLastStep: step },
    select: { totpEnabledAt: true },
  });
  return { enabled: true, enabledAt: user.totpEnabledAt };
}

/** Turning the factor off needs a current code, not just a session. */
export async function disableMfa(userId: string, code: string) {
  const { enabled } = await verifyAgainstStored(userId, code);
  if (!enabled) throw ApiError.validation("No authenticator is enabled.");

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
  });
  return { enabled: false };
}
