/**
 * Supabase configuration & REST helpers.
 *
 * Vite only exposes variables prefixed with `VITE_` by default, but Vercel
 * projects often define `NEXT_PUBLIC_*` variables. `vite.config.ts` therefore
 * exposes both prefixes and maps the `NEXT_PUBLIC_*` values onto
 * `import.meta.env` so the same build works on either platform.
 *
 * Required:
 *   VITE_SUPABASE_URL        (or NEXT_PUBLIC_SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY   (or VITE_SUPABASE_PUBLISHABLE_KEY /
 *                             NEXT_PUBLIC_SUPABASE_ANON_KEY /
 *                             NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 *
 * Never put the service-role/secret key in client code.
 */

type EnvBag = Record<string, string | undefined>;

function metaEnv(): EnvBag {
  const env = (import.meta as ImportMeta & { env?: EnvBag }).env;
  return env ?? {};
}

function processEnv(): EnvBag {
  // `process` is injected by Vite's `define` for the NEXT_PUBLIC keys, and is
  // undefined in the browser otherwise. Guard before touching it.
  if (typeof process === 'undefined' || !process.env) return {};
  return process.env as EnvBag;
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

const meta = metaEnv();
const node = processEnv();

export const SUPABASE_URL = normalizeUrl(
  firstDefined(
    meta.VITE_SUPABASE_URL,
    meta.NEXT_PUBLIC_SUPABASE_URL,
    node.NEXT_PUBLIC_SUPABASE_URL,
    node.VITE_SUPABASE_URL
  )
);

export const SUPABASE_ANON_KEY = firstDefined(
  meta.VITE_SUPABASE_ANON_KEY,
  meta.VITE_SUPABASE_PUBLISHABLE_KEY,
  meta.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  meta.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  node.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  node.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  node.VITE_SUPABASE_ANON_KEY,
  node.VITE_SUPABASE_PUBLISHABLE_KEY
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
    throw new SupabaseError('Supabase returned a malformed response.', response.status);
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
