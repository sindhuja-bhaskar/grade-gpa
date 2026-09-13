import "server-only";

import { prisma } from "@/lib/db";
import {
  GRADE_BANDS,
  assessmentSeries,
  cgpaProgression,
  classifySubject,
  computeGpa,
  computeProgress,
  officialGrade,
  previousAssessedPercent,
  prioritizeSubjects,
  recommendForSubject,
  requiredGpaForTarget,
  requiredMarksForTarget,
  strongestSubjects,
  subjectRelativeStanding,
  type Classification,
  type CompletedCourse,
  type Recommendation,
  type SubjectProgress,
} from "@/lib/academic";
import { toSubjectInput, type SubjectWithAssessments } from "./mappers";
import { getSubject } from "./subjects";

/**
 * Dashboard and analysis assembly (docs/reqs.md §22–§29).
 *
 * Everything here is composition: the academic rules live in the engine, this
 * module only loads the student's records, feeds them in, and shapes the result
 * for the API and the dashboard.
 */

export interface SubjectAnalysis {
  id: string;
  name: string;
  code: string | null;
  credits: number;
  courseType: string;
  gradingType: string;
  status: "ONGOING" | "COMPLETED";
  progress: SubjectProgress;
  classification: Classification;
  recommendations: Recommendation[];
  /** Present only for completed subjects (§18.2, BR-01). */
  official: { grade: string; gradePoint: number; finalMark: number } | null;
  targetFinalMark: number | null;
  requirement: ReturnType<typeof requiredMarksForTarget> | null;
  relativeStanding: ReturnType<typeof subjectRelativeStanding> | null;
  assessmentTrend: ReturnType<typeof assessmentSeries>;
}

export interface SemesterAnalysis {
  id: string;
  academicYear: string;
  semesterNumber: number;
  label: string;
  gpaTarget: number | null;
  gpa: ReturnType<typeof computeGpa>;
  subjects: SubjectAnalysis[];
}

export interface AcademicOverview {
  semesters: SemesterAnalysis[];
  cgpa: ReturnType<typeof computeGpa>;
  cgpaProgression: Array<{ key: string; label: string; cgpa: number | null }>;
  gpaTrend: Array<{ key: string; label: string; gpa: number | null }>;
  ongoingSubjects: SubjectAnalysis[];
  priorities: ReturnType<typeof prioritizeSubjects>;
  strongest: ReturnType<typeof strongestSubjects>;
  recommendations: Array<Recommendation & { subjectId: string; subjectName: string }>;
  targetPlan: {
    targetCgpa: number;
    futureCredits: number;
    result: ReturnType<typeof requiredGpaForTarget>;
  } | null;
}

/**
 * The per-subject mark that a GPA target implies (§23).
 *
 * A GPA target is expressed in grade points, so it is converted to the lowest
 * final mark that earns at least that many points. A target of 8.5 therefore
 * asks for grade A (9 points, 80 marks) — the system never claims a fractional
 * grade point exists.
 */
export function targetMarkForGpa(gpaTarget: number): number | null {
  const eligible = GRADE_BANDS.filter((band) => band.gradePoint >= gpaTarget);
  if (eligible.length === 0) return null;
  return Math.min(...eligible.map((band) => band.minMark));
}

export async function buildOverview(userId: string): Promise<AcademicOverview> {
  const [semesters, goals] = await Promise.all([
    prisma.semester.findMany({
      where: { userId },
      orderBy: [{ academicYear: "asc" }, { semesterNumber: "asc" }],
      include: {
        subjects: {
          orderBy: { createdAt: "asc" },
          include: { assessments: { orderBy: { sequence: "asc" } } },
        },
      },
    }),
    prisma.goal.findMany({ where: { userId } }),
  ]);

  const overallGoal = goals.find((goal) => goal.scope === "OVERALL") ?? null;
  const semesterGoals = new Map(
    goals
      .filter((goal) => goal.scope === "SEMESTER" && goal.semesterId)
      .map((goal) => [goal.semesterId!, goal.targetValue]),
  );

  const analysed: SemesterAnalysis[] = semesters.map((semester) => {
    const gpaTarget = semesterGoals.get(semester.id) ?? semester.gpaTarget ?? null;
    const subjects = semester.subjects.map((subject) =>
      analyseSubject(subject, gpaTarget),
    );

    const completed: CompletedCourse[] = subjects
      .filter((subject) => subject.official !== null)
      .map((subject) => ({
        credits: subject.credits,
        gradePoint: subject.official!.gradePoint,
      }));

    return {
      id: semester.id,
      academicYear: semester.academicYear,
      semesterNumber: semester.semesterNumber,
      label: `Semester ${semester.semesterNumber} (${semester.academicYear})`,
      gpaTarget,
      gpa: computeGpa(completed),
      subjects,
    };
  });

  const allCompleted: CompletedCourse[] = analysed.flatMap((semester) =>
    semester.subjects
      .filter((subject) => subject.official !== null)
      .map((subject) => ({
        credits: subject.credits,
        gradePoint: subject.official!.gradePoint,
      })),
  );

  const ongoingSubjects = analysed.flatMap((semester) =>
    semester.subjects.filter((subject) => subject.status === "ONGOING"),
  );

  const series = analysed.map((semester) => ({
    key: semester.id,
    label: semester.label,
    courses: semester.subjects
      .filter((subject) => subject.official !== null)
      .map((subject) => ({
        credits: subject.credits,
        gradePoint: subject.official!.gradePoint,
      })),
  }));

  const cgpa = computeGpa(allCompleted);
  const futureCredits = ongoingSubjects.reduce(
    (total, subject) => total + subject.credits,
    0,
  );

  return {
    semesters: analysed,
    cgpa,
    cgpaProgression: cgpaProgression(series).map(({ key, label, cgpa: value }) => ({
      key,
      label,
      cgpa: value,
    })),
    gpaTrend: analysed.map((semester) => ({
      key: semester.id,
      label: semester.label,
      gpa: semester.gpa.value,
    })),
    ongoingSubjects,
    priorities: prioritizeSubjects(
      ongoingSubjects.map((subject) => ({
        subjectId: subject.id,
        name: subject.name,
        credits: subject.credits,
        progress: subject.progress,
        classification: subject.classification,
        targetFinalMark: subject.targetFinalMark,
      })),
    ),
    strongest: strongestSubjects(
      ongoingSubjects.map((subject) => ({
        subjectId: subject.id,
        name: subject.name,
        progress: subject.progress,
      })),
    ),
    recommendations: ongoingSubjects.flatMap((subject) =>
      subject.recommendations.map((recommendation) => ({
        ...recommendation,
        subjectId: subject.id,
        subjectName: subject.name,
      })),
    ),
    targetPlan: overallGoal
      ? {
          targetCgpa: overallGoal.targetValue,
          futureCredits,
          result: requiredGpaForTarget({
            currentGradePoints: cgpa.totalGradePoints,
            completedCredits: cgpa.totalCredits,
            futureCredits,
            targetCgpa: overallGoal.targetValue,
          }),
        }
      : null,
  };
}

export function analyseSubject(
  subject: SubjectWithAssessments,
  gpaTarget: number | null,
): SubjectAnalysis {
  const input = toSubjectInput(subject);
  const progress = computeProgress(input);
  const targetFinalMark =
    gpaTarget === null ? null : targetMarkForGpa(gpaTarget);

  const classification = classifySubject({
    progress,
    targetFinalMark,
    previousAssessedPercent: previousAssessedPercent(input.assessments),
  });

  const official = officialGrade(progress);

  return {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    credits: subject.credits,
    courseType: subject.courseType,
    gradingType: subject.gradingType,
    status: subject.status,
    progress,
    classification,
    recommendations:
      subject.status === "ONGOING"
        ? recommendForSubject(classification, progress)
        : [],
    official:
      official && progress.finalMark !== null
        ? { ...official, finalMark: progress.finalMark }
        : null,
    targetFinalMark,
    requirement:
      subject.status === "ONGOING" && targetFinalMark !== null
        ? requiredMarksForTarget(progress, targetFinalMark)
        : null,
    relativeStanding:
      input.gradingType === "RELATIVE" ? subjectRelativeStanding(input) : null,
    assessmentTrend: assessmentSeries(input.assessments),
  };
}

/**
 * One subject's analysis, with the target resolved from the goal that applies
 * to its semester (§21, §23).
 */
export async function analyseSubjectForUser(
  userId: string,
  subjectId: string,
): Promise<SubjectAnalysis> {
  const subject = await getSubject(userId, subjectId);
  const semester = await prisma.semester.findUniqueOrThrow({
    where: { id: subject.semesterId },
    select: {
      gpaTarget: true,
      goals: { where: { scope: "SEMESTER" }, select: { targetValue: true } },
    },
  });

  const gpaTarget = semester.goals[0]?.targetValue ?? semester.gpaTarget ?? null;
  return analyseSubject(subject, gpaTarget);
}
