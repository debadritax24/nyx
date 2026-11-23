# NYX Project Roadmap & Milestones

---

## Phase 0: Repository Foundation [COMPLETED]
- [x] Establish strict two-folder root repository hierarchy (`frontend/` and `backend/`).
- [x] Configure canonical root `.env` template and exclusions in `.gitignore`.
- [x] Establish developer tooling configs (`.editorconfig`, `.prettierrc`, `.prettierignore`, `.gitmessage`).
- [x] Author comprehensive core documentation suite.

---

## Phase 1: Expo & Backend Foundation [COMPLETED]
- [x] Author PostgreSQL initial migration with strict RLS for `profiles`, `vaults`, `authenticator_accounts`, and `devices`.
- [x] Apply forward-only migration `20261123000001_harden_rls_policies.sql` to prevent cross-tenant vault injection.
- [x] Initialize Expo React Native Android project inside `frontend/` with strict TypeScript.
- [x] Establish design tokens, typography, and reusable UI components.
- [x] Implement Supabase client wrapper and session state management (Zustand).
- [x] Implement Auth screens: Sign Up, Sign In, Password Reset, and Session Restoration.
- [x] Author and verify backend RLS test suites.

---

## Phase 2: Offline TOTP Engine [COMPLETED]
- [x] Implement RFC 6238-compliant TOTP generation algorithm supporting SHA-1, SHA-256, and SHA-512.
- [x] Implement Base32 decoder and validator.
- [x] Implement `otpauth://` URI parser for QR code and manual input.
- [x] Verify unit test suite against official RFC 6238 test vectors (Appendix B) including leading zero preservation and boundary transitions.

---

## Phase 3: Local Vault Security & Keystore Integration [COMPLETED]
- [x] Implement CSPRNG 256-bit Vault Key generation on client.
- [x] Implement AES-256-GCM envelope encryption and decryption with 96-bit random nonces and AAD binding.
- [x] Implement `LocalVaultStorage` encrypted file persistence using AES-256-GCM.
- [x] Integrate Android Keystore via `expo-secure-store` and biometric authentication via `expo-local-authentication`.
- [x] Implement automated auto-lock timers on app backgrounding and `FLAG_SECURE` screen privacy via `expo-screen-capture`.
- [x] Implement explicit memory wiping (`zeroMemory`) for cryptographic keys upon lock.

---

## Phase 4: Recovery Architecture [COMPLETED]
- [x] Implement RFC 9106 Argon2id key derivation using WebAssembly (`hash-wasm`).
- [x] Implement 24-word emergency recovery code generation, validation, and key derivation.
- [x] Implement dual independent key wrapping for Vault Key ($K_v$) via passphrase and recovery code.
- [x] Build vault initialization modal and recovery code display.

---

## Phase 5: Cloud Synchronization & Conflict Resolution [COMPLETED]
- [x] Author database migration `20261123000002_devices_last_active.sql` with device metadata and optimistic concurrency triggers.
- [x] Build bidirectional `SyncService` with AES-256-GCM client encryption and AAD binding (`nyx-account:<uuid>:v1`).
- [x] Implement deterministic conflict reconciliation engine preserving forked copies (`(Conflicted Copy)`) to prevent data loss.
- [x] Implement tombstone deletion propagation preventing resurrection of deleted accounts.
- [x] Implement secondary device enrollment via Master Passphrase or 24-Word Recovery Code.
- [x] Implement Enrolled Devices management screen with revocation capabilities (`app/(app)/devices.tsx`).
- [x] Implement live sync status pill on home screen and tap-to-sync triggers.
- [x] Author comprehensive multi-device synchronization test suite (`syncService.test.ts`).

---

## Phase 6: Hardening & Production Readiness [COMPLETED]
- [x] Complete security re-audit of Phase 5 synchronization and cryptographic bounds.
- [x] Implement atomic Compare-And-Swap (CAS) stored procedure `sync_push_account` with `FOR UPDATE` row locking.
- [x] Resolve Delete-vs-Update conflicts with zero data loss preservation (`(Restored from Deleted Copy)`).
- [x] Enforce forked account cryptographic identity invariance (fresh UUID, fresh nonce, and updated AAD).
- [x] Document device revocation boundaries and formal Vault Key Rotation protocol.
- [x] Execute 10-suite live Supabase integration and concurrency tests against live cloud endpoint.
- [x] Author comprehensive Maestro Android UI automation flows (Auth, Vault, Authenticator, Sync, Recovery).
- [x] Audit accessibility: minimum 48dp touch targets, screen-reader labels, roles, contrast.
- [x] Harden Android security: clipboard auto-purge after 30s, blocked `RECORD_AUDIO` permission.
- [x] Profile performance: 500-account TOTP throughput, AES-256-GCM vault scaling, 64MB Argon2id memory profile.
- [x] Configure EAS build profiles (`development`, `preview` APK, and `production` AAB).

---

## Phase 7: Android Device Validation & Crash-Safe Sync [COMPLETED]
- [x] Hardened database stored procedure `sync_push_account` with `unique_violation` trapping (Migration 20261123000004).
- [x] Eliminated missing-row concurrent creation race conditions with deterministic `23514` CAS error handling.
- [x] Built crash-safe offline mutation queue `PersistentMutationQueue` with Write-Ahead Journaling (WAL) and 5-stage state machine.
- [x] Implemented startup crash recovery routine `recoverInterruptedMutations` with remote write status verification.
- [x] Implemented bounded exponential backoff with randomized jitter and non-retryable failure categorization.
- [x] Implemented `VaultService.rotateVaultKey` supporting atomic local re-encryption and remote envelope rotation.
- [x] Added 7-point database concurrency and security test matrix in `rls.test.js` and `live_integration.test.js`.
- [x] Added automated crash simulation tests (`queueCrashRecovery.test.ts`) and key rotation tests (`keyRotation.test.ts`).
- [x] Transparently documented physical hardware verification limitations (`NOT TESTED`) and EAS cloud credential scope.

---

## Phase 8: Controlled Beta & Field Validation [ROADMAP]
- [ ] Connect physical Android test devices via ADB to execute Maestro automated flows.
- [ ] Test hardware TEE / StrongBox Keystore key invalidation upon new biometric enrollment.
- [ ] Supabase Realtime channel subscription for instant multi-device change notifications.
- [ ] Automated encrypted cloud backup exports to Google Drive / WebDAV.
- [ ] Google Play Store and F-Droid automated deployment pipeline via GitHub Actions.
