# NYX Testing Architecture & Verification Protocols

This document defines the testing strategy, official test vectors, RLS verification policies, and execution instructions for NYX.

---

## 1. Testing Pyramid & Strategy

```text
       /\
      /  \     Android E2E / Maestro (Smoke & Critical Flows)
     /----\
    /      \    PostgreSQL RLS Integration Tests (Multi-tenant isolation)
   /--------\
  /          \  Unit Tests: RFC 6238 TOTP Vectors, Base32, AES-GCM Envelopes
 /------------\
```

---

## 2. Unit Testing & RFC 6238 Official Test Vectors

The TOTP engine is verified against official test vectors defined in **RFC 6238** across SHA-1, SHA-256, and SHA-512 algorithms.

### Test Secret Seeds (RFC 6238 Appendix B)
- **SHA-1 Seed (20 bytes):** `12345678901234567890` (ASCII) -> `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` (Base32)
- **SHA-256 Seed (32 bytes):** `12345678901234567890123456789012` (ASCII)
- **SHA-512 Seed (64 bytes):** 64-byte repeated ASCII sequence

### Standard Verification Matrix (30-second Time-Step, T0 = 0)
| Unix Epoch Time | Timestamp (UTC) | Expected TOTP (SHA-1) | Expected TOTP (SHA-256) | Expected TOTP (SHA-512) |
| :--- | :--- | :--- | :--- | :--- |
| `59` | 1970-01-01 00:00:59 | `287082` | `461145` | `906935` |
| `1111111109` | 2005-03-18 01:58:29 | `081804` | `680847` | `709301` |
| `1111111111` | 2005-03-18 01:58:31 | `050471` | `670084` | `287082` |
| `1234567890` | 2009-02-13 23:31:30 | `005924` | `918194` | `359152` |
| `2000000000` | 2033-05-18 03:33:20 | `279037` | `906984` | `613518` |

---

## 3. Cryptographic Envelope Unit Tests

1. **AES-256-GCM Roundtrip:** Verify encryption and decryption of JSON account structures with random keys and nonces.
2. **Tamper Resistance:** Modify 1 byte of the ciphertext or authentication tag; ensure decryption throws an authentication error.
3. **Nonce Uniqueness:** Generate 10,000 successive nonces; assert 0 collisions.
4. **Argon2id Determinism:** Verify identical derived keys given identical inputs, and distinct keys with differing salts.

---

## 4. PostgreSQL Row Level Security (RLS) Tests

Test cases executed against the local Supabase database:
- **Tenant Isolation:** User A creates an account and vault record. User B queries `vaults` and `authenticator_accounts` with User B's JWT; verify 0 records returned.
- **Unauthorized Write:** User B attempts to `INSERT` or `UPDATE` a record with `user_id = User A`; verify statement fails with RLS policy violation.
- **Anonymous Access:** Unauthenticated requests must receive 401 Unauthorized or empty sets.

---

## 5. Execution Commands

### Run Frontend Unit & Vector Tests
```bash
cd frontend
npm test
```

### Run Vector Tests Exclusively
```bash
cd frontend
npm test -- src/core/totp/__tests__/rfc6238.test.ts
```

### Run Supabase Database & RLS Tests
```bash
cd backend
supabase test db
```

### Type Checking & Linting
```bash
npm run typecheck
npm run lint
```
