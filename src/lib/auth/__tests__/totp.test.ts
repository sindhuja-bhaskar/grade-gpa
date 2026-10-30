import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  openTotpSecret,
  otpauthUri,
  sealTotpSecret,
  timeStep,
  totp,
  verifyTotp,
} from "../totp";

// RFC 6238 Appendix B: the SHA-1 seed is the ASCII string "12345678901234567890".
const RFC_SEED = Buffer.from("12345678901234567890");

describe("hotp / totp (RFC 4226, RFC 6238)", () => {
  it("matches the RFC 4226 Appendix D HOTP values", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314"];
    expected.forEach((code, counter) => {
      expect(hotp(RFC_SEED, counter)).toBe(code);
    });
  });

  it("matches the RFC 6238 Appendix B SHA-1 vectors (8 digits)", () => {
    const vectors: Array<[number, string]> = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
    ];
    for (const [seconds, code] of vectors) {
      expect(hotp(RFC_SEED, timeStep(seconds * 1000), 8)).toBe(code);
    }
  });

  it("round-trips base32 and decodes the RFC seed", () => {
    const encoded = base32Encode(RFC_SEED);
    expect(encoded).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(encoded).equals(RFC_SEED)).toBe(true);
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });
});

describe("verifyTotp", () => {
  const secret = base32Encode(RFC_SEED);
  const now = 1_700_000_000_000;

  it("accepts the current code and returns its step", () => {
    expect(verifyTotp(secret, totp(secret, now), { now })).toBe(timeStep(now));
  });

  it("tolerates one step of clock drift either way, but not two", () => {
    expect(verifyTotp(secret, totp(secret, now - 30_000), { now })).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now + 30_000), { now })).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 60_000), { now })).toBeNull();
  });

  it("rejects a code that was already used (replay)", () => {
    const code = totp(secret, now);
    const step = verifyTotp(secret, code, { now });
    expect(verifyTotp(secret, code, { now, afterStep: step })).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(verifyTotp(secret, "", { now })).toBeNull();
    expect(verifyTotp(secret, "12345", { now })).toBeNull();
    expect(verifyTotp(secret, "abcdef", { now })).toBeNull();
  });
});

describe("secret at rest", () => {
  it("seals and opens with the same key, and never stores the plain secret", () => {
    const secret = generateTotpSecret();
    const sealed = sealTotpSecret(secret, "auth-secret-a");
    expect(sealed).not.toContain(secret);
    expect(openTotpSecret(sealed, "auth-secret-a")).toBe(secret);
  });

  it("fails to open under a different key", () => {
    const sealed = sealTotpSecret(generateTotpSecret(), "auth-secret-a");
    expect(() => openTotpSecret(sealed, "auth-secret-b")).toThrow();
  });
});

it("builds an otpauth URI authenticator apps accept", () => {
  const uri = otpauthUri("JBSWY3DPEHPK3PXP", "student@example.com");
  expect(uri).toMatch(/^otpauth:\/\/totp\/Grade%20GPA%20Planner%3Astudent%40example\.com\?/);
  expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  expect(uri).toContain("issuer=Grade+GPA+Planner");
});
