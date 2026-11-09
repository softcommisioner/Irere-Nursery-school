import { UserRole } from '../types';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_AUTH_URL,
  isSupabaseConfigured,
  setSupabaseAccessToken
} from './supabase';

/**
 * Authentication store.
 *
 * When Supabase is configured (`VITE_SUPABASE_URL` + anon key), sign-in and
 * parent registration are handled by Supabase Auth. If the project is not
 * configured (or the auth endpoint is unreachable), the service falls back to
 * the local demo credential store so every portal remains testable.
 *
 * Production note: demo passwords live in memory/localStorage and should be
 * removed once real Supabase accounts are provisioned.
 */

const ACCOUNTS_KEY = 'irere.auth.accounts.v1';
const SESSION_KEY = 'irere.auth.session.v1';

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  linkedStudentReg?: string;
}

export interface AuthAccount extends AuthSession {
  password: string;
  phone?: string;
  linkedStudentName?: string;
  createdAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  HEADMASTER: 'Headmaster',
  ACCOUNTANT: 'Accountant',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  SPONSOR: 'Sponsor'
};

const DEFAULT_STAFF: AuthAccount[] = [
  {
    id: 'demo-headmaster',
    name: 'Mukamana Claudine',
    email: 'headmaster@irerenursery.rw',
    password: 'Irere@2026',
    role: 'HEADMASTER',
    title: 'Headmaster',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'demo-accountant',
    name: 'Habimana Eric',
    email: 'accountant@irerenursery.rw',
    password: 'Irere@2026',
    role: 'ACCOUNTANT',
    title: 'School Accountant',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'demo-teacher',
    name: 'Uwimana Aline',
    email: 'teacher@irerenursery.rw',
    password: 'Irere@2026',
    role: 'TEACHER',
    title: 'Lead Teacher',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'demo-sponsor',
    name: 'Irere Education Partner',
    email: 'sponsor@irerenursery.rw',
    password: 'Irere@2026',
    role: 'SPONSOR',
    title: 'Read-only Sponsor',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredAccounts(): AuthAccount[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthAccount[]) : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: AuthAccount[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Storage can be unavailable (private mode, quota). The session simply
    // will not persist across reloads in that case.
  }
}

/** All accounts, with saved accounts overriding the built-in demo accounts. */
export function getAccounts(): AuthAccount[] {
  const stored = readStoredAccounts();
  const merged = new Map<string, AuthAccount>();
  DEFAULT_STAFF.forEach((account) => merged.set(normalizeEmail(account.email), account));
  stored.forEach((account) => merged.set(normalizeEmail(account.email), account));
  return Array.from(merged.values());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSession(account: AuthAccount): AuthSession {
  const { password: _password, phone: _phone, linkedStudentName: _child, ...session } = account;
  return session;
}

function saveAccount(account: AuthAccount): void {
  const stored = readStoredAccounts();
  const index = stored.findIndex(
    (item) => normalizeEmail(item.email) === normalizeEmail(account.email)
  );
  if (index >= 0) {
    stored[index] = account;
  } else {
    stored.push(account);
  }
  writeStoredAccounts(stored);
}

export function saveSession(session: AuthSession): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures.
  }
}

export function loadSession(): AuthSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed.role !== 'string' || typeof parsed.email !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  setSupabaseAccessToken(null);
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export type AuthResult = { ok: true; session: AuthSession } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Supabase Auth (GoTrue REST)                                                 */
/* -------------------------------------------------------------------------- */

interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  user?: SupabaseAuthUser;
  msg?: string;
  message?: string;
  error?: string;
  error_description?: string;
  code?: string;
}

class SupabaseAuthError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
    this.code = code;
  }
}

async function authRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_AUTH_URL}${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new SupabaseAuthError('Unable to reach Supabase Auth.', 0);
  }

  const raw = await response.text();
  let parsed: SupabaseAuthResponse & Record<string, unknown> = {};
  if (raw.trim() !== '') {
    try {
      parsed = JSON.parse(raw) as SupabaseAuthResponse & Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  if (!response.ok) {
    throw new SupabaseAuthError(
      parsed.msg ??
        parsed.error_description ??
        parsed.message ??
        parsed.error ??
        `Authentication failed with status ${response.status}.`,
      response.status,
      parsed.code
    );
  }

  return parsed as T;
}

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'HEADMASTER':
    case 'HEAD_MASTER':
    case 'HEAD_TEACHER':
    case 'PRINCIPAL':
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return 'HEADMASTER';
    case 'ACCOUNTANT':
    case 'BURSAR':
    case 'FINANCE':
      return 'ACCOUNTANT';
    case 'TEACHER':
    case 'INSTRUCTOR':
      return 'TEACHER';
    case 'PARENT':
    case 'GUARDIAN':
      return 'PARENT';
    case 'SPONSOR':
    case 'DONOR':
      return 'SPONSOR';
    default:
      return null;
  }
}

function roleFromUser(user: SupabaseAuthUser): UserRole | null {
  return (
    normalizeRole(user.app_metadata?.role) ??
    normalizeRole(user.user_metadata?.role) ??
    normalizeRole(user.user_metadata?.user_role)
  );
}

function nameFromUser(user: SupabaseAuthUser, fallbackEmail: string): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.full_name, metadata.name, metadata.display_name, metadata.fullName];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate.trim();
    }
  }
  return fallbackEmail.split('@')[0];
}

function linkedStudentFromUser(user: SupabaseAuthUser): string | undefined {
  const metadata = user.user_metadata ?? {};
  const value = metadata.linked_student_reg ?? metadata.linkedStudentReg;
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim().toUpperCase()
    : undefined;
}

function sessionFromSupabase(
  user: SupabaseAuthUser,
  role: UserRole,
  email: string
): AuthSession {
  return {
    id: user.id,
    name: nameFromUser(user, email),
    email: normalizeEmail(user.email ?? email),
    role,
    title: ROLE_LABELS[role],
    linkedStudentReg: linkedStudentFromUser(user)
  };
}

function isInvalidCredentials(error: unknown): boolean {
  return (
    error instanceof SupabaseAuthError &&
    (error.status === 400 || error.status === 401 || error.status === 403)
  );
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export async function signIn(
  email: string,
  password: string,
  role: UserRole
): Promise<AuthResult> {
  const normalized = normalizeEmail(email);

  if (isSupabaseConfigured()) {
    try {
      const data = await authRequest<SupabaseAuthResponse>(
        '/token?grant_type=password',
        { email: normalized, password }
      );

      if (!data.access_token || !data.user) {
        return {
          ok: false,
          error: 'Supabase did not return a session. Confirm your email and try again.'
        };
      }

      const metadataRole = roleFromUser(data.user);
      if (metadataRole && metadataRole !== role) {
        return {
          ok: false,
          error: `These credentials are registered for the ${ROLE_LABELS[metadataRole]} portal. Please choose the correct portal.`
        };
      }

      const session = sessionFromSupabase(data.user, role, normalized);
      setSupabaseAccessToken(data.access_token);
      saveSession(session);
      return { ok: true, session };
    } catch (error) {
      // Fall back to local/demo credentials so the school can keep using the
      // portals before every Supabase Auth user has been provisioned.
      const local = signInLocal(normalized, password, role);
      if (local.ok) return local;
      if (isInvalidCredentials(error)) {
        return { ok: false, error: 'Incorrect email or password. Please try again.' };
      }
      console.warn('[auth] Supabase sign-in unavailable; using local credentials.', error);
      return local;
    }
  }

  return signInLocal(normalized, password, role);
}

function signInLocal(email: string, password: string, role: UserRole): AuthResult {
  const account = getAccounts().find(
    (item) => normalizeEmail(item.email) === normalizeEmail(email)
  );

  if (!account || account.password !== password) {
    return { ok: false, error: 'Incorrect email or password. Please try again.' };
  }

  if (account.role !== role) {
    return {
      ok: false,
      error: `These credentials are not registered for the ${ROLE_LABELS[role]} portal. Please choose the correct portal.`
    };
  }

  const session = toSession(account);
  saveSession(session);
  return { ok: true, session };
}

export interface ParentRegistrationInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  linkedStudentReg: string;
  linkedStudentName?: string;
}

export async function registerParent(
  input: ParentRegistrationInput
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  if (isSupabaseConfigured()) {
    try {
      const data = await authRequest<SupabaseAuthResponse>('/signup', {
        email,
        password: input.password,
        data: {
          role: 'PARENT',
          full_name: input.name.trim(),
          phone: input.phone ?? null,
          linked_student_reg: input.linkedStudentReg.trim().toUpperCase(),
          linked_student_name: input.linkedStudentName ?? null
        }
      });

      if (data.access_token && data.user) {
        const session = sessionFromSupabase(data.user, 'PARENT', email);
        setSupabaseAccessToken(data.access_token);
        saveSession(session);
        return { ok: true, session };
      }

      return {
        ok: false,
        error:
          'Account created. Check your email inbox to confirm it, then return here to log in.'
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isDuplicate =
        error instanceof SupabaseAuthError &&
        error.status >= 400 &&
        error.status < 500 &&
        /already|registered|exists|duplicate/i.test(message);

      if (isDuplicate) {
        return { ok: false, error: message };
      }

      console.warn(
        '[auth] Supabase registration unavailable; using local account store.',
        error
      );
    }
  }

  return registerParentLocal(input);
}

function registerParentLocal(input: ParentRegistrationInput): AuthResult {
  const email = normalizeEmail(input.email);

  if (getAccounts().some((account) => normalizeEmail(account.email) === email)) {
    return {
      ok: false,
      error: 'An account already exists with this email. Please log in instead.'
    };
  }

  const account: AuthAccount = {
    id: `parent-${Date.now()}`,
    name: input.name.trim(),
    email,
    password: input.password,
    role: 'PARENT',
    title: 'Parent / Guardian',
    phone: input.phone?.trim() || undefined,
    linkedStudentReg: input.linkedStudentReg.trim().toUpperCase(),
    linkedStudentName: input.linkedStudentName?.trim() || undefined,
    createdAt: new Date().toISOString()
  };

  saveAccount(account);
  const session = toSession(account);
  saveSession(session);
  return { ok: true, session };
}

export interface StaffAccountInput {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  phone?: string;
}

export function registerStaffAccount(input: StaffAccountInput): void {
  const email = normalizeEmail(input.email);
  const existing = readStoredAccounts().find(
    (account) => normalizeEmail(account.email) === email
  );

  saveAccount({
    id: existing?.id ?? input.id,
    name: input.name,
    email,
    password: input.password,
    role: input.role,
    title: input.title,
    phone: input.phone,
    linkedStudentReg: existing?.linkedStudentReg,
    linkedStudentName: existing?.linkedStudentName,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  });
}

/**
 * Creates a Supabase Auth account for a new staff member without disturbing the
 * currently signed-in Headmaster session (the token is intentionally ignored).
 * Failures are logged and never block staff creation.
 */
export async function provisionStaffAuth(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await authRequest('/signup', {
      email: normalizeEmail(input.email),
      password: input.password,
      data: {
        role: input.role,
        full_name: input.name,
        title: input.title
      }
    });
  } catch (error) {
    console.warn('[auth] Could not provision Supabase staff account.', error);
  }
}

/** Persists a looked-up pupil on the parent's account and active session. */
export function updateLinkedStudent(email: string, regNumber: string): AuthSession | null {
  const normalized = regNumber.trim().toUpperCase();
  const account = getAccounts().find(
    (item) => normalizeEmail(item.email) === normalizeEmail(email)
  );

  if (account) {
    saveAccount({ ...account, linkedStudentReg: normalized });
  }

  const session = loadSession();
  if (session && normalizeEmail(session.email) === normalizeEmail(email)) {
    const updated = { ...session, linkedStudentReg: normalized };
    saveSession(updated);
    return updated;
  }

  return account ? toSession({ ...account, linkedStudentReg: normalized }) : null;
}

export function getDemoCredentials(
  role: UserRole
): { email: string; password: string } | null {
  const account = DEFAULT_STAFF.find((item) => item.role === role);
  return account ? { email: account.email, password: account.password } : null;
}
