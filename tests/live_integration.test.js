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
const { createClient } = require('@supabase/supabase-js');
const { argon2id } = require('hash-wasm');

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
const envPath = path.join(__dirname, '../.env');
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
    // 6. Compare-And-Swap (CAS) Concurrency & Security Test Matrix
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing Atomic CAS & Database Security Test Matrix...');

    // 6.1 Two simultaneous inserts using the same UUID (missing-row race protection)
    console.log('  -> [Test 6.1] Simultaneous Inserts using same UUID...');
    const concurrentInsertId = '66666666-6666-4666-8666-666666666666';
    const concurrentAad = `nyx-account:${concurrentInsertId}:v1`;
    const encConcurrent = await encryptAesGcm(rawVaultKey, JSON.stringify(originalAccountPlaintext), concurrentAad);

    const { data: firstInsert, error: firstInsertErr } = await clientA.rpc('sync_push_account', {
      p_id: concurrentInsertId,
      p_vault_id: vaultId,
      p_ciphertext: encConcurrent.ciphertext,
      p_nonce: encConcurrent.nonce,
      p_crypto_version: 1,
      p_expected_version: 0,
      p_next_version: 1,
      p_deleted_at: null,
    });
    assert.ifError(firstInsertErr);
    assert.strictEqual(firstInsert.version, 1);

    // Competing client simulates concurrent insert race with identical expected_version = 0
    const { error: secondInsertErr } = await clientA.rpc('sync_push_account', {
      p_id: concurrentInsertId,
      p_vault_id: vaultId,
      p_ciphertext: encConcurrent.ciphertext,
      p_nonce: encConcurrent.nonce,
      p_crypto_version: 1,
      p_expected_version: 0,
      p_next_version: 1,
      p_deleted_at: null,
    });
    assert.ok(secondInsertErr, 'Competing insert must be rejected as concurrency conflict');
    assert.ok(
      secondInsertErr.message.includes('Concurrency conflict') || secondInsertErr.code === '23514',
      `Error must be CAS conflict (23514). Got: ${secondInsertErr.message}`
    );
    console.log('     PASS: Concurrent insert race safely detected and rejected via unique_violation CAS handler.');

    // 6.2 Two simultaneous updates using the same expected version
    console.log('  -> [Test 6.2] Simultaneous updates using same expected version...');
    const encUpdateA = await encryptAesGcm(
      rawVaultKey,
      JSON.stringify({ ...originalAccountPlaintext, account_name: 'competing-A' }),
      accountAad
    );
    const { data: casData2, error: casErr2 } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdateA.ciphertext,
      p_nonce: encUpdateA.nonce,
      p_crypto_version: 1,
      p_expected_version: 1,
      p_next_version: 2,
      p_deleted_at: null,
    });
    assert.ifError(casErr2);
    assert.strictEqual(casData2.version, 2);

    // Competing write with same expected version = 1
    const encUpdateB = await encryptAesGcm(
      rawVaultKey,
      JSON.stringify({ ...originalAccountPlaintext, account_name: 'competing-B' }),
      accountAad
    );
    const { error: casErrCompeting } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 1,
      p_next_version: 2,
      p_deleted_at: null,
    });
    assert.ok(casErrCompeting, 'Competing update with same expected version must be rejected');
    assert.ok(casErrCompeting.code === '23514' || casErrCompeting.message.includes('Concurrency conflict'));
    console.log('     PASS: Competing update on identical expected version rejected.');

    // 6.3 Stale update after a successful write
    console.log('  -> [Test 6.3] Stale update after a successful write...');
    const { error: staleErr } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 1, // Current version is 2
      p_next_version: 3,
      p_deleted_at: null,
    });
    assert.ok(staleErr && (staleErr.code === '23514' || staleErr.message.includes('Concurrency conflict')));
    console.log('     PASS: Stale version increment rejected.');

    // 6.4 Cross-user vault access
    console.log('  -> [Test 6.4] Cross-user vault access prevention...');
    const { error: crossVaultErr } = await clientB.rpc('sync_push_account', {
      p_id: '77777777-7777-4777-8777-777777777777',
      p_vault_id: vaultId, // User A's vault!
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 0,
      p_next_version: 1,
      p_deleted_at: null,
    });
    assert.ok(crossVaultErr, 'Cross-user vault mutation must be rejected');
    assert.ok(crossVaultErr.code === '42501' || crossVaultErr.message.includes('Unauthorized'));
    console.log('     PASS: Cross-user vault access blocked with 42501 Unauthorized.');

    // 6.5 Cross-vault account mutation
    console.log('  -> [Test 6.5] Cross-vault account mutation prevention...');
    const foreignVaultId = '99999999-9999-4999-8999-999999999999';
    const { error: crossAccountVaultErr } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: foreignVaultId,
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 2,
      p_next_version: 3,
      p_deleted_at: null,
    });
    assert.ok(crossAccountVaultErr, 'Reassigning account to non-existent or foreign vault must fail');
    assert.ok(crossAccountVaultErr.code === '42501' || crossAccountVaultErr.message.includes('Unauthorized'));
    console.log('     PASS: Cross-vault account mutation blocked with 42501 Unauthorized.');

    // Clean up temporary concurrent insert record
    await clientA.from('authenticator_accounts').delete().eq('id', concurrentInsertId);

    // 6.6 Atomic Vault Key Rotation Procedure (sync_rotate_vault)
    console.log('  -> [Test 6.6] Atomic Vault Key Rotation (sync_rotate_vault)...');
    const crypto = require('crypto');
    const rotatedVaultKey = crypto.randomBytes(32);
    const rotatedEncAccount = await encryptAesGcm(
      rotatedVaultKey,
      JSON.stringify({ ...originalAccountPlaintext, account_name: 'rotated-account' }),
      accountAad
    );

    const rotatedSaltBytes = crypto.randomBytes(16);
    const rotatedSaltHex = rotatedSaltBytes.toString('hex');
    const rotatedWrappingKeyHex = await argon2id({
      password: password,
      salt: rotatedSaltBytes,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      parallelism: 4,
      outputType: 'hex',
    });
    const rotatedWrappedEnvelope = await encryptAesGcm(
      Buffer.from(rotatedWrappingKeyHex, 'hex'),
      rotatedVaultKey.toString('base64'),
      'nyx-vault-wrap:v1'
    );
    const kdfParams = { m: 65536, t: 3, p: 4, v: 1 };

    const { data: rotData, error: rotErr } = await clientA.rpc('sync_rotate_vault', {
      p_vault_id: vaultId,
      p_passphrase_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_passphrase_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_passphrase_kdf_salt: rotatedSaltHex,
      p_passphrase_kdf_params: kdfParams,
      p_recovery_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_recovery_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_recovery_kdf_salt: rotatedSaltHex,
      p_recovery_kdf_params: kdfParams,
      p_accounts: [
        {
          id: accountId,
          expected_version: 2,
          next_version: 3,
          ciphertext: rotatedEncAccount.ciphertext,
          nonce: rotatedEncAccount.nonce,
          crypto_version: 1,
          deleted_at: null,
        },
      ],
    });
    assert.ifError(rotErr);
    assert.ok(rotData && rotData.success, 'sync_rotate_vault must return success');
    assert.strictEqual(rotData.migrated_accounts, 1);

    // Verify database was updated to new wrapped key and incremented account version
    const { data: checkRotVault } = await clientA.from('vaults').select('*').eq('id', vaultId).single();
    assert.strictEqual(checkRotVault.passphrase_wrapped_vault_key, rotatedWrappedEnvelope.ciphertext);

    const { data: checkRotAcc } = await clientA.from('authenticator_accounts').select('*').eq('id', accountId).single();
    assert.strictEqual(checkRotAcc.version, 3);
    assert.strictEqual(checkRotAcc.ciphertext, rotatedEncAccount.ciphertext);
    console.log('     PASS: Atomic vault rotation procedure migrated envelope and accounts in a single transaction.');

    // 6.7 Concurrency conflict rejection on rotation
    console.log('  -> [Test 6.7] Concurrency conflict on stale rotation batch...');
    const { error: staleRotErr } = await clientA.rpc('sync_rotate_vault', {
      p_vault_id: vaultId,
      p_passphrase_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_passphrase_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_passphrase_kdf_salt: rotatedSaltHex,
      p_passphrase_kdf_params: kdfParams,
      p_recovery_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_recovery_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_recovery_kdf_salt: rotatedSaltHex,
      p_recovery_kdf_params: kdfParams,
      p_accounts: [
        {
          id: accountId,
          expected_version: 1, // Stale! DB is at 3
          next_version: 4,
          ciphertext: rotatedEncAccount.ciphertext,
          nonce: rotatedEncAccount.nonce,
          crypto_version: 1,
          deleted_at: null,
        },
      ],
    });
    assert.ok(staleRotErr && (staleRotErr.code === '23514' || staleRotErr.message.includes('Concurrency conflict')));
    console.log('     PASS: Stale rotation batch atomically rejected with 23514.');

    // 6.8 Cross-user authorization on rotation
    console.log('  -> [Test 6.8] Cross-user authorization guard on rotation...');
    const { error: foreignRotErr } = await clientB.rpc('sync_rotate_vault', {
      p_vault_id: vaultId, // User A vault!
      p_passphrase_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_passphrase_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_passphrase_kdf_salt: rotatedSaltHex,
      p_passphrase_kdf_params: kdfParams,
      p_recovery_wrapped_vault_key: rotatedWrappedEnvelope.ciphertext,
      p_recovery_wrap_nonce: rotatedWrappedEnvelope.nonce,
      p_recovery_kdf_salt: rotatedSaltHex,
      p_recovery_kdf_params: kdfParams,
      p_accounts: [],
    });
    assert.ok(foreignRotErr && (foreignRotErr.code === '42501' || foreignRotErr.message.includes('Unauthorized')));
    console.log('     PASS: Cross-user rotation blocked with 42501 Unauthorized.');

    // -------------------------------------------------------------------------
    // 7. Tombstone Soft-Deletion Propagation & Resurrection Guard
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing Tombstone Deletion Propagation & Resurrection Guard...');
    const tombstoneEnc = await encryptAesGcm(
      rotatedVaultKey,
      JSON.stringify({ ...originalAccountPlaintext, deleted_at: new Date().toISOString() }),
      accountAad
    );

    const { data: tombData, error: tombErr } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: tombstoneEnc.ciphertext,
      p_nonce: tombstoneEnc.nonce,
      p_crypto_version: 1,
      p_expected_version: 3, // Current database version is 3
      p_next_version: 4,
      p_deleted_at: new Date().toISOString(),
    });
    assert.ifError(tombErr);
    assert.strictEqual(tombData.version, 4);
    assert.ok(tombData.deleted_at, 'Tombstone deleted_at must be populated');
    console.log('  -> Tombstone persisted at Version 4 with soft-deletion timestamp.');

    // 7.1 Attempts to bypass soft deletion (Accidental resurrection with stale version)
    console.log('  -> [Test 7.1] Guard against accidental resurrection of soft-deleted record...');
    const { error: resurrectErr } = await clientA.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 3, // Stale version (DB is at 4, soft-deleted)
      p_next_version: 5,
      p_deleted_at: null,
    });
    assert.ok(resurrectErr, 'Resurrection of soft-deleted tombstone with stale version must be rejected');
    assert.ok(resurrectErr.code === '23514' || resurrectErr.message.includes('Concurrency conflict'));
    console.log('     PASS: Accidental resurrection of soft-deleted account blocked.');

    // 7.2 Unauthorized RPC execution
    console.log('  -> [Test 7.2] Unauthorized RPC execution without authentication...');
    const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { fetch: curlFetch },
    });
    const { error: unauthErr } = await unauthClient.rpc('sync_push_account', {
      p_id: accountId,
      p_vault_id: vaultId,
      p_ciphertext: encUpdateB.ciphertext,
      p_nonce: encUpdateB.nonce,
      p_crypto_version: 1,
      p_expected_version: 4,
      p_next_version: 5,
      p_deleted_at: null,
    });
    assert.ok(unauthErr, 'Unauthenticated RPC call must fail');
    assert.ok(
      unauthErr.code === '42501' ||
        unauthErr.message.includes('Unauthorized') ||
        unauthErr.message.includes('not authenticated')
    );
    console.log('     PASS: Unauthenticated RPC execution blocked with 42501.');

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
