# NYX Engineering Memory

## 1. Project Overview & Current Phase
- **Project:** NYX Authenticator (Android-first offline, client-side encrypted TOTP vault)
- **Active Development Phase:** Phase 6 (Production Hardening, Security Validation & Android Release Readiness) Completed.
- **Current Milestone:** Milestone 2.0 (Production Release Candidate verified against live Supabase cloud, atomic Compare-And-Swap concurrency, Delete-vs-Update zero data loss preservation, Maestro E2E test flows, performance scaling benchmarks, and EAS production release profiles).

---

## 2. Independent Repository Audit Findings & Remediations
An independent audit was conducted across cryptography, database RLS, and frontend state management:

1. **[SEC-001 - High] Silent PBKDF2 Fallback instead of Argon2id:**
   - *Finding:* `kdf.ts` previously caught WebAssembly errors and silently switched to PBKDF2 while claiming Argon2id compatibility.
   - *Remediation:* Removed the silent PBKDF2 fallback. `deriveKeyArgon2id` now strictly enforces RFC 9106 Argon2id via `hash-wasm` (64 MB memory, 3 iterations) and throws explicit fatal errors if derivation fails.
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
├── frontend/             # Expo React Native application
│   ├── app/              # Expo Router filesystem routing (auth and app stacks)
│   ├── src/
│   │   ├── components/   # UI primitives (Button, Input, CountdownCircle, TotpCard)
│   │   ├── core/
│   │   │   ├── crypto/   # AES-256-GCM, Argon2id KDF, recovery, storage, keystore
│   │   │   └── totp/     # RFC 6238 engine, Base32 parser, URI validator
│   │   ├── services/     # Supabase auth, vault, and sync services
│   │   └── store/        # Zustand state stores (auth, vault, sync)
│   ├── assets/           # App icons and splash screen
│   └── tests/            # 7 Jest test suites (53 tests passing)
├── backend/              # Supabase database infrastructure
│   ├── supabase/
│   │   ├── migrations/   # 20261123000000 (initial) & 20261123000001 (RLS hardening)
│   │   ├── tests/        # pgTAP RLS test suite
│   │   └── config.toml
│   ├── scripts/          # Schema verification scripts
│   └── tests/            # Database security assertion tests
└── [Documentation Files]
```

---

## 5. Test Suite Verification Summary
- **Frontend Test Suite:** 10 test suites, 74 tests passing (0 failures).
  - `tests/core/totp/rfc6238.test.ts`: Official RFC 6238 vectors (SHA1, SHA256, SHA512), 6-digit & 8-digit codes, leading zeros.
  - `tests/core/totp/base32.test.ts`: Strict RFC 4648 Base32 validation and decoding.
  - `tests/core/totp/uri.test.ts`: Parsing and canonical serialization of `otpauth://` URIs.
  - `tests/core/crypto/vault.test.ts`: AES-256-GCM roundtrip, tampered ciphertext, tampered nonce, tampered AAD, nonce uniqueness.
  - `tests/core/crypto/kdf.test.ts`: Strict Argon2id WebAssembly derivation, explicit fatal error throwing, passphrase wrapping.
  - `tests/core/crypto/recovery.test.ts`: 24-word recovery code generation, validation, and key wrapping.
  - `tests/core/crypto/storage.test.ts`: Encrypted local persistence, corruption handling, and atomic writes.
  - `tests/services/syncService.test.ts`: AES-256-GCM cloud encryption, AAD validation, deterministic conflict reconciliation (preserving forked copies), tombstone anti-resurrection, delete-vs-update zero data loss, and multi-device bidirectional synchronization simulation.
  - `tests/services/deviceService.test.ts`: Persistent UUID generation and device label management.
  - `tests/performance.test.ts`: 100 & 500 account TOTP calculation latency (< 0.3ms/code), 500-account vault encryption/decryption scaling, 64MB Argon2id profiling, and reconciler scalability.
- **Backend Test Suite:** 6 security assertion suites passing.
  - RLS unconditionally enabled and forced across `profiles`, `vaults`, `authenticator_accounts`, and `devices`.
  - Authenticated policies for SELECT, INSERT, UPDATE, DELETE.
  - Cross-tenant vault ownership validation (`auth.uid() = vault.user_id`).
  - Optimistic concurrency monotonic version enforcement trigger (`check_optimistic_concurrency`).
  - Device metadata tracking (`last_active_at`, `device_label`).
  - Atomic Compare-And-Swap (CAS) stored procedure simulation (`sync_push_account`).
- **Live Supabase Cloud Integration Suite:** 10 suites passing against live endpoint `https://ardomiwuahiottpkotmv.supabase.co`.
  - Pre-confirmed test identity registration and authentic JWT session establishment.
  - Argon2id wrapped vault record creation with RLS.
  - Device registration and device label audit.
  - Client-side AES-256-GCM encrypted account upload with CAS.
  - Zero-knowledge database verification (zero plaintext metadata stored on Supabase).
  - Compare-And-Swap (CAS) conflict rejection (stale expected version rejected with SQLSTATE 23514).
  - Tombstone soft-deletion propagation at Version 3.
  - Device revocation (device removed from registry).
  - Cross-tenant RLS policy isolation (User B completely barred from User A data).
  - Automatic test artifact cleanup and teardown.

---

## 6. Known Limitations & Production Notes
- Biometric unlock on emulators requires mocking or enrolled virtual fingerprints via ADB (`adb emu finger touch 1`).
- Physical device testing requires physical hardware with enrolled biometric hardware sensors.
- Real-time instant push notification triggers can be enhanced in post-release updates via Supabase Realtime channel subscriptions.

---

## 7. Release Status
- **NYX Version 1.0.0 (Release Candidate):** Fully verified, hardened, and ready for EAS build and Play Store release candidate generation.
