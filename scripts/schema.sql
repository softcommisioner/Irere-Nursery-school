-- ============================================================================
-- Irere Nursery DMS - database schema
--
-- Creates every table the application reads and writes, with the exact
-- column names produced by the client (camelCase -> snake_case) so INSERT /
-- UPDATE / DELETE payloads match without transformation errors.
--
-- Tables: classes, students, staff, teacher_attendance, student_attendance,
--         payments, ledger, curriculum, evaluations, feedback
--
-- All tables are REAL writable tables (never views). Every table has:
--   * a text primary key with a default UUID (most client inserts do not
--     send an id - the database generates one and returns it via
--     Prefer: return=representation),
--   * Row Level Security ENABLED with permissive SELECT / INSERT / UPDATE /
--     DELETE policies for BOTH the `anon` and `authenticated` roles,
--   * explicit GRANTs for `anon` and `authenticated`.
--
-- RUN (PowerShell / bash, with psql installed):
--   psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f .\scripts\schema.sql
--   (or: npm run db:apply-schema)
--
-- Or paste this whole file into the Supabase SQL Editor and run it.
--
-- The script is idempotent: create-if-not-exists + drop-policy-then-create,
-- so it never destroys existing data.
-- ============================================================================

begin;

set local lock_timeout = '15s';

-- gen_random_uuid() for the id defaults (present by default on Supabase).
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Classes
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id             text primary key default gen_random_uuid()::text,
  code           text not null default '',
  name           text not null,
  kinyarwanda_name text not null default '',
  age_range      text not null default '',
  teacher_id     text not null default '',
  teacher_name   text not null default 'Unassigned',
  room_number    text not null default 'TBD',
  student_count  integer not null default 0,
  capacity       integer not null default 30,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Students
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id                text primary key default gen_random_uuid()::text,
  reg_number        text not null,
  first_name        text not null,
  last_name         text not null,
  gender            text not null default 'F',
  dob               date,
  class_id          text not null default '',
  class_name        text not null default '',
  parent_name       text not null default '',
  parent_phone      text not null default '',
  parent_email      text not null default '',
  residence_village text not null default '',
  tuition_fee_term  numeric not null default 0,
  paid_amount       numeric not null default 0,
  balance           numeric not null default 0,
  emergency_contact text not null default '',
  medical_notes     text,
  created_at        timestamptz not null default now()
);

create index if not exists students_reg_number_idx on public.students (reg_number);
create index if not exists students_class_id_idx on public.students (class_id);

-- ----------------------------------------------------------------------------
-- Staff (teachers / accountants - logins live in Supabase Auth, profiles here)
-- ----------------------------------------------------------------------------
create table if not exists public.staff (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  email       text not null unique,
  phone       text not null default '',
  role        text not null default 'TEACHER',
  avatar_url  text,
  title       text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists staff_email_idx on public.staff (email);

-- ----------------------------------------------------------------------------
-- Teacher attendance (daily self check-in + headmaster review)
-- ----------------------------------------------------------------------------
create table if not exists public.teacher_attendance (
  id                 text primary key default gen_random_uuid()::text,
  teacher_id         text not null default '',
  teacher_name       text not null default '',
  date               date not null,
  check_in_time      text not null default '',
  check_out_time     text,
  status             text not null default 'PENDING',
  notes              text,
  gps_location       jsonb,
  reviewed_by        text,
  reviewed_at        timestamptz,
  rejection_reason   text,
  headmaster_remarks text,
  created_at         timestamptz not null default now()
);

create index if not exists teacher_attendance_teacher_idx on public.teacher_attendance (teacher_id);
create index if not exists teacher_attendance_date_idx on public.teacher_attendance (date);

-- ----------------------------------------------------------------------------
-- Student attendance (daily marking per class)
-- ----------------------------------------------------------------------------
create table if not exists public.student_attendance (
  id                      text primary key default gen_random_uuid()::text,
  student_id              text not null,
  student_name           text not null default '',
  class_id               text not null default '',
  date                   date not null,
  status                 text not null default 'PRESENT',
  remarks                text,
  recorded_by_teacher_id text not null default '',
  created_at             timestamptz not null default now()
);

create index if not exists student_attendance_student_idx on public.student_attendance (student_id);
create index if not exists student_attendance_class_date_idx on public.student_attendance (class_id, date);

-- ----------------------------------------------------------------------------
-- Payments / fees
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id                   text primary key default gen_random_uuid()::text,
  receipt_number       text not null,
  student_id           text not null,
  student_name         text not null default '',
  student_reg          text not null default '',
  class_id             text not null default '',
  class_name           text not null default '',
  amount               numeric not null default 0,
  academic_term        text not null default '',
  payment_method       text not null default 'CASH',
  momo_transaction_ref text,
  payer_name           text not null default '',
  payer_phone          text not null default '',
  received_by          text not null default '',
  payment_date         date not null default current_date,
  status               text not null default 'VERIFIED',
  created_at           timestamptz not null default now()
);

create index if not exists payments_student_idx on public.payments (student_id);
create index if not exists payments_receipt_idx on public.payments (receipt_number);

-- ----------------------------------------------------------------------------
-- Ledger (income / expense)
-- ----------------------------------------------------------------------------
create table if not exists public.ledger (
  id                  text primary key default gen_random_uuid()::text,
  entry_date          date not null default current_date,
  description         text not null default '',
  type                text not null default 'EXPENSE',
  category            text not null default 'TUITION_FEE',
  amount              numeric not null default 0,
  reference_doc_number text not null default '',
  recorded_by         text not null default '',
  payment_method      text not null default 'CASH',
  created_at          timestamptz not null default now()
);

create index if not exists ledger_entry_date_idx on public.ledger (entry_date);

-- ----------------------------------------------------------------------------
-- Curriculum materials
-- ----------------------------------------------------------------------------
create table if not exists public.curriculum (
  id                      text primary key default gen_random_uuid()::text,
  title                   text not null,
  theme                   text not null default '',
  class_level             text not null default 'MIDDLE_CLASS',
  class_name              text not null default '',
  subject                 text not null default 'Kinyarwanda',
  file_format             text not null default 'PDF',
  file_size               text not null default '',
  download_url            text not null default '',
  upload_date             date not null default current_date,
  week_number             integer not null default 1,
  term                    text not null default 'Term 1',
  uploaded_by_teacher_name text not null default '',
  description             text not null default '',
  created_at              timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Milestone evaluations
-- ----------------------------------------------------------------------------
create table if not exists public.evaluations (
  id                    text primary key default gen_random_uuid()::text,
  student_id            text not null,
  term                  text not null default '',
  evaluation_date       date not null default current_date,
  early_literacy        text not null default 'DEVELOPING',
  numeracy_skills       text not null default 'DEVELOPING',
  fine_gross_motor       text not null default 'DEVELOPING',
  social_behavior       text not null default 'DEVELOPING',
  hygiene_self_care     text not null default 'DEVELOPING',
  teacher_feedback      text not null default '',
  headmaster_endorsement boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists evaluations_student_idx on public.evaluations (student_id);

-- ----------------------------------------------------------------------------
-- Parent feedback
-- ----------------------------------------------------------------------------
create table if not exists public.feedback (
  id            text primary key default gen_random_uuid()::text,
  parent_id     text not null default '',
  parent_name   text not null default '',
  student_name  text not null default '',
  student_class text not null default '',
  subject       text not null default '',
  message       text not null default '',
  created_at    timestamptz not null default now(),
  status        text not null default 'PENDING_REPLY',
  response      jsonb
);

create index if not exists feedback_parent_idx on public.feedback (parent_id);

-- ----------------------------------------------------------------------------
-- Row Level Security + full read/write policies
--
-- Permissive policies are granted to BOTH `anon` and `authenticated` because
-- the browser app talks to PostgREST with the anon key (public pages) and
-- with user JWTs after sign-in. Restrict these to `authenticated` only once
-- the school is ready to require sign-in for every read/write.
-- ----------------------------------------------------------------------------

do $$
declare
  rls_table text;
  rls_tables text[] := array[
    'classes',
    'students',
    'staff',
    'teacher_attendance',
    'student_attendance',
    'payments',
    'ledger',
    'curriculum',
    'evaluations',
    'feedback'
  ];
begin
  foreach rls_table in array rls_tables loop
    execute format('alter table public.%I enable row level security', rls_table);

    execute format('drop policy if exists "%s_select" on public.%I', rls_table, rls_table);
    execute format(
      'create policy "%s_select" on public.%I for select to anon, authenticated using (true)',
      rls_table, rls_table
    );

    execute format('drop policy if exists "%s_insert" on public.%I', rls_table, rls_table);
    execute format(
      'create policy "%s_insert" on public.%I for insert to anon, authenticated with check (true)',
      rls_table, rls_table
    );

    execute format('drop policy if exists "%s_update" on public.%I', rls_table, rls_table);
    execute format(
      'create policy "%s_update" on public.%I for update to anon, authenticated using (true) with check (true)',
      rls_table, rls_table
    );

    execute format('drop policy if exists "%s_delete" on public.%I', rls_table, rls_table);
    execute format(
      'create policy "%s_delete" on public.%I for delete to anon, authenticated using (true)',
      rls_table, rls_table
    );

    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', rls_table);
  end loop;
end
$$;

commit;

-- ----------------------------------------------------------------------------
-- Verification: every table should list get, post, patch and delete through
-- PostgREST after this script runs (the client checks the same thing).
-- ----------------------------------------------------------------------------
-- select relname, relkind from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and relname in (
--   'classes','students','staff','teacher_attendance','student_attendance',
--   'payments','ledger','curriculum','evaluations','feedback'
-- );
