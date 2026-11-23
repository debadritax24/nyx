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

## Phase 5: Cloud Synchronization & Conflict Resolution [IN PROGRESS]
- [x] Define remote encrypted schema and optimistic concurrency trigger on Supabase.
- [x] Implement synchronization service stubs and Zustand sync store.
- [ ] Connect live Supabase project and execute end-to-end multi-device sync tests.
- [ ] Implement retry worker with exponential backoff.

---

## Phase 6: Hardening & Production Readiness [PENDING]
- [ ] Complete security audit and dependency vulnerability remediation.
- [ ] Execute end-to-end Maestro tests on Android emulator.
- [ ] Accessibility (A11y) and talk-back optimization.
- [ ] EAS Android production build generation.
