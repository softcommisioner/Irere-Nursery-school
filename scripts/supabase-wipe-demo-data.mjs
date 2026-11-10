import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const fullPath = path.join(root, file);
  if (existsSync(fullPath)) {
    config({ path: fullPath, quiet: true });
  }
}

const PROJECT_URL = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'https://qediptcdjlmvznjhqweu.supabase.co'
)
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SERVICE_ROLE_KEY;

const EMAIL_DOMAIN =
  process.env.SCHOOL_EMAIL_DOMAIN ??
  process.env.VITE_SCHOOL_EMAIL_DOMAIN ??
  'irerenursery.rw';

const HEADMASTER_IDENTIFIER =
  process.env.HEADMASTER_PHONE ??
  process.env.HEADMASTER_EMAIL ??
  process.env.VITE_HEADMASTER_PHONE ??
  process.env.VITE_HEADMASTER_EMAIL ??
  '0788733564';

function toAuthEmail(identifier) {
  const trimmed = identifier.trim().toLowerCase();
  if (/^\+?[\d\s()-]+$/.test(trimmed) && /\d/.test(trimmed)) {
    return `${trimmed.replace(/\D/g, '')}@${EMAIL_DOMAIN}`;
  }
  return trimmed;
}

const HEADMASTER_EMAIL = toAuthEmail(HEADMASTER_IDENTIFIER);

const LEGACY_DEMO_EMAILS = new Set([
  'headmaster@irerenursery.rw',
  'accountant@irerenursery.rw',
  'teacher@irerenursery.rw',
  'sponsor@irerenursery.rw'
]);

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArg = (name) => {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const execute = hasFlag('--yes') && !hasFlag('--dry-run');
const includeAuthUsers = hasFlag('--include-auth-users');

const KEEP = new Set(
  [
    'roles',
    'permissions',
    'role_permissions',
    'system_settings',
    'app_settings',
    'school_settings',
    'school_config',
    'academic_terms',
    'academic_years',
    'fee_structures',
    'fee_schedules',
    'fee_configs',
    'organizations',
    'schools',
    'schema_migrations',
    'migrations',
    'supabase_migrations',
    '_prisma_migrations',
    'spatial_ref_sys',
    'geography_columns',
    'geometry_columns'
  ].concat((getArg('keep') ?? '').split(',').filter(Boolean).map((s) => s.trim()))
);

const ONLY = new Set(
  (getArg('only') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const KNOWN_APP_TABLES = [
  'approval_requests',
  'attendance_approvals',
  'approvals',
  'teacher_attendance_records',
  'teacher_attendance',
  'staff_attendance',
  'student_attendance_records',
  'student_attendance',
  'attendance_records',
  'student_milestone_evaluations',
  'evaluations',
  'curriculum_materials',
  'curriculum',
  'parent_feedback_messages',
  'parent_feedback',
  'feedback',
  'fee_payments',
  'payments',
  'ledger_entries',
  'ledger',
  'financial_ledger',
  'students',
  'school_classes',
  'classes',
  'staff',
  'profiles',
  'users',
  'user_roles',
  'notifications',
  'activity_logs',
  'audit_logs'
];

if (!SERVICE_KEY) {
  console.error(
    'Missing Supabase service key. Set SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.'
  );
  process.exit(1);
}

assertServiceKey(SERVICE_KEY);

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

function assertServiceKey(key) {
  if (key.startsWith('sb_secret_')) return;
  if (!key.startsWith('eyJ')) {
    console.warn('Warning: the supplied key is not a recognisable Supabase secret key.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    console.warn('Warning: could not decode the supplied JWT; continuing.');
    return;
  }

  if (payload.role && payload.role !== 'service_role') {
    throw new Error(
      `The supplied key has role "${payload.role}", not "service_role". Refusing to wipe.`
    );
  }
}

async function discoverTables() {
  const res = await fetch(`${PROJECT_URL}/rest/v1/`, { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Could not read the Supabase REST schema (${res.status}). ` +
        `Check the project URL and service key. ${body.slice(0, 200)}`
    );
  }

  const spec = await res.json();
  const fromDefinitions = Object.keys(spec.definitions ?? {});
  const fromSchemas = Object.keys(spec.components?.schemas ?? {});
  const fromPaths = Object.keys(spec.paths ?? {})
    .filter((route) => route.startsWith('/') && !route.startsWith('/rpc/'))
    .map((route) => route.replace(/^\//, ''))
    .filter((name) => name && !name.includes('/'));

  return [...new Set([...fromDefinitions, ...fromSchemas, ...fromPaths])];
}

function parseError(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function isForeignKeyError(status, error) {
  return (
    status === 409 &&
    (error.code === '23503' ||
      /foreign key constraint/i.test(error.message ?? '') ||
      /still referenced/i.test(error.details ?? ''))
  );
}

function isMissingOrUnwritable(status, error) {
  return (
    status === 404 ||
    status === 405 ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|is a view|does not exist/i.test(error.message ?? '')
  );
}

async function deleteAllRows(table) {
  const res = await fetch(
    `${PROJECT_URL}/rest/v1/${encodeURIComponent(table)}`,
    {
      method: 'DELETE',
      headers: {
        ...headers,
        Prefer: 'return=minimal'
      }
    }
  );

  const text = await res.text();
  return { status: res.status, ok: res.ok, error: parseError(text), text };
}

async function wipeAuthUsers() {
  const adminEmails = new Set(
    [
      HEADMASTER_EMAIL,
      ...(process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ].map((email) => email.trim().toLowerCase())
  );

  const allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const res = await fetch(
      `${PROJECT_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Could not list auth users (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const users = data.users ?? [];
    allUsers.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  let deleted = 0;
  for (const user of allUsers) {
    const email = (user.email ?? '').toLowerCase();
    const role = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase();
    const isLegacyDemo = LEGACY_DEMO_EMAILS.has(email);
    const isCoreAdmin =
      !isLegacyDemo && ['admin', 'super_admin', 'system', 'headmaster'].includes(role);

    if (adminEmails.has(email) || isCoreAdmin) continue;

    const res = await fetch(
      `${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
      { method: 'DELETE', headers }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Could not delete auth user ${user.id} (${res.status}): ${body.slice(0, 200)}`);
    }
    deleted += 1;
  }

  console.log(`Auth: deleted ${deleted} user account(s); preserved ${allUsers.length - deleted}.`);
}

async function main() {
  if (includeAuthUsers && !process.env.ADMIN_EMAILS) {
    throw new Error(
      '--include-auth-users requires ADMIN_EMAILS="admin@example.com,..." so you do not lock yourself out.'
    );
  }

  const discovered = await discoverTables();
  let tables = [...new Set([...discovered, ...KNOWN_APP_TABLES])]
    .filter((table) => !KEEP.has(table))
    .filter((table) => (ONLY.size ? ONLY.has(table) : true))
    .sort();

  console.log(`Project: ${PROJECT_URL}`);
  console.log(`Mode: ${execute ? 'EXECUTE (destructive)' : 'DRY RUN'}`);
  console.log(`Protected tables: ${[...KEEP].join(', ')}`);
  console.log(`Application tables (${tables.length}): ${tables.join(', ')}`);

  if (!execute) {
    console.log('\nDry run only. Re-run with --yes to delete all rows from the tables above.');
    return;
  }

  let pending = tables.map((name) => ({ name, attempts: 0 }));
  let pass = 0;
  let cleared = 0;
  let skipped = 0;

  while (pending.length > 0) {
    pass += 1;
    let progress = false;

    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i];
      const result = await deleteAllRows(item.name);

      if (result.ok) {
        pending.splice(i, 1);
        i -= 1;
        progress = true;
        cleared += 1;
        console.log(`cleared: ${item.name}`);
        continue;
      }

      if (isMissingOrUnwritable(result.status, result.error)) {
        pending.splice(i, 1);
        i -= 1;
        progress = true;
        skipped += 1;
        console.log(`skipped: ${item.name} (${result.status})`);
        continue;
      }

      if (isForeignKeyError(result.status, result.error)) {
        item.attempts += 1;
        continue;
      }

      throw new Error(
        `Failed to clear ${item.name} (${result.status}): ` +
          `${result.error.message ?? result.text.slice(0, 300)}`
      );
    }

    if (!progress) {
      throw new Error(
        'Could not resolve foreign-key order for: ' +
          pending.map((item) => item.name).join(', ') +
          '. Add the blocking child tables to the script or clear them manually.'
      );
    }

    if (pass > tables.length + 5) {
      throw new Error('Too many retry passes while clearing tables.');
    }
  }

  if (includeAuthUsers) {
    await wipeAuthUsers();
  }

  console.log(`\nDone. Cleared ${cleared} table(s), skipped ${skipped}.`);
  console.log('Core configuration/role tables were preserved.');
}

main().catch((error) => {
  console.error(`\nReset failed: ${error.message}`);
  process.exit(1);
});
