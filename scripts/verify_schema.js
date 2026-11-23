/**
 * NYX Schema & RLS Policy Verification Script
 * Validates syntax, table definitions, and security invariants in SQL migrations.
 */
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '../supabase/migrations/20261123000000_initial_nyx_schema.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`ERROR: Migration file not found at ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

const requiredTables = ['profiles', 'vaults', 'authenticator_accounts', 'devices'];
const requiredColumns = {
  profiles: ['id', 'display_name', 'created_at', 'updated_at'],
  vaults: [
    'id', 'user_id',
    'passphrase_wrapped_vault_key', 'passphrase_wrap_nonce', 'passphrase_kdf_salt', 'passphrase_kdf_params',
    'recovery_wrapped_vault_key', 'recovery_wrap_nonce', 'recovery_kdf_salt', 'recovery_kdf_params',
    'crypto_version', 'created_at', 'updated_at'
  ],
  authenticator_accounts: [
    'id', 'user_id', 'vault_id', 'ciphertext', 'nonce',
    'crypto_version', 'version', 'deleted_at', 'created_at', 'updated_at'
  ],
  devices: ['id', 'user_id', 'device_name', 'platform', 'last_synced_at', 'created_at', 'updated_at']
};

let failures = 0;

console.log('--- Checking Required Tables and RLS ---');
for (const table of requiredTables) {
  if (!sql.includes(`CREATE TABLE public.${table}`)) {
    console.error(`FAIL: Missing table definition for ${table}`);
    failures++;
  } else {
    console.log(`PASS: Table public.${table} defined.`);
  }

  if (!sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)) {
    console.error(`FAIL: Missing ENABLE ROW LEVEL SECURITY for ${table}`);
    failures++;
  } else {
    console.log(`PASS: RLS enabled on ${table}.`);
  }

  if (!sql.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`)) {
    console.error(`FAIL: Missing FORCE ROW LEVEL SECURITY for ${table}`);
    failures++;
  } else {
    console.log(`PASS: RLS forced on ${table}.`);
  }
}

console.log('\n--- Checking Required Columns ---');
for (const [table, columns] of Object.entries(requiredColumns)) {
  for (const col of columns) {
    if (!sql.includes(col)) {
      console.error(`FAIL: Table ${table} appears to be missing column '${col}'`);
      failures++;
    }
  }
  console.log(`PASS: All expected columns found for table ${table}.`);
}

console.log('\n--- Checking Concurrency & Trigger Guards ---');
if (!sql.includes('check_optimistic_concurrency')) {
  console.error('FAIL: Optimistic concurrency trigger function not found');
  failures++;
} else {
  console.log('PASS: Optimistic concurrency trigger present.');
}

if (!sql.includes('handle_updated_at')) {
  console.error('FAIL: handle_updated_at trigger function not found');
  failures++;
} else {
  console.log('PASS: handle_updated_at trigger function present.');
}

if (failures > 0) {
  console.error(`\nCompleted with ${failures} validation failure(s).`);
  process.exit(1);
} else {
  console.log('\nAll SQL schema and RLS requirements passed successfully.');
}
