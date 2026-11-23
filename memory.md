# NYX Engineering Memory

## 1. Project Overview & Current Phase
- **Project:** NYX Authenticator
- **Active Development Phase:** Phase 0 (Repository Foundation) transitioning to Phase 1 (Expo & Backend Foundation).
- **Current Milestone:** Milestone 0.1 Complete (Directory layout, environment configuration, core architecture documentation, and tooling definitions established).

---

## 2. Implemented Capabilities & Assets
- Root configuration created: `.env` (canonical template with required empty keys), `.gitignore`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `.gitmessage`, `package.json` (root workspace scripts), `LICENSE`.
- Repository layout established with strict two-folder root hierarchy: `frontend/` and `backend/`.
- Architectural and operational documentation completed:
  - `README.md`
  - `AGENTS.md`
  - `architecture.md`
  - `SECURITY.md`
  - `DATABASE.md`
  - `ENCRYPTION.md`
  - `DEVELOPMENT.md`
  - `API.md`
  - `TESTING.md`
  - `CONTRIBUTING.md`
  - `ROADMAP.md`
  - `CHANGELOG.md`

---

## 3. Important Architectural Decisions
- **Zero Plaintext Cloud Exposure:** Client-side 256-bit AES-GCM authenticated encryption for all account records. Backend is treated as an untrusted ciphertext relay.
- **Tri-Factor Key Protection:**
  1. Local Android Keystore for biometrics / device PIN.
  2. Argon2id wrapped key for passphrase recovery.
  3. Independent Argon2id wrapped key for emergency recovery code.
- **Offline Priority:** TOTP generation, account scanning, and manual creation must function without network access.
- **Strict Separation of Auth & Encryption:** Supabase Auth manages user credentials and session tokens; Vault Key decryption occurs strictly on the client.
- **Optimistic Concurrency & Tombstones:** Version integers (`version`) and soft deletes (`deleted_at`) ensure deterministic sync and prevent resurrected accounts or lost updates.

---

## 4. Current Repository Structure
```text
nyx/
├── frontend/             # Expo React Native application
│   ├── app/
│   ├── src/
│   ├── assets/
│   └── tests/
├── backend/              # Supabase infrastructure
│   ├── supabase/
│   │   ├── migrations/
│   │   └── config.toml
│   ├── scripts/
│   └── tests/
├── .env                  # Single canonical environment configuration
├── .gitignore
├── .editorconfig
├── .prettierrc
├── .prettierignore
├── .gitmessage
├── package.json
├── LICENSE
└── [Documentation Files]
```

---

## 5. Database Migration Status
- Migration `20261123000000_initial_nyx_schema.sql` prepared:
  - Tables: `profiles`, `vaults`, `authenticator_accounts`, `devices`.
  - Row Level Security (RLS) policies enforcing strict `auth.uid()` checks.
  - Performance indexes on foreign keys, timestamps, and version fields.
  - Automated `updated_at` trigger execution.

---

## 6. Known Issues & Blockers
- None at foundation phase.

---

## 7. Pending Work
- **Phase 1 (Expo Foundation):** Initialize Expo TypeScript project inside `frontend/`, configure Expo Router layout, Supabase client initialization, and authentication flows (login, register, password reset).
- **Phase 2 (TOTP Engine):** Implement RFC 6238 core logic, Base32 parser, and URI validator with unit test coverage against official test vectors.
- **Phase 3 (Vault Encryption):** Implement local Keystore wrapping, AES-GCM encrypt/decrypt envelopes, and biometric lock.
- **Phase 4 (Recovery Engine):** Implement Argon2id key wrapping and verification flows.
- **Phase 5 (Cloud Synchronization):** Implement offline queue, push/pull synchronization, and conflict resolution.

---

## 8. Next Recommended Task
- Finalize initial database migration and verify SQL schema syntax.
- Bootstrap Expo application structure inside `frontend/` with strict TypeScript configuration and basic design system.
