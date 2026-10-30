/**
 * Renders docs/PROJECT_REPORT.md to a print-ready A4 PDF.
 *
 *   npm i --no-save marked playwright-core
 *   node scripts/build-report.mjs                      # the DA1 project report
 *   node scripts/build-report.mjs docs/DA3_REPORT.md docs/DA3-Report.pdf
 *
 * Uses the Chrome already installed on the machine (`channel: "chrome"`), so no
 * browser is downloaded. Neither package is a project dependency: the report is
 * built occasionally, not as part of the application build.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [input = "docs/PROJECT_REPORT.md", output = "docs/Grade-GPA-Planner-Project-Report.pdf"] =
  process.argv.slice(2);
const md = readFileSync(resolve(ROOT, input), "utf8");

const slug = (t) =>
  t.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = text.replace(/<[^>]*>/g, "");
      return `<h${depth} id="${slug(plain)}">${text}</h${depth}>\n`;
    },
  },
});

let body = marked.parse(md);

// The cover-page metadata table is a two-column layout table with no headings;
// strip the empty header row rather than printing a blank band.
body = body.replace(/<thead>\s*<tr>\s*(<th[^>]*>\s*<\/th>\s*)+<\/tr>\s*<\/thead>/g, "");

// ASCII diagrams are wider than prose. Size each block so its longest line fits
// the text column instead of being clipped at the margin.
const TEXT_WIDTH_PT = 486;          // A4 width less margins and block padding
const CHAR_RATIO = 0.601;           // advance width of a monospace glyph
const MAX_PT = 8;
const MIN_PT = 5.2;

body = body.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (whole, attrs, code) => {
  const longest = code
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .split("\n")
    .reduce((max, line) => Math.max(max, line.length), 0);
  const fitted = TEXT_WIDTH_PT / (CHAR_RATIO * Math.max(longest, 1));
  const size = Math.max(MIN_PT, Math.min(MAX_PT, fitted)).toFixed(2);
  return `<pre style="font-size:${size}pt"><code${attrs}>${code}</code></pre>`;
});

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Grade/GPA Planner — Project Report</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Georgia, serif;
    font-size: 11pt; line-height: 1.5; color: #111; margin: 0;
  }
  h1, h2, h3, h4 { font-family: Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.25; }
  h1 { font-size: 17pt; margin: 0 0 10pt; padding-bottom: 5pt; border-bottom: 1.5pt solid #0f172a; page-break-before: always; page-break-after: avoid; }
  h1:first-of-type { page-break-before: avoid; border-bottom: none; font-size: 26pt; text-align: center; margin-top: 40pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt; page-break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 12pt 0 5pt; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #1d4ed8; text-decoration: none; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9pt; background: #f3f4f6; padding: 0.5pt 2.5pt; border-radius: 2pt; }
  pre { background: #f8fafc; border: 0.5pt solid #e2e8f0; border-radius: 3pt; padding: 7pt 9pt; overflow: hidden; page-break-inside: avoid; }
  pre { font-size: 7.6pt; }
  pre code { background: none; padding: 0; font-size: inherit; line-height: 1.35; white-space: pre; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 0.5pt solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; }
  /* Capped so a screenshot fits on the same page as its caption rather than
     being pushed to a page of its own. */
  img { display: block; max-width: 100%; max-height: 180mm; margin: 6pt auto;
        border: 0.5pt solid #cbd5e1; border-radius: 3pt; page-break-inside: avoid; }
  blockquote { margin: 8pt 0; padding-left: 10pt; border-left: 2pt solid #cbd5e1; color: #475569; }
  hr { border: none; border-top: 0.5pt solid #e2e8f0; margin: 14pt 0; }
  /* Title block: the metadata table on the cover page */
  body > table:first-of-type { width: 82%; margin: 18pt auto 0; font-size: 11pt; }
  body > h2:first-of-type { text-align: center; font-weight: normal; color: #475569; font-size: 14pt; margin-top: 4pt; }
  body > p:first-of-type { text-align: center; }
</style></head><body>
${body}
</body></html>`;

writeFileSync(`${ROOT}/docs/report.html`, html);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.goto(`file://${ROOT}/docs/report.html`, { waitUntil: "networkidle" });
await page.pdf({
  path: resolve(ROOT, output),
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:7pt;color:#94a3b8;width:100%;padding:0 16mm;font-family:Helvetica">Grade/GPA Planner — Project Report</div>`,
  footerTemplate: `<div style="font-size:7pt;color:#94a3b8;width:100%;padding:0 16mm;text-align:center;font-family:Helvetica">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  margin: { top: "20mm", bottom: "18mm", left: "16mm", right: "16mm" },
});
await browser.close();
console.log("PDF written");
