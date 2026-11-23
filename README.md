# NYX

NYX is a privacy-first, offline-first authenticator application for Android built with React Native (Expo) and Supabase. It generates RFC 6238-compliant Time-based One-Time Passwords (TOTP) entirely on the client, safeguards cryptographic assets using hardware-backed secure storage, and synchronizes encrypted account records across devices without exposing plaintext secrets to the cloud.

---

## Key Features

- **Offline-First Authenticator:** Operates completely offline without requiring an active network connection for code generation, account scanning, or manual credential entry.
- **RFC 6238 & RFC 4226 Compliance:** Supports 6-digit TOTP codes, standard 30-second intervals, and SHA-1, SHA-256, and SHA-512 HMAC algorithms.
- **Client-Side Zero-Knowledge Encryption:** Authenticator secrets are encrypted locally using AES-256-GCM under a random 256-bit Vault Key. The backend never receives plaintext secrets, unencrypted Vault Keys, or generated codes.
- **Tri-Factor Vault Protection:**
  1. *Local Device Storage:* Hardware-backed Android Keystore via biometrics and device credentials.
  2. *Passphrase Recovery:* Vault Key wrapped using an Argon2id-derived key from a user passphrase.
  3. *Recovery Code:* Vault Key wrapped using an independent Argon2id-derived key from an emergency recovery code.
- **Biometric Security:** Biometric authentication (fingerprint / face unlock) protecting vault decryption with automated lock timers and background preview masking.
- **Safe Cloud Synchronization:** Optimistic concurrency and explicit conflict resolution via PostgreSQL Row-Level Security (RLS) on Supabase.

---

## Technology Stack

- **Mobile Framework:** React Native / Expo (Expo Router, TypeScript strict mode)
- **UI & Interaction:** Native styling design tokens, React Native Reanimated, Expo Haptics
- **State Management:** Zustand, React Hook Form, Zod
- **Hardware & Native Capabilities:** Expo Camera, Expo SecureStore, Expo LocalAuthentication, Expo Crypto, Expo Clipboard
- **Cryptography Engine:** AES-256-GCM, Argon2id key derivation, RFC 6238 TOTP engine
- **Backend & Database:** Supabase Auth, PostgreSQL 15+ with Row-Level Security (RLS)
- **Testing:** Jest, React Native Testing Library, RFC 6238 test vectors, pgTAP / RLS test suites

---

## Architecture Overview

NYX separates authentication from vault decryption:
1. **Supabase Auth** manages user identity (email, session tokens, JWTs).
2. **Local Vault Key** unlocks encrypted records independently on device.
3. **Database Layer** stores only ciphertext payloads, cryptographic nonces, and Argon2id KDF salt parameters.

See [architecture.md](file:///home/tushardevx01/Documents/nyx/architecture.md) and [ENCRYPTION.md](file:///home/tushardevx01/Documents/nyx/ENCRYPTION.md) for architectural specifications.

---

## Repository Structure

```text
nyx/
├── frontend/             # Expo React Native mobile application
│   ├── app/              # Expo Router filesystem routing
│   ├── src/              # Application source (core, services, store, components, types, utils)
│   ├── assets/           # Application icons, splash screen, and images
│   ├── tests/            # Unit, integration, and crypto vector tests
│   ├── app.json          # Expo manifest configuration
│   ├── eas.json          # EAS build configuration
│   ├── package.json      # Frontend dependencies and scripts
│   └── tsconfig.json     # Strict TypeScript configuration
│
├── backend/              # Supabase database & backend infrastructure
│   ├── supabase/
│   │   ├── migrations/   # Versioned SQL migrations with RLS policies
│   │   ├── functions/    # Edge functions
│   │   └── config.toml   # Supabase local environment config
│   ├── scripts/          # Database provisioning and maintenance scripts
│   ├── tests/            # SQL and RLS policy integration tests
│   └── README.md         # Backend documentation
│
├── .env                  # Environment variable configuration (template keys)
├── .gitignore            # Git exclusion rules
├── .editorconfig         # Code format configuration
├── .prettierrc           # Prettier configuration
├── .prettierignore       # Prettier ignore paths
├── .gitmessage           # Git commit message template
├── README.md             # Project overview
├── AGENTS.md             # AI engineering instructions & invariants
├── architecture.md       # Detailed system architecture & Mermaid diagrams
├── memory.md             # Project state, milestones, and technical decisions
├── SECURITY.md           # Threat model, assets, and security review rules
├── CONTRIBUTING.md       # Contribution guidelines & workflows
├── DEVELOPMENT.md        # Local development setup guide (Fedora/Linux)
├── DATABASE.md           # Schema definitions, RLS policies, and sync rules
├── ENCRYPTION.md         # Cryptographic envelope & recovery specifications
├── API.md                # Supabase schema & API operations reference
├── TESTING.md            # Test strategies, vectors, and execution guides
├── ROADMAP.md            # Implementation roadmap & milestone tracking
├── CHANGELOG.md          # Version history & release notes
└── LICENSE               # License terms
```

---

## Installation & Setup

### Prerequisites

- Node.js >= 20.x (Node 24 LTS verified)
- npm >= 10.x
- Git >= 2.40
- Android Studio / Android SDK (API 34+)
- Supabase CLI (`supabase`)
- Docker (for Supabase local development)

### Quick Start

1. Clone and navigate to the repository:
   ```bash
   cd nyx
   ```

2. Configure environment:
   Fill in `.env` with your Supabase credentials:
   ```bash
   cp .env.example .env # or edit .env directly
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

4. Start Supabase locally (optional if using cloud project):
   ```bash
   cd ../backend
   supabase start
   ```

5. Run the frontend application:
   ```bash
   cd ../frontend
   npx expo start --android
   ```

---

## Running Tests

- Run frontend tests:
  ```bash
  cd frontend && npm test
  ```
- Run crypto & TOTP vector tests:
  ```bash
  cd frontend && npm test -- src/core/totp/__tests__
  ```
- Run backend RLS tests:
  ```bash
  cd backend && supabase test db
  ```

---

## Project Status

- **Current Milestone:** Phase 0 & Phase 1 Foundation Active.
- Repository structure, strict documentation, database migrations, and frontend baseline configured.
- See [memory.md](file:///home/tushardevx01/Documents/nyx/memory.md) and [ROADMAP.md](file:///home/tushardevx01/Documents/nyx/ROADMAP.md) for live progress.
