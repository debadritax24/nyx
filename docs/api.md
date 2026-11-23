# NYX API & Supabase Operations Reference

This document outlines the Supabase PostgREST endpoints, authentication interactions, RPC functions, and Edge Functions utilized by NYX.

---

## 1. Authentication Operations (Supabase Auth)

All user sessions are authenticated using Supabase Auth (GoTrue).

### 1.1 Sign Up
- **Method:** `supabase.auth.signUp({ email, password })`
- **Output:** Returns session and user object. Creates initial row in `profiles`.
- **Note:** Does not decrypt or create the cryptographic vault.

### 1.2 Sign In
- **Method:** `supabase.auth.signInWithPassword({ email, password })`
- **Output:** JWT session token stored in secure storage.

### 1.3 Sign Out
- **Method:** `supabase.auth.signOut()`
- **Output:** Purges local Supabase session and locks local vault.

### 1.4 Password Reset
- **Method:** `supabase.auth.resetPasswordForEmail(email, { redirectTo })`

---

## 2. Vault Operations (PostgREST)

### 2.1 Get Vault Record
Retrieves the user's encrypted vault envelope and KDF parameters.
```typescript
const { data, error } = await supabase
  .from('vaults')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### 2.2 Create Vault Record
Publishes newly created wrapped Vault Keys during initial account setup.
```typescript
const { data, error } = await supabase
  .from('vaults')
  .insert({
    passphrase_wrapped_vault_key: wrappedKeyPass,
    passphrase_wrap_nonce: noncePass,
    passphrase_kdf_salt: saltPass,
    passphrase_kdf_params: kdfParamsPass,
    recovery_wrapped_vault_key: wrappedKeyRec,
    recovery_wrap_nonce: nonceRec,
    recovery_kdf_salt: saltRec,
    recovery_kdf_params: kdfParamsRec,
    crypto_version: 1,
  });
```

---

## 3. Account Synchronization & Concurrency Operations

### 3.1 Push Account Mutation via Atomic Compare-And-Swap (CAS)
Pushes an account insertion, modification, or soft-deletion tombstone atomically using database-level Compare-And-Swap semantics with row-level locking (`FOR UPDATE`).

```typescript
const { data, error } = await supabase.rpc('sync_push_account', {
  p_id: mutation.id,
  p_vault_id: mutation.vault_id,
  p_ciphertext: mutation.ciphertext,
  p_nonce: mutation.nonce,
  p_crypto_version: mutation.crypto_version,
  p_expected_version: mutation.expectedVersion,
  p_next_version: mutation.nextVersion,
  p_deleted_at: mutation.deleted_at || null,
});
```

- **Parameters:**
  - `p_id` (UUID): Account identity.
  - `p_vault_id` (UUID): Owning vault identity.
  - `p_ciphertext` (TEXT): AES-256-GCM ciphertext of JSON account data.
  - `p_nonce` (TEXT): Base64 96-bit random nonce.
  - `p_crypto_version` (INTEGER): Format version (`1`).
  - `p_expected_version` (INTEGER): The version observed prior to local edit (`0` for new insertions).
  - `p_next_version` (INTEGER): Expected version + 1 (monotonically incrementing).
  - `p_deleted_at` (TIMESTAMPTZ, optional): Tombstone soft-deletion timestamp.
- **Error Handling:**
  - If database version does not match `p_expected_version`, raises SQLSTATE `23514` with message `Concurrency conflict: Expected version X but found version Y`.
  - If two devices concurrently insert the same UUID (`p_expected_version: 0`), the race condition is trapped via `unique_violation` and raises SQLSTATE `23514` with message `Concurrency conflict: Record X was concurrently created at version Y`.
  - If target vault does not belong to user, raises SQLSTATE `42501` (`Unauthorized: Target vault ...`).
  - If record is soft-deleted and client attempts stale update, raises SQLSTATE `23514` (`Concurrency conflict: Account ... is soft-deleted`).
  - Client retrieves current remote row and invokes deterministic reconciliation.

### 3.2 Persistent Mutation Queue (WAL & Integrity)
Managed by `PersistentMutationQueue` (`frontend/src/services/queueService.ts`):
- `runExclusive(action)`: Internal async serialization mutex ensuring concurrent mutations never interleave or corrupt disk state.
- `enqueue(mutation)`: Atomically appends mutation to `nyx_mutation_queue_v1.journal` with SHA-256 integrity checksum and versioned envelope (`schemaVersion: 1`).
- `loadJournal()`: Reads mutations from disk; if primary journal is corrupt, recovers automatically from `nyx_mutation_queue_v1.journal.bak`.
- `markProcessing(mutationId)`: Sets state to `PROCESSING` before network dispatch.
- `acknowledge(mutationId)`: Purges acknowledged mutation from disk.
- `recordFailure(mutationId, errorMsg, isPermanent)`: Bounded backoff ($500\text{ms} \times 2^{\text{retry}} + \text{jitter}$) or marks `PERMANENTLY_FAILED`.
- `recoverInterruptedMutations(checkRemoteCallback)`: Startup crash-recovery reconciling incomplete uploads.

### 3.3 Two-Phase Master Vault Key Rotation
Managed by `VaultService.rotateVaultKey` and `VaultService.recoverInterruptedRotation` (`frontend/src/services/vaultService.ts`):
- Pre-flight check: Verifies active key can decrypt local accounts before proceeding.
- Generates new 256-bit symmetric vault key $K_v'$.
- Re-encrypts all local accounts with fresh 96-bit nonces and bound AAD.
- Wraps $K_v'$ under passphrase and recovery code via Argon2id.
- Persists `nyx_rotation_manifest_v1.json` at stage `PREPARED`.
- Updates Supabase `vaults` row and pushes re-encrypted accounts via atomic CAS; advances manifest to `CLOUD_COMMITTED`.
- Updates Android Keystore with $K_v'$, commits local storage, verifies decryption, and purges manifest (`COMPLETED`).
- On app launch, `recoverInterruptedRotation` recovers and commits $K_v'$ if the app crashed in `CLOUD_COMMITTED`, preventing user lockout.

### 3.4 Pull Modified Accounts
Retrieves encrypted records updated since the client's last synchronization timestamp.
```typescript
let query = supabase
  .from('authenticator_accounts')
  .select('*')
  .order('updated_at', { ascending: true });

if (lastSyncedAt) {
  query = query.gt('updated_at', lastSyncedAt);
}
const { data, error } = await query;
```

---

## 4. Device Management Operations

### 3.1 Fetch Encrypted Accounts Since Last Sync
Pulls remote updates for local decryption and reconciliation.
```typescript
const { data, error } = await supabase
  .from('authenticator_accounts')
  .select('id, vault_id, ciphertext, nonce, crypto_version, version, deleted_at, updated_at')
  .gt('updated_at', lastSyncedTimestamp)
  .order('updated_at', { ascending: true });
```

### 3.2 Upsert Encrypted Account
Pushes a new or updated encrypted account with optimistic versioning.
```typescript
const { data, error } = await supabase
  .from('authenticator_accounts')
  .upsert({
    id: accountId,
    vault_id: vaultId,
    ciphertext: encryptedPayload,
    nonce: base64Nonce,
    crypto_version: 1,
    version: nextVersion,
    deleted_at: isDeleted ? new Date().toISOString() : null,
  })
  .select();
```

---

## 4. Device Management Operations

### 4.1 Register / Heartbeat Device
```typescript
const { data, error } = await supabase
  .from('devices')
  .upsert({
    id: deviceUuid,
    device_name: deviceModel,
    platform: 'android',
    last_synced_at: new Date().toISOString(),
  });
```

---

## 5. Security & Edge Functions Policy

- No Edge Function may ever receive plaintext TOTP secrets, plaintext Vault Keys, or generated OTP codes.
- Edge functions are reserved strictly for auxiliary tasks (e.g., account deletion workflows, automated dead-session cleanup, or rate limiting).
