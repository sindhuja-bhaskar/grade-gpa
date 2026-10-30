# syntax=docker/dockerfile:1
#
# Hardened production image (DA3, Q2(c)). Compared with Dockerfile.baseline:
#   - Alpine base instead of full Debian: far fewer OS packages to be vulnerable;
#   - multi-stage: compilers, dev dependencies and source never reach runtime;
#   - Next.js standalone output: only the traced node_modules are copied;
#   - npm/yarn/corepack removed from the runtime (they ship their own CVEs and
#     the server never needs them);
#   - runs as an unprivileged user; the application files stay root-owned, so
#     a compromised process can neither modify them nor act as root.

ARG NODE_IMAGE=node:22-alpine

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder so the Prisma client can be constructed while pages are
# collected; the real URL is only ever supplied at run time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && addgroup -S -g 1001 app \
 && adduser -S -u 1001 -G app app

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER app
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
