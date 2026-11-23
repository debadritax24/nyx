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

## 3. Account Synchronization Operations

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
