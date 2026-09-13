import "server-only";

import bcrypt from "bcryptjs";

/** §35.1: a deliberately slow hash, never a fast general-purpose digest. */
const COST_FACTOR = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST_FACTOR);
}

export function verifyPassword(
  plaintext: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, passwordHash);
}
