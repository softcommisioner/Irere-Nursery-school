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

const IDENTIFIER =
  process.env.HEADMASTER_PHONE ??
  process.env.HEADMASTER_EMAIL ??
  process.env.VITE_HEADMASTER_PHONE ??
  process.env.VITE_HEADMASTER_EMAIL ??
  '0788733564';

const PASSWORD =
  process.env.HEADMASTER_PASSWORD ??
  process.env.VITE_HEADMASTER_PASSWORD ??
  'irere@2026';

const NAME =
  process.env.HEADMASTER_NAME ??
  process.env.VITE_HEADMASTER_NAME ??
  'Headmaster';

const EMAIL_DOMAIN =
  process.env.SCHOOL_EMAIL_DOMAIN ??
  process.env.VITE_SCHOOL_EMAIL_DOMAIN ??
  'irerenursery.rw';

function toAuthEmail(identifier) {
  const trimmed = identifier.trim().toLowerCase();
  if (/^\+?[\d\s()-]+$/.test(trimmed) && /\d/.test(trimmed)) {
    return `${trimmed.replace(/\D/g, '')}@${EMAIL_DOMAIN}`;
  }
  return trimmed;
}

const EMAIL = toAuthEmail(IDENTIFIER);

if (!SERVICE_KEY) {
  console.error(
    'Missing Supabase service key. Set SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.'
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

function metadata() {
  return {
    role: 'HEADMASTER',
    full_name: NAME,
    phone: IDENTIFIER,
    title: 'Headmaster'
  };
}

async function findExistingUser() {
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
    const match = users.find(
      (user) => (user.email ?? '').toLowerCase() === EMAIL.toLowerCase()
    );
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function createUser() {
  const res = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata(),
      app_metadata: { role: 'HEADMASTER' }
    })
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Could not create the Headmaster account (${res.status}): ${body.slice(0, 300)}`);
  }

  return JSON.parse(body);
}

async function updateUser(user) {
  const res = await fetch(
    `${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { ...(user.user_metadata ?? {}), ...metadata() },
        app_metadata: { ...(user.app_metadata ?? {}), role: 'HEADMASTER' }
      })
    }
  );

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Could not update the Headmaster account (${res.status}): ${body.slice(0, 300)}`);
  }

  return JSON.parse(body);
}

async function main() {
  console.log(`Project: ${PROJECT_URL}`);
  console.log(`Headmaster login: ${IDENTIFIER} (auth email: ${EMAIL})`);

  const existing = await findExistingUser();
  const user = existing ? await updateUser(existing) : await createUser();

  console.log(`\nHeadmaster account ${existing ? 'updated' : 'created'} successfully.`);
  console.log(`  Name:     ${NAME}`);
  console.log(`  Login:    ${IDENTIFIER}`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  User ID:  ${user.id ?? user.user?.id ?? '(unknown)'}`);
  console.log('\nKeep these credentials safe. The password is never stored in the database.');
}

main().catch((error) => {
  console.error(`\nProvisioning failed: ${error.message}`);
  process.exit(1);
});
