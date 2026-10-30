/**
 * DA3 Q2(b) walkthrough against a running server, printing every request and
 * status code — the evidence for the report and the demo video.
 *
 *   BASE_URL=http://localhost:8080 npx tsx scripts/da3-auth-demo.ts
 *
 * Needs the seed student (npm run db:seed) and the advisor account
 * (tsx scripts/da3-demo-accounts.ts advisor). Enrols the student in TOTP,
 * reading codes from the same RFC 6238 implementation an authenticator app
 * runs — then turns it off again, so the script can be re-run.
 */

import { totp } from "../src/lib/auth/totp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

type Jar = { cookie?: string };

async function call(
  label: string,
  method: string,
  path: string,
  options: { jar?: Jar; body?: unknown; cookie?: string } = {},
) {
  const headers: Record<string, string> = {};
  if (options.body) headers["content-type"] = "application/json";
  const cookie = options.cookie ?? options.jar?.cookie;
  if (cookie) headers.cookie = cookie;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  const setCookie = response.headers
    .getSetCookie()
    .find((c) => c.includes("authjs.session-token="));
  if (setCookie && options.jar) options.jar.cookie = setCookie.split(";")[0];

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  const summary = payload?.error
    ? `${payload.error.code}: ${payload.error.message}`
    : "ok";
  console.log(`${String(response.status).padEnd(4)} ${method.padEnd(6)} ${path.padEnd(32)} ${label} → ${summary}`);
  return { status: response.status, data: payload?.data };
}

const nextStepCode = (secret: string) => totp(secret, Date.now() + 30_000);

async function main() {
  console.log(`Target: ${BASE}\n`);
  const student: Jar = {};
  const advisor: Jar = {};
  const creds = { email: "student@example.com", password: "planner123" };

  console.log("── 1. Update/Delete without a valid token ──");
  await call("no cookie", "DELETE", "/api/subjects/any-id");
  await call("no cookie", "PUT", "/api/subjects/any-id", { body: { name: "x" } });
  await call("forged cookie", "DELETE", "/api/subjects/any-id", {
    cookie: "authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0.forged",
  });

  console.log("\n── 2. Enrol an authenticator (TOTP) ──");
  await call("password only (no MFA yet)", "POST", "/api/auth/login", { jar: student, body: creds });
  const setup = await call("start enrolment", "POST", "/api/auth/mfa", { jar: student });
  const secret: string = setup.data.secret;
  console.log(`     otpauth URI: ${setup.data.otpauthUri.replace(secret, "<secret>")}`);
  await call("wrong code", "PUT", "/api/auth/mfa", { jar: student, body: { code: "000000" } });
  await call("code from app", "PUT", "/api/auth/mfa", { jar: student, body: { code: totp(secret) } });
  await call("sign out", "POST", "/api/auth/logout", { jar: student });

  console.log("\n── 3. Sign-in now needs the second factor ──");
  const fresh: Jar = {};
  await call("password only", "POST", "/api/auth/login", { jar: fresh, body: creds });
  await call("wrong code", "POST", "/api/auth/login", { jar: fresh, body: { ...creds, otp: "123456" } });
  const otp = nextStepCode(secret);
  await call("password + TOTP", "POST", "/api/auth/login", { jar: fresh, body: { ...creds, otp } });
  await call("same code replayed", "POST", "/api/auth/login", { jar: {}, body: { ...creds, otp } });

  console.log("\n── 4. Role check: STUDENT may update/delete own records ──");
  const subjects = await call("list", "GET", "/api/subjects", { jar: fresh });
  const subject = subjects.data[0];
  await call("rename own subject", "PUT", `/api/subjects/${subject.id}`, {
    jar: fresh,
    body: { name: subject.name },
  });
  const semester = await call("create scratch semester", "POST", "/api/semesters", {
    jar: fresh,
    body: { academicYear: "2099-00", semesterNumber: 1 },
  });
  await call("delete it", "DELETE", `/api/semesters/${semester.data.id}`, { jar: fresh });

  console.log("\n── 5. Role check: ADVISOR is read-only ──");
  await call("advisor sign-in", "POST", "/api/auth/login", {
    jar: advisor,
    body: { email: "advisor@example.com", password: "advisor123" },
  });
  await call("advisor read", "GET", "/api/subjects", { jar: advisor });
  await call("advisor update", "PUT", `/api/subjects/${subject.id}`, {
    jar: advisor,
    body: { name: "changed by advisor" },
  });
  await call("advisor delete", "DELETE", `/api/subjects/${subject.id}`, { jar: advisor });

  console.log("\n── 6. Reset: turn the authenticator off again ──");
  await new Promise((resolve) => setTimeout(resolve, 31_000));
  await call("disable with current code", "DELETE", "/api/auth/mfa", {
    jar: fresh,
    body: { code: nextStepCode(secret) },
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
