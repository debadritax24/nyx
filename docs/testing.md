# NYX Testing Architecture & Verification Protocols

This document defines the testing strategy, official test vectors, RLS verification policies, and execution instructions for NYX.

---

## 1. Testing Pyramid & Strategy

```text
       /\
      /  \     Android E2E / Maestro (Smoke & Critical Flows)
     /----\
    /      \    PostgreSQL RLS Integration Tests (Multi-tenant isolation)
   /--------\
  /          \  Unit Tests: RFC 6238 TOTP Vectors, Base32, AES-GCM Envelopes
 /------------\
```

---

## 2. Unit Testing & RFC 6238 Official Test Vectors

The TOTP engine is verified against official test vectors defined in **RFC 6238** across SHA-1, SHA-256, and SHA-512 algorithms.

### Test Secret Seeds (RFC 6238 Appendix B)
- **SHA-1 Seed (20 bytes):** `12345678901234567890` (ASCII) -> `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` (Base32)
- **SHA-256 Seed (32 bytes):** `12345678901234567890123456789012` (ASCII)
- **SHA-512 Seed (64 bytes):** 64-byte repeated ASCII sequence

### Standard Verification Matrix (30-second Time-Step, T0 = 0)
| Unix Epoch Time | Timestamp (UTC) | Expected TOTP (SHA-1) | Expected TOTP (SHA-256) | Expected TOTP (SHA-512) |
| :--- | :--- | :--- | :--- | :--- |
| `59` | 1970-01-01 00:00:59 | `287082` | `461145` | `906935` |
| `1111111109` | 2005-03-18 01:58:29 | `081804` | `680847` | `709301` |
| `1111111111` | 2005-03-18 01:58:31 | `050471` | `670084` | `287082` |
| `1234567890` | 2009-02-13 23:31:30 | `005924` | `918194` | `359152` |
| `2000000000` | 2033-05-18 03:33:20 | `279037` | `906984` | `613518` |

---

## 3. Cryptographic Envelope Unit Tests

1. **AES-256-GCM Roundtrip:** Verify encryption and decryption of JSON account structures with random keys and nonces.
2. **Tamper Resistance:** Modify 1 byte of the ciphertext or authentication tag; ensure decryption throws an authentication error.
3. **Nonce Uniqueness:** Generate 10,000 successive nonces; assert 0 collisions.
4. **Argon2id Determinism:** Verify identical derived keys given identical inputs, and distinct keys with differing salts.

---

## 4. PostgreSQL Row Level Security (RLS) Tests

Test cases executed against the local Supabase database:
- **Tenant Isolation:** User A creates an account and vault record. User B queries `vaults` and `authenticator_accounts` with User B's JWT; verify 0 records returned.
- **Unauthorized Write:** User B attempts to `INSERT` or `UPDATE` a record with `user_id = User A`; verify statement fails with RLS policy violation.
- **Anonymous Access:** Unauthenticated requests must receive 401 Unauthorized or empty sets.

---

## 5. Cloud Synchronization & Multi-Device Concurrency Tests

Implemented in `frontend/tests/services/syncService.test.ts` and `frontend/tests/services/deviceService.test.ts`:
1. **Zero-Knowledge Encryption Verification:** Assert ciphertext uploaded to the cloud contains zero plaintext secrets, issuers, or account labels.
2. **Associated Authenticated Data (AAD) Tampering:** Tamper with the account UUID in the AAD or ciphertext; verify decryption throws an authentication tag validation error.
3. **Deterministic Conflict Reconciliation:**
   - **Clean Fast-Forward:** When remote version > local version and no local conflict exists, cleanly adopt the remote record.
   - **Data Preservation (Conflicted Copy):** When concurrent edits collide, adopt remote as canonical and fork the local divergent edit into a separate record with `(Conflicted Copy)` appended to the account name. Verify both accounts are preserved.
   - **Same-Version Divergence:** Detect and fork concurrent edits that share the identical version number.
4. **Anti-Resurrection Tombstone Protection:** Verify that remote tombstones (`deleted_at`) purge local records and prevent deleted accounts from being resurrected by offline devices.
5. **Multi-Device Bidirectional Sync Simulation:** Simulate Device A creating an account, Device B pulling and editing to version 2, and Device A pulling and fast-forwarding to version 2.
6. **Device Metadata Persistence:** Verify persistent device UUID generation and label management.

---

## 6. Phase 6: Live Supabase Integration & Maestro E2E Flows

### 6.1 Live Supabase Integration Test Suite
Implemented in `backend/tests/live_integration.test.js`:
- Tests real user registration and session tokens via Supabase Auth.
- Tests encrypted vault creation with Argon2id wrapped keys.
- Tests device registration and metadata tracking in `devices`.
- Tests client-side encrypted account upload via atomic Compare-And-Swap (CAS) procedure `sync_push_account`.
- Tests zero-knowledge information disclosure (asserts backend stores no plaintext issuers, usernames, or secrets).
- **7-Point Database Concurrency & Security Test Matrix:**
  1. Two simultaneous inserts using the same UUID (missing-row race handled via `unique_violation` trapping -> `23514`).
  2. Two simultaneous updates using the same expected version (competing update rejected with `23514`).
  3. Stale update after a successful write (rejected with `23514`).
  4. Cross-user vault access prevention (blocked with `42501 Unauthorized`).
  5. Cross-vault account mutation prevention (blocked with `42501 Unauthorized`).
  6. Attempts to bypass soft deletion / tombstone resurrection (rejected with `23514`).
  7. Unauthorized RPC execution without authentication (blocked with `42501`).
- Tests tombstone soft-deletion propagation.
- Tests device revocation.
- Tests cross-tenant RLS isolation (User B receives 0 rows when querying User A data).

### 6.2 Offline Queue Durability & Crash Recovery Suite
Executed by `npm --prefix frontend test -- tests/services/queueCrashRecovery.test.ts`:
- Tests atomic Write-Ahead Journaling (`nyx_mutation_queue_v1.journal`) state machine transitions with mutex serialization (`runExclusive`).
- Tests journal schema versioning (`schemaVersion: 1`) and Keystore-keyed HMAC-SHA256 authentication (`nyx_queue_hmac_key_v1`).
- Tests HMAC tamper resistance: tampering with journal payload, checksum, or schema version immediately causes verification failure and triggers corrupted archive creation.
- Tests safe backup rotation: verifies existing primary journal validity prior to rotating to `.bak`, ensuring corrupted primary journals never destroy valid backups.
- Tests corrupted journal archiving (`nyx_mutation_queue_v1.journal.corrupted.<timestamp>`) when both primary and backup files are invalid.
- Tests concurrent mutation serialization ensuring zero lost writes under heavy concurrent enqueues.
- Tests folding intermediate un-sent edits for the same account to prevent queue bloat.
- Tests tombstone preservation across restarts and offline cycles.
- Tests recovery of mutations interrupted in `PROCESSING` state by application termination.
- Tests acknowledgement of mutations where remote server write succeeded before local crash.
- Tests bounded exponential backoff with randomized jitter on transient network errors.
- Tests immediate non-retryable transition to `PERMANENTLY_FAILED` on authorization errors (e.g. `42501`).

### 6.3 Master Vault Key Rotation & Confidentiality Suite
Executed by `npm --prefix frontend test -- tests/services/keyRotation.test.ts`:
- Tests pre-flight decryption check: aborts rotation without side effects if active key cannot decrypt local accounts.
- Tests generation of fresh 256-bit symmetric vault key ($K_v'$).
- Tests manifest key confidentiality: asserts that neither $K_v$ nor $K_v'$ is ever written to disk in plaintext (`nyx_rotation_manifest_v2.json` contains only AES-256-GCM ciphertext wrapped under $K_v$).
- Tests Keystore staging lifecycle: verifies $K_v'$ is stored in `nyx_staging_vault_key_v1` and promoted to `nyx_vault_key_v1` only upon completion.
- Tests atomic cloud rotation: verifies `sync_rotate_vault` updates the envelope and accounts atomically.
- Tests atomic rotation rollback: verifies that if `sync_rotate_vault` fails or network drops, local storage remains on $K_v$, the Keystore staging key is cleared, and the manifest is deleted.
- Tests crash recovery (`recoverInterruptedRotation`):
  - Recovers and commits $K_v'$ if app crashes after cloud commit.
  - Recovers $K_v'$ even if Keystore staging was wiped, using the wrapped ciphertext in the manifest.
  - Discards manifest safely keeping $K_v$ active if app crashes during `PREPARED`.
- Tests unwrap verification with both passphrase and recovery code.
- Verifies that old key $K_v$ can no longer decrypt newly re-encrypted records.

### 6.4 Maestro Android UI Automation Suite
Located in `frontend/maestro/`:
- `01-auth-flow.yaml`: Account creation, login, session persistence, and logout.
- `02-vault-lifecycle.yaml`: Master passphrase setup, 24-word recovery code confirmation, manual locking, and vault unlock.
- `03-authenticator-flow.yaml`: Manual account entry, malformed Base32 secret validation, live 6-digit TOTP calculation, 30s clipboard auto-purge, and account deletion.
- `04-synchronization-flow.yaml`: Manual sync pill tap, background sync polling, and enrolled device inspection.
- `05-recovery-flow.yaml`: Secondary device enrollment via Master Passphrase or 24-Word Recovery Code, with rejection of invalid mnemonics.

---

## 7. Execution Commands

### Run Full Test Suite (Frontend + Backend)
```bash
npm --prefix frontend test && npm --prefix backend test
```

### Run Frontend Unit & Vector Tests
```bash
cd frontend
npm test
```

### Run Vector Tests Exclusively
```bash
cd frontend
npm test -- tests/core/totp/rfc6238.test.ts
```

### Run Backend RLS & Concurrency Tests
```bash
cd backend
npm test
```

### Type Checking
```bash
npm --prefix frontend run typecheck
```
