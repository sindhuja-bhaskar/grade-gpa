# Grade/GPA Planner

A cloud-based academic performance and GPA planning system, built to the SRS in
[`docs/reqs.md`](docs/reqs.md) (v2.1).

Students record assessment marks as they are released, see where they stand on
the work assessed **so far**, get official GPA/CGPA from completed courses, and
find out what the remaining assessments need in order to reach a target.

The rule the whole system is built around: **an unavailable assessment is not a
zero, and an ongoing subject does not have a grade.**

## Stack

| Layer | Choice |
|---|---|
| UI + API | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| Validation & API contract | Zod 4 → OpenAPI 3.0 (`/api/docs`) |
| Data | PostgreSQL 16, Prisma 7 with the `pg` driver adapter |
| Auth | Auth.js v5 (`next-auth@beta`), credentials provider, bcrypt hashing, server-side session records |
| Tests | Vitest |

## Getting started

For a fuller walkthrough — prerequisites, verification, a demo script and
troubleshooting — see **[docs/RUNNING.md](docs/RUNNING.md)**. The submission
report is **[docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md)** (also built as
[a PDF](docs/Grade-GPA-Planner-Project-Report.pdf)); what to hand in, and in
what form, is in **[docs/SUBMISSION.md](docs/SUBMISSION.md)**.

```bash
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 48
npm install                   # also generates the Prisma client
npm run db:create             # role + database on the local PostgreSQL server
npx prisma migrate deploy     # applies prisma/migrations
npm run db:seed               # demo data (student@example.com / planner123)
npm run dev                   # http://localhost:3000
```

### Database

Development runs against a **local PostgreSQL server on :5432** (Homebrew
`postgresql@14` on this machine), using the role and database that
`npm run db:create` sets up:

```
postgresql://gradegpa:gradegpa@localhost:5432/gradegpa?schema=public
```

`docker-compose.yml` is kept as an alternative — `npm run db:up` starts
PostgreSQL 16 in Docker on the same port with the same credentials, so the same
`DATABASE_URL` works either way. Use it (or a cloud instance) when you want to
develop against the same major version as production; the schema in use does
not depend on any post-14 feature.

To point at a cloud database instead, set `DATABASE_URL` and run
`npx prisma migrate deploy`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Calculation-engine unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:create` | Create the local role and database (idempotent) |
| `npm run db:up` / `db:down` | PostgreSQL 16 in Docker (alternative to the local server) |
| `npm run db:migrate` / `db:studio` / `db:seed` | Prisma migrate, studio, seed |

## Layout

```
docs/reqs.md              The SRS. The source of truth for every rule below.
docs/PROJECT_REPORT.md    Submission report; PDF built by scripts/build-report.mjs
prisma/schema.prisma      Entities from §32; migrations in prisma/migrations.
src/lib/academic/         The calculation engine (§36) — pure, server-only, tested.
  config/                 Weightages (§11), grade bands (§16), thresholds (§24).
src/lib/services/         Database access, ownership checks, dashboard assembly.
src/lib/auth/             Password hashing, tokens, sessions, rate limiting.
src/lib/api/              Route-handler plumbing, error shape, OpenAPI document.
src/lib/validation/       Zod request schemas — also the source of the OpenAPI spec.
src/app/api/              REST endpoints (§31).
src/app/                  UI: landing, auth, dashboard (§29).
src/middleware.ts         First-gate route protection (never the only check).
```

## API

Browse the live documentation at `/api/docs`; the OpenAPI 3.0 document is served
from `/api/docs/openapi.json` and generated from the same Zod schemas the
handlers validate against.

Every endpoint except `/api/auth/register` and `/api/auth/login` requires a
session. A missing or invalid session returns `401`; reaching another student's
record returns `403`.

```
/api/auth/{register,login,logout,refresh}   /api/gpa
/api/users/me                               /api/cgpa
/api/semesters      /api/semesters/{id}     /api/performance
/api/subjects       /api/subjects/{id}      /api/recommendations
/api/assessments    /api/assessments/{id}
/api/goals          /api/goals/{id}
```

## Authentication

Auth.js v5 handles sign-in; the credentials provider checks a bcrypt hash.
Sessions are **server-side records**: each sign-in writes a `sessions` row, the
cookie carries that row's token, and every request re-reads it. Deleting the row
ends the session immediately — a valid cookie alone is never enough. The expiry
slides while the student is working, so a session does not die mid-entry.

Auth.js refuses its own `database` session strategy when credentials are the
only sign-in method, so the revocable half is assembled explicitly in
`src/auth.ts`; the comment there explains the arrangement. `Account` and
`VerificationToken` tables are present for the adapter contract and are unused
until an OAuth or email provider is added.

`AUTH_SECRET` signs the cookie and must be set per environment.

## Academic rules worth knowing before changing code

* A mark that has not been entered is `NOT_AVAILABLE` and contributes nothing —
  to neither earned marks nor assessed weight. `0` means an actual zero (§12).
* A subject becomes `COMPLETED`, and gets an official grade, only when every
  component of its course type has a mark (§18.2, BR-21).
* GPA/CGPA with no completed course is `null` — "not yet available", never
  `0.00` (§19, BR-22).
* Performance categories are statuses, not grades (§24, BR-13).
* Required marks and required GPAs are planning targets, never predictions, and
  say plainly when a target has become unreachable (§22, §23, BR-15).
* Weightages, grade boundaries and category thresholds live in
  `src/lib/academic/config/` — change them there, not in calculation code (§36).
  The defaults reflect the scheme in §11.1 and **must be confirmed against the
  real course structure** before being relied on (§6.1).

## Deployment (§34)

A step-by-step manual for Vercel with free-tier Postgres is in
**[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)**. In outline, for any platform:

1. Deploy the Next.js app to any Node-compatible cloud platform; the UI and the
   `/api` routes ship as one deployment.
2. Provision a cloud PostgreSQL database and set `DATABASE_URL` to its **pooled**
   connection string — free-tier connection limits are a real failure mode on
   serverless platforms (§41).
3. Set `AUTH_SECRET` to a fresh secret per environment.
4. Run `npx prisma migrate deploy` against the production database.
5. Confirm HTTPS; cookies are issued `Secure` when `NODE_ENV=production`.

## Pages

| Page | What it does |
|---|---|
| `/dashboard` | GPA/CGPA, required future GPA, priorities, recommendations, trend (§29) |
| `/dashboard/semesters` | Create, edit and delete semesters (§9, §27) |
| `/dashboard/subjects` | Create subjects; list them by semester with their standing |
| `/dashboard/subjects/[id]` | Mark entry for the whole scheme, edit, delete (§11–§14) |
| `/dashboard/goals` | Set the overall CGPA target and per-semester GPA targets (§21) |

Forms post to Server Actions that reuse the same Zod schemas and services as the
REST API, so validation messages and ownership rules are identical whichever
way a record is changed.

## Status

Complete: the calculation engine with its test suite, the database schema, the
authentication and session layer, every REST endpoint listed above, the OpenAPI
document, and full CRUD in the UI.

Not yet built: the integration and authorization test suites described in §40,
which need a test database. Mark entry has been exercised end to end in a real
browser, but those runs are not yet a committed test suite.
