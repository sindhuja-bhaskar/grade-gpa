/**
 * Shared vocabulary for the calculation engine (docs/reqs.md §36).
 *
 * These types are deliberately independent of Prisma and of React: the engine
 * is a set of pure modules that take plain data and return plain data, so it
 * can be unit-tested without a database or a request (§36, §40).
 */

export type CourseType = "THEORY" | "LABORATORY" | "THEORY_AND_LAB";
export type GradingType = "ABSOLUTE" | "RELATIVE";
export type CourseComponent = "THEORY" | "LAB";
export type AssessmentStatus = "AVAILABLE" | "NOT_AVAILABLE";
export type SubjectStatus = "ONGOING" | "COMPLETED";

/** A component of a course scheme: what it is worth and out of how much. */
export interface ComponentSpec {
  code: string;
  label: string;
  component: CourseComponent;
  sequence: number;
  maxMarks: number;
  /** Percentage weight *within its component group* (theory or lab). */
  weight: number;
  /** §14: assignments never require a class average. */
  classAverageApplicable: boolean;
  /**
   * §11.2: some lab components carry a minimum-mark requirement that is
   * independent of the grade calculation. Expressed as a percentage of maxMarks.
   */
  minimumMarkPercent?: number;
}

/**
 * The full assessment structure for one course type. Split gives the relative
 * weight of the theory and lab halves of a THEORY_AND_LAB course (§17.3).
 */
export interface CourseScheme {
  courseType: CourseType;
  components: ComponentSpec[];
  split: { theory: number; lab: number };
}

/** One assessment as the engine sees it — the mark may legitimately be absent. */
export interface AssessmentInput {
  componentCode: string;
  label: string;
  component: CourseComponent;
  sequence: number;
  maxMarks: number;
  /** Weight within the component group, copied from the scheme at creation. */
  weight: number;
  status: AssessmentStatus;
  /** Null when NOT_AVAILABLE. 0 means an actual zero was scored (BR-04, BR-05). */
  studentMark: number | null;
  classAverage?: number | null;
  standardDeviation?: number | null;
}

export interface SubjectInput {
  id: string;
  name: string;
  credits: number;
  courseType: CourseType;
  gradingType: GradingType;
  classStrength?: number | null;
  /** Per-subject override of the theory/lab split (§11.2). */
  theoryWeightPercent?: number | null;
  labWeightPercent?: number | null;
  assessments: AssessmentInput[];
}

/** Contribution of a single assessment to the 100-mark course total. */
export interface ComponentContribution {
  componentCode: string;
  label: string;
  component: CourseComponent;
  sequence: number;
  maxMarks: number;
  /** Weight of this component in the *final course mark*, after any split. */
  effectiveWeight: number;
  status: AssessmentStatus;
  studentMark: number | null;
  /** Weighted marks earned. Null while the assessment is unavailable. */
  earned: number | null;
  minimumMarkPercent?: number;
  minimumMarkMet?: boolean | null;
}

/**
 * Where an ongoing subject currently stands (§12, §13). Every field describes
 * *assessed* work only: nothing here is a grade, and nothing is extrapolated.
 */
export interface SubjectProgress {
  components: ComponentContribution[];
  /** Weighted marks earned so far, out of `completedWeight`. */
  earnedMarks: number;
  /** Total weight of the assessments that have a recorded mark. */
  completedWeight: number;
  /** Total weight still unassessed. */
  remainingWeight: number;
  /** Highest final mark still reachable = earnedMarks + remainingWeight. */
  maxAchievableFinalMark: number;
  /** Percentage scored on the work assessed so far; null when nothing is. */
  assessedPercent: number | null;
  /** True when every component of the scheme has a recorded mark (BR-21). */
  isComplete: boolean;
  /** Final mark out of 100 — only once `isComplete` (§18.2). */
  finalMark: number | null;
}

export type PerformanceCategory =
  | "EXCELLENT"
  | "STRONG"
  | "ON_TRACK"
  | "NEEDS_ATTENTION"
  | "NEEDS_IMPROVEMENT"
  | "HIGH_RISK";

export interface GradeResult {
  grade: string;
  gradePoint: number;
}

/** A completed course, the only kind that feeds official GPA/CGPA (BR-16). */
export interface CompletedCourse {
  credits: number;
  gradePoint: number;
}
