/**
 * One-off migration: replace any password stored in plain text with a salted
 * bcrypt hash (DA3, Q2(a)).
 *
 * The application has hashed every password it writes since Assignment 1
 * (src/lib/auth/password.ts, cost 12), and sign-in only ever compares against a
 * bcrypt hash — so a plain-text row can neither be created by the app nor used
 * to sign in. This script is for rows that arrive some other way (an import
 * from an older system, a manual INSERT) and is idempotent: rows that already
 * hold a bcrypt hash are left alone.
 *
 *   npx tsx scripts/hash-plaintext-passwords.ts            # migrate
 *   npx tsx scripts/hash-plaintext-passwords.ts --dry-run  # report only
 *
 * Kept free of src/lib/** imports: those modules are `server-only`.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Must match src/lib/auth/password.ts.
const COST_FACTOR = 12;
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const users = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: { id: true, email: true, passwordHash: true },
  });

  const plain = users.filter((user) => !BCRYPT_HASH.test(user.passwordHash!));
  console.log(
    `${users.length} account(s) with a password; ${plain.length} stored in plain text.`,
  );

  for (const user of plain) {
    if (dryRun) {
      console.log(`  would hash: ${user.email}`);
      continue;
    }
    // bcrypt generates a fresh random 16-byte salt per call and embeds it in
    // the hash, so equal passwords never produce equal hashes.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(user.passwordHash!, COST_FACTOR) },
    });
    console.log(`  hashed: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
