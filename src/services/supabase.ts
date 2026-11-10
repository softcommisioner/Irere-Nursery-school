/**
 * Supabase configuration & REST helpers.
 *
 * The client reads its configuration directly from
 * `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`
 * (statically inlined by Vite at build time). Vercel projects that define the
 * Next.js-style `NEXT_PUBLIC_*` names still work because `vite.config.ts`
 * exposes both prefixes through `envPrefix`.
 *
 * Required:
 *   VITE_SUPABASE_URL        (or NEXT_PUBLIC_SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY   (or VITE_SUPABASE_PUBLISHABLE_KEY /
 *                             NEXT_PUBLIC_SUPABASE_ANON_KEY /
 *                             NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 *
 * Never put the service-role/secret key in client code.
 */

interface ClientEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

function firstDefined(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return '';
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}

const env = (import.meta.env ?? {}) as ClientEnv;

export const SUPABASE_URL = normalizeUrl(
  firstDefined(
    import.meta.env.VITE_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL
  )
);

export const SUPABASE_ANON_KEY = firstDefined(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

export const SUPABASE_REST_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '';
export const SUPABASE_AUTH_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function supabaseConfigError(): string {
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) {
    return 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_ equivalents) in your Vercel project.';
  }
  if (!SUPABASE_URL) {
    return 'Supabase URL is missing. Set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.';
  }
  return 'Supabase anon key is missing. Set VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.';
}

/* -------------------------------------------------------------------------- */
/* Auth token (kept in sync by services/auth.ts)                              */
/* -------------------------------------------------------------------------- */

const TOKEN_KEY = 'irere.supabase.access-token.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSupabaseAccessToken(): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSupabaseAccessToken(token: string | null): void {
  if (!canUseStorage()) return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures (private browsing, quota, etc.).
  }
}

/* -------------------------------------------------------------------------- */
/* Low-level REST request                                                     */
/* -------------------------------------------------------------------------- */

export class SupabaseError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
    this.code = code;
  }
}

export function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getSupabaseAccessToken() ?? SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export interface SupabaseRequestOptions extends RequestInit {
  /** Adds `Accept: application/vnd.pgrst.object+json` for single-row requests. */
  single?: boolean;
}

export async function supabaseRest<T>(
  path: string,
  options: SupabaseRequestOptions = {}
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseError(supabaseConfigError(), 0);
  }

  const { single, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_REST_URL}${path}`, {
      ...rest,
      headers: supabaseHeaders({
        ...(single ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
        ...((headers as Record<string, string> | undefined) ?? {})
      })
    });
  } catch {
    throw new SupabaseError(
      'Unable to reach Supabase. Check your network connection and project URL.',
      0
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    const parsed = parseError(raw);
    throw new SupabaseError(
      parsed.message || `Supabase request failed with status ${response.status}`,
      response.status,
      parsed.code
    );
  }

  if (response.status === 204 || raw.trim() === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SupabaseError(
      `Supabase returned a malformed response for "${path}" (status ${response.status}): ${raw
        .trim()
        .slice(0, 240)}`,
      response.status
    );
  }
}

function parseError(raw: string): { message?: string; code?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as {
      message?: string;
      error?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return {
      message: parsed.message ?? parsed.error ?? parsed.details ?? parsed.hint,
      code: parsed.code
    };
  } catch {
    return { message: raw.slice(0, 240) };
  }
}

export function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof SupabaseError)) return false;
  return (
    error.status === 404 ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|does not exist|schema cache/i.test(error.message)
  );
}

/**
 * PostgREST answers with 405 Method Not Allowed when the resolved relation
 * exists but cannot serve the method — typically a read-only view being
 * POST/PATCH/DELETEd (e.g. a `profiles`/`users` view over `auth.users`).
 */
export function isMethodNotAllowedError(error: unknown): boolean {
  if (!(error instanceof SupabaseError)) return false;
  return (
    error.status === 405 ||
    error.code === 'PGRST204' ||
    /method not allowed|cannot insert into|cannot update|not updatable|inseparable/i.test(
      error.message
    )
  );
}

/**
 * Row Level Security policies or missing grants reject writes with 403 /
 * 42501 "permission denied". These point at a real table, so the fix belongs
 * in the database (policies or privileges), not in the request format.
 */
export function isPermissionDeniedError(error: unknown): boolean {
  if (!(error instanceof SupabaseError)) return false;
  return (
    error.status === 403 ||
    error.code === '42501' ||
    error.code === '42502' ||
    /permission denied|row-level security|rls policy|violates row-level/i.test(error.message)
  );
}
