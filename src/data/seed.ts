import {
  CurriculumMaterial,
  FeePayment,
  LedgerEntry,
  ParentFeedbackMessage,
  SchoolClass,
  Student,
  StudentAttendanceRecord,
  StudentMilestoneEvaluation,
  TeacherAttendanceRecord,
  User
} from '../types';

/**
 * Local fallback dataset.
 *
 * Demo/mock records have intentionally been removed so a fresh deployment
 * starts at zero and only renders data returned by the live API.
 */

export const SEED_STAFF: User[] = [];

export const SEED_CLASSES: SchoolClass[] = [];

export const SEED_STUDENTS: Student[] = [];

export const SEED_TEACHER_ATTENDANCE: TeacherAttendanceRecord[] = [];

export const SEED_STUDENT_ATTENDANCE: StudentAttendanceRecord[] = [];

export const SEED_PAYMENTS: FeePayment[] = [];

export const SEED_LEDGER: LedgerEntry[] = [];

export const SEED_CURRICULUM: CurriculumMaterial[] = [];

export const SEED_FEEDBACK: ParentFeedbackMessage[] = [];

export const SEED_EVALUATIONS: StudentMilestoneEvaluation[] = [];
