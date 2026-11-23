# NYX Project Roadmap & Milestones

---

## Phase 0: Repository Foundation [COMPLETED]
- [x] Establish strict two-folder root repository hierarchy (`frontend/` and `backend/`).
- [x] Configure canonical root `.env` template and exclusions in `.gitignore`.
- [x] Establish developer tooling configs (`.editorconfig`, `.prettierrc`, `.prettierignore`, `.gitmessage`).
- [x] Author core documentation (`README.md`, `AGENTS.md`, `architecture.md`, `memory.md`, `SECURITY.md`, `DATABASE.md`, `ENCRYPTION.md`, `API.md`, `TESTING.md`, `DEVELOPMENT.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `CHANGELOG.md`).

---

## Phase 1: Expo & Backend Foundation [IN PROGRESS]
- [x] Author PostgreSQL initial migration with strict RLS for `profiles`, `vaults`, `authenticator_accounts`, and `devices`.
- [ ] Initialize Expo React Native Android project inside `frontend/` with strict TypeScript.
- [ ] Establish design tokens, typography, and reusable UI components.
- [ ] Implement Supabase client wrapper and session state management (Zustand).
- [ ] Implement Auth screens: Sign Up, Sign In, Password Reset, and Session Restoration.
- [ ] Verify multi-tenant RLS isolation against unauthorized access.

---

## Phase 2: Offline TOTP Engine
- [ ] Implement RFC 6238-compliant TOTP generation algorithm supporting SHA-1, SHA-256, and SHA-512.
- [ ] Implement Base32 decoder and validator.
- [ ] Implement `otpauth://` URI parser for QR code and manual input.
- [ ] Build account registration screens (Expo Camera QR scanner and manual entry form).
- [ ] Build account dashboard with dynamic 30-second countdown animations and automatic foreground/background resynchronization.
- [ ] Verify unit test suite against official RFC 6238 test vectors.

---

## Phase 3: Local Vault Security & Keystore Integration
- [ ] Implement CSPRNG 256-bit Vault Key generation on client.
- [ ] Implement AES-256-GCM envelope encryption and decryption with 96-bit random nonces.
- [ ] Integrate Android Keystore via Expo SecureStore and biometric authentication.
- [ ] Implement automated auto-lock timers and app switcher privacy obscuration.

---

## Phase 4: Recovery Architecture
- [ ] Implement Argon2id key derivation for master passphrase.
- [ ] Implement 24-word emergency recovery code generation and key derivation.
- [ ] Implement dual key wrapping for Vault Key ($K_v$).
- [ ] Build new-device vault restoration workflow from cloud ciphertext.

---

## Phase 5: Cloud Synchronization & Conflict Resolution
- [ ] Implement persistent offline mutation queue.
- [ ] Implement optimistic concurrency control via version counters.
- [ ] Implement tombstone-based deletion replication.
- [ ] Implement bidirectional sync worker with retry and backoff.

---

## Phase 6: Hardening & Production Readiness
- [ ] Complete security audit and dependency vulnerability remediation.
- [ ] Execute end-to-end Maestro tests on Android emulator.
- [ ] Accessibility (A11y) and talk-back optimization.
- [ ] EAS Android production build generation.
