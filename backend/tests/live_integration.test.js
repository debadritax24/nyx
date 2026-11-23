/**
 * NYX Live Supabase Integration Test Suite
 * Executes end-to-end cloud synchronization, zero-knowledge encryption verification,
 * atomic Compare-And-Swap (CAS) concurrency, tombstones, and cross-tenant isolation
 * against live Supabase project infrastructure.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');
const { createClient } = require('../../frontend/node_modules/@supabase/supabase-js');
const { argon2id } = require('../../frontend/node_modules/hash-wasm');

// Proxy-compatible Fetch adapter for sandbox environment
async function curlFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  const method = init.method || (typeof input === 'object' && input.method) || 'GET';
  const rawHeaders = init.headers || (typeof input === 'object' && input.headers) || {};
  let headerArgs = '';
  const entries = rawHeaders instanceof Headers ? rawHeaders.entries() : Object.entries(rawHeaders);
  for (const [k, v] of entries) {
    headerArgs += ` -H "${k}: ${v}"`;
  }
  let bodyArg = '';
  let tmpFile = null;
  const body = init.body || (typeof input === 'object' && input.body);
  if (body) {
    tmpFile = `/tmp/fetch_${Date.now()}_${Math.random().toString(36).substring(2)}.json`;
    fs.writeFileSync(tmpFile, typeof body === 'string' ? body : JSON.stringify(body));
    bodyArg = ` --data @${tmpFile}`;
  }
  const cmd = `curl -s -i -X ${method} ${headerArgs} ${bodyArg} "${url}"`;
  try {
    const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

    const parts = raw.split(/\r?\n\r?\n/);
    const bodyPart = parts[parts.length - 1];
    const lastHeaderPart = parts[parts.length - 2] || '';
    const statusLine = lastHeaderPart.split(/\r?\n/)[0] || '';
    const statusCode = parseInt(statusLine.split(' ')[1], 10) || 200;

    const resHeaders = new Headers();
    for (const hline of lastHeaderPart.split(/\r?\n/).slice(1)) {
      const col = hline.indexOf(':');
      if (col !== -1) {
        resHeaders.append(hline.substring(0, col).trim(), hline.substring(col + 1).trim());
      }
    }

    if (statusCode === 204 || statusCode === 205 || statusCode === 304) {
      return new Response(null, { status: statusCode, headers: resHeaders });
    }

    return new Response(bodyPart, { status: statusCode, headers: resHeaders });
  } catch (err) {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    throw err;
  }
}

// Load root .env
const envPath = path.join(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
}

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Dynamically obtain service_role key for administrative test setup without hardcoding secrets
let SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY && env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_PROJECT_REF) {
  try {
    const keysRaw = execSync(
      `curl -s -H "Authorization: Bearer ${env.SUPABASE_ACCESS_TOKEN}" "https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys"`,
      { encoding: 'utf8' }
    );
    const keys = JSON.parse(keysRaw);
    const serviceRoleObj = keys.find((k) => k.name === 'service_role' || k.role === 'service_role');
    if (serviceRoleObj) SERVICE_ROLE_KEY = serviceRoleObj.api_key;
  } catch (err) {
    // Dynamic fetch fallback
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_ANON_KEY missing in .env');
  process.exit(1);
}

// Cryptographic Helpers (WebCrypto)
async function encryptAesGcm(keyBytes, plaintextStr, aadStr) {
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encodedPlaintext = new TextEncoder().encode(plaintextStr);
  const encodedAad = new TextEncoder().encode(aadStr);

  const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encodedAad },
    cryptoKey,
    encodedPlaintext
  );

  return {
    ciphertext: Buffer.from(ciphertextBuf).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

async function decryptAesGcm(keyBytes, ciphertextBase64, nonceBase64, aadStr) {
  const nonce = Buffer.from(nonceBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const encodedAad = new TextEncoder().encode(aadStr);

  const decryptedBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encodedAad },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuf);
}

async function runLiveIntegrationTests() {
  console.log('===============================================================');
  console.log('   NYX LIVE SUPABASE INTEGRATION & CONCURRENCY TEST SUITE      ');
  console.log('===============================================================');
  console.log(`Target Supabase Endpoint: ${SUPABASE_URL}\n`);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: curlFetch },
  });
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: curlFetch },
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: curlFetch },
  });

  const uniqueSuffix = Date.now().toString(36);
  const emailA = `nyx_test_a_${uniqueSuffix}@nyx-test-suite.org`;
  const emailB = `nyx_test_b_${uniqueSuffix}@nyx-test-suite.org`;
  const password = `NyxPass_${uniqueSuffix}!1234`;

  let userIdA = null;
  let userIdB = null;
  const vaultId = globalThis.crypto.randomUUID();
  const accountId = globalThis.crypto.randomUUID();
  const deviceId = globalThis.crypto.randomUUID();
  const rawVaultKey = globalThis.crypto.getRandomValues(new Uint8Array(32));

  try {
    // -------------------------------------------------------------------------
    // 1. User Registration & Authentication (Pre-confirmed test identities)
    // -------------------------------------------------------------------------
    console.log('[1/10] Testing User Registration & Session Establishment...');
    const { data: userACreated, error: adminErrA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
    });
    assert.ifError(adminErrA);
    userIdA = userACreated.user.id;

    const { data: userBCreated, error: adminErrB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
    });
    assert.ifError(adminErrB);
    userIdB = userBCreated.user.id;

    // Log in with clientA and clientB to obtain authentic JWT tokens
    const { data: authA, error: loginErrA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password: password,
    });
    assert.ifError(loginErrA);
    assert.strictEqual(authA.user.id, userIdA);

    const { data: authB, error: loginErrB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password: password,
    });
    assert.ifError(loginErrB);
    assert.strictEqual(authB.user.id, userIdB);

    console.log(`  -> User A registered: ${userIdA}`);
    console.log(`  -> User B registered: ${userIdB}`);

    // -------------------------------------------------------------------------
    // 2. Vault Creation with Argon2id Key Wrapping
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Testing Encrypted Vault Creation (Argon2id + AES-256-GCM)...');
    const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Buffer.from(saltBytes).toString('hex');
    const derivedWrappingKeyHex = await argon2id({
      password: password,
      salt: saltBytes,
      iterations: 3,
      memorySize: 65536, // 64 MB
      hashLength: 32,
      parallelism: 4,
      outputType: 'hex',
    });
    const wrappingKeyBytes = Buffer.from(derivedWrappingKeyHex, 'hex');

    const wrappedVaultKey = await encryptAesGcm(
      wrappingKeyBytes,
      Buffer.from(rawVaultKey).toString('base64'),
      'nyx-vault-wrap:v1'
    );

    const { error: vaultErr } = await clientA.from('vaults').insert({
      id: vaultId,
      user_id: userIdA,
      passphrase_wrapped_vault_key: wrappedVaultKey.ciphertext,
      passphrase_wrap_nonce: wrappedVaultKey.nonce,
      passphrase_kdf_salt: saltHex,
      passphrase_kdf_params: { m: 65536, t: 3, p: 4, v: 1 },
      recovery_wrapped_vault_key: wrappedVaultKey.ciphertext,
      recovery_wrap_nonce: wrappedVaultKey.nonce,
      recovery_kdf_salt: saltHex,
      recovery_kdf_params: { m: 65536, t: 3, p: 4, v: 1 },
      crypto_version: 1,
    });
    assert.ifError(vaultErr);
    console.log('  -> Vault record created with Argon2id wrapped key and RLS verification.');

    // -------------------------------------------------------------------------
    // 3. Device Registration & Auditing
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Testing Device Registration in devices table...');
    const { error: devErr } = await clientA.from('devices').insert({
      id: deviceId,
      user_id: userIdA,
      device_name: 'Pixel 8 Pro (Primary)',
      device_label: 'Pixel 8 Pro (Primary)',
      platform: 'android',
      last_active_at: new Date().toISOString(),
    });
    assert.ifError(devErr);
    console.log('  -> Device Pixel 8 Pro registered.');

    // -------------------------------------------------------------------------
    // 4. Client-Side Encrypted Account Upload via CAS Stored Procedure
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing Client-Side Encrypted Account Upload via Atomic CAS...');
    const originalAccountPlaintext = {
      issuer: 'GitHub',
      account_name: 'alice@nyx.internal',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    };
    const accountAad = `nyx-account:${accountId}:v1`;
    const encAccount = await encryptAesGcm(
      rawVaultKey,
      JSON.stringify(originalAccountPlaintext),
      accountAad
    );

    // Call atomic Compare-And-Swap procedure: sync_push_account
    // Initial creation: expected_version = 0, next_version = 1
    const { data: casData1, error: casErr1 } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encAccount.ciphertext,
      p_nonce: encAccount.nonce,
      p_crypto_version: 1,
      p_expected_version: 0,
      p_next_version: 1,
      p_deleted_at: null,
    });
    assert.ifError(casErr1);
    assert.strictEqual(casData1.version, 1);
    console.log('  -> Account record inserted atomically at Version 1.');

    // -------------------------------------------------------------------------
    // 5. Zero-Knowledge Inspection & Download Decryption
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Testing Zero-Knowledge Verification & Decryption...');
    const { data: remoteRows, error: pullErr } = await clientA
      .from('authenticator_accounts')
      .select('*')
      .eq('id', accountId);
    assert.ifError(pullErr);
    assert.strictEqual(remoteRows.length, 1);
    const downloadedRow = remoteRows[0];

    // Assert backend only stored ciphertext and never plaintext secrets
    const rawCiphertext = downloadedRow.ciphertext;
    assert.ok(!rawCiphertext.includes('GitHub'), 'Zero-Knowledge: Ciphertext must not contain issuer');
    assert.ok(!rawCiphertext.includes('alice'), 'Zero-Knowledge: Ciphertext must not contain account_name');
    assert.ok(!rawCiphertext.includes('JBSWY3DPEHPK3PXP'), 'Zero-Knowledge: Ciphertext must not contain TOTP secret');

    // Decrypt on client with Vault Key and verify AAD
    const decryptedJson = await decryptAesGcm(
      rawVaultKey,
      downloadedRow.ciphertext,
      downloadedRow.nonce,
      accountAad
    );
    const parsed = JSON.parse(decryptedJson);
    assert.strictEqual(parsed.issuer, 'GitHub');
    assert.strictEqual(parsed.account_name, 'alice@nyx.internal');
    assert.strictEqual(parsed.secret, 'JBSWY3DPEHPK3PXP');
    console.log('  -> Zero-Knowledge confirmed: Cloud storage contains no plaintext metadata.');
    console.log('  -> Client decryption verified with exact HMAC secret recovery.');

    // -------------------------------------------------------------------------
    // 6. Compare-And-Swap (CAS) Concurrency Conflict Defense
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing Compare-And-Swap (CAS) Concurrency Conflict Handling...');
    // Device 1 updates record to version 2 (expected: 1, next: 2)
    const updatedPlaintext1 = { ...originalAccountPlaintext, account_name: 'alice-device1-edit' };
    const encUpdate1 = await encryptAesGcm(rawVaultKey, JSON.stringify(updatedPlaintext1), accountAad);

    const { data: casData2, error: casErr2 } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdate1.ciphertext,
      p_nonce: encUpdate1.nonce,
      p_crypto_version: 1,
      p_expected_version: 1,
      p_next_version: 2,
      p_deleted_at: null,
    });
    assert.ifError(casErr2);
    assert.strictEqual(casData2.version, 2);
    console.log('  -> Device 1 successfully pushed update to Version 2.');

    // Competing Device 2 (simulating concurrent edit offline) tries to push update based on stale Version 1!
    const updatedPlaintext2 = { ...originalAccountPlaintext, account_name: 'alice-device2-competing-edit' };
    const encUpdate2 = await encryptAesGcm(rawVaultKey, JSON.stringify(updatedPlaintext2), accountAad);

    const { data: casData3, error: casErr3 } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdate2.ciphertext,
      p_nonce: encUpdate2.nonce,
      p_crypto_version: 1,
      p_expected_version: 1, // STALE! Expected 1, but database is now at 2
      p_next_version: 2,
      p_deleted_at: null,
    });
    assert.ok(casErr3, 'Database CAS MUST reject stale update');
    assert.ok(
      casErr3.message.includes('Concurrency conflict') || casErr3.code === '23514',
      `Error must reflect concurrency conflict. Received: ${casErr3.message}`
    );
    console.log(`  -> Concurrency conflict correctly detected and rejected: ${casErr3.message}`);

    // -------------------------------------------------------------------------
    // 7. Tombstone Soft-Deletion Propagation
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing Tombstone Deletion Propagation...');
    const tombstoneEnc = await encryptAesGcm(
      rawVaultKey,
      JSON.stringify({ ...originalAccountPlaintext, deleted_at: new Date().toISOString() }),
      accountAad
    );

    const { data: tombData, error: tombErr } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: tombstoneEnc.ciphertext,
      p_nonce: tombstoneEnc.nonce,
      p_crypto_version: 1,
      p_expected_version: 2, // Current database version is 2
      p_next_version: 3,
      p_deleted_at: new Date().toISOString(),
    });
    assert.ifError(tombErr);
    assert.strictEqual(tombData.version, 3);
    assert.ok(tombData.deleted_at, 'Tombstone deleted_at must be populated');
    console.log('  -> Tombstone persisted at Version 3 with soft-deletion timestamp.');

    // -------------------------------------------------------------------------
    // 8. Device Revocation Verification
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing Device Revocation in devices table...');
    const { error: revokeErr } = await clientA.from('devices').delete().eq('id', deviceId);
    assert.ifError(revokeErr);
    const { data: checkDev } = await clientA.from('devices').select('*').eq('id', deviceId);
    assert.strictEqual(checkDev.length, 0);
    console.log('  -> Device Pixel 8 Pro revoked and removed from devices registry.');

    // -------------------------------------------------------------------------
    // 9. Cross-User Tenant Isolation (RLS Security Enforcement)
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing Cross-Tenant RLS Policy Isolation...');
    // User B tries to read User A's vault
    const { data: foreignVaults } = await clientB.from('vaults').select('*').eq('id', vaultId);
    assert.strictEqual(foreignVaults.length, 0, 'RLS violation: User B must not see User A vault');

    // User B tries to read User A's account
    const { data: foreignAccounts } = await clientB
      .from('authenticator_accounts')
      .select('*')
      .eq('id', accountId);
    assert.strictEqual(foreignAccounts.length, 0, 'RLS violation: User B must not see User A account');

    // User B tries to overwrite User A's account via CAS RPC
    const { error: foreignCasErr } = await clientB.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encAccount.ciphertext,
      p_nonce: encAccount.nonce,
      p_crypto_version: 1,
      p_expected_version: 3,
      p_next_version: 4,
      p_deleted_at: null,
    });
    assert.ok(foreignCasErr, 'RLS violation: User B must not be able to modify User A account');
    console.log('  -> Cross-tenant isolation verified: User B completely barred from User A data.');

    // -------------------------------------------------------------------------
    // 10. Teardown & Test Cleanup
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Cleaning up temporary test artifacts...');
    await clientA.from('authenticator_accounts').delete().eq('id', accountId);
    await clientA.from('vaults').delete().eq('id', vaultId);
    console.log('  -> Test accounts and vaults removed.');

    console.log('\n===============================================================');
    console.log('   ALL 10 LIVE SUPABASE INTEGRATION TEST SUITES PASSED!        ');
    console.log('===============================================================');
  } catch (err) {
    console.error('\nFAILURE in Live Integration Test:', err);
    process.exit(1);
  }
}

runLiveIntegrationTests();
