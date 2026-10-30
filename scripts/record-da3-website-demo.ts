/**
 * DA3 demo video recorded on the live website, with narration
 * (docs/da3/video/website-demo.mp4).
 *
 *   docker compose -f docker-compose.scale.yml up -d     # Q1: 3 replicas + Nginx on :8080
 *   SITE_URL=https://grade-gpa-git-assignment-3-sindhuja4.vercel.app \
 *   [VERCEL_BYPASS=<Protection Bypass for Automation secret>] \
 *     npx tsx scripts/record-da3-website-demo.ts
 *
 * Everything on screen is live: Q1 requests go through the running Nginx, the
 * failover scene really stops gradegpa-backend-2, and Q2 is performed on the
 * website. Measured results that cannot be reproduced in seconds (the
 * 1,000-request benchmarks, Trivy) are shown from the evidence files.
 *
 * The demo student must have no authenticator enrolled at the start; the
 * recording enrols one, and the script turns it off again afterwards.
 */

import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, type APIRequestContext, type Page } from "playwright-core";
import { totp } from "../src/lib/auth/totp";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs/da3/video");
const WORK = join(OUT_DIR, ".work-website");
const SITE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LB = process.env.LB_URL ?? "http://localhost:8080";
const VOICE = process.env.VOICE ?? "Samantha";
const RATE = process.env.RATE ?? "188";
const SIZE = { width: 1280, height: 720 };
const SLIDES = `file://${join(OUT_DIR, "slides.html")}`;
const STUDENT = { email: "student@example.com", password: "planner123" };
const ADVISOR = { email: "advisor@example.com", password: "advisor123" };

type Ctx = { page: Page; pace: (ms: number) => Promise<void>; state: State };
type State = { secret?: string; lastCode?: string };
type Scene = { id: string; title: string; screen: string; text: string; act: (ctx: Ctx) => Promise<void> };

const slide = (id: string) => async ({ page }: Ctx) => {
  if (!page.url().startsWith("file:")) await page.goto(SLIDES);
  await page.evaluate((s) => (window as unknown as { showSlide(id: string): void }).showSlide(s), id);
};

// ── Load-balancer monitor: a page that renders real requests made to Nginx ──

const MONITOR_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1280px;height:720px;background:#0f172a;color:#e2e8f0;font-family:-apple-system,Helvetica,Arial,sans-serif}
  header{padding:26px 40px 8px} h1{font-size:28px;margin:0} .sub{color:#94a3b8;font-size:16px;margin-top:6px}
  .cards{display:flex;gap:18px;padding:16px 40px}
  .card{flex:1;background:#1e293b;border-radius:12px;padding:16px 20px;border:2px solid #334155;transition:all .2s}
  .card.hit{border-color:#4ade80;background:#14532d}
  .card.down{border-color:#f87171;background:#450a0a}
  .card h2{margin:0;font-size:18px} .card .n{font-size:40px;font-weight:700;margin-top:6px}
  .card .st{font-size:13px;color:#94a3b8;margin-top:2px}
  #log{margin:6px 40px;font-family:Menlo,monospace;font-size:15px;line-height:1.55;height:330px;overflow:hidden;
       background:#020617;border-radius:10px;padding:12px 18px}
  .ok{color:#4ade80}.bad{color:#f87171}.ev{color:#fbbf24;font-weight:700}
  footer{padding:4px 40px;font-size:18px} footer b{font-size:22px}
</style></head><body>
<header><h1 id="title"></h1><div class="sub" id="sub"></div></header>
<div class="cards">${[1, 2, 3].map((n) => `<div class="card" id="c${n}"><h2>gradegpa-backend-${n}</h2><div class="st">backend${n}:3000 · host :300${n}</div><div class="n" id="n${n}">0</div><div class="st" id="s${n}">up</div></div>`).join("")}</div>
<div id="log"></div>
<footer>Requests: <b id="total">0</b> &nbsp;·&nbsp; Succeeded: <b id="good" class="ok">0</b> &nbsp;·&nbsp; Failed: <b id="bad">0</b></footer>
</body></html>`;

async function openMonitor(page: Page, title: string, sub: string) {
  await page.setContent(MONITOR_HTML);
  await page.evaluate(([t, s]) => {
    document.getElementById("title")!.textContent = t!;
    document.getElementById("sub")!.textContent = s!;
  }, [title, sub]);
}

async function monitorRequest(page: Page, api: APIRequestContext) {
  const started = Date.now();
  let line: string;
  let instance: string | null = null;
  let ok = false;
  try {
    const response = await api.get(`${LB}/api/health`, { timeout: 15_000 });
    const body = await response.json().catch(() => null);
    instance = body?.instance ?? null;
    ok = response.ok();
    line = `GET ${LB}/api/health → <span class="${ok ? "ok" : "bad"}">${response.status()}</span> ${instance ?? ""} <span style="color:#64748b">${Date.now() - started} ms</span>`;
  } catch (error) {
    line = `GET ${LB}/api/health → <span class="bad">FAILED</span> ${(error as Error).message.split("\n")[0]}`;
  }
  await page.evaluate(([html, inst, good]) => {
    const log = document.getElementById("log")!;
    log.insertAdjacentHTML("afterbegin", `<div>${html}</div>`);
    const total = document.getElementById("total")!;
    total.textContent = String(Number(total.textContent) + 1);
    const counter = document.getElementById(good === "1" ? "good" : "bad")!;
    counter.textContent = String(Number(counter.textContent) + 1);
    document.querySelectorAll(".card").forEach((c) => c.classList.remove("hit"));
    const n = inst?.replace("backend", "");
    if (n) {
      document.getElementById(`c${n}`)!.classList.add("hit");
      const el = document.getElementById(`n${n}`)!;
      el.textContent = String(Number(el.textContent) + 1);
    }
  }, [line, instance ?? "", ok ? "1" : "0"]);
}

async function monitorEvent(page: Page, text: string, downInstance?: number) {
  await page.evaluate(([t, n]) => {
    document.getElementById("log")!.insertAdjacentHTML("afterbegin", `<div class="ev">$ ${t}</div>`);
    if (n) {
      document.getElementById(`c${n}`)!.classList.add("down");
      document.getElementById(`s${n}`)!.textContent = "STOPPED";
    }
  }, [text, downInstance ? String(downInstance) : ""]);
}

// ── API console: real requests to the website, shown on top of the page ──

async function apiConsole(page: Page, lines: string[]) {
  await page.evaluate((all) => {
    let box = document.getElementById("da3-console");
    if (!box) {
      box = document.createElement("div");
      box.id = "da3-console";
      box.style.cssText =
        "position:fixed;left:40px;right:40px;bottom:30px;z-index:99999;background:#0f172a;color:#e2e8f0;" +
        "font:15px/1.6 Menlo,monospace;padding:16px 20px;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.4);" +
        "white-space:pre";
      document.body.appendChild(box);
    }
    box.innerHTML = all.join("<br>");
  }, lines);
}

const status = (code: number) =>
  `<b style="color:${code < 300 ? "#4ade80" : "#f87171"}">${code}</b>`;

async function apiCall(request: APIRequestContext, method: string, path: string, data?: unknown) {
  const response = await request.fetch(`${SITE}${path}`, { method, data, failOnStatusCode: false });
  const body = await response.json().catch(() => null);
  return { code: response.status(), message: body?.error ? `${body.error.code}: ${body.error.message}` : "ok" };
}

// ── Scenes ──────────────────────────────────────────────────────────────────

const SCENES: Scene[] = [
  {
    id: "intro",
    title: "Introduction — the live website",
    screen: `${SITE} — the deployed application`,
    text: "This is our Grade GPA Planner, live on Vercel, the hosting platform from Assignment 1. This video shows how we scaled it for results day, and how we secured it.",
    act: async ({ page, pace }) => {
      await page.goto(`${SITE}/`);
      await pace(4000);
      await page.goto(`${SITE}/login`);
    },
  },
  {
    id: "q1a",
    title: "Q1 (a) Three instances behind Nginx, live",
    screen: "live requests through Nginx on :8080, rotating across the three containers",
    text: "Question one. On results day every student checks their CGPA at once, so the API hit hardest is GET slash API slash CGPA. We run three backend containers with Docker Compose behind an Nginx load balancer on port 8080, all connected to our Prisma Postgres cloud database. These are live requests through Nginx, and the answers rotate across backend one, two and three.",
    act: async ({ page, pace }) => {
      await openMonitor(page, "Nginx load balancer · http://localhost:8080", "docker-compose.scale.yml · 3 replicas of gradegpa:hardened · Prisma Postgres (db.prisma.io)");
      await pace(2500);
      for (let i = 0; i < 18; i += 1) {
        await monitorRequest(page, page.request);
        await pace(900);
      }
    },
  },
  {
    id: "q1b",
    title: "Q1 (b) Load test results",
    screen: "slide q1b — Apache Bench results from docs/da3/evidence",
    text: "We load tested that API with Apache Bench: a thousand requests at concurrency fifty. One instance gave three point one nine requests per second, averaging fifteen point seven seconds. Three instances gave nine point two seven per second and five point four seconds, two point nine times the throughput.",
    act: slide("q1b"),
  },
  {
    id: "q1c",
    title: "Q1 (c) Stopping an instance, live",
    screen: "live requests while gradegpa-backend-2 is stopped",
    text: "Now we stop backend two while requests keep flowing. With proxy next upstream, a two second connect timeout and max fails, Nginx replays any request that hits the dead container on a healthy one, so not one request fails. In the full load test, the naive configuration lost nine requests, and this one lost zero.",
    act: async ({ page, pace }) => {
      await openMonitor(page, "Failover test · stopping one replica under load", "deploy/nginx/lb-3.conf · proxy_next_upstream error timeout · max_fails=1 · proxy_connect_timeout 2s");
      for (let i = 0; i < 4; i += 1) {
        await monitorRequest(page, page.request);
        await pace(500);
      }
      await monitorEvent(page, "docker stop gradegpa-backend-2", 2);
      const stopping = run("docker", ["stop", "gradegpa-backend-2"]);
      for (let i = 0; i < 22; i += 1) {
        // Fired concurrently with the stop, as real traffic would be.
        await Promise.all([monitorRequest(page, page.request), monitorRequest(page, page.request)]);
        await pace(450);
      }
      await stopping;
    },
  },
  {
    id: "q1d",
    title: "Q1 (d) Architecture and cloud bursting",
    screen: "slide q1d — architecture diagram",
    text: "The architecture shows Nginx, the three containers on ports 3001 to 3003, and the cloud database. In orange is cloud bursting to Vercel. Results day is a short, predictable spike, so overflow goes to serverless functions that scale back to zero. Edge computing would not help, because every answer comes from the central database.",
    act: slide("q1d"),
  },
  {
    id: "q2a",
    title: "Q2 (a) Sensitive data and password hashing",
    screen: "slide q2a — users table before and after the hashing script",
    text: "Question two. Our most sensitive data is student marks. Passwords are stored as salted bcrypt hashes, and our migration script converts any plain text password into one.",
    act: slide("q2a"),
  },
  {
    id: "q2b-mfa",
    title: "Q2 (b) Authenticator-app MFA on the website",
    screen: `${SITE} — Security page, QR enrolment, sign-in with the code`,
    text: "Here is multi-factor authentication on the live website. On the Security page, the student scans the QR code with Google or Microsoft Authenticator, and confirms a six digit code. After signing out, the password alone is no longer enough. The site asks for the authenticator code. Each code works only once, and the secret is stored encrypted.",
    act: async ({ page, pace, state }) => {
      await page.goto(`${SITE}/login`);
      await page.fill('input[name="email"]', STUDENT.email);
      await page.fill('input[name="password"]', STUDENT.password);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard");
      await pace(1500);
      await page.click("nav >> text=Security");
      await page.waitForSelector("text=Set up authenticator");
      await pace(1200);
      await page.click("text=Set up authenticator");
      await page.waitForSelector('img[alt="QR code for your authenticator app"]');
      await pace(4500);
      state.secret = (await page.textContent("section code"))!.trim();
      await page.type('input[name="code"]', totp(state.secret), { delay: 120 });
      await page.click("text=Turn on");
      await page.waitForSelector("text=Two-step sign-in is now on.");
      await pace(2200);
      await page.click("text=Sign out");
      await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"));
      await page.goto(`${SITE}/login`);
      await page.fill('input[name="email"]', STUDENT.email);
      await page.fill('input[name="password"]', STUDENT.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('input[name="otp"]');
      await pace(2500);
      // Enrolment used this time step; codes are single-use, so sign in with the next.
      state.lastCode = totp(state.secret, Date.now() + 30_000);
      await page.type('input[name="otp"]', state.lastCode, { delay: 120 });
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard");
      await pace(1500);
    },
  },
  {
    id: "q2b-api",
    title: "Q2 (b) Update/Delete restricted by role, on the website's API",
    screen: `${SITE} — real API calls: no session, then the read-only advisor`,
    text: "Update and delete are restricted by role. Calling the delete API without a session returns 401. A faculty advisor can read, but its update and delete requests are rejected with 403 forbidden.",
    act: async ({ page, pace }) => {
      await page.goto(`${SITE}/dashboard/subjects`);
      const subjects = await page.evaluate(async () => (await (await fetch("/api/subjects")).json()).data);
      const subject = subjects[0] as { id: string; name: string };
      const lines = [`<span style="color:#94a3b8"># ${SITE}</span>`];
      const show = async () => apiConsole(page, lines);

      const noSession = await page.evaluate(async (id) => {
        const r = await fetch(`/api/subjects/${id}`, { method: "DELETE", credentials: "omit" });
        return { code: r.status, body: await r.json().catch(() => null) };
      }, subject.id);
      lines.push(`DELETE /api/subjects/${subject.id.slice(0, 10)}…  (no session)   → ${status(noSession.code)} ${noSession.body?.error?.code ?? ""}`);
      await show();
      await pace(2500);

      const advisor = await page.context().browser()!.newContext({ extraHTTPHeaders: bypassHeaders() });
      const login = await apiCall(advisor.request, "POST", "/api/auth/login", ADVISOR);
      lines.push(`POST   /api/auth/login  advisor@example.com      → ${status(login.code)} ${login.message}`);
      const read = await apiCall(advisor.request, "GET", "/api/subjects");
      lines.push(`GET    /api/subjects    (advisor)                → ${status(read.code)} ${read.message}`);
      await show();
      await pace(1500);
      const put = await apiCall(advisor.request, "PUT", `/api/subjects/${subject.id}`, { name: "changed by advisor" });
      lines.push(`PUT    /api/subjects/…  (advisor)                → ${status(put.code)} ${put.message}`);
      const del = await apiCall(advisor.request, "DELETE", `/api/subjects/${subject.id}`);
      lines.push(`DELETE /api/subjects/…  (advisor)                → ${status(del.code)} ${del.message}`);
      await show();
      await advisor.close();
      await pace(3000);
    },
  },
  {
    id: "q2c",
    title: "Q2 (c) Trivy scan and hardening",
    screen: "slide q2c — Trivy results",
    text: "Trivy found twenty seven critical and four eighty seven high vulnerabilities in the original Debian image running as root. Alpine, a multi-stage build and a non-root user cut that to three and three, and a Next.js security upgrade brought it to zero and zero.",
    act: slide("q2c"),
  },
  {
    id: "q2d",
    title: "Q2 (d) Threat agents and GDPR",
    screen: "slide q2d — threat agents",
    text: "Finally, an external attacker with stolen passwords is stopped by MFA and hashing, and a malicious insider altering marks is stopped by roles and ownership checks. Both map to GDPR articles thirty two and five, because we process identifiable students' personal data. Thank you.",
    act: slide("q2d"),
  },
];

function bypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_BYPASS;
  return secret
    ? { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" }
    : {};
}

function duration(file: string): number {
  return Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
      .toString().trim(),
  );
}

/** Leaves the demo student as it was found: no authenticator enrolled. */
async function disableMfa(request: APIRequestContext, state: State) {
  if (!state.secret) return;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    for (const offset of [0, 30_000]) {
      const code = totp(state.secret, Date.now() + offset);
      if (code === state.lastCode) continue;
      const result = await apiCall(request, "DELETE", "/api/auth/mfa", { code });
      if (result.code === 200) {
        console.log("authenticator turned off again for", STUDENT.email);
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.error(`!! could not turn MFA off for ${STUDENT.email}; do it from the Security page`);
}

async function preflight() {
  // Wake the serverless functions first, so the video does not open on a
  // blank page while Vercel cold-starts.
  for (const path of ["/", "/login", "/dashboard/security"]) {
    await fetch(`${SITE}${path}`, { headers: bypassHeaders(), redirect: "manual" }).catch(() => {});
  }
  const probe = await fetch(`${SITE}/api/health`, { headers: bypassHeaders(), redirect: "manual" });
  if (probe.status !== 200) {
    throw new Error(`${SITE} returned ${probe.status}. Turn off Vercel Authentication for previews, or set VERCEL_BYPASS.`);
  }
  const login = await fetch(`${SITE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...bypassHeaders() },
    body: JSON.stringify(STUDENT),
  });
  const body = await login.json().catch(() => null);
  if (body?.error?.code === "MFA_REQUIRED") {
    throw new Error(`${STUDENT.email} already has an authenticator enrolled. Turn it off on the Security page first.`);
  }
  if (!login.ok) throw new Error(`Student sign-in failed: ${login.status} ${JSON.stringify(body)}`);
  for (const n of [1, 2, 3]) {
    const state = execFileSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", `gradegpa-backend-${n}`]).toString().trim();
    if (state !== "healthy") throw new Error(`gradegpa-backend-${n} is ${state}; start docker-compose.scale.yml first.`);
  }
}

async function main() {
  await preflight();
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  const clips = SCENES.map((scene) => {
    const file = join(WORK, `${scene.id}.aiff`);
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", file, scene.text]);
    return { ...scene, file, seconds: duration(file) };
  });
  console.log(`narration: ${clips.reduce((s, c) => s + c.seconds, 0).toFixed(1)} s`);

  const browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 60_000 });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: WORK, size: SIZE },
    extraHTTPHeaders: bypassHeaders(),
  });
  const page = await context.newPage();
  const state: State = {};
  const t0 = Date.now();
  const starts: number[] = [];
  const pace = (ms: number) => page.waitForTimeout(ms);

  try {
    for (const clip of clips) {
      console.log(`scene ${clip.id} (${clip.seconds.toFixed(1)} s)`);
      const begin = Date.now();
      starts.push((begin - t0) / 1000);
      await clip.act({ page, pace, state });
      const left = clip.seconds * 1000 + 400 - (Date.now() - begin);
      if (left > 0) await page.waitForTimeout(left);
    }
  } finally {
    await disableMfa(context.request, state).catch((e) => console.error(e));
    await run("docker", ["start", "gradegpa-backend-2"]).catch(() => {});
    await context.close();
    await browser.close();
  }

  const webm = join(WORK, readdirSync(WORK).find((f) => f.endsWith(".webm"))!);
  const inputs = clips.flatMap((clip) => ["-i", clip.file]);
  const delays = clips
    .map((_, i) => `[${i + 1}:a]adelay=${Math.round(starts[i]! * 1000)}:all=1[a${i}]`)
    .join(";");
  const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0[aout]`;
  // End when the last scene ends, not when the browser finished closing.
  const sceneEnds = clips.map((clip, i) => starts[i]! + clip.seconds + 0.4);
  const end = Math.max(...sceneEnds.slice(-1)) + 1.2;
  const out = join(OUT_DIR, "website-demo.mp4");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", webm, ...inputs,
    "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-t", end.toFixed(2),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "medium",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
  ]);
  const total = duration(out);
  console.log(`video: ${out} — ${total.toFixed(1)} s ${total > 180 ? "(OVER 3:00)" : "(under 3:00)"}`);

  const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  writeFileSync(
    join(ROOT, "docs/da3/WEBSITE_VIDEO_SCRIPT.md"),
    [
      "# DA3 Website Demo — Voice Script",
      "",
      `Video: \`docs/da3/video/website-demo.mp4\` (${stamp(total)}), recorded on ${SITE}`,
      `with Nginx at ${LB}. Voice: macOS \`say -v ${VOICE} -r ${RATE}\`. To narrate it yourself,`,
      "read each section at the time shown.",
      "",
      "Generated by `scripts/record-da3-website-demo.ts`.",
      "",
      ...clips.flatMap((clip, i) => [
        `## ${stamp(starts[i]!)}–${stamp(starts[i + 1] ?? total)} · ${clip.title}`,
        "",
        `*On screen: ${clip.screen}*`,
        "",
        `> ${clip.text}`,
        "",
      ]),
    ].join("\n"),
  );
  rmSync(WORK, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
