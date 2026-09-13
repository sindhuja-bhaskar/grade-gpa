# Deploying to Vercel with free-tier Postgres

A step-by-step manual for putting this application on a public cloud URL, using
Vercel for the application and Neon (free tier) for PostgreSQL. Allow about
twenty minutes the first time.

This satisfies §34 of the specification and acceptance criterion 10 (§42): a
cloud-hosted application, a cloud-hosted database, secure communication,
environment-based configuration, and a public URL.

---

## What you will end up with

```
        Browser
           |  HTTPS
           v
   +-------------------------+
   |  Vercel                 |   Next.js app: UI + /api
   |  your-app.vercel.app    |   Node.js serverless functions
   +-----------+-------------+
               |  pooled connection (PgBouncer)
               v
   +-------------------------+
   |  Neon                   |   managed PostgreSQL, free tier
   +-------------------------+
```

Neon's Vercel integration injects two connection strings:

| Variable | What it is | Used for |
|---|---|---|
| `DATABASE_URL` | Pooled, through PgBouncer | The running application — this is what the app reads |
| `DATABASE_URL_UNPOOLED` | Direct connection | Migrations |

Pooling matters here: each serverless invocation can open its own connection,
and a free-tier database's connection limit is small (§41 lists this as a
deployment risk).

---

## Before you start

You need a GitHub account, a Vercel account (sign in with GitHub), and this
repository pushed to GitHub. Nothing else is installed on your machine.

Confirm the project builds locally first — a build that fails on Vercel is
harder to diagnose than one that fails here:

```bash
npm ci
npm run build
```

---

## Step 1 — Push the repository to GitHub

The repository currently has no remote:

```bash
git remote -v          # prints nothing
```

Create an empty repository on GitHub (no README, no .gitignore — the project has
both), then:

```bash
git remote add origin https://github.com/<your-username>/grade-gpa-planner.git
git branch -M main
git push -u origin main
```

`.env` is git-ignored, so no secrets leave your machine. If `git status` shows
an untracked `yarn.lock`, delete it — the project uses npm, and two lockfiles
confuse the build:

```bash
rm -f yarn.lock
```

---

## Step 2 — Create the Vercel project

1. Go to **vercel.com/new** and sign in with GitHub.
2. **Import** the repository you just pushed.
3. Vercel detects Next.js. Leave the framework preset, build command and output
   directory at their defaults — `package.json` already builds correctly
   (`prisma generate && next build`).
4. **Do not deploy yet.** Expand **Environment Variables** and continue to
   Step 3 first; a deployment without `AUTH_SECRET` will build but fail at
   sign-in.

If the first deployment happens before the variables are set, that is
recoverable — set them and redeploy.

---

## Step 3 — Add the database

1. In the Vercel dashboard, open your project → **Storage** tab → **Create
   Database** → choose **Neon** (Serverless Postgres) from the Marketplace.
2. Select the **Free** plan.
3. Choose a region close to you, and set the **application** to the same region
   later (Step 5) — a database on another continent adds latency to every query.
4. Click **Connect** to attach it to this project.

Vercel now injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and several `PG*`
variables into the project automatically. The application reads `DATABASE_URL`,
which is the pooled string — exactly what a serverless deployment needs.

---

## Step 4 — Add the remaining environment variables

In **Settings → Environment Variables**, add these for Production (and Preview,
if you want preview deployments to work):

| Name | Value | Why |
|---|---|---|
| `AUTH_SECRET` | Output of `openssl rand -base64 48` | Signs the session cookie. Without it, Auth.js refuses to start a session |
| `SESSION_TTL_DAYS` | `30` | How long a session lives without activity |
| `DATABASE_POOL_MAX` | `2` | Connections **per serverless instance**. The default of 5 is right for a local server and too many for free-tier serverless |

Generate the secret locally:

```bash
openssl rand -base64 48
```

Use a **different** secret from your local `.env`. Changing it later invalidates
every existing session, which is a valid way to sign everyone out but a
confusing way to debug.

Do not add `DATABASE_URL` by hand — the Neon integration manages it.

---

## Step 5 — Set the function region (optional but worth it)

**Settings → Functions → Function Region**: choose the same region as the Neon
database. Every request in this application makes at least one database query,
so the round trip is on the critical path.

---

## Step 6 — Deploy

Click **Deploy** (or push a commit to `main`). The build runs:

```
npm ci                       # .npmrc makes this resolve cleanly
prisma generate              # postinstall, then again in the build script
next build
```

The build takes two to three minutes. It should end with a list of routes and no
errors. The database is *not* touched during the build — the schema is applied
in the next step.

---

## Step 7 — Apply the schema

Migrations run once, from your machine, against the **unpooled** connection.
PgBouncer's transaction pooling interferes with the locks a migration takes, so
use the direct URL.

1. In Vercel: **Settings → Environment Variables**, reveal
   `DATABASE_URL_UNPOOLED` and copy it.
2. From the project directory:

```bash
DATABASE_URL="<paste DATABASE_URL_UNPOOLED here>" npx prisma migrate deploy
```

Expected output:

```
2 migrations found in prisma/migrations
All migrations have been successfully applied.
```

Optionally load the demo data, so the deployed site has something to show:

```bash
DATABASE_URL="<paste DATABASE_URL_UNPOOLED here>" npm run db:seed
```

That creates `student@example.com` / `planner123` with a completed semester and
an ongoing one. **If you seed a public deployment, treat those credentials as
public** — anyone with the URL can sign in. That is usually what you want for a
demonstration; delete the account afterwards if it is not.

---

## Step 8 — Verify

Open the deployment URL and check each of these. They are the same properties
the report claims, so this is also a rehearsal for the demonstration.

| Check | Expected |
|---|---|
| `/` loads over HTTPS | Landing page |
| Register a new account | Redirects to the dashboard, signed in |
| `/api/docs` | Swagger UI listing the endpoints |
| Sign out, then open `/dashboard` | Redirected to `/login` |
| `curl -s -o /dev/null -w "%{http_code}" https://<url>/api/performance` | `401` |
| Sign in as the seeded student | CGPA 8.57; current semester "Not yet available" |
| Open a subject, record a mark | Saves; figures update |

A quick command-line check of the two that matter most:

```bash
URL=https://your-app.vercel.app
curl -s -o /dev/null -w "unauthenticated API: %{http_code}\n" $URL/api/performance   # 401
curl -s -o /dev/null -w "docs: %{http_code}\n" $URL/api/docs                          # 200
```

---

## Step 9 — Record the URL

Put the live URL into the two places that claim it:

* `docs/PROJECT_REPORT.md` §15.4 — replace the "not yet deployed" paragraph with
  the platform names and the URL, and change acceptance scenario 10 in §13.5 from
  *Pending* to *Passed*, along with objective 22 in §3. Then rebuild the PDF:

  ```bash
  npm i --no-save marked playwright-core
  node scripts/build-report.mjs
  ```

* `docs/VIDEO_SCRIPT.md` §3 — use the **deployed** wording and fill in the URL.

To re-record the demo against the live site instead of localhost:

```bash
npm i --no-save playwright-core
APP_URL=https://your-app.vercel.app node scripts/record-demo.mjs
```

---

## Before the demonstration

**Warm it up.** Free-tier Neon suspends the database after a few minutes idle,
and serverless functions cold-start. The first request after a quiet period can
take several seconds and looks like a broken application. Open the site and sign
in a minute or two before presenting — §41 lists this as the most likely
demo-day failure.

---

## Troubleshooting

**Build fails during `npm ci` with `ERESOLVE`**
The repository includes `.npmrc` with `legacy-peer-deps=true` for exactly this.
Confirm the file was committed and pushed.

**Build fails in `prisma generate`**
The generated client is git-ignored and rebuilt on every deploy, which is
correct. Check that `prisma/schema.prisma` and `prisma7.config.ts` are both
committed.

**Site loads but sign-in fails, or every page bounces to `/login`**
`AUTH_SECRET` is missing, or was set for the wrong environment. Set it for
Production and redeploy — environment variable changes do not apply to an
existing deployment.

**`Can't reach database server` / connection errors under load**
Confirm the application is using the pooled `DATABASE_URL` (not the unpooled
one) and that `DATABASE_POOL_MAX` is 1–2.

**`The table public.users does not exist`**
Step 7 has not been run, or it was run against a different database. Re-run it
with the unpooled URL and check the output says migrations were applied.

**Migration hangs or times out**
You are using the pooled URL. Use `DATABASE_URL_UNPOOLED`.

**First request after a pause takes several seconds**
Expected on free tiers: Neon autosuspend plus a serverless cold start. Warm the
site before demonstrating.

---

## Costs

Both free tiers are sufficient for this project: Vercel's Hobby plan for a
personal, non-commercial project, and Neon's free plan. Neither requires a card.
Keep the seed data minimal — free-tier storage and compute-hours are finite
(§41).

## Sources

* [Postgres on Vercel](https://vercel.com/docs/postgres)
* [Neon now available on Vercel Marketplace](https://vercel.com/changelog/neon-now-available-on-vercel-marketplace)
* [Connecting with the Vercel-Managed Integration — Neon Docs](https://neon.com/docs/guides/vercel-managed-integration)
