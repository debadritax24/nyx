# NYX Engineering Memory

## 1. Project Overview & Current Phase
- **Project:** NYX Authenticator (Android-first offline, client-side encrypted TOTP vault)
- **Active Development Phase:** Hermes Engine Compatibility & Unified Root Architecture Completed.
- **Current Milestone:** Unified single-root Expo + Supabase layout, ratcheted SHA-512 CSPRNG entropy pool and native `expo-crypto` integration, pure JavaScript RFC 9106 Argon2id execution via `@noble/hashes` on Hermes engine (zero fallback invariant strictly preserved), 12 passing Jest test suites (96 tests), 8 backend security assertion suites, and 10 live Supabase cloud integration tests.

---

## 2. Independent Repository Audit Findings & Remediations
An independent audit was conducted across cryptography, database RLS, and frontend state management:

1. **[SEC-001 - High] Silent PBKDF2 Fallback instead of Argon2id:**
   - *Finding:* `kdf.ts` previously caught WebAssembly errors and silently switched to PBKDF2 while claiming Argon2id compatibility.
   - *Remediation:* Removed the silent PBKDF2 fallback. `deriveKeyArgon2id` strictly enforces RFC 9106 Argon2id: using WebAssembly acceleration via `hash-wasm` when WebAssembly is supported, and pure JavaScript RFC 9106 Argon2id via `@noble/hashes/argon2.js` in non-WebAssembly runtimes (Hermes engine). Cryptographic fallback to weaker algorithms remains strictly prohibited.
2. **[SEC-002 - Critical] Unpersisted Account Records (Memory-Only Zustand State):**
   - *Finding:* Accounts existed solely in JavaScript heap. App termination resulted in complete data loss.
   - *Remediation:* Implemented `LocalVaultStorage` using AES-256-GCM authenticated encryption under the Master Vault Key ($K_v$) with atomic file writes to application-isolated sandbox storage.
3. **[SEC-003 - High] Missing Associated Authenticated Data (AAD) Binding:**
   - *Finding:* Ciphertext could theoretically be substituted across accounts without validation.
   - *Remediation:* Enforced structured AAD (`nyx-account:<id>:v1` and `nyx-local-vault-storage:v1`) across all encryption and decryption operations.
4. **[SEC-004 - Medium] Placeholder Camera QR Scanner:**
   - *Finding:* `scan.tsx` previously rendered a placeholder mock view.
   - *Remediation:* Implemented production `CameraView` from `expo-camera` with dynamic permission requesting, framing crosshairs, and immediate URI parsing.
5. **[SEC-005 - Medium] Cross-Tenant Vault Ownership Gap in RLS Policy:**
   - *Finding:* `authenticator_accounts` `INSERT` policy checked `auth.uid() = user_id` but did not verify that `vault_id` belonged to `auth.uid()`.
   - *Remediation:* Authored forward migration `20261123000001_harden_rls_policies.sql` enforcing `EXISTS (SELECT 1 FROM vaults v WHERE v.id = authenticator_accounts.vault_id AND v.user_id = auth.uid())`.
6. **[SEC-006 - Medium] Missing 24-Word Recovery Code Generator:**
   - *Finding:* Recovery code derivation was documented but lacked a secure BIP-39 mnemonic generator.
   - *Remediation:* Implemented `generateRecoveryCode()` with 256 bits of entropy and wordlist validation in `recovery.ts`.
7. **[SEC-007 - Low] Lack of Screen Security & Background Blur:**
   - *Finding:* Sensitive OTP screens could be captured in Android recents switcher.
   - *Remediation:* Integrated `expo-screen-capture` (`preventScreenCaptureAsync()`) and AppState auto-lock listeners in `app/_layout.tsx`.
8. **[SEC-008 - High] Android Keystore Hardware Biometric Protection Nuance:**
   - *Finding:* `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` is an iOS-only keychain flag. On Android, `expo-secure-store` encrypts data with Keystore-backed AES keys in SharedPreferences.
   - *Remediation:* Gated Vault Key retrieval behind explicit biometric authentication challenges (`LocalAuthentication.authenticateAsync`) via `keystore.ts`.
9. **[SEC-009 - High] Stale Overwrite Vulnerability in Optimistic Concurrency:**
   - *Finding:* `check_optimistic_concurrency()` trigger checked `NEW.version > OLD.version` without verifying that the client's expected base version matched the current database version, allowing concurrent stale overwrites.
   - *Remediation:* Authored migration `20261123000003_atomic_cas_concurrency.sql` implementing atomic Compare-And-Swap (CAS) stored procedure `sync_push_account` with `FOR UPDATE` row locking. Rejects stale writes with SQLSTATE `23514`.
10. **[SEC-010 - High] Silent Data Loss on Delete-Versus-Update Conflicts:**
    - *Finding:* When Device A deleted an account while Device B edited it offline, incoming tombstones purged Device B's local modifications silently.
    - *Remediation:* Implemented deterministic data preservation: canonical ID is purged to honor tombstone, but offline modifications are automatically restored as a separate account `(Restored from Deleted Copy)` with a fresh UUID and new AAD.
11. **[SEC-011 - High] Device Revocation Misconception:**
    - *Finding:* Deleting records from `devices` table cuts off cloud sync queries, but cannot cryptographically erase an extracted Vault Key from hardware in an adversary's physical possession.
    - *Remediation:* Accurately documented device revocation boundaries and designed a formal Vault Key Rotation ($K_v \to K_v'$) protocol in `SECURITY.md` and `architecture.md`.
12. **[SEC-012 - Medium] Sensitive Clipboard Leaks & Unnecessary Audio Permission:**
    - *Finding:* Copied OTP codes remained on system clipboard indefinitely; `expo-camera` plugin injected `RECORD_AUDIO` permission.
    - *Remediation:* Configured automatic clipboard auto-purging after 30 seconds; explicitly blocked `android.permission.RECORD_AUDIO` in `app.json`.
13. **[SEC-013 - High] Concurrent Queue Race Conditions & Lost Mutations:**
    - *Finding:* Asynchronous operations against the offline mutation journal (`nyx_mutation_queue_v1.journal`) could interleave read-modify-write sequences without mutual exclusion, resulting in lost mutations during rapid concurrent enqueues or status transitions.
    - *Remediation:* Implemented an internal async serialization mutex (`runExclusive`) in `PersistentMutationQueue`, serializing all journal modifications. Verified by concurrency stress tests.
14. **[SEC-014 - High] Queue Journal Truncation & Silent Loss on Parse Errors:**
    - *Finding:* The queue journal previously lacked integrity checksums; parsing failures silently caught exceptions and defaulted to empty arrays, causing unrecoverable data loss upon partial disk writes.
    - *Remediation:* Implemented `QueueJournalEnvelope` (`schemaVersion: 1`, SHA-256 `checksum`, `updatedAt`), automated backup journal rotation (`nyx_mutation_queue_v1.journal.bak`), automatic recovery repairing primary journals from backup, and archiving corrupted journals to `nyx_mutation_queue_v1.journal.corrupted.<timestamp>`.
15. **[SEC-015 - Critical] Non-Atomic Vault Key Rotation Lockout Risk:**
    - *Finding:* In Phase 7, if the application crashed after pushing re-encrypted accounts to Supabase but before updating the local Keystore with $K_v'$, the user was permanently locked out: local Keystore possessed $K_v$ while cloud held accounts encrypted under $K_v'$.
    - *Remediation:* Replaced single-step rotation with a two-phase protocol tracked via an on-disk manifest (`nyx_rotation_manifest_v1.json`) with stages `PREPARED`, `CLOUD_COMMITTED`, and `COMPLETED`. Implemented pre-flight decryption verification and startup recovery (`recoverInterruptedRotation`), guaranteeing that if an app crashes post-cloud-commit, $K_v'$ is recovered and committed locally on next boot.
16. **[SEC-016 - Medium] EAS Project ID Authorization Collision:**
    - *Finding:* EAS project ID `0a58fd2d-3c2f-485d-8dd9-44b3ebc38a11` returns 403 Forbidden for the active developer account `tushardevx01` (`thetushardev0@gmail.com`).
    - *Remediation:* Documented EAS entity authorization status and runbook in `DEVELOPMENT.md`. Retained project ID per repository invariants without unauthorized overwriting.
17. **[SEC-017 - Critical] Partial Cloud Commit Vulnerability in Key Rotation:**
    - *Finding:* Pushing re-encrypted accounts in a client-side loop allowed intermediate network errors or process termination to leave some accounts in Supabase encrypted under $K_v'$ and others under $K_v$, while discarding the manifest reverted the client to $K_v$.
    - *Remediation:* Authored and deployed migration `20261123000005_atomic_vault_rotation.sql` implementing `sync_rotate_vault`, which atomically migrates the vault envelope and all re-encrypted accounts in a single PostgreSQL transaction with `FOR UPDATE` row locking. Eliminates partial cloud-commit states entirely.
18. **[SEC-018 - Critical] Staged Vault Key Plaintext Exposure in Manifest:**
    - *Finding:* `newVaultKeyBase64` was previously stored in plaintext JSON in `nyx_rotation_manifest_v1.json` on application storage.
    - *Remediation:* Eliminated plaintext keys from disk. Staged keys are now stored in hardware-backed Android Keystore (`nyx_staging_vault_key_v1`) and encrypted under `oldVaultKey` in `nyx_rotation_manifest_v2.json`.
19. **[SEC-019 - High] Lack of Cryptographic Integrity in Mutation Queue:**
    - *Finding:* Simple DJB2 string checksums provided no cryptographic integrity or tamper resistance against sandbox filesystem modification.
    - *Remediation:* Implemented device-bound Keystore-keyed HMAC-SHA256 (`getQueueHmacKey`) integrity authentication in `QueueJournalEnvelope`.
20. **[SEC-020 - High] Unprotected Backup Journal Overwrite:**
    - *Finding:* Corrupted primary journal files could potentially overwrite valid `.bak` backup files during rotation.
    - *Remediation:* Added validation check ensuring the primary journal is confirmed valid before rotating to backup.
21. **[SEC-021 - Medium] Android Auto Backup Enabled Without Keystore Restoration:**
    - *Finding:* Default `allowBackup` could cause Android Auto Backup to upload encrypted files to Google Drive without hardware-backed Keystore keys.
    - *Remediation:* Explicitly set `android.allowBackup: false` in `app.json`.

---

## 3. Important Architectural Decisions
- **Zero Plaintext Storage:** Plaintext secrets are never persisted to disk. All local credentials reside in AES-256-GCM ciphertext files decrypted only in memory when the Vault Key is loaded.
- **Immediate Memory Zeroing:** Implemented `zeroMemory(buffer)` to wipe decrypted cryptographic keys from memory upon vault locking.
- **Dual Independent Wrapping:** Vault Key ($K_v$) is wrapped independently by:
  1. User Master Passphrase via Argon2id.
  2. 24-word emergency recovery code via Argon2id.
- **Real-Time Auto-Locking:** App transitions to `background` or `inactive` automatically wipe RAM keys and lock the vault.

---

## 4. Current Repository Structure
```text
nyx/
├── app/                  # Expo Router filesystem routing (auth and app stacks)
├── src/
│   ├── components/       # UI primitives (Button, Input, CountdownCircle, TotpCard)
│   ├── core/
│   │   ├── crypto/       # AES-256-GCM, Argon2id KDF (@noble/hashes + hash-wasm), recovery, storage, keystore
│   │   └── totp/         # RFC 6238 engine, Base32 parser, URI validator
│   ├── services/         # Supabase auth, vault, queue, and sync services
│   └── store/            # Zustand state stores (auth, vault, sync)
├── assets/               # App icons and splash screen
├── maestro/              # Declarative E2E mobile test flows
├── supabase/             # Supabase database infrastructure
│   ├── migrations/       # Migrations 0–5 (RLS, CAS concurrency, atomic rotation)
│   ├── tests/            # pgTAP RLS test suite
│   └── config.toml
├── scripts/              # Schema verification scripts
├── tests/                # 12 Jest test suites (95 tests passing) and database security assertions
├── package.json          # Root unified npm configuration
├── tsconfig.json         # Strict TypeScript configuration
└── [Documentation Files]
```

---

## 5. Test Suite Verification Summary
- **Frontend Test Suite:** 12 test suites, 96 tests passing (0 failures).
  - `tests/core/totp/rfc6238.test.ts`: Official RFC 6238 vectors (SHA1, SHA256, SHA512), 6-digit & 8-digit codes, leading zeros.
  - `tests/core/totp/base32.test.ts`: Strict RFC 4648 Base32 validation and decoding.
  - `tests/core/totp/uri.test.ts`: Parsing and canonical serialization of `otpauth://` URIs.
  - `tests/core/crypto/vault.test.ts`: AES-256-GCM roundtrip, tampered ciphertext, tampered nonce, tampered AAD, nonce uniqueness, and non-WebCrypto offline SHA-512 ratcheted CSPRNG entropy pool validation.
  - `tests/core/crypto/kdf.test.ts`: Strict Argon2id WebAssembly derivation, non-WASM Hermes engine fallback to pure JS `@noble/hashes/argon2` with bit-for-bit parity, explicit fatal error throwing, passphrase wrapping.
  - `tests/core/crypto/recovery.test.ts`: 24-word recovery code generation, validation, and key wrapping.
  - `tests/core/crypto/storage.test.ts`: Encrypted local persistence, corruption handling, and atomic writes.
  - `tests/services/syncService.test.ts`: AES-256-GCM cloud encryption, AAD validation, deterministic conflict reconciliation (preserving forked copies), tombstone anti-resurrection, delete-vs-update zero data loss, and multi-device bidirectional synchronization simulation.
  - `tests/services/deviceService.test.ts`: Persistent UUID generation and device label management.
  - `tests/services/queueCrashRecovery.test.ts`: Crash-safe persistent queue, 5-stage state machine, process crash recovery during active upload, remote write status reconciliation, bounded exponential backoff with jitter, async mutex serialization (`runExclusive`), journal schema versioning with Keystore-keyed HMAC-SHA256 authentication, safe backup journal (`.bak`) recovery, and corrupted journal archiving.
  - `tests/services/keyRotation.test.ts`: Master Vault Key Rotation ($K_v \to K_v'$), pre-flight decryption verification, staged key confidentiality (zero plaintext keys on disk, Keystore staging slot and AES-GCM wrapping), atomic PostgreSQL transaction procedure (`sync_rotate_vault`), on-disk rotation manifest lifecycle (`PREPARED` -> `COMMITTED`), startup crash recovery (`recoverInterruptedRotation`), and local Keystore re-binding.
  - `tests/performance.test.ts`: 100 & 500 account TOTP calculation latency (< 0.25ms/code), 500-account vault encryption/decryption scaling, 64MB Argon2id profiling, and reconciler scalability.
- **Backend Test Suite:** 8 security assertion suites passing.
  - RLS unconditionally enabled and forced across `profiles`, `vaults`, `authenticator_accounts`, and `devices`.
  - Authenticated policies for SELECT, INSERT, UPDATE, DELETE.
  - Cross-tenant vault ownership validation (`auth.uid() = vault.user_id`).
  - Optimistic concurrency monotonic version enforcement trigger (`check_optimistic_concurrency`).
  - Device metadata tracking (`last_active_at`, `device_label`).
  - Atomic Compare-And-Swap (CAS) stored procedure definition with `FOR UPDATE` locking and `unique_violation` insertion race handlers (Migration `20261123000004_safe_concurrent_cas.sql`).
  - CAS concurrency simulator verified: exact version matches required, race conditions eliminated, soft-delete resurrection blocked.
  - Atomic vault rotation procedure `sync_rotate_vault` defined with transactional account & envelope update (Migration `20261123000005_atomic_vault_rotation.sql`).
- **Live Supabase Cloud Integration Suite:** 10 suites passing against live endpoint `https://ardomiwuahiottpkotmv.supabase.co`.
  - Pre-confirmed test identity registration and authentic JWT session establishment.
  - Argon2id wrapped vault record creation with RLS.
  - Device registration and device label audit.
  - Client-side AES-256-GCM encrypted account upload with CAS.
  - Zero-knowledge database verification (zero plaintext metadata stored on Supabase).
  - 10-Point CAS, Database Security & Atomic Rotation Test Matrix:
    1. Simultaneous inserts with same UUID (handled via `unique_violation` trapping -> `23514`).
    2. Simultaneous updates with same expected version (rejected with `23514`).
    3. Stale update after successful write (rejected with `23514`).
    4. Cross-user vault access blocked with `42501 Unauthorized`.
    5. Cross-vault account mutation blocked with `42501 Unauthorized`.
    6. Atomic vault rotation procedure `sync_rotate_vault` verified (migrated envelope and accounts in a single transaction).
    7. Concurrency conflict on stale rotation batch rejected with `23514`.
    8. Cross-user authorization guard on rotation blocked with `42501 Unauthorized`.
    9. Guard against accidental tombstone resurrection (rejected with `23514`).
    10. Unauthenticated RPC execution blocked with `42501`.
  - Tombstone soft-deletion propagation at Version 3.
  - Device revocation (device removed from registry).
  - Cross-tenant RLS policy isolation (User B completely barred from User A data).
  - Automatic test artifact cleanup and teardown.

---

## 6. Known Limitations & Production Notes
- **Hardware-Backed Keystore on Physical Devices:** In the automated sandbox environment, no physical Android device was connected (`adb devices` returned 0 devices). While Expo SecureStore uses Android Keystore on Android devices, hardware TEE/StrongBox enforcement (`KeyProperties.SECURITY_LEVEL_STRONGBOX`) and hardware key invalidation upon new biometric enrollment are marked `NOT TESTED` on physical hardware and require field testing on a physical device.
- **EAS Cloud Build Access:** The local EAS session is logged in as `tushardevx01`, which is not authorized for remote cloud builds under the existing project entity `0a58fd2d-3c2f-485d-8dd9-44b3ebc38a11`. Local prebuild succeeds, but remote EAS cloud preview build is marked `NOT TESTED (UNAUTHORIZED EAS PROJECT CREDENTIAL)`.
- **Memory Zeroization Reality:** `Uint8Array` buffers are zeroized upon vault lock, but immutable JavaScript strings remain governed by V8 garbage collection.

---

## 7. Release Status
- **NYX Version 1.0.0 (Release Candidate):** CONDITIONALLY READY. Architecture, cryptography, zero-knowledge invariants, atomic CAS concurrency, offline queue durability, and cloud integration tests are fully verified. Field validation on physical hardware is required before general public release.
