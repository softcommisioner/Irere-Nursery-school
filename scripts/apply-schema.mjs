import { spawnSync } from 'node:child_process';
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

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Add it to .env.local (or .env) and retry.');
  console.error('You can copy it from Supabase -> Project Settings -> Database (Connection string).');
  process.exit(1);
}

const sqlFile = path.join(root, 'scripts', 'schema.sql');

const result = spawnSync(
  'psql',
  [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile],
  { stdio: 'inherit' }
);

if (result.error) {
  console.error('Could not run psql. Install the PostgreSQL client and ensure psql is on PATH.');
  console.error('Alternatively, open scripts/schema.sql and paste its contents into the');
  console.error('Supabase SQL Editor (Dashboard -> SQL Editor -> New query) and run it.');
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
