/**
 * Demo data for the walkthrough in docs/reqs.md §44.
 *
 * Creates one student with a completed semester (official GPA) and an ongoing
 * semester that reproduces the §12.2 example — CAT-I and two assignments
 * recorded, everything else genuinely unavailable.
 *
 * Run with: npm run db:seed
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  computeProgress,
  gradeForMark,
  requiredComponents,
} from "../src/lib/academic";

// The engine input is built inline rather than through
// src/lib/services/mappers.ts: that module is `server-only`, which throws when
// imported by a plain Node script like this one.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "student@example.com";
const DEMO_PASSWORD = "planner123";

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo Student",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    },
  });

  const past = await prisma.semester.create({
    data: {
      userId: user.id,
      academicYear: "2024-25",
      semesterNumber: 1,
      gpaTarget: 8.5,
    },
  });

  const current = await prisma.semester.create({
    data: {
      userId: user.id,
      academicYear: "2025-26",
      semesterNumber: 2,
      gpaTarget: 8.5,
    },
  });

  await prisma.goal.create({
    data: { userId: user.id, scope: "OVERALL", targetValue: 8.8 },
  });

  // A completed semester: every component recorded, so official grades exist.
  await addSubject(past.id, "Data Structures", 4, "THEORY", {
    CAT_I: 44,
    CAT_II: 41,
    ASSIGNMENT_1: 9,
    ASSIGNMENT_2: 10,
    ASSIGNMENT_3: 8,
    FAT: 82,
  });
  await addSubject(past.id, "Digital Logic", 3, "THEORY", {
    CAT_I: 38,
    CAT_II: 35,
    ASSIGNMENT_1: 8,
    ASSIGNMENT_2: 8,
    ASSIGNMENT_3: 9,
    FAT: 70,
  });

  // The ongoing semester, mid-way through assessment.
  await addSubject(current.id, "Computer Networks", 3, "THEORY", {
    CAT_I: { mark: 42, classAverage: 36 },
    ASSIGNMENT_1: 9,
    ASSIGNMENT_2: 8,
  });
  await addSubject(current.id, "DBMS", 4, "THEORY", {
    CAT_I: { mark: 26, classAverage: 31 },
    ASSIGNMENT_1: 6,
  });
  await addSubject(current.id, "Operating Systems Lab", 2, "LABORATORY", {
    LAB_CONTINUOUS: 84,
  });

  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

type Mark = number | { mark: number; classAverage?: number };

async function addSubject(
  semesterId: string,
  name: string,
  credits: number,
  courseType: "THEORY" | "LABORATORY" | "THEORY_AND_LAB",
  marks: Record<string, Mark>,
) {
  const subject = await prisma.subject.create({
    data: {
      semesterId,
      name,
      credits,
      courseType,
      gradingType: "ABSOLUTE",
      assessments: {
        create: requiredComponents(courseType).map((spec) => {
          const entry = marks[spec.code];
          const recorded = typeof entry === "number" ? { mark: entry } : entry;
          return {
            componentCode: spec.code,
            label: spec.label,
            component: spec.component,
            sequence: spec.sequence,
            maxMarks: spec.maxMarks,
            weight: spec.weight,
            studentMark: recorded?.mark ?? null,
            classAverage: recorded?.classAverage ?? null,
            status: recorded ? ("AVAILABLE" as const) : ("NOT_AVAILABLE" as const),
            recordedAt: recorded ? new Date() : null,
          };
        }),
      },
    },
    include: { assessments: true },
  });

  // Same rule as the API: a grade is written only once every component is in.
  const progress = computeProgress({
    id: subject.id,
    name: subject.name,
    credits: subject.credits,
    courseType: subject.courseType,
    gradingType: subject.gradingType,
    classStrength: subject.classStrength,
    theoryWeightPercent: subject.theoryWeightPercent,
    labWeightPercent: subject.labWeightPercent,
    assessments: subject.assessments.map((assessment) => ({
      componentCode: assessment.componentCode,
      label: assessment.label,
      component: assessment.component,
      sequence: assessment.sequence,
      maxMarks: assessment.maxMarks,
      weight: assessment.weight,
      status: assessment.status,
      studentMark: assessment.studentMark,
      classAverage: assessment.classAverage,
      standardDeviation: assessment.standardDeviation,
    })),
  });
  if (progress.isComplete && progress.finalMark !== null) {
    const { grade, gradePoint } = gradeForMark(progress.finalMark);
    await prisma.subject.update({
      where: { id: subject.id },
      data: {
        status: "COMPLETED",
        finalMark: progress.finalMark,
        grade,
        gradePoint,
        completedAt: new Date(),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
