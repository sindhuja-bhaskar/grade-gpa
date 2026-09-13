import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton (docs/reqs.md §34, §41).
 *
 * Serverless route handlers are re-entered constantly; a new client per
 * invocation exhausts free-tier connection limits. One client is cached per
 * runtime, and the pg driver adapter keeps a small pool. In production behind a
 * serverless platform, point DATABASE_URL at the provider's *pooled* endpoint.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (see README).",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    // Kept deliberately small: free-tier Postgres allows few connections (§41).
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
