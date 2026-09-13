#!/usr/bin/env bash
# Creates the local development role and database (docs/reqs.md §32).
# Idempotent: safe to re-run. Requires a PostgreSQL server on :5432 and a psql
# superuser connection (the Homebrew default, where your login role is one).
set -euo pipefail

ROLE="${DB_ROLE:-gradegpa}"
DB="${DB_NAME:-gradegpa}"
PASSWORD="${DB_PASSWORD:-gradegpa}"

# CREATEDB is required beyond owning the database itself: `prisma migrate dev`
# creates a temporary shadow database to verify a new migration, and fails with
# P3014 without this privilege.
psql -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
    CREATE ROLE ${ROLE} LOGIN CREATEDB PASSWORD '${PASSWORD}';
  ELSE
    ALTER ROLE ${ROLE} CREATEDB;
  END IF;
END
\$\$;
SQL

if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB}'" | grep -q 1; then
  echo "Database ${DB} already exists."
else
  createdb -O "${ROLE}" "${DB}"
  echo "Created database ${DB} owned by ${ROLE}."
fi
