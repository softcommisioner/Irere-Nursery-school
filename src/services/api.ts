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
  TeacherAttendanceStatus,
  User,
  UserRole
} from '../types';

/**
 * API service layer.
 *
 * All backend access goes through this module. Point it at your real backend
 * (or Supabase / a Supabase Edge Function / PostgREST endpoint) with the
 * `VITE_API_BASE_URL` environment variable:
 *
 *   VITE_API_BASE_URL=https://<project-ref>.supabase.co/rest/v1
 *
 * If you prefer the official Supabase SDK, install `@supabase/supabase-js` and
 * swap the `request()` implementation for `supabase.from(...)` calls — the
 * exported function signatures below can stay identical.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {})
      },
      ...options
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection.', 0);
  }

  const raw = await response.text();

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(raw) || `Request failed with status ${response.status}`,
      response.status
    );
  }

  if (response.status === 204 || raw.trim() === '') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Guard against non-JSON payloads (e.g. an SPA index.html returned with a 200
  // for an unmatched `/api/...` route). Never let a raw `JSON.parse` SyntaxError
  // escape — raise a descriptive ApiError the UI can fall back from.
  if (!contentType.toLowerCase().includes('json') && looksLikeHtml(raw)) {
    throw new ApiError(
      'The API endpoint returned HTML instead of JSON. The backend is not available.',
      response.status
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError('Received a malformed response from the server.', response.status);
  }
}

function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 32).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml');
}

function extractErrorMessage(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string; detail?: string };
    return parsed.message ?? parsed.error ?? parsed.detail ?? '';
  } catch {
    return looksLikeHtml(raw) ? 'The backend is not available.' : raw.slice(0, 200);
  }
}

/* -------------------------------------------------------------------------- */
/* Classes & students                                                          */
/* -------------------------------------------------------------------------- */

export function getClasses(): Promise<SchoolClass[]> {
  return request<SchoolClass[]>('/classes');
}

export function getStudents(): Promise<Student[]> {
  return request<Student[]>('/students');
}

export function getStudent(studentId: string): Promise<Student> {
  return request<Student>(`/students/${studentId}`);
}

export interface CreateStudentInput {
  regNumber: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dob: string;
  classId: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  residenceVillage: string;
  tuitionFeeTerm: number;
}

export function createStudent(input: CreateStudentInput): Promise<Student> {
  return request<Student>('/students', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Staff accounts                                                              */
/* -------------------------------------------------------------------------- */

export function getStaff(): Promise<User[]> {
  return request<User[]>('/staff');
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: Extract<UserRole, 'ACCOUNTANT' | 'TEACHER'>;
  title: string;
  password: string;
}

export function createStaff(input: CreateStaffInput): Promise<User> {
  return request<User>('/staff', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Class management                                                            */
/* -------------------------------------------------------------------------- */

export interface CreateClassInput {
  code: string;
  name: string;
  kinyarwandaName: string;
  ageRange: string;
  teacherId: string;
  teacherName: string;
  roomNumber: string;
  capacity: number;
}

export function createClass(input: CreateClassInput): Promise<SchoolClass> {
  return request<SchoolClass>('/classes', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Teacher attendance                                                          */
/* -------------------------------------------------------------------------- */

export function getTeacherAttendance(): Promise<TeacherAttendanceRecord[]> {
  return request<TeacherAttendanceRecord[]>('/teacher-attendance');
}

export interface TeacherCheckInInput {
  teacherId: string;
  teacherName: string;
  date: string;
  checkInTime: string;
  notes?: string;
}

export function createTeacherCheckIn(
  input: TeacherCheckInInput
): Promise<TeacherAttendanceRecord> {
  return request<TeacherAttendanceRecord>('/teacher-attendance', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export interface ReviewTeacherAttendanceInput {
  status: Extract<TeacherAttendanceStatus, 'APPROVED' | 'REJECTED'>;
  reviewedBy: string;
  headmasterRemarks?: string;
  rejectionReason?: string;
}

export function reviewTeacherAttendance(
  id: string,
  input: ReviewTeacherAttendanceInput
): Promise<TeacherAttendanceRecord> {
  return request<TeacherAttendanceRecord>(`/teacher-attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Student attendance                                                          */
/* -------------------------------------------------------------------------- */

export function getStudentAttendance(): Promise<StudentAttendanceRecord[]> {
  return request<StudentAttendanceRecord[]>('/student-attendance');
}

export function saveStudentAttendance(
  records: Omit<StudentAttendanceRecord, 'id'>[]
): Promise<StudentAttendanceRecord[]> {
  return request<StudentAttendanceRecord[]>('/student-attendance', {
    method: 'POST',
    body: JSON.stringify({ records })
  });
}

/* -------------------------------------------------------------------------- */
/* Fees & ledger                                                               */
/* -------------------------------------------------------------------------- */

export function getFeePayments(): Promise<FeePayment[]> {
  return request<FeePayment[]>('/payments');
}

export type RecordPaymentInput = Omit<FeePayment, 'id' | 'receiptNumber' | 'status'>;

export function recordPayment(input: RecordPaymentInput): Promise<FeePayment> {
  return request<FeePayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function getLedger(): Promise<LedgerEntry[]> {
  return request<LedgerEntry[]>('/ledger');
}

export type LedgerEntryInput = Omit<LedgerEntry, 'id'>;

export function createLedgerEntry(input: LedgerEntryInput): Promise<LedgerEntry> {
  return request<LedgerEntry>('/ledger', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Curriculum                                                                  */
/* -------------------------------------------------------------------------- */

export function getCurriculum(classId?: string): Promise<CurriculumMaterial[]> {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return request<CurriculumMaterial[]>(`/curriculum${query}`);
}

export type CurriculumUploadInput = Omit<CurriculumMaterial, 'id' | 'uploadDate'>;

export function uploadCurriculum(
  input: CurriculumUploadInput
): Promise<CurriculumMaterial> {
  return request<CurriculumMaterial>('/curriculum', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Evaluations                                                                 */
/* -------------------------------------------------------------------------- */

export function getEvaluations(): Promise<StudentMilestoneEvaluation[]> {
  return request<StudentMilestoneEvaluation[]>('/evaluations');
}

/* -------------------------------------------------------------------------- */
/* Parent feedback                                                             */
/* -------------------------------------------------------------------------- */

export function getFeedback(studentId?: string): Promise<ParentFeedbackMessage[]> {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return request<ParentFeedbackMessage[]>(`/feedback${query}`);
}

export interface SubmitFeedbackInput {
  parentId: string;
  parentName: string;
  studentName: string;
  studentClass: string;
  subject: string;
  message: string;
}

export function submitFeedback(
  input: SubmitFeedbackInput
): Promise<ParentFeedbackMessage> {
  return request<ParentFeedbackMessage>('/feedback', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
