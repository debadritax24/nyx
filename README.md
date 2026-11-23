# NYX

<p align="center">
  <strong>Zero-Knowledge, Offline-First TOTP Authenticator for Android</strong><br>
  Client-side AES-256-GCM encryption, Argon2id key derivation, hardware Keystore biometric gating, and crash-safe Supabase synchronization.
</p>

---

## Overview

**NYX** is a privacy-first, offline-first two-factor authenticator (2FA) application engineered for Android using React Native (Expo) and Supabase. It generates RFC 6238-compliant Time-based One-Time Passwords (TOTP) entirely on the client, safeguards cryptographic assets using hardware-backed secure storage, and synchronizes encrypted account records across devices without exposing plaintext secrets to the cloud.

The system is designed under a strict **Zero Plaintext Cloud Exposure** invariant: the backend database never receives plaintext TOTP secrets, unencrypted Vault Keys, user passphrases, emergency recovery codes, or generated OTP codes.

---

## Architectural & Security Invariants

1. **Zero Plaintext Cloud Exposure:**
   All account credentials (issuer, account name, secret, algorithm, digits, period) are encrypted client-side using authenticated encryption (**AES-256-GCM** with 128-bit authentication tags and Associated Authenticated Data binding).
2. **Tri-Factor Master Key Wrapping:**
   The master symmetric Vault Key ($K_v$) is generated from 256 bits of high-entropy randomness and wrapped independently by:
   - **Android Keystore:** Hardware-backed secure storage gated behind biometric authentication (`LocalAuthentication`).
   - **Passphrase Envelope:** Key derivation via **Argon2id** (64 MB memory, 3 iterations, 4 parallelism).
   - **Recovery Code Envelope:** 24-word high-entropy mnemonic wrapped independently via **Argon2id**.
3. **Zero Algorithmic Fallback:**
   Argon2id and AES-256-GCM are enforced unconditionally without downgrading to weaker primitives (such as PBKDF2 or unauthenticated CBC modes), even in restricted JavaScript runtimes.
4. **Hermes Native Engine Compatibility:**
   Pure JavaScript implementations via `@noble/hashes` and `node-forge` execute natively on the React Native Hermes engine where WebAssembly, WebCrypto Subtle, and Node standard libraries are absent.
5. **Crash-Safe Offline Mutation Queue:**
   Offline mutations are recorded in an application-level write-ahead journal (`.journal`) with Keystore-keyed HMAC-SHA256 tamper resistance, startup crash reconciliation, safe backup rotation (`.journal.bak`), and bounded exponential backoff with jitter.
6. **Optimistic Concurrency & Atomic CAS:**
   All cloud updates are governed by integer version tracking (`version`). Concurrent modifications and multi-account key rotations are committed atomically through PostgreSQL stored procedures (`sync_push_account`, `sync_rotate_vault`) with `FOR UPDATE` row locking.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Mobile Runtime** | React Native `0.88`, Expo `58`, Hermes Engine, Expo Router filesystem routing |
| **Cryptography** | AES-256-GCM (`node-forge`), RFC 9106 Argon2id (`@noble/hashes`), RFC 6238 TOTP (`@noble/hashes`), SHA-512 Ratcheted CSPRNG Pool |
| **Hardware Integration** | `expo-secure-store` (Keystore), `expo-local-authentication` (Biometrics), `expo-camera`, `expo-screen-capture` |
| **State & Data** | Zustand reactive stores, React Hook Form, Zod runtime validation schemas |
| **Backend Infrastructure** | Supabase Auth, PostgreSQL 15+ with Row-Level Security (RLS), atomic PL/pgSQL stored procedures |
| **Testing & CI** | Jest, RFC 6238 Appendix B test vectors, pgTAP / RLS security suites, live Supabase cloud integration matrix |

---

## Repository Structure

```text
nyx/
├── app/                  # Expo Router filesystem routing
│   ├── (auth)/           # Authentication flows (login, register, reset-password)
│   ├── (app)/            # Authenticated application (dashboard, scan, manual, settings, devices)
│   └── _layout.tsx       # Root layout with app-state auto-lock and screen capture guards
├── src/                  # Core application source
│   ├── core/             # Cryptography & TOTP engines
│   │   ├── crypto/       # AES-256-GCM, Argon2id, Keystore, CSPRNG, LocalVaultStorage
│   │   └── totp/         # RFC 6238 TOTP engine, Base32 codec, URI parser
│   ├── services/         # Typed domain services (Supabase, Vault, Sync, Queue, Device)
│   ├── store/            # Lightweight Zustand reactive stores (Auth, Vault, Sync)
│   └── components/       # Design system tokens and reusable UI components
├── assets/               # Production app icons, adaptive foreground, splash screens
├── docs/                 # Architectural specifications, security reviews, and manuals
│   ├── architecture.md   # System architecture & Mermaid sequence diagrams
│   ├── encryption.md     # Cryptographic envelope & recovery specifications
│   ├── security.md       # Threat model, assets, and adversarial audit review
│   ├── database.md       # Schema definitions, RLS policies, and sync rules
│   ├── api.md            # Supabase schema & API operations reference
│   ├── development.md    # Local development setup guide
│   ├── testing.md        # Test strategies, vectors, and execution guides
│   ├── contributing.md   # Contribution guidelines & workflows
│   └── roadmap.md        # Implementation roadmap & milestone tracking
├── maestro/              # End-to-end Maestro mobile UI test automation flows
├── scripts/              # Remote database migration tooling and schema verifier
├── supabase/             # Supabase configuration and versioned SQL migrations
│   ├── migrations/       # Idempotent forward-only SQL migrations with RLS policies
│   └── tests/            # Database RLS policy integration tests
├── tests/                # Jest unit, integration, crypto vectors, and live Supabase tests
│   ├── core/             # Cryptography & TOTP test suites (RFC 6238 vectors)
│   └── services/         # Queue recovery, key rotation, and sync conflict tests
├── .env                  # Single source of truth environment variables
├── app.json              # Expo application manifest & native permissions
├── eas.json              # Expo Application Services build profiles
├── babel.config.js       # Babel preset configuration
├── jest.config.js        # Jest test runner configuration
├── tsconfig.json         # Strict TypeScript configuration
├── package.json          # Root scripts and unified dependencies
├── AGENTS.md             # Invariants and standards for automated agents
├── CHANGELOG.md          # Version history & release notes
├── LICENSE               # License terms
├── memory.md             # Engineering memory & architectural milestones
└── README.md             # Project overview
```

---

## Documentation Directory (`docs/`)

Deep architectural manuals and specifications are organized inside [`docs/`](file:///home/tushardevx01/Documents/nyx/docs):

- **[System Architecture](file:///home/tushardevx01/Documents/nyx/docs/architecture.md):** Complete component topology, state machines, and Mermaid sequence diagrams for enrollment, sync, and recovery.
- **[Encryption & Key Wrapping](file:///home/tushardevx01/Documents/nyx/docs/encryption.md):** Specification of cryptographic envelopes, Argon2id parameters, AES-256-GCM tag verification, and recovery derivation.
- **[Security Architecture & Threat Model](file:///home/tushardevx01/Documents/nyx/docs/security.md):** Adversarial audit findings, hardware boundary threat analysis, device revocation, and rotation guarantees.
- **[Database Schema & Sync](file:///home/tushardevx01/Documents/nyx/docs/database.md):** Table schemas (`profiles`, `vaults`, `authenticator_accounts`, `devices`), RLS policy definitions, and CAS concurrency procedures.
- **[API Reference](file:///home/tushardevx01/Documents/nyx/docs/api.md):** Supabase REST/RPC interfaces and TypeScript service contracts.
- **[Testing Strategy](file:///home/tushardevx01/Documents/nyx/docs/testing.md):** RFC vector test suites, failure injection test plans, and automated verification matrices.
- **[Local Development Guide](file:///home/tushardevx01/Documents/nyx/docs/development.md):** Environment setup, Android Studio configuration, and debugging workflows.
- **[Contributing Guidelines](file:///home/tushardevx01/Documents/nyx/docs/contributing.md):** Code conventions, Git workflows, and security checklists.
- **[Roadmap](file:///home/tushardevx01/Documents/nyx/docs/roadmap.md):** Completed phases and future roadmap milestones.

---

## Installation & Setup

### Prerequisites

- **Node.js:** `>= 20.x` (Node 24 LTS verified)
- **Package Manager:** `npm >= 10.x`
- **Mobile SDK:** Android Studio / Android SDK (API 34+)
- **Environment:** Root `.env` file populated with Supabase credentials

### Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tushardevx01/nyx.git
   cd nyx
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Populate the single root `.env` file:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

4. **Start Development Server:**
   ```bash
   npx expo start
   # or
   npm start
   ```

5. **Run on Android Device / Emulator:**
   ```bash
   npm run android
   ```

---

## Verification & Testing

NYX enforces a strict verification hierarchy covering unit tests, cryptographic vectors, schema verification, and live cloud security assertions:

| Command | Target Scope |
| :--- | :--- |
| `npm test` | **Unified Execution:** Runs frontend Jest suites followed immediately by backend database verification. |
| `npm run test:frontend` | **Client Test Suite:** Executes all 12 Jest suites (RFC 6238 vectors, pure JS Argon2id, AES-256-GCM, mutation queue recovery, rotation manifest). |
| `npm run test:backend` | **Database & Cloud Suite:** Runs schema verification, 8 PostgreSQL RLS policy security suites, and 10 live Supabase integration tests. |
| `npm run typecheck` | **Static Type Validation:** Compiles TypeScript across all files under `strict: true` with `noImplicitAny: true`. |

---

## Security Reporting

To report a potential vulnerability or cryptographic defect, please review [docs/security.md](file:///home/tushardevx01/Documents/nyx/docs/security.md) for disclosure guidelines. Never submit sensitive vulnerability details to public issue trackers.

---

## License

This project is licensed under the terms of the [LICENSE](file:///home/tushardevx01/Documents/nyx/LICENSE) file.
