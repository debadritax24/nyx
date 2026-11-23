# NYX Changelog

All notable changes to the NYX project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Android Device Validation, Crash-Safe Sync & Release Candidate Audit (Phase 7)
- **Safe Concurrent CAS & Race Mitigation (Migration 4):** Authored and applied `20261123000004_safe_concurrent_cas.sql` to live Supabase. Hardened `sync_push_account` with sub-transaction `unique_violation` error trapping and row re-locking, converting missing-row concurrent creation races into catchable `23514` CAS concurrency conflicts.
- **Cross-Vault & Tombstone Resurrection Guards:** Added database guards in `sync_push_account` preventing unauthorized cross-vault account mutations and accidental resurrection of soft-deleted tombstones.
- **Crash-Safe Persistent Mutation Queue (WAL):** Engineered `PersistentMutationQueue` in `queueService.ts` utilizing atomic Write-Ahead Journaling (`nyx_mutation_queue_v1.journal`) via atomic temporary write and rename. Features a 5-stage state machine (`ENQUEUED`, `PROCESSING`, `ACKNOWLEDGED`, `RETRYING`, `PERMANENTLY_FAILED`).
- **Interruption Recovery on Startup:** Implemented `recoverInterruptedMutations` routine that queries the server on app startup to verify if mutations stuck in `PROCESSING` were committed before a process termination, acknowledging committed writes and resetting uncommitted writes to `ENQUEUED` for safe idempotent retry.
- **Bounded Exponential Backoff with Jitter:** Implemented jittered backoff ($500\text{ ms} \times 2^{\text{retry}} + \text{jitter}$, capped at 30s) and immediate permanent failure classification for non-retryable authorization errors (e.g. `42501`).
- **Vault Key Rotation ($K_v \to K_v'$):** Implemented `VaultService.rotateVaultKey` executing full local re-encryption, fresh salt/nonce generation, Argon2id re-wrapping for passphrase and recovery code, and transactional cloud update via atomic CAS.
- **Comprehensive Database Security Test Matrix:** Expanded `live_integration.test.js` and `rls.test.js` to verify all 7 requested concurrency and security cases against live Supabase.
- **Expanded Test Suite:** Added `queueCrashRecovery.test.ts` and `keyRotation.test.ts`, expanding the test suite to 12 passing test suites (82 unit/vector/crash/performance tests) and 7 backend security assertion suites.

### Production Hardening & Release Readiness (Phase 6)
- **Atomic Compare-And-Swap (CAS) Concurrency:** Implemented `sync_push_account` stored procedure via migration `20261123000003_atomic_cas_concurrency.sql` with `FOR UPDATE` row locking, eliminating stale overwrite race conditions.
- **Delete-vs-Update Conflict Resolution (Zero Data Loss):** Upgraded `reconcileAccounts` to preserve local offline modifications as `(Restored from Deleted Copy)` when encountering a remote tombstone, while purging the deleted canonical ID to prevent resurrection.
- **Forked Account Cryptographic Identity Invariance:** Enforced that forked and restored records are re-encrypted with fresh 96-bit nonces and newly bound AAD (`nyx-account:<fresh_uuid>:v1`), strictly prohibiting ciphertext reuse across accounts.
- **Live Supabase Integration Test Suite:** Authored and verified a 10-suite live integration test in `backend/tests/live_integration.test.js` covering registration, Argon2id vault creation, CAS concurrency conflict checks, zero-knowledge verification, tombstones, and cross-tenant RLS isolation against live Supabase infrastructure.
- **Maestro Android UI Automation Suite:** Authored 5 declarative Maestro E2E test flows in `frontend/maestro/` covering Authentication, Vault Lifecycle, Authenticator CRUD & malformed key validation, Cloud Sync, and Recovery.
- **Performance Benchmarking:** Verified TOTP calculation responsiveness (< 0.25ms/code for 500 accounts), AES-256-GCM vault scaling (< 80ms for 500 accounts), and 64MB Argon2id profiling in `frontend/tests/performance.test.ts`.
- **Android Security & Privacy:** Configured clipboard auto-purging after 30 seconds for copied OTPs, enforced `FLAG_SECURE` screen privacy, and explicitly blocked `RECORD_AUDIO` permission.
- **Accessibility Hardening:** Enforced minimum 48dp touch targets, added `accessibilityRole`, `accessibilityLabel`, and `testID` attributes across all interactive components.
- **EAS Build Configuration:** Configured `eas.json` profiles for `development`, `preview` (APK), and `production` (AAB) with environment-separated release settings.

### Cloud Synchronization & Multi-Device Concurrency (Phase 5)
- **Bidirectional Cloud Sync Engine:** Implemented `SyncService` with client-side AES-256-GCM encryption, strict AAD verification, and background mutation queuing in `syncStore`.
- **Deterministic Conflict Reconciliation:** Engineered a deterministic conflict reconciler that fast-forwards clean updates and forks concurrent conflicting edits into `(Conflicted Copy)` records, guaranteeing zero data loss.
- **Tombstone Anti-Resurrection:** Added soft deletion propagation (`deleted_at`), ensuring deleted records cleanly propagate across offline devices without being resurrected.
- **Multi-Device Enrollment Protocol:** Created secondary device enrollment workflows in `vaultService.ts` and `app/(app)/enrollment.tsx` allowing secondary devices to independently unwrap $K_v$ via Passphrase or 24-word Recovery Code without key escrow.
- **Device Management & Auditing:** Added `DeviceService` and `app/(app)/devices.tsx` to list all registered hardware devices, monitor `last_active_at`, and revoke compromised devices.
- **Forward Database Migration:** Authored `20261123000002_devices_last_active.sql` adding `device_label` and `last_active_at` columns.
- **Cryptographic Strictness:** Removed silent PBKDF2 fallback in `deriveKeyArgon2id`; key derivation errors now throw explicit fatal exceptions.
- **Multi-Device Test Coverage:** Added 11 new tests across `syncService.test.ts` and `deviceService.test.ts` bringing total test coverage to 64 passing unit tests and 5 backend security assertion suites.

### Security & Cryptography
- **Argon2id Key Derivation:** Implemented RFC 9106 Argon2id derivation via `hash-wasm` with 64 MB memory cost, 3 iterations, and 32-byte key output length.
- **Local Encrypted Vault Storage:** Created `LocalVaultStorage` providing AES-256-GCM encrypted persistence of account credentials to application sandbox storage.
- **AAD Enforcement:** Bound Associated Authenticated Data (`nyx-account:<id>:v1` and `nyx-local-vault-storage:v1`) across all encryption/decryption routines to prevent ciphertext substitution.
- **Emergency Recovery Code:** Implemented `generateRecoveryCode()` producing 24-word recovery codes with 256 bits of entropy and Argon2id key wrapping.
- **Screen Privacy:** Enabled `expo-screen-capture` (`preventScreenCaptureAsync`) to set `FLAG_SECURE` on Android, blocking screenshots and obscuring app switcher thumbnails.
- **Memory Zeroing:** Added `zeroMemory()` to wipe raw Vault Keys in RAM upon vault locking.
- **Backend RLS Hardening:** Added migration `20261123000001_harden_rls_policies.sql` enforcing cross-tenant vault ownership on `authenticator_accounts` insertions and updates.

### Added
- **Production Camera QR Scanner:** Replaced placeholder view in `app/(app)/scan.tsx` with genuine `CameraView` from `expo-camera` with permissions handling and framing overlay.
- **Vault Setup & Recovery Modal:** Added interactive vault initialization dialog in `app/(app)/index.tsx` generating master passphrase and 24-word recovery code.
- **Expanded Test Suite:** Added 3 new test suites (`kdf.test.ts`, `recovery.test.ts`, `storage.test.ts`), bringing total unit test coverage to 53 passing tests.
- **Backend Security Test Suite:** Authored automated RLS policy and concurrency tests in `backend/tests/rls.test.js` and `backend/supabase/tests/20261123000000_rls_policies.test.sql`.

### Fixed
- Fixed unpersisted accounts defect where credentials were lost upon application termination.
- Fixed mock QR scanner preventing actual Android camera barcode scanning.
- Fixed cross-tenant relational integrity gap in database migration RLS policies.
