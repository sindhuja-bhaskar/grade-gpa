# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A cloud-based Grade/GPA Planner for a single student role, built to the SRS in
`docs/reqs.md` (v2.1). The SRS is the source of truth: it is numbered by section
(§) and by business rule (BR-01 … BR-22), and the code cites those numbers in
comments. When a requirement and the code disagree, the SRS wins — or the SRS
needs an explicit amendment first.

Full-stack Next.js 16 (App Router) + TypeScript + Prisma 7 + PostgreSQL. One
deployment serves both the UI and the REST API.

## Commands

```bash
npm run dev          # dev server
npm test             # engine unit tests (vitest)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # prisma generate && next build
npm run db:create    # local role + database (idempotent)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # demo data: student@example.com / planner123
npm run db:up        # PostgreSQL 16 in Docker — alternative, needs the daemon
```

Run `npm run typecheck && npm test && npm run lint` before calling work done.
Add a test for every rule change in `src/lib/academic/` — the engine is the
core value of the project and §40 requires it to be covered.

## Local database

Development runs against the **local PostgreSQL server on :5432** (Homebrew
`postgresql@14`), database `gradegpa`, role `gradegpa`. `docker-compose.yml`
uses the same port and credentials, so switching between them needs no change to
`DATABASE_URL`. Production targets PostgreSQL 16; nothing in the schema depends
on a post-14 feature, but check before adding something that does.

## Architecture

Three logical tiers, one deployment (§7). The tier boundary is a *module*
boundary and must stay enforced in code:

```
src/app/**              UI (client + server components) and /api route handlers
src/app/dashboard/actions.ts  Server Actions behind every CRUD form
src/lib/actions/        Server Action plumbing: FormState, FormData readers
src/lib/api/            handler plumbing: auth wrapper, error shape, OpenAPI doc
src/lib/services/       database access, ownership checks, dashboard assembly
src/lib/academic/       the calculation engine — pure functions, no Prisma, no React
src/auth.ts             Auth.js v5 configuration — the only place sessions are minted
src/lib/auth/           password hashing, session helpers, cookie names, rate limiting
src/generated/prisma/   generated client (gitignored; `npm run db:generate`)
```

* `src/proxy.ts` is the Next.js 16 route-protection hook (renamed from
  `middleware.ts`). It runs in the **edge runtime**: importing anything that
  reaches a Node built-in — `src/auth.ts` pulls in `node:crypto` and Prisma —
  fails every request at runtime. It imports `src/lib/auth/cookie-names.ts` only,
  and checks for a cookie's presence, never its validity.
* `server-only` modules throw when loaded outside a Next.js server context, so
  scripts (`prisma/seed.ts`) and vitest cannot import them. Keep
  `src/lib/academic/**` free of `server-only` for that reason.
* Anything touching the database or the engine imports `server-only`. Never
  import `src/lib/services/**`, `src/lib/db.ts` or `src/lib/auth/**` from a
  client component — shipping business rules or secrets to the browser is a
  named risk in §41.
* The engine takes plain data and returns plain data. `src/lib/services/mappers.ts`
  is the single translation point between Prisma rows and engine inputs.
* Route handlers stay thin: validate → call a service → respond.

## Authentication

Auth.js v5 (`next-auth@beta`) with the credentials provider. Read `src/auth.ts`
before touching anything here — it documents why the session is assembled the
way it is.

* Sessions are **server-side records**: a `sessions` row per sign-in, its token
  carried in the cookie, re-read on every request. Deleting the row revokes the
  session immediately. Do not "optimise" that read away — revocability is the
  reason it exists.
* Auth.js rejects `session.strategy: "database"` while credentials are the only
  provider (`@auth/core/lib/utils/assert.js`). That is why the strategy is
  `jwt` with a session row behind it, not an oversight.
* Handlers and pages call `getSessionUser()` / `requireUser()` from
  `src/lib/auth/session.ts`, never `auth()` directly — one seam to change.
* `/api/auth/login`, `/logout`, `/refresh` and `/register` are REST wrappers
  kept because §31 names them; Auth.js's own endpoints live under the
  `[...nextauth]` catch-all and are matched only when no exact route matches.
* `AUTH_SECRET` must be set in every environment.

## Rules that must not be broken

These are business rules from §38, not preferences. Each has tests.

1. **Unavailable ≠ zero** (§12, BR-04/05). No mark means `status: NOT_AVAILABLE`,
   excluded from earned marks *and* from assessed weight. `studentMark: 0` is a
   real zero. Clearing a mark sends the assessment back to `NOT_AVAILABLE`.
2. **No grade for an ongoing subject** (§18.1, BR-01). `officialGrade()` returns
   null unless the subject is complete; the database's `grade`/`gradePoint`
   fields are cleared whenever a subject is not complete.
3. **Completion is all-or-nothing** (§18.2, BR-21). A subject completes only when
   *every* component of its course type has a mark — not at any weight threshold.
   `syncSubjectResult()` is the one place this transition happens.
4. **Nothing-yet is null, not 0.00** (§19, BR-22). GPA/CGPA return `null` with no
   completed courses; the UI prints "Not yet available".
5. **Never fabricate academic data** (BR-20). No invented class averages, no
   extrapolated marks, no performance category for a subject with no marks
   (it reports `AWAITING_DATA` instead).
6. **Targets are requirements, not predictions** (§22, §23, BR-15). Every
   planning result carries `attainable` and an explanation, and says what is
   still reachable when a target is out of range.
7. **Configuration, not literals** (§36). Weightages, grade boundaries and
   category thresholds live in `src/lib/academic/config/`. Do not inline them
   into calculation functions.
8. **Ownership on every request** (§8.2). Use the helpers in
   `src/lib/services/ownership.ts`. 401 for no/invalid session, 403 for another
   student's record — keep them distinct (§31). `src/middleware.ts` is a first
   gate only, never the authorization check.

## CRUD forms

Pages under `/dashboard` write through Server Actions in
`src/app/dashboard/actions.ts`, not through `fetch`. Each action authenticates,
parses with the same Zod schema the REST API uses, and calls the same service —
never a direct Prisma query, so ownership checks cannot be bypassed.

* A `"use server"` module may only export async functions: shared constants live
  in `src/lib/actions/form-state.ts`.
* `runFormAction` turns `ApiError`/`ZodError` into `FormState` for the form to
  render, and calls `unstable_rethrow` first so `redirect()` and `notFound()`
  still work.
* FormData is all strings. Use the readers in `src/lib/actions/form.ts`: blank
  means "not provided" (`null`), a required-but-missing number becomes `NaN` so
  the schema reports it rather than storing 0, and `markValue` keeps blank and
  `0` distinct — that is BR-04/BR-05 at the form boundary, and it has tests.
* Deleting a record removes the element that would show the confirmation, so
  delete actions `redirect()` with a `?removed=` parameter and the destination
  page renders a `<Notice>`. Follow that pattern for new deletes.
* HTML5 attributes (`required`, `max`) are a convenience, never the check: the
  server rejects the same input with the client-side guard removed.

## Conventions

* Comments explain *why*, and cite the SRS section or BR they implement. Do not
  restate what the code says.
* Rounding is explicit via `src/lib/academic/decimal.ts`. Compute on raw values,
  round once at the reported value — component-level rounding must not
  accumulate into course totals.
* Request validation lives in `src/lib/validation/schemas.ts`; adding a schema
  with `.meta({ id })` also publishes it to `/api/docs`. Rules needing database
  context (a mark against its assessment's maximum) belong in the service layer.
* Errors are thrown as `ApiError` and rendered by `failure()` — never build ad
  hoc error responses.
* Prisma models are `camelCase` in the client, `snake_case` tables via `@@map`.

## Decisions taken beyond the SRS

Recorded here because the SRS leaves them open; revisit with the user before
changing:

* **Floats, not SQL `decimal`, for marks**, with explicit rounding in
  `decimal.ts`. Keeps `Prisma.Decimal` out of the engine and the JSON layer at
  no cost in accuracy at two decimal places.
* **Cascade on delete** for semester → subject → assessment, and for a deleted
  account (§30.4 left the cascade-vs-block choice to database design).
* **A subject with no recorded mark gets no performance category.** BR-12 asks
  for a category on every ongoing subject, but assigning one with zero data
  would fabricate information (BR-20). Such a subject reports
  `status: AWAITING_DATA` with an explanation.
* **GPA targets convert to per-subject mark targets** by taking the lowest final
  mark whose grade point meets the target (`targetMarkForGpa`); a target of 8.5
  therefore asks for grade A. No fractional grade point is ever implied.
* **Auth.js v5 is a beta release** (`5.0.0-beta.32`). It is the App Router
  line and supports Next 16, but pin the version and re-test auth after any
  upgrade.
* **Rate limiting is in-memory**, so per-instance only. Fine for the assignment;
  swap the store if the deployment ever runs more than one instance.

## Current state

Built: engine + tests, schema and initial migration, auth/session layer, all
REST endpoints, OpenAPI docs, dashboard and subject list.

Not built yet: subject/mark-entry forms (API is complete — see the TODO in
`src/app/dashboard/subjects/page.tsx`), and the integration and authorization
test suites from §40, which need a test database.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
