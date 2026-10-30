/**
 * Screenshots for docs/DA3_REPORT.md (docs/da3/screenshots/*.png).
 *
 *   docker compose -f docker-compose.scale.yml up -d
 *   SITE_URL=https://grade-gpa-git-assignment-3-sindhuja4.vercel.app \
 *     npx tsx scripts/da3-screenshots.ts
 *
 * Terminal screenshots are rendered from real command output: commands that
 * can be re-run in seconds (docker ps, curl, docker images) are run now; the
 * long measurements (1,000-request ab runs, Trivy, the password migration)
 * are rendered from the raw files saved in docs/da3/evidence when they ran.
 * Browser screenshots are taken on the live website. The demo student must
 * have no authenticator enrolled; the script turns it off again at the end.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { totp } from "../src/lib/auth/totp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/da3/screenshots");
const EVIDENCE = join(ROOT, "docs/da3/evidence");
const SITE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LB = "http://localhost:8080";
const STUDENT = { email: "student@example.com", password: "planner123" };
const ADVISOR = { email: "advisor@example.com", password: "advisor123" };

type Block = { cmd?: string; out: string; note?: string };

const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: ROOT }).toString().trimEnd();
const evidence = (file: string) => readFileSync(join(EVIDENCE, file), "utf8").trimEnd();
/** Whole lines from the first containing `from` to the next containing `to`. */
const between = (text: string, from: string, to: string) => {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.includes(from));
  const end = lines.findIndex((l, i) => i >= start && l.includes(to));
  return lines.slice(start, end + 1).join("\n");
};
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function terminal(browser: Browser, file: string, title: string, blocks: Block[]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const body = blocks
    .map((b) =>
      [
        b.note ? `<div class="note"># ${escape(b.note)}</div>` : "",
        b.cmd ? `<div class="cmd"><span class="ps">$</span> ${escape(b.cmd)}</div>` : "",
        `<pre>${escape(b.out)}</pre>`,
      ].join(""),
    )
    .join("");
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:20px;background:#fff;font-family:-apple-system,Helvetica,Arial,sans-serif;width:max-content;max-width:1160px}
    .win{background:#0f172a;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.25)}
    .bar{background:#1e293b;color:#94a3b8;font-size:13px;padding:9px 14px;display:flex;gap:8px;align-items:center}
    .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
    .content{padding:14px 18px 16px}
    .cmd{font:13.5px/1.5 Menlo,monospace;color:#e2e8f0;margin-top:8px} .ps{color:#4ade80}
    .note{font:13px/1.5 Menlo,monospace;color:#64748b;margin-top:10px}
    pre{font:13px/1.45 Menlo,monospace;color:#cbd5e1;margin:4px 0 6px;white-space:pre}
  </style></head><body><div class="win"><div class="bar">
    <span class="dot" style="background:#f87171"></span><span class="dot" style="background:#fbbf24"></span>
    <span class="dot" style="background:#4ade80"></span>&nbsp; ${escape(title)}</div>
    <div class="content">${body}</div></div></body></html>`);
  await page.locator(".win").screenshot({ path: join(OUT, file) });
  await page.close();
  console.log("wrote", file);
}

function curl(args: string[]) {
  return execFileSync("curl", ["-s", "-w", "\\nHTTP %{http_code}", ...args]).toString().trim();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ── Q1(a): live ──
  const health = Array.from({ length: 6 }, () => sh("curl", ["-s", `${LB}/api/health`])).join("\n");
  await terminal(browser, "q1a-compose-and-rotation.png", "grade-gpa — docker compose + Nginx", [
    {
      cmd: "docker compose -f docker-compose.scale.yml ps",
      out: sh("docker", ["compose", "-f", "docker-compose.scale.yml", "ps", "--format", "table {{.Name}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"]),
    },
    { cmd: `for i in 1 2 3 4 5 6; do curl -s ${LB}/api/health; echo; done`, out: health },
    {
      note: "Nginx access log, 3-instance load test: /api/cgpa requests per upstream address",
      out: evidence("q1a-distribution-3-instances.txt").split("\n").filter((l) => l.includes("upstream=")).join("\n"),
    },
    {
      note: "which container owns each address (docker network inspect)",
      out: evidence("q1a-distribution-3-instances.txt").split("\n").filter((l) => l.startsWith("gradegpa-")).sort().join("\n"),
    },
  ]);

  // ── Q1(b): from the saved ab runs ──
  const abCmd = 'ab -n 1000 -c 50 -s 60 -C "authjs.session-token=…" http://127.0.0.1:8080/api/cgpa';
  for (const [file, label, src] of [
    ["q1b-ab-1-instance.png", "1 instance (NGINX_CONF=lb-1.conf)", "q1b-ab-1-instance.txt"],
    ["q1b-ab-3-instances.png", "3 instances (lb-3.conf)", "q1b-ab-3-instances.txt"],
  ] as const) {
    const text = evidence(src);
    await terminal(browser, file, `Apache Bench — ${label}`, [
      { cmd: abCmd, out: between(text, "Server Software", "Transfer rate") },
      { note: "Percentage of the requests served within a certain time (ms)", out: between(text, "  50%", "100%") },
    ]);
  }

  // ── Q1(c): from the saved failover runs ──
  for (const [file, label, ab, codes, timeline] of [
    ["q1c-before-naive.png", "BEFORE — lb-3-naive.conf (no failover)", "q1c-ab-naive-stop-one.txt", "q1c-naive-status-codes.txt", "q1c-naive-timeline.txt"],
    ["q1c-after-failover.png", "AFTER — lb-3.conf (proxy_next_upstream)", "q1c-ab-resilient-stop-one.txt", "q1c-resilient-status-codes.txt", "q1c-resilient-timeline.txt"],
  ] as const) {
    const text = evidence(ab);
    const summary = text
      .split("\n")
      .filter((l) => /^(Complete requests|Failed requests|Non-2xx responses|Requests per second|Time per request:.*\(mean\)$)/.test(l))
      .join("\n");
    const blocks: Block[] = [
      { cmd: `${abCmd} &`, out: "" },
      { cmd: "sleep 20; docker stop gradegpa-backend-2", out: evidence(timeline).split("\n")[0]! },
      { note: "ab summary", out: summary },
      { note: "HTTP status of every /api/cgpa request (Nginx access log)", out: evidence(codes) },
    ];
    if (file.includes("after")) {
      blocks.push({
        note: "requests that hit the stopped replica (172.18.0.5) and were answered by another",
        out: evidence("q1c-resilient-retried-requests.txt"),
      });
    } else {
      blocks.push({ note: "Nginx error log", out: evidence("q1c-naive-nginx-errors.txt").split("\n").slice(0, 2).map((l) => l.slice(0, 150)).join("\n") });
    }
    await terminal(browser, file, label, blocks);
  }

  // ── Q2(a): from the saved migration run ──
  await terminal(browser, "q2a-password-hashing.png", "psql — users table", [
    { note: "BEFORE", cmd: `psql -c 'SELECT email, role, "passwordHash" FROM users ORDER BY email;'`, out: evidence("q2a-before.txt").split("\n").slice(1).join("\n") },
    { cmd: "npx tsx scripts/hash-plaintext-passwords.ts", out: evidence("q2a-migration-run.txt") },
    { note: "AFTER", cmd: `psql -c 'SELECT email, role, "passwordHash" FROM users ORDER BY email;'`, out: evidence("q2a-after.txt").split("\n").slice(1).join("\n") },
  ]);

  // ── Q2(b): live on the website (SKIP_SITE=1 re-renders only the terminal shots) ──
  if (!process.env.SKIP_SITE) await websiteShots(browser);

  await trivyShot(browser);
  await browser.close();
}

async function websiteShots(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  let secret: string | undefined;
  let usedCode: string | undefined;
  try {
    await page.goto(`${SITE}/login`);
    await page.fill('input[name="email"]', STUDENT.email);
    await page.fill('input[name="password"]', STUDENT.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
    await page.click("nav >> text=Security");
    await page.click("text=Set up authenticator");
    await page.waitForSelector('img[alt="QR code for your authenticator app"]');
    secret = (await page.textContent("section code"))!.trim();
    await page.screenshot({ path: join(OUT, "q2b-security-qr.png") });
    console.log("wrote q2b-security-qr.png");

    await page.fill('input[name="code"]', totp(secret));
    await page.click("text=Turn on");
    await page.waitForSelector("text=Two-step sign-in is now on.");
    await page.screenshot({ path: join(OUT, "q2b-mfa-enabled.png") });
    console.log("wrote q2b-mfa-enabled.png");

    await page.click("text=Sign out");
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"));
    await page.goto(`${SITE}/login`);
    await page.fill('input[name="email"]', STUDENT.email);
    await page.fill('input[name="password"]', STUDENT.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[name="otp"]');
    usedCode = totp(secret, Date.now() + 30_000);
    await page.fill('input[name="otp"]', usedCode);
    await page.screenshot({ path: join(OUT, "q2b-login-asks-for-code.png") });
    console.log("wrote q2b-login-asks-for-code.png");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");

    // API checks with curl, against the same website.
    const subjects = await page.evaluate(async () => (await (await fetch("/api/subjects")).json()).data);
    const id = (subjects[0] as { id: string }).id;
    const jar = join(OUT, ".advisor-cookies");
    const login = curl(["-c", jar, "-H", "content-type: application/json", "-d", JSON.stringify(ADVISOR), `${SITE}/api/auth/login`]);
    await terminal(browser, "q2b-api-401-403.png", `curl — ${SITE}`, [
      { note: "1. Update/Delete without a valid token", cmd: `curl -X DELETE ${SITE}/api/subjects/${id}`, out: curl(["-X", "DELETE", `${SITE}/api/subjects/${id}`]) },
      { cmd: `curl -X PUT -b "__Secure-authjs.session-token=forged" -d '{"name":"x"}' ${SITE}/api/subjects/${id}`, out: curl(["-X", "PUT", "-b", "__Secure-authjs.session-token=forged", "-H", "content-type: application/json", "-d", '{"name":"x"}', `${SITE}/api/subjects/${id}`]) },
      { note: "2. Signed in as the read-only ADVISOR", cmd: `curl -c jar -d '{"email":"advisor@example.com",…}' ${SITE}/api/auth/login`, out: login },
      { cmd: `curl -b jar ${SITE}/api/subjects`, out: curl(["-b", jar, `${SITE}/api/subjects`]) },
      { cmd: `curl -b jar -X PUT -d '{"name":"changed by advisor"}' ${SITE}/api/subjects/${id}`, out: curl(["-b", jar, "-X", "PUT", "-H", "content-type: application/json", "-d", '{"name":"changed by advisor"}', `${SITE}/api/subjects/${id}`]) },
      { cmd: `curl -b jar -X DELETE ${SITE}/api/subjects/${id}`, out: curl(["-b", jar, "-X", "DELETE", `${SITE}/api/subjects/${id}`]) },
    ]);
    execFileSync("rm", ["-f", jar]);
  } finally {
    // Leave the demo student as it was: no authenticator.
    if (secret) {
      let off = false;
      for (let attempt = 0; attempt < 12 && !off; attempt += 1) {
        for (const offset of [0, 30_000]) {
          const code = totp(secret, Date.now() + offset);
          if (code === usedCode) continue;
          const r = await page.request.fetch(`${SITE}/api/auth/mfa`, { method: "DELETE", data: { code }, failOnStatusCode: false });
          if (r.ok()) { off = true; break; }
        }
        if (!off) await new Promise((r) => setTimeout(r, 10_000));
      }
      console.log(off ? "authenticator turned off again" : "!! turn MFA off manually on the Security page");
    }
    await context.close();
  }
}

async function trivyShot(browser: Browser) {
  // ── Q2(c): from the saved Trivy runs, plus live image sizes ──
  const totals = (file: string) => {
    const lines = evidence(file).split("\n");
    return lines
      .map((l, i) => (l.startsWith("Total:") ? `${lines[i - 2]}\n${l}` : null))
      .filter(Boolean)
      .join("\n\n");
  };
  /** The summary table's header and its OS row: top border to the second separator. */
  const summaryHead = (file: string) => {
    const lines = evidence(file).split("\n");
    const top = lines.findIndex((l) => l.startsWith("┌"));
    return lines.slice(top, top + 5).join("\n");
  };
  const scan = (image: string) => `trivy image --scanners vuln --severity CRITICAL,HIGH ${image}`;
  await terminal(browser, "q2c-trivy-before-after.png", "Trivy 0.76.1 — CRITICAL and HIGH", [
    { note: "BEFORE: Dockerfile.baseline (node:22, Debian 12, root)", cmd: scan("gradegpa:baseline"), out: totals("q2c-trivy-baseline.txt") },
    { note: "AFTER hardening: Dockerfile (node:22-alpine, multi-stage, non-root)", cmd: scan("gradegpa:hardened"), out: `${summaryHead("q2c-trivy-hardened.txt")}\n\n${totals("q2c-trivy-hardened.txt")}` },
    { note: "AFTER hardening + Next.js 16.4.1", cmd: scan("gradegpa:hardened"), out: evidence("q2c-trivy-hardened-patched.txt").split("\n").slice(1, 10).join("\n") + "\n   …every target: 0\n\nLegend:\n- '0': Clean (no security findings detected)" },
    { cmd: "docker images gradegpa", out: sh("docker", ["images", "gradegpa", "--format", "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"]) },
    { cmd: "docker run --rm --entrypoint id gradegpa:baseline", out: sh("docker", ["run", "--rm", "--entrypoint", "id", "gradegpa:baseline"]) },
    { cmd: "docker run --rm --entrypoint id gradegpa:hardened", out: sh("docker", ["run", "--rm", "--entrypoint", "id", "gradegpa:hardened"]) },
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
