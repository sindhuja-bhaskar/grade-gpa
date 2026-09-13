import { z } from "zod";
import { GPA_RANGE } from "@/lib/academic/config";

/**
 * Request schemas (docs/reqs.md §31, §37).
 *
 * One definition per payload drives runtime validation, the TypeScript types
 * used by the handlers, and the published OpenAPI document (§31), so the three
 * cannot drift apart. Rules that need database context — "a mark cannot exceed
 * that assessment's maximum" — are enforced in the service layer, where the
 * assessment's configuration is known.
 */

export const courseTypeSchema = z
  .enum(["THEORY", "LABORATORY", "THEORY_AND_LAB"])
  .meta({ id: "CourseType" });

export const gradingTypeSchema = z
  .enum(["ABSOLUTE", "RELATIVE"])
  .meta({ id: "GradingType" });

export const assessmentStatusSchema = z
  .enum(["AVAILABLE", "NOT_AVAILABLE"])
  .meta({ id: "AssessmentStatus" });

const gpaValue = z
  .number()
  .min(GPA_RANGE.min, `Must be at least ${GPA_RANGE.min}.`)
  .max(GPA_RANGE.max, `Must be at most ${GPA_RANGE.max}.`);

// ─── Authentication ────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128, "Use at most 128 characters."),
    name: z.string().trim().min(1).max(120).optional(),
  })
  .meta({ id: "RegisterRequest" });

export const loginSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
  })
  .meta({ id: "LoginRequest" });

export const updateProfileSchema = z
  .object({ name: z.string().trim().min(1).max(120).nullable() })
  .meta({ id: "UpdateProfileRequest" });

// ─── Semesters (§9, §21, §37) ──────────────────────────────────────────────

export const semesterCreateSchema = z
  .object({
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}(-\d{2,4})?$/, 'Use a form such as "2025-26".'),
    semesterNumber: z
      .number()
      .int("Use a whole number.")
      .min(1, "Semesters are numbered from 1.")
      .max(12, "Semester numbers above 12 are not supported."),
    gpaTarget: gpaValue.nullish(),
  })
  .meta({ id: "SemesterCreateRequest" });

export const semesterUpdateSchema = semesterCreateSchema
  .partial()
  .meta({ id: "SemesterUpdateRequest" });

// ─── Subjects (§10, §37) ───────────────────────────────────────────────────

export const subjectCreateSchema = z
  .object({
    semesterId: z.string().min(1),
    name: z.string().trim().min(1, "Enter the subject name.").max(160),
    code: z.string().trim().max(32).nullish(),
    credits: z
      .number()
      .positive("Credits must be greater than zero.")
      .max(30, "That many credits looks like a typo."),
    courseType: courseTypeSchema,
    gradingType: gradingTypeSchema,
    classStrength: z
      .number()
      .int()
      .positive("Class strength must be a positive whole number.")
      .nullish(),
    theoryWeightPercent: z.number().min(0).max(100).nullish(),
    labWeightPercent: z.number().min(0).max(100).nullish(),
  })
  .refine(
    (value) =>
      value.theoryWeightPercent === null ||
      value.theoryWeightPercent === undefined ||
      value.labWeightPercent === null ||
      value.labWeightPercent === undefined ||
      Math.abs(value.theoryWeightPercent + value.labWeightPercent - 100) < 0.001,
    {
      message: "The theory and laboratory weights must add up to 100%.",
      path: ["theoryWeightPercent"],
    },
  )
  .meta({ id: "SubjectCreateRequest" });

export const subjectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    code: z.string().trim().max(32).nullish(),
    credits: z.number().positive().max(30).optional(),
    courseType: courseTypeSchema.optional(),
    gradingType: gradingTypeSchema.optional(),
    classStrength: z.number().int().positive().nullish(),
    theoryWeightPercent: z.number().min(0).max(100).nullish(),
    labWeightPercent: z.number().min(0).max(100).nullish(),
  })
  .meta({ id: "SubjectUpdateRequest" });

// ─── Assessments (§11, §12, §14, §37) ──────────────────────────────────────

export const assessmentUpdateSchema = z
  .object({
    /**
     * Null clears the mark and returns the assessment to NOT_AVAILABLE. It is
     * not the same as 0, which records an actual zero (§12.1, BR-04, BR-05).
     */
    studentMark: z
      .number()
      .min(0, "A mark cannot be negative.")
      .nullable()
      .optional(),
    classAverage: z
      .number()
      .min(0, "A class average cannot be negative.")
      .nullable()
      .optional(),
    standardDeviation: z
      .number()
      .min(0, "Standard deviation cannot be negative.")
      .nullable()
      .optional(),
  })
  .meta({ id: "AssessmentUpdateRequest" });

export const assessmentCreateSchema = assessmentUpdateSchema
  .extend({
    subjectId: z.string().min(1),
    componentCode: z.string().min(1),
  })
  .meta({ id: "AssessmentCreateRequest" });

// ─── Goals (§21, §37) ──────────────────────────────────────────────────────

export const goalCreateSchema = z
  .object({
    scope: z.enum(["SEMESTER", "OVERALL"]),
    targetValue: gpaValue,
    semesterId: z.string().min(1).nullish(),
  })
  .refine(
    (value) => value.scope === "OVERALL" || Boolean(value.semesterId),
    {
      message: "A semester goal must name the semester it applies to.",
      path: ["semesterId"],
    },
  )
  .meta({ id: "GoalCreateRequest" });

export const goalUpdateSchema = z
  .object({ targetValue: gpaValue })
  .meta({ id: "GoalUpdateRequest" });

// ─── Query parameters ──────────────────────────────────────────────────────

export const subjectQuerySchema = z.object({
  semesterId: z.string().min(1).optional(),
  status: z.enum(["ONGOING", "COMPLETED"]).optional(),
});

export const assessmentQuerySchema = z.object({
  subjectId: z.string().min(1).optional(),
});

export const planningQuerySchema = z.object({
  targetCgpa: z.coerce.number().min(GPA_RANGE.min).max(GPA_RANGE.max).optional(),
  futureCredits: z.coerce.number().min(0).max(400).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SemesterCreateInput = z.infer<typeof semesterCreateSchema>;
export type SemesterUpdateInput = z.infer<typeof semesterUpdateSchema>;
export type SubjectCreateInput = z.infer<typeof subjectCreateSchema>;
export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>;
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
