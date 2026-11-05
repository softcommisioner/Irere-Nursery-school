/**
 * Small client-side generators used by the management departments.
 *
 * These run in the browser so the Headmaster can see a secure password and a
 * unique registration number immediately, even before the backend confirms the
 * record. The backend should re-validate uniqueness on save.
 */

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/** Generates a readable 12-character password with all required character sets. */
export function generatePassword(length = 12): string {
  let password = pick(UPPER) + pick(LOWER) + pick(DIGITS) + pick(SYMBOLS);
  while (password.length < length) {
    password += pick(ALL);
  }
  // Fisher–Yates shuffle so the guaranteed characters are not always leading.
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Builds a school registration number, e.g. `IRR-2026-007`.
 * `sequence` is typically the next student count (existing students + 1).
 */
export function generateRegistrationNumber(sequence: number, year = 2026): string {
  const padded = String(Math.max(1, sequence)).padStart(3, '0');
  return `IRR-${year}-${padded}`;
}

/** Generates a short, readable id with a stable prefix. */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomInt(100000)}`;
}
