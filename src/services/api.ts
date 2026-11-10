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
import {
  SupabaseError,
  isMethodNotAllowedError,
  isMissingTableError,
  isPermissionDeniedError,
  isSchemaMismatchError,
  isSupabaseConfigured,
  supabaseConfigError,
  supabaseRest
} from './supabase';

/**
 * API service layer.
 *
 * Every call now goes straight to Supabase through its PostgREST API
 * (`https://<project-ref>.supabase.co/rest/v1`). The old hard-coded `/api`
 * routes that only existed in local development (and returned `NOT_FOUND` on
 * Vercel) have been removed.
 *
 * Environment variables (see `.env.example`):
 *   VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * If Supabase is unreachable or not configured, the exported functions throw a
 * descriptive `ApiError` and `App.tsx` keeps the UI usable with local data.
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Serialises an error for precise console.error output. */
function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError || error instanceof SupabaseError) {
    return { name: error.name, message: error.message, status: error.status, code: error.code };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { error };
}

/* -------------------------------------------------------------------------- */
/* Column helpers (Supabase convention is snake_case)                         */
/* -------------------------------------------------------------------------- */

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function toRow(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toRow);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [camelToSnake(key), toRow(entry)])
    );
  }
  return value;
}

function fromRow<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((entry) => fromRow(entry)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [snakeToCamel(key), fromRow(entry)])
    ) as T;
  }
  return value as T;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SupabaseError) {
    return new ApiError(error.message, error.status, error.code);
  }
  if (error instanceof Error) return new ApiError(error.message, 0);
  return new ApiError('An unexpected error occurred while talking to Supabase.', 0);
}

function fallbackId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* Table resolution                                                           */
/* -------------------------------------------------------------------------- */

type TableGroup = keyof typeof TABLE_CANDIDATES;

const TABLE_CANDIDATES = {
  classes: ['classes', 'school_classes'],
  students: ['students'],
  staff: ['staff', 'users', 'profiles'],
  teacherAttendance: [
    'teacher_attendance',
    'teacher_attendance_records',
    'staff_attendance',
    'attendance_records'
  ],
  studentAttendance: [
    'student_attendance',
    'student_attendance_records',
    'attendance_records'
  ],
  payments: ['payments', 'fee_payments'],
  ledger: ['ledger', 'ledger_entries', 'financial_ledger'],
  curriculum: ['curriculum', 'curriculum_materials'],
  evaluations: ['evaluations', 'student_milestone_evaluations'],
  feedback: ['feedback', 'parent_feedback', 'parent_feedback_messages']
} as const;

const resolvedTables = new Map<TableGroup, string>();

interface TableRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: string;
  body?: unknown;
  prefer?: string;
  /** Reads tolerate a missing table and return an empty result instead. */
  allowMissing?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Live schema introspection (PostgREST OpenAPI root)                          */
/* -------------------------------------------------------------------------- */

interface OpenApiSpec {
  paths?: Record<string, Record<string, unknown>>;
  definitions?: Record<string, { properties?: Record<string, unknown> }>;
}

interface RestSchema {
  /** Relation name -> methods PostgREST accepts (get/post/patch/delete). */
  methods: Map<string, Set<string>>;
  /** Relation name -> exact column names on that relation. */
  columns: Map<string, Set<string>>;
}

let restSchemaPromise: Promise<RestSchema | null> | null = null;

/**
 * Loads the PostgREST OpenAPI description of the live database once per
 * session. It reports the exact relations that exist and which methods each
 * accepts — a read-only view (e.g. `users`/`profiles` over `auth.users`) only
 * lists `get`, which is what produces "405 Method Not Allowed" on INSERT.
 * Using this to filter write candidates means mutations are only attempted
 * against relations that actually accept the method and its columns.
 */
async function loadRestSchema(): Promise<RestSchema | null> {
  if (!restSchemaPromise) {
    restSchemaPromise = (async () => {
      try {
        const spec = await supabaseRest<OpenApiSpec>('/', { method: 'GET' });
        if (!spec || typeof spec !== 'object' || !spec.paths) return null;

        const methods = new Map<string, Set<string>>();
        const columns = new Map<string, Set<string>>();

        Object.entries(spec.paths).forEach(([path, operations]) => {
          const name = path.replace(/^\//, '');
          if (!name || /[({]/.test(name)) return;
          methods.set(name, new Set(Object.keys(operations ?? {})));
        });

        Object.entries(spec.definitions ?? {}).forEach(([name, definition]) => {
          const properties = definition?.properties ?? {};
          if (Object.keys(properties).length > 0) {
            columns.set(name, new Set(Object.keys(properties)));
          }
        });

        return { methods, columns };
      } catch (error) {
        console.error(
          '[api] Could not load the Supabase REST schema — table/method verification is disabled for this session.',
          errorDetails(error)
        );
        return null;
      }
    })();
  }
  return restSchemaPromise;
}

/** Top-level snake_case column names sent for a payload (object or batch). */
function payloadColumnKeys(payload: unknown): string[] {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== 'object') return [];
  return Object.keys(row).map(camelToSnake);
}

async function tableRequest<T>(
  group: TableGroup,
  options: TableRequestOptions = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const isWrite = method !== 'GET';
  const cached = resolvedTables.get(group);
  let candidates = cached
    ? [cached, ...TABLE_CANDIDATES[group].filter((name) => name !== cached)]
    : [...TABLE_CANDIDATES[group]];

  const schema = await loadRestSchema();

  // Route writes only to relations the live database declares as writable.
  // This is what stops INSERT/UPDATE/DELETE from ever hitting a read-only
  // view (the source of the 405 Method Not Allowed errors).
  if (isWrite && schema) {
    const writable = candidates.filter((table) =>
      schema.methods.get(table)?.has(method.toLowerCase())
    );
    const rejected = candidates.filter((table) => !writable.includes(table));
    if (writable.length > 0 && rejected.length > 0) {
      console.warn(
        `[api] Skipping read-only relation(s) for ${method} on "${group}": ${rejected.join(', ')}. ` +
          `Writable candidate(s): ${writable.join(', ')}.`
      );
      candidates = writable;
    }
  }

  let lastError: unknown = null;
  // First non-retryable-but-405 style failure (e.g. a read-only view) — thrown
  // at the end if no other candidate accepts the request.
  let methodError: unknown = null;

  for (const table of candidates) {
    // Pre-flight column check: never send a payload whose columns do not
    // exist on this candidate table (different candidates have different
    // schemas) — log the exact mismatch instead of waiting for PostgREST.
    if (isWrite && schema && options.body !== undefined) {
      const columns = schema.columns.get(table);
      const unknownColumns = payloadColumnKeys(options.body).filter(
        (key) => !columns?.has(key)
      );
      if (columns && unknownColumns.length > 0) {
        console.error(
          `[api] Skipping ${method} /rest/v1/${table}: payload columns ` +
            `[${unknownColumns.join(', ')}] do not exist on the table. ` +
            `Available columns: ${[...columns].join(', ')}.`,
          { payload: options.body }
        );
        lastError = new ApiError(
          `Payload does not match the "${table}" table schema (unknown columns: ${unknownColumns.join(', ')}).`,
          400
        );
        continue;
      }
    }

    try {
      const result = await supabaseRest<T>(`/${table}${options.query ?? ''}`, {
        method,
        body: options.body === undefined ? undefined : JSON.stringify(toRow(options.body)),
        headers: options.prefer ? { Prefer: options.prefer } : undefined
      });
      resolvedTables.set(group, table);
      return result;
    } catch (error) {
      lastError = error;

      // Missing table (404), method-not-allowed (405, typically a read-only
      // view) or column/schema mismatch (PGRST204) means this candidate cannot
      // serve the request — log the exact table, method and payload, then try
      // the next candidate.
      if (
        isMissingTableError(error) ||
        isMethodNotAllowedError(error) ||
        isSchemaMismatchError(error)
      ) {
        if (isMethodNotAllowedError(error) && methodError === null) {
          methodError = error;
        }
        console.error(
          `[api] ${method} /rest/v1/${table}${options.query ?? ''} was rejected:`,
          { payload: options.body, details: errorDetails(error) }
        );
        continue;
      }

      // RLS policies / missing grants point at a real table: fail fast with an
      // actionable message naming the relation instead of guessing.
      if (isPermissionDeniedError(error)) {
        console.error(
          `[api] ${method} /rest/v1/${table} is blocked by Row Level Security / permissions.`,
          { payload: options.body, details: errorDetails(error) }
        );
        const base = toApiError(error);
        throw new ApiError(
          `Permissions are blocking ${method} on the "${table}" table: ${base.message}. ` +
            'Add an INSERT/UPDATE/DELETE policy for the authenticated role (or grant the ' +
            'privilege) in Supabase.',
          base.status,
          base.code
        );
      }

      console.error(
        `[api] ${method} /rest/v1/${table}${options.query ?? ''} failed.`,
        { payload: options.body, details: errorDetails(error) }
      );
      throw toApiError(error);
    }
  }

  if (options.allowMissing) {
    console.error(
      `[api] No Supabase table found for "${group}". Tried: ${candidates.join(', ')}.`,
      errorDetails(lastError)
    );
    return (method === 'GET' ? [] : undefined) as T;
  }

  // Every candidate was missing or rejected the method (e.g. all of them are
  // read-only views). Prefer the 405 detail so the real cause is reported.
  const cause = toApiError(methodError ?? lastError);
  throw new ApiError(
    `${method} request failed for "${group}" (tried tables: ${candidates.join(', ')}): ` +
      `${cause.message}. ` +
      (methodError
        ? 'The relation may be a read-only view — create the writable table in Supabase and make sure it grants INSERT/UPDATE/DELETE to the authenticated role.'
        : 'Verify the table exists and accepts this operation.'),
    cause.status,
    cause.code
  );
}

/**
 * Reads every row of a table group. Parsing is defensive:
 * - A missing table (or any Supabase/runtime error) logs exact details to
 *   `console.error` and resolves to `[]` so one broken table never fails the
 *   whole live-data load.
 * - A response that is not a JSON array (empty body, object, HTML page) is
 *   reported and treated as "no rows" instead of throwing a malformed-response
 *   error further down the line.
 * - A completely unconfigured Supabase project still throws so the UI can show
 *   the configuration banner.
 */
async function readList<T>(group: TableGroup): Promise<T[]> {
  if (!isSupabaseConfigured()) {
    throw new ApiError(supabaseConfigError(), 0);
  }

  try {
    const rows = await tableRequest<unknown[]>(group, {
      query: '?select=*',
      allowMissing: true
    });

    if (rows === null || rows === undefined) return [];
    if (!Array.isArray(rows)) {
      console.error(
        `[api] Unexpected Supabase payload for "${group}" — expected a JSON array, got ${typeof rows}.`,
        errorDetails(rows)
      );
      return [];
    }

    try {
      return fromRow<T[]>(rows);
    } catch (err) {
      console.error(
        `[api] Could not parse rows for "${group}" (schema mismatch?). Tried tables: ${TABLE_CANDIDATES[
          group
        ].join(', ')}.`,
        errorDetails(err)
      );
      return [];
    }
  } catch (error) {
    console.error(
      `[api] Failed to load "${group}" from Supabase. Tried tables: ${TABLE_CANDIDATES[
        group
      ].join(', ')}.`,
      errorDetails(error)
    );
    return [];
  }
}

async function insertOne<T>(group: TableGroup, payload: unknown): Promise<T> {
  const rows = await tableRequest<unknown[]>(group, {
    method: 'POST',
    body: payload,
    prefer: 'return=representation'
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (row === undefined || row === null) {
    console.error(
      `[api] Insert into "${group}" was accepted but returned no row.`,
      { payload, response: rows }
    );
    throw new ApiError(
      `Supabase accepted the insert into "${group}" but did not return the created row. ` +
        'Verify the table schema matches the payload.',
      0
    );
  }
  return fromRow<T>(row);
}

async function patchOne<T>(
  group: TableGroup,
  id: string,
  payload: unknown
): Promise<T> {
  const rows = await tableRequest<unknown[]>(group, {
    method: 'PATCH',
    query: `?id=eq.${encodeURIComponent(id)}`,
    body: payload,
    prefer: 'return=representation'
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (row === undefined || row === null) {
    console.error(
      `[api] Update on "${group}" (id=${id}) matched no row or returned no representation.`,
      { payload, response: rows }
    );
    throw new ApiError(
      `Could not update the record in "${group}" (id=${id}) — it may no longer exist, ` +
        'or the table schema does not match the payload.',
      404
    );
  }
  return fromRow<T>(row);
}

/* -------------------------------------------------------------------------- */
/* Classes & students                                                         */
/* -------------------------------------------------------------------------- */

export async function getClasses(): Promise<SchoolClass[]> {
  return readList<SchoolClass>('classes');
}

export async function getStudents(): Promise<Student[]> {
  return readList<Student>('students');
}

export async function getStudent(studentId: string): Promise<Student> {
  const rows = await tableRequest<unknown[]>('students', {
    query: `?select=*&id=eq.${encodeURIComponent(studentId)}`
  });
  const list = Array.isArray(rows) ? fromRow<Student[]>(rows) : [];
  const found = list[0];
  if (!found) {
    throw new ApiError('Student not found.', 404);
  }
  return found;
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

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const created = await insertOne<Student>('students', input);
  return {
    ...created,
    id: created.id ?? fallbackId('stu'),
    paidAmount: created.paidAmount ?? 0,
    balance: created.balance ?? input.tuitionFeeTerm,
    emergencyContact: created.emergencyContact ?? ''
  };
}

export type UpdateStudentInput = Omit<CreateStudentInput, 'regNumber'>;

export async function updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
  const updated = await patchOne<Student | undefined>('students', id, input);
  if (!updated) {
    throw new ApiError('Student not found or could not be updated.', 404);
  }
  const paid = updated.paidAmount ?? 0;
  return {
    ...updated,
    id: updated.id ?? id,
    paidAmount: paid,
    balance: Math.max(0, input.tuitionFeeTerm - paid),
    emergencyContact: updated.emergencyContact ?? ''
  };
}

export interface StudentPaymentStatusInput {
  paidAmount: number;
  balance: number;
}

/**
 * Persists a student's running fee totals (paid amount / balance) after a
 * payment is recorded so the figures survive refresh and logout.
 */
export async function updateStudentPaymentStatus(
  id: string,
  input: StudentPaymentStatusInput
): Promise<Student> {
  const updated = await patchOne<Student | undefined>('students', id, input);
  if (!updated) {
    throw new ApiError('Student not found or could not be updated.', 404);
  }
  return {
    ...updated,
    id: updated.id ?? id,
    paidAmount: updated.paidAmount ?? input.paidAmount,
    balance: updated.balance ?? input.balance
  };
}

export async function deleteStudent(id: string): Promise<void> {
  await tableRequest<unknown[]>('students', {
    method: 'DELETE',
    query: `?id=eq.${encodeURIComponent(id)}`
  });
}

/* -------------------------------------------------------------------------- */
/* Staff accounts                                                             */
/* -------------------------------------------------------------------------- */

export async function getStaff(): Promise<User[]> {
  return readList<User>('staff');
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: Extract<UserRole, 'ACCOUNTANT' | 'TEACHER'>;
  title: string;
  password: string;
}

export async function createStaff(input: CreateStaffInput): Promise<User> {
  // Never persist plain-text passwords in the database. Staff logins are
  // handled by Supabase Auth / the local credential store.
  const { password: _password, ...profile } = input;
  const created = await insertOne<User>('staff', profile);
  return {
    ...created,
    id: created.id ?? fallbackId('staff'),
    phone: created.phone ?? input.phone ?? ''
  };
}

/* -------------------------------------------------------------------------- */
/* Class management                                                           */
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

export async function createClass(input: CreateClassInput): Promise<SchoolClass> {
  const created = await insertOne<SchoolClass>('classes', input);
  return {
    ...created,
    id: created.id ?? fallbackId('cls'),
    studentCount: created.studentCount ?? 0
  };
}

/* -------------------------------------------------------------------------- */
/* Teacher attendance                                                         */
/* -------------------------------------------------------------------------- */

export async function getTeacherAttendance(): Promise<TeacherAttendanceRecord[]> {
  return readList<TeacherAttendanceRecord>('teacherAttendance');
}

export interface TeacherCheckInInput {
  teacherId: string;
  teacherName: string;
  date: string;
  checkInTime: string;
  notes?: string;
}

export async function createTeacherCheckIn(
  input: TeacherCheckInInput
): Promise<TeacherAttendanceRecord> {
  const created = await insertOne<TeacherAttendanceRecord>('teacherAttendance', {
    ...input,
    status: 'PENDING'
  });
  return {
    ...created,
    id: created.id ?? fallbackId('att'),
    status: created.status ?? 'PENDING'
  };
}

export interface ReviewTeacherAttendanceInput {
  status: Extract<TeacherAttendanceStatus, 'APPROVED' | 'REJECTED'>;
  reviewedBy: string;
  headmasterRemarks?: string;
  rejectionReason?: string;
}

export async function reviewTeacherAttendance(
  id: string,
  input: ReviewTeacherAttendanceInput
): Promise<TeacherAttendanceRecord> {
  const updated = await patchOne<TeacherAttendanceRecord>('teacherAttendance', id, {
    ...input,
    reviewedAt: new Date().toISOString()
  });
  return {
    ...updated,
    id: updated.id ?? id
  };
}

/* -------------------------------------------------------------------------- */
/* Student attendance                                                         */
/* -------------------------------------------------------------------------- */

export async function getStudentAttendance(): Promise<StudentAttendanceRecord[]> {
  return readList<StudentAttendanceRecord>('studentAttendance');
}

export async function saveStudentAttendance(
  records: Omit<StudentAttendanceRecord, 'id'>[]
): Promise<StudentAttendanceRecord[]> {
  const rows = await tableRequest<unknown[]>('studentAttendance', {
    method: 'POST',
    body: records,
    prefer: 'return=representation'
  });
  const list = Array.isArray(rows) ? rows : [];
  return fromRow<StudentAttendanceRecord[]>(list).map((record) => ({
    ...record,
    id: record.id ?? fallbackId('satt')
  }));
}

/* -------------------------------------------------------------------------- */
/* Fees & ledger                                                              */
/* -------------------------------------------------------------------------- */

export async function getFeePayments(): Promise<FeePayment[]> {
  return readList<FeePayment>('payments');
}

export type RecordPaymentInput = Omit<FeePayment, 'id' | 'receiptNumber' | 'status'>;

export async function recordPayment(input: RecordPaymentInput): Promise<FeePayment> {
  const fallbackReceipt = `RCP-${new Date().getFullYear()}-${Date.now()
    .toString()
    .slice(-4)}`;
  const created = await insertOne<FeePayment>('payments', {
    ...input,
    receiptNumber: fallbackReceipt,
    status: 'VERIFIED'
  });
  return {
    ...created,
    id: created.id ?? fallbackId('pay'),
    receiptNumber: created.receiptNumber ?? fallbackReceipt,
    status: created.status ?? 'VERIFIED'
  };
}

export async function getLedger(): Promise<LedgerEntry[]> {
  return readList<LedgerEntry>('ledger');
}

export type LedgerEntryInput = Omit<LedgerEntry, 'id'>;

export async function createLedgerEntry(input: LedgerEntryInput): Promise<LedgerEntry> {
  const created = await insertOne<LedgerEntry>('ledger', input);
  return {
    ...created,
    id: created.id ?? fallbackId('led')
  };
}

/* -------------------------------------------------------------------------- */
/* Curriculum                                                                  */
/* -------------------------------------------------------------------------- */

export async function getCurriculum(_classId?: string): Promise<CurriculumMaterial[]> {
  return readList<CurriculumMaterial>('curriculum');
}

export type CurriculumUploadInput = Omit<CurriculumMaterial, 'id' | 'uploadDate'>;

export async function uploadCurriculum(
  input: CurriculumUploadInput
): Promise<CurriculumMaterial> {
  const created = await insertOne<CurriculumMaterial>('curriculum', input);
  return {
    ...created,
    id: created.id ?? fallbackId('cur'),
    uploadDate: created.uploadDate ?? new Date().toISOString().slice(0, 10)
  };
}

/* -------------------------------------------------------------------------- */
/* Evaluations                                                                 */
/* -------------------------------------------------------------------------- */

export async function getEvaluations(): Promise<StudentMilestoneEvaluation[]> {
  return readList<StudentMilestoneEvaluation>('evaluations');
}

/* -------------------------------------------------------------------------- */
/* Parent feedback                                                             */
/* -------------------------------------------------------------------------- */

export async function getFeedback(studentId?: string): Promise<ParentFeedbackMessage[]> {
  const all = await readList<ParentFeedbackMessage>('feedback');
  if (!studentId) return all;
  return all.filter((message) => message.parentId === studentId);
}

export interface SubmitFeedbackInput {
  parentId: string;
  parentName: string;
  studentName: string;
  studentClass: string;
  subject: string;
  message: string;
}

export async function submitFeedback(
  input: SubmitFeedbackInput
): Promise<ParentFeedbackMessage> {
  const created = await insertOne<ParentFeedbackMessage>('feedback', {
    ...input,
    createdAt: new Date().toISOString(),
    status: 'PENDING_REPLY'
  });
  return {
    ...created,
    id: created.id ?? fallbackId('fb'),
    createdAt: created.createdAt ?? new Date().toISOString(),
    status: created.status ?? 'PENDING_REPLY'
  };
}
