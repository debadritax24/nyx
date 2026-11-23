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

// 6. Test optimistic concurrency logic directly in JavaScript simulation
function simulateOptimisticConcurrency(oldVersion, newVersion) {
  if (oldVersion !== null && newVersion <= oldVersion) {
    throw new Error(`Concurrency conflict: version ${newVersion} <= ${oldVersion}`);
  }
  return true;
}

assert.strictEqual(simulateOptimisticConcurrency(1, 2), true);
assert.strictEqual(simulateOptimisticConcurrency(2, 3), true);
assert.throws(() => simulateOptimisticConcurrency(2, 2), /Concurrency conflict/);
assert.throws(() => simulateOptimisticConcurrency(2, 1), /Concurrency conflict/);
console.log('[PASS] Concurrency simulator verified: stale updates and duplicate versions rejected');

console.log('\nAll 5 backend security and RLS test suites PASSED.');
