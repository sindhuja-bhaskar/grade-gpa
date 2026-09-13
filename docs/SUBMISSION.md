# Submission Checklist

Two files go to Microsoft Teams, named with your register number:

| Required | File to submit | Source in this repository |
|---|---|---|
| PDF document | `RegisterNo_PDF.pdf` | `docs/Grade-GPA-Planner-Project-Report.pdf` |
| MP4 video, ≤ 3 minutes | `RegisterNo_Presentation.mp4` | `docs/video/demo.mp4` + your narration |

---

## 1 · The PDF

**Before submitting, fill in three fields** on the cover page of
`docs/PROJECT_REPORT.md` (lines 13–15): student name, register number, and date
of submission. Then rebuild the PDF:

```bash
npm i --no-save marked playwright-core
node scripts/build-report.mjs
```

Rename it for submission (substitute your register number):

```bash
cp docs/Grade-GPA-Planner-Project-Report.pdf ~/Desktop/21BCE1234_PDF.pdf
```

**What the report already contains:** problem and objectives, requirements
mapped to the specification, three-tier architecture, ER model and schema,
calculation-engine formulas, a business-rule enforcement table, technology
justification, implementation, security, testing results, screenshots of the
running application, cloud deployment design, design decisions, limitations,
conclusion, references, and three appendices. 44 pages.

---

## 2 · The video

`docs/video/demo.mp4` is a **silent 2:46 capture**: title and explanation
slides, then a paced walkthrough of the running application, ending on a
summary slide. It is timed to the narration in
[`docs/VIDEO_SCRIPT.md`](VIDEO_SCRIPT.md), which is about 2:46 when read at a
normal pace.

Two ways to produce the final file:

**A — narrate over the capture.** Open `docs/video/demo.mp4` in iMovie,
QuickTime Player, Clipchamp or any editor, record your voice over it reading the
script, and export as MP4.

**B — record your own screen.** Start the app (`npm start`), open QuickTime
Player → File → New Screen Recording, and read the script aloud while following
the same sequence. This is often easier than syncing to an existing capture.

To regenerate the capture — for example after deploying, so the demo shows the
live URL:

```bash
npm start                                   # or: APP_URL=https://your-url node ...
npm i --no-save playwright-core
node scripts/record-demo.mjs                # writes docs/video/demo.mp4 and prints its length
```

Rename for submission:

```bash
cp docs/video/demo.mp4 ~/Desktop/21BCE1234_Presentation.mp4
```

---

## 3 · Before you submit

- [ ] Name, register number and date filled in on the report cover; PDF rebuilt
- [ ] **Application deployed to a public cloud URL** — see below
- [ ] Report §15.4 and the objectives table updated if deployment is completed
- [ ] Video narrated, exported as MP4, **verified under 3:00**
- [ ] Both files renamed to `RegisterNo_PDF` and `RegisterNo_Presentation`
- [ ] Video opens and plays on another device before uploading

### The one outstanding item

The assignment asks the video to cover cloud deployment, and acceptance
criterion 10 of the specification requires a public cloud URL. **The application
has not yet been deployed.** Everything needed for it is ready — the production
build works, migrations are committed, and configuration is entirely through
environment variables — but the deployment itself has not been carried out.

A step-by-step manual for Vercel with free-tier Neon Postgres is in
[`docs/DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md). In outline, on any platform:

1. Create a managed PostgreSQL database (Neon, Supabase, Railway and Render all
   have free tiers). Copy its **pooled** connection string.
2. Create a project on a Next.js-capable host (Vercel, Render, Railway) from this
   repository.
3. Set `DATABASE_URL`, a fresh `AUTH_SECRET` (`openssl rand -base64 48`), and
   `NODE_ENV=production`.
4. Run `npx prisma migrate deploy` against the production database.
5. Deploy, then open the URL and sign in to confirm it works.
6. Optionally run `npm run db:seed` against the production database so the demo
   has data.

If deployment is not possible before the deadline, use the **(not yet
deployed)** wording in Section 3 of the video script and leave the report's
§15.4 as it stands. Describing the deployment design accurately is defensible;
claiming a deployment that cannot be opened is not.
