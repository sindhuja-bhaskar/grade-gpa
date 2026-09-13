# Presentation Video — Narration Script

**Limit: 3:00. This script is 415 words — about 2:46 at a normal speaking pace
(150 words per minute), leaving a margin.** It is timed to
`docs/video/demo.mp4`, a silent capture paced to these sections.

The assignment requires four things: the chosen application, the implementation,
the cloud deployment, and a demonstration of the working application. Each has a
section below.

> **Before recording:** if the application has been deployed, use the *deployed*
> wording in Section 3 and fill in the platform names and URL. If it has not,
> use the alternative. Do not claim a deployment that cannot be opened.

---

## 1 · The application — 0:00 to 0:28

*(on screen: title slide, then the problem slide)*

> "This is the Grade/GPA Planner — a cloud-based web application for tracking
> assessment marks, calculating GPA and CGPA, and working out what the remaining
> assessments need to produce.
>
> It solves a problem every spreadsheet gets wrong. When a mark has not been
> released, a spreadsheet treats it as zero, and the student sees a failing
> projection that is meaningless. Here, an unavailable assessment counts towards
> nothing — and is never a zero."

---

## 2 · Implementation — 0:28 to 1:16

*(on screen: architecture slide, then implementation slide)*

> "It is a three-tier system. The presentation and application tiers ship as one
> Next.js deployment in TypeScript; the data tier is PostgreSQL through Prisma.
>
> The core is the calculation engine — pure modules with no React and no database
> code, so the academic rules can be tested alone. Sixty-four unit tests cover
> the specification's worked examples and every grade boundary.
>
> Weightages and grade boundaries live in configuration, not inside the
> calculation functions. Everything is exposed as REST APIs under `/api`, with
> OpenAPI documentation generated from the same validation schemas the handlers
> use, so the two cannot drift apart. Authentication uses Auth.js with
> server-side sessions, and every request re-checks that the record belongs to
> the student asking for it."

---

## 3 · Cloud deployment — 1:16 to 1:40

*(on screen: cloud deployment slide)*

**If deployed:**

> "It runs on [platform], serving the interface and the API from one deployment,
> with a managed PostgreSQL database on [database platform]. Database access goes
> through a connection pooler, because serverless functions would otherwise
> exhaust a free-tier connection limit. Secrets are environment variables, never
> committed. It is live at [URL]."

**(not yet deployed):**

> "The deployment architecture is one cloud-hosted Next.js application serving
> both the interface and the API, with a managed PostgreSQL database. Access goes
> through a connection pooler, because serverless functions would otherwise
> exhaust a free-tier connection limit. Secrets are environment variables, never
> committed, and migrations are applied with `prisma migrate deploy`."

---

## 4 · Demonstration — 1:40 to 2:32

*(on screen: the live application)*

> "Here it is running. The official CGPA is 8.57, from completed courses only.
> The target is 8.8, and the remaining nine credits must average 8.98 — stated as
> a requirement, not a prediction.
>
> Ongoing subjects show marks assessed so far and a status — never a grade.
>
> Computer Networks: 29.6 earned of the 35 assessed. CAT-II, Assignment 3 and the
> FAT are blank because they have not happened. To finish on 80, CAT-II needs
> 38 to 44.
>
> I record 44. The figures update, and the subject stays ongoing — two components
> are still outstanding.
>
> Now the last two. Every component has a mark, so the subject completes, and
> only now does an official grade appear and feed the semester GPA.
>
> And the API documentation, generated from the validation schemas."

---

## 5 · Close — 2:32 to 2:46

> "Every rule is enforced in code and covered by tests: an unavailable mark is
> never zero, an ongoing subject shows no grade, and a GPA with nothing completed
> reads 'not yet available'. Thank you."

---

## Recording notes

* **Time it first.** Read it aloud with a timer before recording. If you run
  over, cut from Section 2 — it compresses most easily.
* **Audio matters more than video.** Somewhere quiet, close to the microphone. A
  clear voice over a simple capture scores better than the reverse.
* **Two ways to record.** Narrate over `docs/video/demo.mp4` in any editor, or
  re-record your own screen with QuickTime (File → New Screen Recording) while
  reading this aloud.
* **Check the final file** is MP4, under three minutes, and named
  `RegisterNo_Presentation.mp4`.
