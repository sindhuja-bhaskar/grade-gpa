# Running the Grade/GPA Planner

Everything needed to get the system running locally, verify it works, and
demonstrate it. For what the system *is* and how the code is organised, see the
[README](../README.md); for the requirements it implements, see
[`reqs.md`](reqs.md).

---

## 1. Prerequisites

| Requirement | Version used here | Check with |
|---|---|---|
| Node.js | 20.19.6 (project needs ≥ 20.9) | `node -v` |
| npm | 10.8.2 | `npm -v` |
| PostgreSQL | 14.15 (Homebrew); 16 in Docker also works | `psql --version` |

The project is built with **npm** — `package-lock.json` is the committed
lockfile. The scripts run fine under `yarn <script>` or `pnpm <script>`, but
installing with another package manager adds a second lockfile; prefer
`npm install`.

PostgreSQL must be **running on port 5432** before the setup steps below:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN     # should print a postgres process
```

If nothing is listening, start it:

```bash
brew services start postgresql@14    # Homebrew install
# or, to use the containerised database instead:
npm run db:up                        # PostgreSQL 16 via docker-compose (needs Docker running)
```

Both options use the same credentials, so `DATABASE_URL` does not change
between them.

---

## 2. First-time setup

Run these once, from the project root:

```bash
# 1. Environment file
cp .env.example .env

# 2. A real signing secret for the session cookie
#    macOS/Linux — paste the output into AUTH_SECRET in .env
openssl rand -base64 48

# 3. Dependencies (also generates the Prisma client)
npm install

# 4. Database role + database (idempotent, safe to re-run)
npm run db:create

# 5. Apply the schema
npx prisma migrate deploy

# 6. Demo data — optional, but it makes the app worth looking at
npm run db:seed
```

### What each step does

* **`.env`** — `DATABASE_URL` points at the local database; `AUTH_SECRET` signs
  the session cookie; `SESSION_TTL_DAYS` controls how long a session lives
  without activity. `.env` is gitignored and never committed.
* **`npm run db:create`** — creates the `gradegpa` role and the `gradegpa`
  database owned by it (`scripts/create-db.sh`). It connects as your own
  PostgreSQL superuser, which is the Homebrew default.
* **`npx prisma migrate deploy`** — applies the migrations in
  `prisma/migrations` exactly as committed. Use this for setup; `npm run
  db:migrate` (`prisma migrate dev`) is for *creating* a new migration after
  changing `prisma/schema.prisma`.
* **`npm run db:seed`** — one demo student with a completed semester (so GPA and
  CGPA have something to calculate) and an ongoing semester mid-assessment.

Expected output from the last two steps:

```
All migrations have been successfully applied.
Seeded student@example.com / planner123
```

---

## 3. Running it

### Development

```bash
npm run dev
```

Then open <http://localhost:3000>. Changes to files reload automatically.

### Production mode

```bash
npm run build
npm start
```

Same port. Use this to check what the deployed build actually does — it is the
mode to demonstrate from.

### Signing in

The seeded account is:

```
Email:    student@example.com
Password: planner123
```

Or create your own from <http://localhost:3000/register>.

---

## 4. Checking it works

```bash
npm run typecheck     # no type errors
npm test              # 60 calculation-engine tests
npm run lint          # no lint errors
```

Then, with the server running, a quick end-to-end check:

```bash
# sign in, keeping the session cookie
curl -s -c /tmp/gg.txt -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"student@example.com","password":"planner123"}'

# official CGPA from completed courses only
curl -s -b /tmp/gg.txt http://localhost:3000/api/cgpa

# ongoing performance, priorities and required marks
curl -s -b /tmp/gg.txt http://localhost:3000/api/performance
```

An unauthenticated request must be refused:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/performance   # 401
```

Browse the full API at <http://localhost:3000/api/docs>.

---

## 5. A five-minute walkthrough

This follows the demonstration flow in [`reqs.md` §44](reqs.md).

1. **Sign in** as the demo student and land on the dashboard.
2. **Official CGPA** reads `8.57` from two completed courses. The current
   semester shows **"Not yet available"** rather than `0.00` — nothing has been
   completed in it yet, and an absent result is never reported as a zero.
3. **Ongoing subjects** show marks *assessed so far*, not a final mark:
   Computer Networks reads `29.6 / 35` with the status **Strong Performance**.
   No ongoing subject anywhere shows a grade.
4. **Next target** for Computer Networks is `CAT-II: 38.75–43.75 / 50` — what the
   next assessment needs, presented as a planning range, never as a prediction.
5. **Priority subjects** names DBMS and says why: a 4-credit subject running
   below its trajectory with most of its assessment weight still to come.
6. **Required future GPA** shows what the remaining credits must average to
   reach the target CGPA of 8.80, and says plainly when a target has moved out
   of reach.
7. **Record a mark** and watch the consequences. Find an assessment id, then
   record it:

   ```bash
   SUBJ=$(curl -s -b /tmp/gg.txt http://localhost:3000/api/subjects \
     | python3 -c "import json,sys; print([s['id'] for s in json.load(sys.stdin)['data'] if s['name']=='Computer Networks'][0])")

   curl -s -b /tmp/gg.txt "http://localhost:3000/api/assessments?subjectId=$SUBJ" \
     | python3 -m json.tool | grep -B2 NOT_AVAILABLE | head

   curl -s -b /tmp/gg.txt -X PUT http://localhost:3000/api/assessments/<id> \
     -H 'content-type: application/json' -d '{"studentMark":44}'
   ```

   The subject stays **ongoing** until *every* component has a mark; when the
   last one lands, it becomes completed and its official grade and grade point
   appear — and the semester GPA stops saying "not yet available".

8. **Try to break the rules.** Each is refused with a clear message:

   ```bash
   # a mark above the maximum            -> 422
   curl -s -b /tmp/gg.txt -X PUT http://localhost:3000/api/assessments/<id> \
     -H 'content-type: application/json' -d '{"studentMark":140}'

   # another student's record            -> 403
   # no session                          -> 401
   ```

To put the demo data back to its starting state at any point:

```bash
npm run db:seed
```

---

## 6. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on :3000 |
| `npm run build` / `npm start` | Production build, then serve it |
| `npm test` / `npm run test:watch` | Calculation-engine tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:create` | Create the local role and database |
| `npm run db:migrate` | Author a new migration after a schema change (needs `CREATEDB`) |
| `npx prisma migrate deploy` | Apply committed migrations — the one to use for setup |
| `npm run db:seed` | Reset the demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:up` / `db:down` | Start/stop the Docker PostgreSQL instead |

---

## 7. Troubleshooting

**`DATABASE_URL is not set. Copy .env.example to .env`**
There is no `.env`. Run `cp .env.example .env` and set `AUTH_SECRET`.

**`Can't reach database server at localhost:5432`**
PostgreSQL is not running. `brew services start postgresql@14`, or
`npm run db:up` for the Docker instance.

**`database "gradegpa" does not exist` / `role "gradegpa" does not exist`**
Run `npm run db:create`.

**`permission denied for table ...`**
The tables were created by a different role than the one in `DATABASE_URL`.
Check the owner and make them agree:

```bash
psql -d gradegpa -c "select tablename, tableowner from pg_tables where schemaname='public';"
```

**`Error: P3014 — Prisma Migrate could not create the shadow database`**
`prisma migrate dev` builds a temporary *shadow* database to check a new
migration against, so the database user needs `CREATEDB` — owning the database
is not enough. Grant it once, as a superuser:

```bash
psql -d postgres -c "ALTER ROLE gradegpa CREATEDB;"
```

`npm run db:create` does this for you; older setups predate it. Note that plain
setup never needs `migrate dev` at all — use `npx prisma migrate deploy`, which
applies the committed migrations and creates no shadow database. `migrate dev`
is only for authoring a *new* migration after editing `prisma/schema.prisma`.

**Sign-in fails, or pages bounce back to `/login`**
`AUTH_SECRET` is missing or was changed — changing it invalidates every existing
session cookie. Set it, restart, and sign in again.

**`Port 3000 is already in use`**
Something else is on the port: `lsof -nP -iTCP:3000 -sTCP:LISTEN`, then
`kill <pid>`, or run `PORT=3001 npm run dev`.

**Type errors mentioning `@/generated/prisma`**
The generated client is stale or missing (it is gitignored). Run
`npm run db:generate`.

**`Database schema is not up to date` / unexpected columns**
Compare migrations against the database with `npx prisma migrate status`, then
`npx prisma migrate deploy`.

**A script fails with "This module cannot be imported from a Client Component"**
A plain Node script (`prisma/seed.ts`, a test) imported a module marked
`server-only`. Import the pure module instead — `src/lib/academic/**` is free of
`server-only` for exactly this reason.
