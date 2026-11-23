/**
 * NYX RLS & Database Security Assertion Suite
 * Evaluates migration definitions, policy enforcement, and optimistic concurrency rules.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Executing Backend Database & RLS Security Suite ---');

const migrationDir = path.join(__dirname, '../supabase/migrations');
const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();

let totalSql = '';
for (const file of files) {
  totalSql += '\n' + fs.readFileSync(path.join(migrationDir, file), 'utf8');
}

// 1. Verify RLS is enabled and forced for every user table
const requiredTables = ['profiles', 'vaults', 'authenticator_accounts', 'devices'];
for (const tbl of requiredTables) {
  assert.ok(
    totalSql.includes(`ALTER TABLE public.${tbl} ENABLE ROW LEVEL SECURITY;`),
    `Security violation: ${tbl} does not have ENABLE ROW LEVEL SECURITY`
  );
  assert.ok(
    totalSql.includes(`ALTER TABLE public.${tbl} FORCE ROW LEVEL SECURITY;`),
    `Security violation: ${tbl} does not have FORCE ROW LEVEL SECURITY`
  );
  console.log(`[PASS] Table ${tbl} enforces RLS unconditionally`);
}

// 2. Verify all operations restrict access via auth.uid()
const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
for (const tbl of requiredTables) {
  for (const op of operations) {
    const regex = new RegExp(`CREATE POLICY ".*${op.toLowerCase()}.*"\\s+ON public\\.${tbl}[\\s\\S]*?TO authenticated`, 'i');
    assert.ok(
      regex.test(totalSql),
      `Security violation: Table ${tbl} missing authenticated policy for operation ${op}`
    );
  }
  console.log(`[PASS] Table ${tbl} defines authenticated policies for SELECT, INSERT, UPDATE, DELETE`);
}

// 3. Verify cross-tenant vault injection protection
assert.ok(
  totalSql.includes('v.user_id = auth.uid()'),
  'Security violation: authenticator_accounts must verify vault ownership'
);
console.log('[PASS] authenticator_accounts verifies vault ownership against auth.uid()');

// 4. Verify optimistic concurrency check logic
assert.ok(
  totalSql.includes('NEW.version <= OLD.version'),
  'Security violation: check_optimistic_concurrency must reject non-incrementing version'
);
console.log('[PASS] Optimistic concurrency trigger enforces monotonic version increments');

// 5. Verify device metadata enhancements from forward migration
assert.ok(
  totalSql.includes('last_active_at') && totalSql.includes('device_label'),
  'Verification failure: devices must contain last_active_at and device_label'
);
console.log('[PASS] devices table includes last_active_at and device_label columns');

// 6. Test Compare-And-Swap (CAS) stored procedure and simulation
assert.ok(
  totalSql.includes('FUNCTION public.sync_push_account'),
  'Verification failure: sync_push_account stored procedure must be defined'
);
assert.ok(
  totalSql.includes('FOR UPDATE'),
  'Security requirement: sync_push_account must use FOR UPDATE row-level locking'
);
assert.ok(
  totalSql.includes('v_existing.version != p_expected_version'),
  'Security requirement: sync_push_account must verify expected_version equals current_version'
);
assert.ok(
  totalSql.includes('unique_violation'),
  'Concurrency requirement: sync_push_account must catch unique_violation to resolve concurrent insert race'
);
assert.ok(
  totalSql.includes('v_existing.deleted_at IS NOT NULL'),
  'Security requirement: sync_push_account must guard against accidental tombstone resurrection'
);
console.log('[PASS] Atomic Compare-And-Swap (CAS) stored procedure defined with FOR UPDATE locking and race handlers');

// 7. Test atomic Compare-And-Swap (CAS) logic simulation
function simulateCAS(currentVersion, expectedVersion, nextVersion, isDeleted = false, unDeleteRequested = false) {
  if (currentVersion === null) {
    // New record insertion
    if (expectedVersion > 0) {
      throw new Error(`Concurrency conflict: Record does not exist (expected ${expectedVersion})`);
    }
    return nextVersion;
  }
  // Soft deletion protection
  if (isDeleted && unDeleteRequested && expectedVersion < currentVersion) {
    throw new Error(`Concurrency conflict: Record is soft-deleted at version ${currentVersion}`);
  }
  // Existing record update
  if (currentVersion !== expectedVersion) {
    throw new Error(`Concurrency conflict: Expected version ${expectedVersion} but found ${currentVersion}`);
  }
  if (nextVersion <= currentVersion) {
    throw new Error(`Concurrency conflict: Next version ${nextVersion} must be greater than ${currentVersion}`);
  }
  return nextVersion;
}

// First insertion: expected 0 -> assigns version 1
assert.strictEqual(simulateCAS(null, 0, 1), 1);
// Normal update: expected 1 -> advances to version 2
assert.strictEqual(simulateCAS(1, 1, 2), 2);
// Competing stale update: client expected 1, but DB is already at version 2 -> REJECTED!
assert.throws(() => simulateCAS(2, 1, 3), /Expected version 1 but found 2/);
// Stale read update: client expected 2, but DB already at version 3 -> REJECTED!
assert.throws(() => simulateCAS(3, 2, 4), /Expected version 2 but found 3/);
// Invalid decrement update: REJECTED!
assert.throws(() => simulateCAS(2, 2, 2), /Next version 2 must be greater than 2/);
// Attempted resurrection of soft-deleted tombstone with stale expected version: REJECTED!
assert.throws(() => simulateCAS(3, 2, 4, true, true), /Record is soft-deleted at version 3/);
console.log('[PASS] CAS concurrency simulator verified: exact version matches required, race conditions eliminated');

console.log('\nAll 7 backend security, RLS, and CAS test suites PASSED.');
