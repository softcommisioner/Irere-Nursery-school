import { UserRole } from '../types';
import { HEADMASTER_ACCOUNT } from '../config/headmaster';
import { createParentProfile } from './api';

/**
 * Local credential store.
 *
 * Accounts are keyed by phone number (primary) with an optional email address.
 * Passwords never leave this device and are stored as SHA-256 hashes where the
 * browser supports Web Crypto. Staff and parent profile records are persisted
 * separately in Supabase (`staff` and `parents`).
 */

const ACCOUNTS_KEY = 'irere.auth.accounts.v1';
const SESSION_KEY = 'irere.auth.session.v1';

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  title: string;
  linkedStudentReg?: string;
}

export interface AuthAccount extends AuthSession {
  password: string;
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

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Converts Rwandan phone formats to one canonical value:
 * `0788733564`, `+250 788 733 564` and `250788733564` all become `0788733564`.
 */
export function normalizePhone(phone: string | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('250')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith('7')) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidPhone(phone: string | undefined): boolean {
  return /^0\d{9}$/.test(normalizePhone(phone));
}

export function isValidEmail(email: string | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isLegacyDemoAccount(account: AuthAccount): boolean {
  return (
    LEGACY_DEMO_IDS.has(account.id) ||
    LEGACY_DEMO_EMAILS.has(normalizeEmail(account.email))
  );
}

function accountKey(account: Pick<AuthAccount, 'id' | 'phone' | 'email'>): string {
  const phone = normalizePhone(account.phone);
  if (phone) return `phone:${phone}`;
  const email = normalizeEmail(account.email);
  if (email) return `email:${email}`;
  return `id:${account.id}`;
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
 * All accounts. Built-in accounts are merged last so the permanent Headmaster
 * account always wins and its credentials can never be shadowed by old data.
 */
export function getAccounts(): AuthAccount[] {
  const stored = readStoredAccounts();
  const merged = new Map<string, AuthAccount>();
  stored.forEach((account) => merged.set(accountKey(account), account));
  BUILT_IN_ACCOUNTS.forEach((account) => merged.set(accountKey(account), account));
  return Array.from(merged.values());
}

function toSession(account: AuthAccount): AuthSession {
  const { password: _password, linkedStudentName: _child, ...session } = account;
  return session;
}

function findAccount(identifier: string): AuthAccount | undefined {
  const value = identifier.trim();
  if (!value) return undefined;

  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return getAccounts().find((account) => normalizeEmail(account.email) === email);
  }

  const phone = normalizePhone(value);
  if (phone) {
    const byPhone = getAccounts().find(
      (account) => normalizePhone(account.phone) === phone
    );
    if (byPhone) return byPhone;
  }

  const email = normalizeEmail(value);
  return email
    ? getAccounts().find((account) => normalizeEmail(account.email) === email)
    : undefined;
}

function findDuplicate(
  phone: string,
  email: string,
  ignoreId?: string
): AuthAccount | undefined {
  return getAccounts().find(
    (account) =>
      account.id !== ignoreId &&
      ((phone !== '' && normalizePhone(account.phone) === phone) ||
        (email !== '' && normalizeEmail(account.email) === email))
  );
}

function saveAccount(account: AuthAccount): void {
  const stored = readStoredAccounts();
  const index = stored.findIndex(
    (item) => item.id === account.id || accountKey(item) === accountKey(account)
  );
  if (index >= 0) {
    stored[index] = account;
  } else {
    stored.push(account);
  }
  writeStoredAccounts(stored);
}

function removeAccount(id: string): void {
  writeStoredAccounts(readStoredAccounts().filter((account) => account.id !== id));
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return password;
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hash}`;
}

async function passwordMatches(account: AuthAccount, password: string): Promise<boolean> {
  if (!account.password.startsWith('sha256:')) {
    return account.password === password;
  }
  return account.password === (await hashPassword(password));
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
    if (typeof parsed.phone !== 'string') {
      parsed.phone = '';
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export type AuthResult = { ok: true; session: AuthSession } | { ok: false; error: string };

export async function signIn(
  identifier: string,
  password: string,
  role: UserRole
): Promise<AuthResult> {
  const account = findAccount(identifier);

  if (!account || !(await passwordMatches(account, password))) {
    return { ok: false, error: 'Incorrect phone/email or password. Please try again.' };
  }

  if (account.role !== role) {
    return {
      ok: false,
      error: `These credentials are not registered for the ${ROLE_LABELS[role]} portal. Please choose the correct portal.`
    };
  }

  // Upgrade old plain-text local passwords silently after a successful login.
  if (!account.password.startsWith('sha256:')) {
    saveAccount({ ...account, password: await hashPassword(password) });
  }

  const session = toSession(account);
  saveSession(session);
  return { ok: true, session };
}

export interface ParentRegistrationInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  linkedStudentReg: string;
  linkedStudentName?: string;
}

export type AccountProvisionResult =
  | { ok: true; session?: AuthSession }
  | { ok: false; error: string };

function duplicateAccountError(duplicate: AuthAccount): string {
  return `An account already exists for ${duplicate.phone || duplicate.email}. Please log in instead.`;
}

function parentPersistenceError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/parents/i.test(message)) {
    return `${message} Run \`npm run db:apply-schema\` to create the parents table, then try again.`;
  }
  return message || 'Could not save the parent account.';
}

/**
 * Creates a parent profile in the database and a matching local credential.
 * Used both by self-service registration and by the Headmaster portal.
 */
export async function provisionParentAccount(
  input: ParentRegistrationInput
): Promise<AccountProvisionResult> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);

  if (!isValidPhone(phone)) {
    return { ok: false, error: 'Enter a valid phone number (e.g. 0788733564).' };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address or leave it blank.' };
  }
  if (!input.linkedStudentReg.trim()) {
    return { ok: false, error: 'Enter the child registration number / ID.' };
  }

  const duplicate = findDuplicate(phone, email);
  if (duplicate) {
    return { ok: false, error: duplicateAccountError(duplicate) };
  }

  let profile;
  try {
    profile = await createParentProfile({
      name: input.name.trim(),
      phone,
      email,
      linkedStudentReg: input.linkedStudentReg.trim().toUpperCase(),
      linkedStudentName: input.linkedStudentName?.trim() || undefined
    });
  } catch (error) {
    console.error('[auth] Could not save the parent profile in Supabase.', error);
    return { ok: false, error: parentPersistenceError(error) };
  }

  const account: AuthAccount = {
    id: profile.id,
    name: input.name.trim(),
    email,
    phone,
    password: await hashPassword(input.password),
    role: 'PARENT',
    title: 'Parent / Guardian',
    linkedStudentReg: profile.linkedStudentReg || input.linkedStudentReg.trim().toUpperCase(),
    linkedStudentName:
      profile.linkedStudentName || input.linkedStudentName?.trim() || undefined,
    createdAt: profile.createdAt ?? new Date().toISOString()
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
    return { ok: false, error: 'The parent account was created but no session was returned.' };
  }

  saveSession(result.session);
  return { ok: true, session: result.session };
}

/**
 * Creates the local staff credential. The staff profile must already have been
 * inserted in Supabase so the local `id` matches the database record.
 */
export async function provisionStaffAuth(input: {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
  title: string;
}): Promise<AccountProvisionResult> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);

  if (!isValidPhone(phone)) {
    return { ok: false, error: 'Enter a valid phone number (e.g. 0788733564).' };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address or leave it blank.' };
  }

  const duplicate = findDuplicate(phone, email, input.id);
  if (duplicate) {
    return { ok: false, error: duplicateAccountError(duplicate) };
  }

  saveAccount({
    id: input.id,
    name: input.name.trim(),
    email,
    phone,
    password: await hashPassword(input.password),
    role: input.role,
    title: input.title,
    createdAt: new Date().toISOString()
  });

  return { ok: true };
}

/** Keeps the local credential in sync when the staff profile is edited. */
export function staffAccountUpdateError(
  id: string,
  input: { phone: string; email: string }
): string | null {
  const existing = readStoredAccounts().find((account) => account.id === id);
  if (!existing) return null;

  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!isValidPhone(phone)) {
    return 'Enter a valid phone number (e.g. 0788733564).';
  }
  if (email && !isValidEmail(email)) {
    return 'Enter a valid email address or leave it blank.';
  }
  const duplicate = findDuplicate(phone, email, id);
  return duplicate ? duplicateAccountError(duplicate) : null;
}

export function updateStaffAccount(
  id: string,
  input: {
    name: string;
    phone: string;
    email: string;
    role: UserRole;
    title: string;
  }
): void {
  const existing = readStoredAccounts().find((account) => account.id === id);
  if (!existing) return;

  const problem = staffAccountUpdateError(id, input);
  if (problem) throw new Error(problem);

  const updated: AuthAccount = {
    ...existing,
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    role: input.role,
    title: input.title
  };
  saveAccount(updated);

  const session = loadSession();
  if (session?.id === id) saveSession(toSession(updated));
}

export function deleteStaffAccount(id: string): void {
  removeAccount(id);
  if (loadSession()?.id === id) clearSession();
}

/** Persists a looked-up pupil on the parent's account and active session. */
export function updateLinkedStudent(identifier: string, regNumber: string): AuthSession | null {
  const normalized = regNumber.trim().toUpperCase();
  const account = findAccount(identifier);

  if (account) {
    saveAccount({ ...account, linkedStudentReg: normalized });
  }

  const session = loadSession();
  if (
    session &&
    (session.id === account?.id ||
      normalizePhone(session.phone) === normalizePhone(identifier) ||
      normalizeEmail(session.email) === normalizeEmail(identifier))
  ) {
    const updated = { ...session, linkedStudentReg: normalized };
    saveSession(updated);
    return updated;
  }

  return account ? toSession({ ...account, linkedStudentReg: normalized }) : null;
}
