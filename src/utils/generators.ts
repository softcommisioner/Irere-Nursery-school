/**
 * Small client-side generators used by the management departments.
 *
 * These run in the browser so the Headmaster can see a unique registration
 * number immediately, even before the backend confirms the record. The backend
 * should re-validate uniqueness on save.
 */

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
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
