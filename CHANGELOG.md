# NYX Changelog

All notable changes to the NYX project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
