# NYX Architecture Specification

This document provides a comprehensive technical overview of NYX: system context, container topology, frontend/backend architecture, cryptographic data flows, synchronization models, and failure modes.

---

## 1. System Context & Trust Boundaries

NYX operates with a zero-trust model toward the cloud backend. The cloud is treated as an untrusted, semi-honest synchronization relay.

```mermaid
flowchart TD
    User["End User (Android Device)"]
    subgraph DeviceBoundary ["Trusted Device Boundary"]
        App["NYX Client (React Native / Expo)"]
        Keystore["Android Keystore / SecureStore"]
        LocalDB["Encrypted Local State (Zustand / SQLite / Storage)"]
    end
    subgraph CloudBoundary ["Untrusted Cloud Boundary (Supabase)"]
        AuthService["Supabase Auth (Identity & JWT)"]
        Postgres["PostgreSQL Database (RLS Enforced)"]
        StorageRelay["Encrypted Ciphertext Tables"]
    end

    User -->|"Biometric / PIN"| App
    App <-->|"Hardware Protected Key"| Keystore
    App <-->|"Encrypted Records"| LocalDB
    App -->|"User Credentials (No Vault Keys)"| AuthService
    AuthService -->|"JWT Session"| App
    App <-->|"Synchronize Encrypted Blobs (AES-256-GCM)"| StorageRelay
    StorageRelay <-->|"Row Level Security"| Postgres
```

### Trust Zones
1. **Trusted Execution Zone:** The NYX mobile app process, local memory, and Android Keystore hardware security module.
2. **Untrusted Transit & Cloud Zone:** Supabase Auth, PostgreSQL tables, network edge. The backend receives only encrypted blobs, KDF parameters, salts, and nonces.

---

## 2. Container Architecture

```mermaid
flowchart LR
    subgraph FrontendApp ["Frontend Container (Expo / React Native)"]
        UI["Presentation Layer (Expo Router)"]
        State["State Layer (Zustand Stores)"]
        CoreEngine["Core Engines (TOTP & Crypto)"]
        NativeBridge["Expo Hardware Modules (Camera, LocalAuth, SecureStore)"]
        SyncClient["Sync Queue & Conflict Resolver"]
        
        UI --> State
        State --> CoreEngine
        State --> SyncClient
        CoreEngine --> NativeBridge
    end

    subgraph BackendServices ["Backend Services (Supabase)"]
        SupabaseClient["PostgREST / Auth API"]
        RLS["PostgreSQL RLS Engine"]
        Tables["profiles / vaults / authenticator_accounts / devices"]
        
        SyncClient <-->|"HTTPS / TLS 1.3"| SupabaseClient
        SupabaseClient --> RLS
        RLS --> Tables
    end
```

---

## 3. Cryptographic Architecture & Data Flow

### 3.1 Vault Key Derivation & Wrapping

A randomly generated 256-bit symmetric **Vault Key** ($K_v$) encrypts all local TOTP account records. $K_v$ is never transmitted anywhere in plaintext.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as NYX Client
    participant Keystore as Android Keystore
    participant Backend as Supabase (Encrypted Vaults)

    Note over User, App: Vault Creation Flow
    User->>App: Creates Master Passphrase & receives Recovery Code
    App->>App: Generate random 256-bit Vault Key (Kv)
    App->>Keystore: Store Kv wrapped with Biometric/Keystore Key
    App->>App: Derive Key K_pass = Argon2id(Passphrase, Salt1, Params)
    App->>App: Derive Key K_rec = Argon2id(RecoveryCode, Salt2, Params)
    App->>App: Wrap1 = AES_GCM(K_pass, Kv, Nonce1)
    App->>App: Wrap2 = AES_GCM(K_rec, Kv, Nonce2)
    App->>Backend: Store (Wrap1, Salt1, Nonce1, Wrap2, Salt2, Nonce2, CryptoVersion)
    Note over Backend: Cloud only receives wrapped keys & public salts
```

### 3.2 TOTP Generation Flow (Completely Offline)

```mermaid
flowchart TD
    Clock["Device Real-Time Clock"]
    SecureKey["Decrypted Vault in RAM (Kv)"]
    LocalStore["Local Encrypted DB"]
    Engine["RFC 6238 TOTP Engine"]
    UI["Active Screen (Countdown & OTP Code)"]

    LocalStore -->|"Load Ciphertext + Nonce"| SecureKey
    SecureKey -->|"AES-256-GCM Decrypt"| DecryptedSecret["Plaintext Base32 Secret"]
    Clock -->|"Unix Timestamp (T)"| Engine
    DecryptedSecret -->|"HMAC-SHA(Secret, T/30)"| Engine
    Engine -->|"Truncate & Dynamic Truncation"| UI
    UI -->|"Every 1s Refresh Timer"| Clock
```

---

## 4. Account Registration Flow (QR Code & Manual)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Camera as Expo Camera
    participant Parser as URI & Base32 Parser
    participant Crypto as AES-GCM Encryptor
    participant LocalDB as Local Vault
    participant Sync as Sync Queue

    alt QR Code Registration
        User->>Camera: Point at QR code
        Camera->>Parser: Read otpauth:// URI
    else Manual Registration
        User->>Parser: Input Issuer, Account, Base32 Secret, Period, Algorithm
    end

    Parser->>Parser: Validate Base32 & Parameters (RFC 6238)
    Parser->>Crypto: Pass validated account data
    Crypto->>Crypto: Generate random 96-bit Nonce
    Crypto->>Crypto: Encrypt account payload using Vault Key (Kv)
    Crypto->>LocalDB: Store encrypted record (id, ciphertext, nonce, version: 1)
    LocalDB->>Sync: Queue sync job (action: INSERT, id, payload)
    LocalDB-->>User: Display new live TOTP item immediately (Zero Latency)
```

---

## 5. Offline-First Cloud Synchronization Architecture (Phase 5)

Synchronization is bidirectional, non-blocking, and handles intermittent connectivity, network disruptions, and multi-device concurrent edits with zero data loss.

### 5.1 Multi-Device Enrollment Protocol
When a secondary device (Device B) is enrolled into an existing user account:
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant B as Device B (Secondary)
    participant Cloud as Supabase Backend
    participant A as Device A (Primary)

    User->>B: Sign In (Email / Password)
    B->>Cloud: Fetch Encrypted Vault Record
    Cloud-->>B: Wrapped Kv + Salt + Params (Passphrase & Recovery)
    User->>B: Enters Master Passphrase OR 24-Word Recovery Code
    B->>B: Derive K_pass/K_rec via Argon2id (Strict RFC 9106)
    B->>B: Unwrap Kv via AES-256-GCM tag verification
    B->>B: Store Kv in Device B's local Android Keystore
    B->>Cloud: Register Device B metadata (device_id, label, platform)
    B->>Cloud: Pull all encrypted accounts (authenticator_accounts)
    B->>B: Decrypt all accounts with Kv and display live OTPs
```

### 5.2 Atomic Compare-And-Swap (CAS) & Deterministic Reconciliation
```mermaid
flowchart TD
    subgraph Client ["Client Device (NYX Engine)"]
        Mut["User Action (Create / Edit / Delete)"]
        LocalSave["Save Encrypted to Local Vault Storage"]
        Queue["Queue Mutation (expectedVersion, nextVersion)"]
        Enc["AES-256-GCM Encrypt with AAD: nyx-account:id:v1"]
        StateEngine["Sync State Machine (idle -> syncing -> synced)"]
    end

    subgraph Backend ["Supabase Cloud"]
        CASProc["sync_push_account() Stored Procedure (FOR UPDATE Lock)"]
        DBTable["authenticator_accounts Table"]
    end

    Mut --> LocalSave
    LocalSave --> Queue
    Queue --> Enc
    Enc --> StateEngine
    StateEngine -->|"1. Push Mutation via RPC (expected, next)"| CASProc

    CASProc -->|"Version Matches expected_version"| DBTable
    CASProc -->|"Version Mismatch (Race Condition)"| Reject["Reject with SQLSTATE 23514"]

    DBTable -->|"2. Pull Remote Modified Records"| Pull["Pull Remote List"]
    Reject -->|"Mark Conflicted"| Reconcile["Deterministic Reconciler"]
    Pull --> Reconcile

    subgraph ConflictResolution ["Deterministic Reconciliation Algorithm"]
        Reconcile --> CheckConf{"Conflict Detected?"}
        CheckConf -- No --> FastForward["Adopt Remote Version Cleanly"]
        CheckConf -- Edit vs Edit --> Fork["Fork Local Edit into (Conflicted Copy)"]
        CheckConf -- Delete vs Edit --> Restore["Restore Local Edit into (Restored from Deleted Copy)"]
        Fork --> Preserve["Save Both: Canonical Remote + Preserved Fork"]
        Restore --> Preserve
    end
```

### 5.3 Tombstone Deletion, Anti-Resurrection & Delete-vs-Update Conflicts
1. **Tombstone Propagation:** Deletions publish a tombstone (`deleted_at = now()`) with an incremented version counter.
2. **Anti-Resurrection Invariant:** Reconcilers respect tombstones when `remote.version >= local.version`, removing the account from local active sets.
3. **Delete-vs-Update Conflict Resolution (Zero Data Loss):** If Device A deleted an account and Device B modified that account while offline:
   - The canonical account ID is removed (honoring the tombstone deletion).
   - Device B's local modifications are preserved as a brand new account record with a fresh UUID and label `(Restored from Deleted Copy)`.
   - The preserved copy is re-encrypted with fresh nonces and bound AAD, ensuring zero data loss and preventing future resurrection of the deleted ID.

### 5.4 Device Revocation Boundaries & Atomic Vault Key Rotation
- **Revocation Boundary:** Deleting a record from the `devices` table purges sync query authorization, but does **not** cryptographically erase the Vault Key from hardware in an adversary's physical possession.
- **Atomic Vault Key Rotation Protocol ($K_v \to K_v'$):** Implemented in `VaultService.rotateVaultKey` and backed by `sync_rotate_vault` stored procedure:
  1. *Pre-flight Verification:* Calls `LocalVaultStorage.loadAccounts(oldVaultKey)` to verify active key decrypts local data.
  2. *Phase 1 (`PREPARED`):* Generates $K_v'$, stores it in the Android Keystore staging slot (`nyx_staging_vault_key_v1`), re-encrypts accounts in RAM under $K_v'$, wraps $K_v'$ under $K_v$ via AES-256-GCM, and writes `nyx_rotation_manifest_v2.json` to disk (zero plaintext keys on disk).
  3. *Phase 2 (`CLOUD_COMMITTED`):* Invokes `sync_rotate_vault` RPC, updating vault envelope and all account records in a single atomic database transaction. If RPC fails, rolls back locally and clears staging key.
  4. *Local Commit (`COMPLETED`):* Promotes $K_v'$ in Android Keystore, commits local accounts, verifies decryption, and purges manifest.
  5. *Startup Crash Recovery:* `recoverInterruptedRotation` detects interrupted rotations on reboot, checking cloud commit status before promoting $K_v'$ or safely discarding the manifest.

### 5.5 Crash-Safe Offline Mutation Queue (Write-Ahead Journaling & Keystore HMAC)
Offline mutations are managed via `PersistentMutationQueue` (`frontend/src/services/queueService.ts`):
- **Concurrency Serialization Mutex (`runExclusive`):** All async queue operations are serialized through an internal lock to eliminate concurrent read-modify-write race conditions and lost mutations.
- **Keystore HMAC Authentication:** Journal file (`nyx_mutation_queue_v1.journal`) stores a versioned envelope (`schemaVersion: 1`, `checksum`, `updatedAt`) authenticated by a device-bound 256-bit HMAC key in Android Keystore (`nyx_queue_hmac_key_v1`). Tampering with payload or checksum is immediately rejected.
- **Safe Backup Rotation & Auto-Repair:** Prior journal is validated before rotating to `nyx_mutation_queue_v1.journal.bak`. Corrupted primary files cannot overwrite valid backups. Corrupted journals that cannot be parsed are archived to `nyx_mutation_queue_v1.journal.corrupted.<timestamp>`.
- **Application-Level WAL:** Mutations are written to disk using atomic temporary write + rename before remote dispatch.
- **State Machine:** `ENQUEUED` -> `PROCESSING` -> `ACKNOWLEDGED` (or `RETRYING` with jittered backoff, or `PERMANENTLY_FAILED`).
- **Startup Crash Recovery:** Detects mutations interrupted in `PROCESSING` state during application kill or power failure, queries the server to determine whether remote write completed, and acknowledges or resets to `ENQUEUED`.
- **Deduplication:** Folds multiple offline updates for the same account to prevent queue bloat.

---

## 6. Failure Scenarios & Mitigations

| Failure Mode | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Complete Network Loss** | Cannot contact Supabase. | Full offline mode: OTP generation, local scanning, and edits remain 100% operational; sync operations queue persistently. |
| **Biometric Failure / Lockout** | Cannot unlock Keystore. | Fallback to device PIN/Pattern, or enter the Master Passphrase to unwrap the Vault Key. |
| **Lost Device** | Physical device gone. | Restore on a new device using Supabase Auth + Master Passphrase or 24-word Recovery Code. |
| **Compromised Backend** | Attacker breaches Supabase database. | Attacker obtains only AES-256-GCM ciphertext, Argon2id salts, and wrapped keys. Without the client passphrase or device Keystore, plaintext secrets cannot be decrypted. |
| **Sync Race Condition** | Edits made on two devices concurrently. | Optimistic concurrency version checks (`version` column) reject stale updates; local tombstones prevent resurrecting deleted accounts. |
