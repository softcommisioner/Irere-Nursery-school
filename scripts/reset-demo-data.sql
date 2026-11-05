-- ============================================================================
-- Irere Nursery DMS - demo / mock data reset
-- Target: PostgreSQL 12+ (including Supabase)
--
-- WHAT THIS DOES
--   * Empties every operational table: students, staff, classes, attendance,
--     approvals, fees/payments, ledger, curriculum, evaluations and feedback.
--   * Restarts every truncated table's identity/sequence.
--   * Uses TRUNCATE ... CASCADE so foreign keys are handled safely.
--   * Keeps the schema intact and never drops or alters a table.
--   * Does NOT truncate core configuration tables such as roles, permissions,
--     role_permissions, system_settings, school_settings, academic_terms,
--     academic_years or fee_structures.
--
-- WHAT IT DOES NOT TOUCH
--   * PostgreSQL internals (information_schema, pg_catalog).
--   * Supabase internals (auth, storage, realtime, extensions, migrations).
--   * Migration history tables.
--
-- RUN (PowerShell / bash, with psql installed):
--   psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f .\scripts\reset-demo-data.sql
--
-- Or paste this whole file into the Supabase SQL Editor and run it.
--
-- WARNING: destructive and irreversible. Take a backup first:
--   pg_dump "$env:DATABASE_URL" -Fc -f irere-before-reset.dump
-- ============================================================================

begin;

-- Fail fast instead of waiting forever on a locked table.
set local lock_timeout = '15s';
set local statement_timeout = '60s';

do $$
declare
  target_table text;
  demo_tables text[] := array[
    -- Approvals / attendance -------------------------------------------------
    'approval_requests',
    'attendance_approvals',
    'approvals',
    'teacher_attendance_records',
    'teacher_attendance',
    'staff_attendance',
    'student_attendance_records',
    'student_attendance',
    'attendance_records',

    -- Teaching / assessment -------------------------------------------------
    'student_milestone_evaluations',
    'evaluations',
    'curriculum_materials',
    'curriculum',
    'parent_feedback_messages',
    'parent_feedback',
    'feedback',

    -- Finance ---------------------------------------------------------------
    'fee_payments',
    'payments',
    'ledger_entries',
    'ledger',
    'financial_ledger',

    -- People and classes ----------------------------------------------------
    'students',
    'school_classes',
    'classes',
    'staff',

    -- Operational logs / notifications (remove if you must retain audits) ---
    'notifications',
    'activity_logs',
    'audit_logs'
  ];
begin
  foreach target_table in array demo_tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = target_table
        and c.relkind in ('r', 'p')
    ) then
      execute format(
        'truncate table public.%I restart identity cascade',
        target_table
      );
      raise notice 'cleared demo table: public.%', target_table;
    end if;
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- OPTIONAL: staff / login accounts stored in public.users
--
-- The script above clears public.staff. If your app instead keeps staff
-- logins in public.users, uncomment and adjust the role predicate below.
-- This keeps SUPER_ADMIN / ADMIN / SYSTEM accounts so you cannot lock yourself
-- out. It deliberately never touches Supabase auth.users or auth.identities.
-- ----------------------------------------------------------------------------
-- delete from public.users
-- where upper(role::text) not in ('SUPER_ADMIN', 'ADMIN', 'SYSTEM');

commit;

-- ----------------------------------------------------------------------------
-- Verification (optional): every operational table should now return 0.
-- ----------------------------------------------------------------------------
-- select 'students' as table_name, count(*) from public.students
-- union all select 'staff', count(*) from public.staff
-- union all select 'classes', count(*) from public.classes
-- union all select 'payments', count(*) from public.payments
-- union all select 'ledger', count(*) from public.ledger;
