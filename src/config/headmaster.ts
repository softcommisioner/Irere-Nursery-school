import { UserRole } from '../types';

/**
 * Permanent Headmaster account.
 *
 * The school signs in with the headmaster phone number (`0788733564`) or the
 * derived work email. Authentication runs against the local credential store,
 * so the email is just a convenience alias — it is not sent to Supabase Auth.
 *
 * Values can be overridden at build time through environment variables.
 */

const env = import.meta.env;

const DEFAULT_IDENTIFIER = '0788733564';
const DEFAULT_PASSWORD = 'irere@2026';
const DEFAULT_NAME = 'Headmaster';
const DEFAULT_EMAIL_DOMAIN = 'irerenursery.rw';

export const SCHOOL_EMAIL_DOMAIN =
  (env.VITE_SCHOOL_EMAIL_DOMAIN as string | undefined)?.trim() || DEFAULT_EMAIL_DOMAIN;

/** Converts a phone number into a stable sign-in email alias. */
export function toAuthEmail(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  if (/^\+?[\d\s()-]+$/.test(trimmed) && /\d/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    return `${digits}@${SCHOOL_EMAIL_DOMAIN}`;
  }
  return trimmed;
}

export const HEADMASTER_IDENTIFIER =
  (env.VITE_HEADMASTER_PHONE as string | undefined)?.trim() ||
  (env.VITE_HEADMASTER_EMAIL as string | undefined)?.trim() ||
  DEFAULT_IDENTIFIER;

export const HEADMASTER_PASSWORD =
  (env.VITE_HEADMASTER_PASSWORD as string | undefined) || DEFAULT_PASSWORD;

export const HEADMASTER_NAME =
  (env.VITE_HEADMASTER_NAME as string | undefined)?.trim() || DEFAULT_NAME;

export const HEADMASTER_AUTH_EMAIL = toAuthEmail(HEADMASTER_IDENTIFIER);

export const HEADMASTER_ACCOUNT = {
  id: 'headmaster',
  name: HEADMASTER_NAME,
  email: HEADMASTER_AUTH_EMAIL,
  phone: HEADMASTER_IDENTIFIER,
  password: HEADMASTER_PASSWORD,
  role: 'HEADMASTER' as UserRole,
  title: 'Headmaster',
  createdAt: '2026-01-01T00:00:00.000Z'
};
