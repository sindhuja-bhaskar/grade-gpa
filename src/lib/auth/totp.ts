import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Time-based one-time passwords — RFC 6238 over RFC 4226 HOTP (DA3, Q2(b)).
 *
 * The second factor for sign-in, compatible with Google and Microsoft
 * Authenticator: SHA-1, 6 digits, 30-second steps, the defaults those apps
 * assume when an otpauth:// URI does not say otherwise.
 *
 * Written against node:crypto rather than a library because the algorithm is
 * a few lines and the RFC's own test vectors cover it (see __tests__/totp.test.ts).
 * Kept free of `server-only` so vitest can import it — nothing here touches the
 * database or a session.
 */

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
/** Steps either side of now still accepted, for clock drift between phone and server. */
export const TOTP_WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** A new 160-bit secret, base32-encoded as authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function timeStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
}

/** RFC 4226 HOTP value for one counter, zero-padded to `digits`. */
export function hotp(
  key: Buffer,
  counter: number,
  digits = TOTP_DIGITS,
  algorithm: "sha1" | "sha256" | "sha512" = "sha1",
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(algorithm, key).update(message).digest();
  // Dynamic truncation (RFC 4226 §5.3): 31 bits from an offset the digest picks.
  const offset = digest.readUInt8(digest.length - 1) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totp(secretBase32: string, now = Date.now()): string {
  return hotp(base32Decode(secretBase32), timeStep(now));
}

/**
 * Checks a submitted code and returns the time step it matched, or null.
 *
 * `afterStep` is the last step already used to sign in: a code is accepted at
 * most once, so a code read over someone's shoulder or replayed from a captured
 * request is worthless after the first use.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { now?: number; afterStep?: number | null } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretBase32);
  const current = timeStep(options.now);
  const submitted = Buffer.from(code);

  for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
    const step = current + drift;
    if (options.afterStep != null && step <= options.afterStep) continue;
    if (timingSafeEqual(Buffer.from(hotp(key, step)), submitted)) return step;
  }
  return null;
}

/** The otpauth:// URI an authenticator app reads from the enrolment QR code. */
export function otpauthUri(secretBase32: string, accountEmail: string): string {
  const issuer = "Grade GPA Planner";
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

// ─── Secret at rest ─────────────────────────────────────────────────────────
//
// A TOTP secret is as sensitive as a password: whoever reads it can mint codes
// forever. It is stored AES-256-GCM encrypted under a key derived from
// AUTH_SECRET, so a leaked database dump alone does not defeat the second factor.

function encryptionKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, "gradegpa-totp", "totp-secret-at-rest", 32),
  );
}

export function sealTotpSecret(plain: string, authSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(authSecret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function openTotpSecret(sealed: string, authSecret: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) {
    throw new Error("Unrecognised TOTP secret format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(authSecret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
