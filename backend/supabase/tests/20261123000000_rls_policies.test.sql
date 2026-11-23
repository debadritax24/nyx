-- =============================================================================
-- pgTAP RLS POLICY & SECURITY TEST SUITE FOR SUPABASE
-- Run with: supabase test db
-- =============================================================================

BEGIN;
SELECT plan(10);

-- 1. Verify all user tables exist in public schema
SELECT has_table('public', 'profiles', 'Table public.profiles must exist');
SELECT has_table('public', 'vaults', 'Table public.vaults must exist');
SELECT has_table('public', 'authenticator_accounts', 'Table public.authenticator_accounts must exist');
SELECT has_table('public', 'devices', 'Table public.devices must exist');

-- 2. Verify RLS is enabled on all tables
SELECT row_eq(
  'SELECT relrowsecurity FROM pg_class WHERE relname = ''profiles''',
  ROW(true),
  'profiles table must have RLS enabled'
);
SELECT row_eq(
  'SELECT relrowsecurity FROM pg_class WHERE relname = ''vaults''',
  ROW(true),
  'vaults table must have RLS enabled'
);
SELECT row_eq(
  'SELECT relrowsecurity FROM pg_class WHERE relname = ''authenticator_accounts''',
  ROW(true),
  'authenticator_accounts table must have RLS enabled'
);
SELECT row_eq(
  'SELECT relrowsecurity FROM pg_class WHERE relname = ''devices''',
  ROW(true),
  'devices table must have RLS enabled'
);

-- 3. Verify optimistic concurrency trigger function exists
SELECT has_function('public', 'check_optimistic_concurrency', 'check_optimistic_concurrency trigger function must exist');
SELECT has_function('public', 'handle_updated_at', 'handle_updated_at trigger function must exist');

SELECT * FROM finish();
ROLLBACK;
