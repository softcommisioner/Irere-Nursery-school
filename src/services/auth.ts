import { UserRole } from '../types';
import { HEADMASTER_ACCOUNT, toAuthEmail } from '../config/headmaster';
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
 * account registration are handled by Supabase Auth. If the project is not
 * configured (or the auth endpoint is unreachable), the service falls back to a
 * local credential store that contains only the permanent Headmaster account.
 *
 * Demo staff accounts have been removed. Real staff, teacher and parent logins
 * are created by the Headmaster through the portal (or by the provisioning
 * script) and stored in Supabase Auth.
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

const BUILT_IN_ACCOUNTS: AuthAccount[] = [HEADMASTER_ACCOUNT];

/**
 * Accounts created by older demo builds. They are filtered out of the local
 * store so a browser that used the app before this release starts clean.
 */
const LEGACY_DEMO_IDS = new Set([
  'demo-headmaster',
  'demo-accountant',
  'demo-teacher',
  'demo-sponsor'
]);

const LEGACY_DEMO_EMAILS = new Set([
  'headmaster@irerenursery.rw',
  'accountant@irerenursery.rw',
  'teacher@irerenursery.rw',
  'sponsor@irerenursery.rw'
]);

function isLegacyDemoAccount(account: AuthAccount): boolean {
  return (
    LEGACY_DEMO_IDS.has(account.id) ||
    LEGACY_DEMO_EMAILS.has(normalizeEmail(account.email))
  );
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredAccounts(): AuthAccount[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as AuthAccount[]).filter((account) => !isLegacyDemoAccount(account));
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

/**
 * All accounts. Stored accounts are merged first so the permanent Headmaster
 * account always wins and its credentials can never be shadowed by old data.
 */
export function getAccounts(): AuthAccount[] {
  const stored = readStoredAccounts();
  const merged = new Map<string, AuthAccount>();
  stored.forEach((account) => merged.set(normalizeEmail(account.email), account));
  BUILT_IN_ACCOUNTS.forEach((account) =>
    merged.set(normalizeEmail(account.email), account)
  );
  return Array.from(merged.values());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Accepts either an email address or a phone number as the login identifier. */
export function normalizeIdentifier(identifier: string): string {
  return normalizeEmail(toAuthEmail(identifier));
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
    if (isLegacyDemoAccount(parsed as AuthAccount)) {
      window.localStorage.removeItem(SESSION_KEY);
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

async function signInViaSupabase(
  email: string,
  password: string,
  role: UserRole
): Promise<AuthResult> {
  const data = await authRequest<SupabaseAuthResponse>('/token?grant_type=password', {
    email,
    password
  });

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

  const session = sessionFromSupabase(data.user, role, email);
  setSupabaseAccessToken(data.access_token);
  saveSession(session);
  return { ok: true, session };
}

/**
 * Creates the permanent Headmaster account on first use when Supabase is
 * configured but the account has not been provisioned yet. Running
 * `npm run db:provision:headmaster` is still the recommended path because it
 * uses the service role and can confirm the email immediately.
 */
async function ensureHeadmasterAuth(): Promise<boolean> {
  try {
    await authRequest<SupabaseAuthResponse>('/signup', {
      email: HEADMASTER_ACCOUNT.email,
      password: HEADMASTER_ACCOUNT.password,
      data: {
        role: HEADMASTER_ACCOUNT.role,
        full_name: HEADMASTER_ACCOUNT.name,
        phone: HEADMASTER_ACCOUNT.phone,
        title: HEADMASTER_ACCOUNT.title
      }
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/already|registered|exists|duplicate/i.test(message)) {
      return true;
    }
    console.warn('[auth] Could not provision the Headmaster account automatically.', error);
    return false;
  }
}

export async function signIn(
  identifier: string,
  password: string,
  role: UserRole
): Promise<AuthResult> {
  const normalized = normalizeIdentifier(identifier);

  if (isSupabaseConfigured()) {
    try {
      return await signInViaSupabase(normalized, password, role);
    } catch (error) {
      const isHeadmasterLogin =
        normalized === normalizeEmail(HEADMASTER_ACCOUNT.email) &&
        password === HEADMASTER_ACCOUNT.password;

      if (isHeadmasterLogin && isInvalidCredentials(error)) {
        const provisioned = await ensureHeadmasterAuth();
        if (provisioned) {
          try {
            return await signInViaSupabase(normalized, password, role);
          } catch (retryError) {
            console.warn(
              '[auth] Headmaster account exists but is not ready for sign-in yet.',
              retryError
            );
          }
        }
      }

      // The local store always contains the permanent Headmaster account, so
      // the school can still sign in before Supabase Auth is provisioned.
      const local = signInLocal(normalized, password, role);
      if (local.ok) return local;
      if (isInvalidCredentials(error)) {
        return { ok: false, error: 'Incorrect email/phone or password. Please try again.' };
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
    return { ok: false, error: 'Incorrect email/phone or password. Please try again.' };
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

export type AccountProvisionResult =
  | {
      ok: true;
      session?: AuthSession;
      accessToken?: string;
      requiresEmailConfirmation?: boolean;
    }
  | { ok: false; error: string };

/**
 * Creates a real parent account in Supabase Auth (or the local store when
 * Supabase is not configured) without changing the active session. This is used
 * by the Headmaster portal so registering a parent does not log the Headmaster
 * out.
 */
export async function provisionParentAccount(
  input: ParentRegistrationInput
): Promise<AccountProvisionResult> {
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

      if (data.user) {
        const session = sessionFromSupabase(data.user, 'PARENT', email);
        return {
          ok: true,
          session,
          accessToken: data.access_token,
          requiresEmailConfirmation: !data.access_token
        };
      }

      return { ok: true, requiresEmailConfirmation: true };
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

      console.warn('[auth] Supabase parent registration failed.', error);
      return {
        ok: false,
        error: message || 'Could not create the parent account in Supabase.'
      };
    }
  }

  return provisionParentLocal(input);
}

function provisionParentLocal(input: ParentRegistrationInput): AccountProvisionResult {
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
  return { ok: true, session: toSession(account) };
}

/** Self-service parent registration from the Parent portal. */
export async function registerParent(
  input: ParentRegistrationInput
): Promise<AuthResult> {
  const result = await provisionParentAccount(input);
  if (!result.ok) return result;

  if (!result.session) {
    return {
      ok: false,
      error:
        'Account created. Check your email inbox to confirm it, then return here to log in.'
    };
  }

  if (result.accessToken) setSupabaseAccessToken(result.accessToken);
  saveSession(result.session);
  return { ok: true, session: result.session };
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
 * Creates a real Supabase Auth account for a new staff member without
 * disturbing the currently signed-in Headmaster session (the returned token is
 * intentionally ignored). Errors are returned so the portal can avoid creating
 * a staff record that cannot log in.
 */
export async function provisionStaffAuth(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  phone?: string;
}): Promise<AccountProvisionResult> {
  const email = normalizeEmail(input.email);

  if (isSupabaseConfigured()) {
    try {
      const data = await authRequest<SupabaseAuthResponse>('/signup', {
        email,
        password: input.password,
        data: {
          role: input.role,
          full_name: input.name,
          phone: input.phone ?? null,
          title: input.title
        }
      });

      return {
        ok: true,
        accessToken: data.access_token,
        requiresEmailConfirmation: !data.access_token
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      console.warn('[auth] Could not provision Supabase staff account.', error);
      return {
        ok: false,
        error: message || 'Could not create the staff login in Supabase.'
      };
    }
  }

  return { ok: true };
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
