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

## 5. Offline-First Cloud Synchronization Flow

Synchronization is bidirectional, non-blocking, and handles network disruption gracefully.

```mermaid
flowchart TD
    LocalChange["Local Mutation (Create, Update, Delete)"]
    Queue["Offline Sync Queue"]
    NetCheck{"Internet Available?"}
    PushRemote["Push Changes to Supabase (Optimistic Concurrency)"]
    ConflictCheck{"Remote Version > Local Version?"}
    Resolve["Conflict Handler (Deterministic Rule / Prompt)"]
    ApplyRemote["Pull New Remote Records & Decrypt Locally"]

    LocalChange --> Queue
    Queue --> NetCheck
    NetCheck -- No --> StoredOffline["Retain in Persistent Queue"]
    NetCheck -- Yes --> PushRemote
    PushRemote --> ConflictCheck
    ConflictCheck -- Yes --> Resolve
    ConflictCheck -- No --> CommitRemote["Supabase Updates Successfully"]
    CommitRemote --> ApplyRemote
```

---

## 6. Failure Scenarios & Mitigations

| Failure Mode | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Complete Network Loss** | Cannot contact Supabase. | Full offline mode: OTP generation, local scanning, and edits remain 100% operational; sync operations queue persistently. |
| **Biometric Failure / Lockout** | Cannot unlock Keystore. | Fallback to device PIN/Pattern, or enter the Master Passphrase to unwrap the Vault Key. |
| **Lost Device** | Physical device gone. | Restore on a new device using Supabase Auth + Master Passphrase or 24-word Recovery Code. |
| **Compromised Backend** | Attacker breaches Supabase database. | Attacker obtains only AES-256-GCM ciphertext, Argon2id salts, and wrapped keys. Without the client passphrase or device Keystore, plaintext secrets cannot be decrypted. |
| **Sync Race Condition** | Edits made on two devices concurrently. | Optimistic concurrency version checks (`version` column) reject stale updates; local tombstones prevent resurrecting deleted accounts. |
