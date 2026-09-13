/**
 * Records the silent presentation capture for the submission video.
 *
 *   npm i --no-save playwright-core       # uses the Chrome already installed
 *   npm start                             # the app must be running on :3000
 *   node scripts/record-demo.mjs
 *
 * Produces docs/video/demo.mp4 — slides followed by a paced walkthrough of the
 * running application, timed to the narration in docs/VIDEO_SCRIPT.md. Record
 * your voice over it; the capture has no audio.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "docs/video/.raw");
const OUT = join(ROOT, "docs/video/demo.mp4");
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const SIZE = { width: 1280, height: 720 };

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: RAW, size: SIZE },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);

// ── Slides: 0:00 – 1:40 ───────────────────────────────────────────────────
// Durations match the narration sections in docs/VIDEO_SCRIPT.md. The whole
// video must stay under the 3-minute limit, so this is a budget, not a guess.
await page.goto(`file://${join(ROOT, "docs/video/slides.html")}`);
const SLIDE_SECONDS = [14, 14, 24, 24, 24];      // title, problem, architecture, implementation, cloud
for (const [index, seconds] of SLIDE_SECONDS.entries()) {
  await page.evaluate((n) => window.showSlide(n), index + 1);
  await wait(seconds * 1000);
}

// ── Demonstration: 1:40 – 2:45 ────────────────────────────────────────────
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"]', "student@example.com");
await page.fill('input[name="password"]', "planner123");
await wait(1200);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");
await page.waitForSelector("text=Official CGPA");
await wait(2000);

// The figures the narration calls out, one at a time.
await page.mouse.wheel(0, 260);
await wait(5000);                                  // CGPA, target, required GPA
await page.mouse.wheel(0, 420);
await wait(5500);                                  // ongoing subjects: status, not a grade
await page.mouse.wheel(0, -680);
await wait(800);

await page.goto(`${BASE}/dashboard/subjects`);
await page.waitForSelector("text=Add a subject");
await wait(1500);
await page.click('a:has-text("Computer Networks")');
await page.waitForSelector("text=Assessment marks");
await wait(6000);                                  // earned so far, blanks are not zeros
await page.mouse.wheel(0, 300);
await wait(4000);                                  // required marks per assessment

// Record CAT-II: the subject stays ongoing, because components remain.
const marks = page.locator('input[name^="mark-"]');
await marks.nth(1).fill("44");
await wait(900);
await page.click('button:has-text("Save marks")');
await page.waitForSelector("text=assessment(s) recorded");
await wait(4000);

// Record the last two: the subject completes and an official grade appears.
await page.locator('input[name^="mark-"]').nth(4).fill("9");
await page.locator('input[name^="mark-"]').nth(5).fill("78");
await wait(800);
await page.click('button:has-text("Save marks")');
await page.waitForSelector("text=Official result");
await page.mouse.wheel(0, -400);
await wait(6000);

// The published API documentation.
await page.goto(`${BASE}/api/docs`);
await page.waitForSelector(".swagger-ui");
await wait(4000);

// ── Close ─────────────────────────────────────────────────────────────────
await page.goto(`file://${join(ROOT, "docs/video/slides.html")}`);
// Held a little longer than the closing narration, so the video never
// runs out before the voice does.
await page.evaluate(() => window.showSlide(7));
await wait(20000);

await context.close();
await browser.close();

// Playwright writes .webm; the submission requires .mp4.
const webm = readdirSync(RAW).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("no recording produced");
execFileSync(
  "ffmpeg",
  ["-y", "-i", join(RAW, webm), "-c:v", "libx264", "-preset", "slow", "-crf", "23",
   "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", "30", OUT],
  { stdio: "ignore" },
);
rmSync(RAW, { recursive: true, force: true });

const duration = execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of",
  "default=noprint_wrappers=1:nokey=1", OUT,
]).toString().trim();
console.log(`docs/video/demo.mp4 — ${Number(duration).toFixed(1)}s`);
if (Number(duration) > 180) console.warn("WARNING: longer than the 3-minute limit");
