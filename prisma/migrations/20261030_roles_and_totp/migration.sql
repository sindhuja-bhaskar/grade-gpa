-- DA3 Q2(b): account roles and a TOTP second factor.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADVISOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER;
