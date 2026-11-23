# NYX Engineering Memory

## 1. Project Overview & Current Phase
- **Project:** NYX Authenticator (Android-first offline, client-side encrypted TOTP vault)
- **Active Development Phase:** Phase 5 (Secure Cloud Synchronization & Multi-Device Conflict Resolution) Completed.
- **Current Milestone:** Milestone 1.5 (Full bidirectional encrypted synchronization engine, deterministic conflict reconciliation preserving forked copies, anti-resurrection tombstones, and multi-device enrollment via Passphrase or 24-word Recovery Code).

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
- **Frontend Test Suite:** 9 test suites, 64 tests passing (0 failures).
  - `tests/core/totp/rfc6238.test.ts`: Official RFC 6238 vectors (SHA1, SHA256, SHA512), 6-digit & 8-digit codes, leading zeros.
  - `tests/core/totp/base32.test.ts`: Strict RFC 4648 Base32 validation and decoding.
  - `tests/core/totp/uri.test.ts`: Parsing and canonical serialization of `otpauth://` URIs.
  - `tests/core/crypto/vault.test.ts`: AES-256-GCM roundtrip, tampered ciphertext, tampered nonce, tampered AAD, nonce uniqueness.
  - `tests/core/crypto/kdf.test.ts`: Strict Argon2id WebAssembly derivation, explicit fatal error throwing, passphrase wrapping.
  - `tests/core/crypto/recovery.test.ts`: 24-word recovery code generation, validation, and key wrapping.
  - `tests/core/crypto/storage.test.ts`: Encrypted local persistence, corruption handling, and atomic writes.
  - `tests/services/syncService.test.ts`: AES-256-GCM cloud encryption, AAD validation, deterministic conflict reconciliation (preserving forked copies), tombstone anti-resurrection, and multi-device bidirectional synchronization simulation.
  - `tests/services/deviceService.test.ts`: Persistent UUID generation and device label management.
- **Backend Test Suite:** 5 security assertion suites passing.
  - RLS unconditionally enabled and forced across `profiles`, `vaults`, `authenticator_accounts`, and `devices`.
  - Authenticated policies for SELECT, INSERT, UPDATE, DELETE.
  - Cross-tenant vault ownership validation (`auth.uid() = vault.user_id`).
  - Optimistic concurrency monotonic version enforcement trigger (`check_optimistic_concurrency`).
  - Device metadata tracking (`last_active_at`, `device_label`).

---

## 6. Known Limitations
- Biometric unlock on emulators requires mocking or enrolled virtual fingerprints via ADB (`adb emu finger touch 1`).
- Multi-device real-time sync currently relies on heartbeat polling / pull on demand and optimistic mutation flushing. Realtime Supabase websockets can be added in Phase 6.

---

## 7. Next Recommended Task
- **Phase 6 (Hardening & Production Readiness):** Maestro E2E test scripts, accessibility audit, performance benchmarking on low-end Android devices, and EAS production release profile.
