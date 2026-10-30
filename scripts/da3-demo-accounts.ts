/**
 * Demo accounts for the DA3 security walkthrough (Q2(a), Q2(b)).
 *
 *   npx tsx scripts/da3-demo-accounts.ts advisor   # advisor@example.com, role ADVISOR
 *   npx tsx scripts/da3-demo-accounts.ts legacy    # legacy@example.com, PLAIN-TEXT password
 *
 * `legacy` deliberately writes a password in the clear, to reproduce how an
 * account imported from an older system would look — the "before" picture for
 * Q2(a). Run scripts/hash-plaintext-passwords.ts straight afterwards.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const which = process.argv[2];

  if (which === "advisor") {
    const email = "advisor@example.com";
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: "Faculty Advisor",
        role: "ADVISOR",
        passwordHash: await bcrypt.hash("advisor123", 12),
      },
      update: { role: "ADVISOR" },
    });
    console.log(`${email} / advisor123 — role ADVISOR (read-only)`);
    return;
  }

  if (which === "legacy") {
    const email = "legacy@example.com";
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "Legacy Import", passwordHash: "legacy123" },
      update: { passwordHash: "legacy123" },
    });
    console.log(`${email} written with a PLAIN-TEXT password (demo "before" state)`);
    return;
  }

  console.error("Usage: tsx scripts/da3-demo-accounts.ts advisor|legacy");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
