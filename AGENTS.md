# AGENTS.md - Instructions for Autonomous Agents

This document defines the absolute operational rules, architectural invariants, and engineering standards for all AI and automated agents working in the **NYX** repository.

Every agent must read and adhere to this document before reading or modifying code.

---

## 1. Project Identity & Purpose

- **Application:** NYX
- **Domain:** Offline-first, client-side encrypted TOTP authenticator
- **Platform:** Android (React Native + Expo Router)
- **Backend:** Supabase (PostgreSQL with Row Level Security)
- **Primary Security Invariant:** Zero Plaintext Cloud Exposure. The backend must NEVER receive plaintext TOTP secrets, plaintext Vault Keys, recovery passphrases, recovery codes, or generated OTP codes.

---

## 2. Non-Negotiable Structural Invariants

1. **Two Root Application Folders Only:**
   - `frontend/` - All React Native, Expo, and client code.
   - `backend/` - All Supabase configurations, migrations, and backend tests.
   - Never create a third application folder at root.
2. **Single Environment File:**
   - Root `nyx/.env` is the sole environment file.
   - Never create `.env.example`, `.env.local`, `.env.development`, or `.env.production`.
   - Never commit populated credentials or secrets to Git.
3. **Frontend Isolation:**
   - Never import root `.env` or Node-only backend modules into `frontend/`.
   - Client code only accesses variables with the `EXPO_PUBLIC_` prefix.
   - Privileged variables (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`) must remain isolated to administrative tooling.
4. **Independent Maintainability:**
   - Frontend and backend must be independently buildable and testable.

---

## 3. Cryptographic & Security Rules

1. **Client-Side Encryption:**
   - All account credentials must be encrypted client-side using authenticated encryption (AES-256-GCM).
   - Every encryption operation must generate a fresh, cryptographically secure 96-bit (12-byte) initialization vector/nonce. Never reuse nonces under the same key.
2. **Key Wrapping & Derivation:**
   - The master Vault Key is a random 256-bit symmetric key.
   - The Vault Key is wrapped independently by:
     - Android Keystore-backed secure storage.
     - User passphrase via Argon2id.
     - Emergency recovery code via Argon2id.
   - Never implement cryptographic primitives from scratch. Use verified, reviewed cryptographic packages.
3. **No Plaintext Logging:**
   - Never log unencrypted secrets, seed phrases, private keys, or OTP values to the console or telemetry.
4. **App Privacy:**
   - The application view must be obscured when entering the Android app switcher to prevent unauthorized shoulder-surfing or screenshotting.

---

## 4. Database & Synchronization Standards

1. **Row Level Security (RLS) is Mandatory:**
   - Every user-owned table (`profiles`, `vaults`, `authenticator_accounts`, `devices`) must have RLS enabled.
   - Policies must restrict `SELECT`, `INSERT`, `UPDATE`, and `DELETE` exclusively to authenticated owners via `auth.uid() = user_id`.
2. **Optimistic Concurrency & Conflict Handling:**
   - Account synchronizations use integer version tracking (`version`).
   - Stale updates must never silently overwrite newer remote records.
   - Soft deletes (`deleted_at`) ensure deletion tombstones propagate correctly during offline synchronization.
3. **Migrations:**
   - All schema changes must be written as forward-only, idempotent SQL migrations in `backend/supabase/migrations/` prefixed with a UTC timestamp.

---

## 5. Coding & Architecture Standards

1. **TypeScript Strict Mode:**
   - `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
   - Avoid `any`. Use well-defined interfaces and Zod runtime validation schemas for external data.
2. **Small, Focused Modules:**
   - Adhere to single responsibility. Keep components and services modular.
   - Feature-based structure in `frontend/src/`.
3. **State Management:**
   - Use Zustand for predictable, lightweight state management.
   - Decouple UI components from raw database access using typed service abstractions.
4. **Error Handling:**
   - Never swallow errors silently.
   - Surface actionable user feedback while capturing structured diagnostics in development logs.

---

## 6. Verification & Change Protocol

Before submitting or committing any change, agents must:
1. Run static checks: TypeScript compilation (`npm run typecheck`), linting, and formatting.
2. Run test suites: Ensure unit and vector tests pass.
3. Inspect Git diffs: Verify no unintended files or secrets are staged.
4. Update `memory.md`: Record completed milestones, architectural decisions, and current project status.
5. Update `CHANGELOG.md` for notable changes.
6. Commit using Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `security:`, `chore:`).
