/**
 * Builds the DA3 demo video with narration (docs/da3/video/demo.mp4).
 *
 *   npm i --no-save playwright-core          # uses the Chrome already installed
 *   brew install ffmpeg
 *   APP_URL=http://localhost:3300 npx tsx scripts/record-da3-demo.ts
 *
 * The app at APP_URL must have the seed student (npm run db:seed) with no
 * authenticator enrolled: the live scene enrols one, then signs in with it.
 * Point it at a disposable database, not production.
 *
 * Each scene's narration is synthesised with macOS `say` first, so every slide
 * is held exactly as long as its voice-over; the clips are then placed at the
 * moment their scene started in the capture. Also writes docs/da3/VIDEO_SCRIPT.md
 * with the real timings, for anyone who prefers to record their own voice.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { totp } from "../src/lib/auth/totp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs/da3/video");
const WORK = join(OUT_DIR, ".work");
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const VOICE = process.env.VOICE ?? "Samantha";
const RATE = process.env.RATE ?? "188";
const SIZE = { width: 1280, height: 720 };
const LIMIT_SECONDS = 180;

type Scene = {
  id: string;
  title: string;
  /** A slide id in slides.html, or "live" for the browser demonstration. */
  show: string;
  text: string;
};

const SCENES: Scene[] = [
  {
    id: "title",
    title: "Introduction",
    show: "title",
    text: "This is Digital Assignment 3 for the Grade GPA Planner, the cloud application from Assignment 1. Question one scales it. Question two secures it.",
  },
  {
    id: "q1a",
    title: "Q1 (a) Peak demand and three instances",
    show: "q1a",
    text: "Our peak is results day, when every student opens their CGPA within minutes. The hardest-hit API is GET slash API slash CGPA, which loads every mark and runs the GPA engine. Docker Compose runs three backend containers behind an Nginx load balancer, all connected to our Prisma Postgres cloud database. Health checks rotate backend one, two, three, and the load test split three thirty six, three thirty five, three thirty five.",
  },
  {
    id: "q1b",
    title: "Q1 (b) Load test, 1 vs 3 instances",
    show: "q1b",
    text: "Apache Bench sent a thousand requests at concurrency fifty. One instance managed three point one nine requests per second, averaging fifteen point seven seconds. Three instances reached nine point two seven per second and five point four seconds: two point nine times the throughput, because each replica brings its own database pool.",
  },
  {
    id: "q1c",
    title: "Q1 (c) Stopping an instance",
    show: "q1c",
    text: "Then we stopped backend two mid-test. With a naive Nginx config, nine requests failed with 502 errors. With proxy next upstream, a two second connect timeout and max fails, Nginx replays the request on a healthy replica. Zero failures, and twenty five requests silently retried.",
  },
  {
    id: "q1d",
    title: "Q1 (d) Architecture and cloud bursting",
    show: "q1d",
    text: "In the architecture, the orange tier is cloud bursting to Vercel, our Assignment 1 host. Results day is a short, predictable spike, so overflow goes to serverless functions that scale to zero afterwards. It works because our replicas are stateless. Edge computing would not help, since every answer comes from one student's records in the central database.",
  },
  {
    id: "q2a",
    title: "Q2 (a) Sensitive data and password hashing",
    show: "q2a",
    text: "Question two. Our most sensitive data is student marks and grades. Passwords are salted bcrypt hashes. Here, a legacy account stored in plain text is converted to a bcrypt hash by our migration script.",
  },
  {
    id: "live",
    title: "Q2 (b) Authenticator-app MFA, live",
    show: "live",
    text: "Now multi-factor authentication, live. On the Security page, the student scans this QR code with Google or Microsoft Authenticator, and confirms with a six digit code. After signing out, the password alone is no longer enough. The login asks for the authenticator code. Codes work once, and the secret is stored encrypted.",
  },
  {
    id: "q2b",
    title: "Q2 (b) Role-restricted Update and Delete",
    show: "q2b",
    text: "Update and delete are restricted by role. Without a valid token, the API returns 401. A faculty advisor can read, but update and delete return 403, while the student who owns the record succeeds.",
  },
  {
    id: "q2c",
    title: "Q2 (c) Trivy scan and hardening",
    show: "q2c",
    text: "Trivy found twenty seven critical and four eighty seven high vulnerabilities in the original Debian image running as root. Alpine, a multi-stage build and a non-root user cut that to three and three, and a Next.js security upgrade brought it to zero and zero.",
  },
  {
    id: "q2d",
    title: "Q2 (d) Threat agents and GDPR",
    show: "q2d",
    text: "Finally, an external attacker with stolen passwords is stopped by MFA and hashing, and a malicious insider altering marks is stopped by roles and ownership checks. Both map to GDPR articles thirty two and five, because we process identifiable students' personal data. Thank you.",
  },
];

function duration(file: string): number {
  return Number(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
    ]).toString().trim(),
  );
}

async function liveDemo(page: Page, pace: (ms: number) => Promise<void>) {
  const creds = { email: "student@example.com", password: "planner123" };

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
  await pace(1200);

  await page.click('nav >> text=Security');
  await page.waitForSelector("text=Set up authenticator");
  await pace(1500);
  await page.click("text=Set up authenticator");
  await page.waitForSelector('img[alt="QR code for your authenticator app"]');
  await pace(4500);

  // The key printed under the QR code is what the phone app would read.
  const secret = (await page.textContent("section code"))!.trim();
  await page.type('input[name="code"]', totp(secret), { delay: 120 });
  await pace(600);
  await page.click("text=Turn on");
  await page.waitForSelector("text=Two-step sign-in is now on.");
  await pace(2500);

  await page.click("text=Sign out");
  // Not "networkidle": the signed-out page keeps a connection open.
  await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"));
  await pace(800);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await pace(600);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="otp"]');
  await pace(3000);

  // The enrolment consumed this time step; the app accepts the next one.
  await page.type('input[name="otp"]', totp(secret, Date.now() + 30_000), { delay: 120 });
  await pace(600);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
  await pace(2500);
}

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  // 1. Narration, so the visuals can be timed to it.
  const clips = SCENES.map((scene) => {
    const file = join(WORK, `${scene.id}.aiff`);
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", file, scene.text]);
    return { ...scene, file, seconds: duration(file) };
  });
  const speech = clips.reduce((sum, clip) => sum + clip.seconds, 0);
  console.log(`narration: ${speech.toFixed(1)} s with voice ${VOICE} at ${RATE} wpm`);

  // 2. Capture.
  console.log("launching Chrome…");
  const browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 60_000 });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: WORK, size: SIZE },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const starts: number[] = [];
  const slides = `file://${join(OUT_DIR, "slides.html")}`;

  for (const clip of clips) {
    console.log(`scene ${clip.id} (${clip.seconds.toFixed(1)} s)`);
    if (clip.show === "live") {
      const begin = Date.now();
      starts.push((begin - t0) / 1000);
      await liveDemo(page, (ms) => page.waitForTimeout(ms));
      const left = clip.seconds * 1000 + 400 - (Date.now() - begin);
      if (left > 0) await page.waitForTimeout(left);
      await page.goto(slides);
    } else {
      if (!page.url().startsWith("file:")) await page.goto(slides);
      await page.evaluate((id) => (window as unknown as { showSlide(id: string): void }).showSlide(id), clip.show);
      starts.push((Date.now() - t0) / 1000);
      await page.waitForTimeout(clip.seconds * 1000 + 400);
    }
  }
  await page.waitForTimeout(800);
  await context.close();
  await browser.close();

  // 3. Lay each clip at its scene's start and mux.
  const webm = join(WORK, readdirSync(WORK).find((f) => f.endsWith(".webm"))!);
  const inputs = clips.flatMap((clip) => ["-i", clip.file]);
  const delays = clips
    .map((_, i) => `[${i + 1}:a]adelay=${Math.round(starts[i]! * 1000)}:all=1[a${i}]`)
    .join(";");
  const mix = `${delays};${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0[aout]`;
  const out = join(OUT_DIR, "demo.mp4");
  // The capture keeps running while the browser closes; end 1.5 s after the
  // last sentence instead of on a silent slide.
  const end = starts.at(-1)! + clips.at(-1)!.seconds + 1.5;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", webm, ...inputs,
    "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-t", end.toFixed(2),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "medium",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
  ]);
  const total = duration(out);
  console.log(`video: ${out} — ${total.toFixed(1)} s ${total > LIMIT_SECONDS ? "(OVER the 3-minute limit)" : "(under 3:00)"}`);

  // 4. The script, with the timings this capture actually has.
  const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const words = clips.reduce((n, c) => n + c.text.split(/\s+/).length, 0);
  const md = [
    "# DA3 Demo Video — Voice Script",
    "",
    `Video: \`docs/da3/video/demo.mp4\` (${stamp(total)}, limit 3:00). Narration: ${words} words,`,
    `voiced with macOS \`say -v ${VOICE} -r ${RATE}\`. To record your own voice instead, read each`,
    "section at the time shown; the slides change on these marks.",
    "",
    "Generated by `scripts/record-da3-demo.ts` — edit the scenes there and re-run.",
    "",
    ...clips.flatMap((clip, i) => {
      const end = starts[i + 1] ?? total;
      return [
        `## ${stamp(starts[i]!)}–${stamp(end)} · ${clip.title}`,
        "",
        `*On screen: ${clip.show === "live" ? "the running application — login, Security page, QR enrolment, sign-in with the authenticator code" : `slide \`${clip.show}\``}*`,
        "",
        `> ${clip.text}`,
        "",
      ];
    }),
  ].join("\n");
  writeFileSync(join(ROOT, "docs/da3/VIDEO_SCRIPT.md"), md);
  rmSync(WORK, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
