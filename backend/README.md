# NYX Backend Infrastructure

This directory contains Supabase migrations, configurations, edge functions, test suites, and maintenance scripts for NYX.

---

## Directory Organization

```text
backend/
├── supabase/
│   ├── migrations/     # Versioned SQL migrations (RLS enforced)
│   ├── functions/      # Supabase Edge Functions (optional/auxiliary)
│   └── config.toml     # Supabase project configuration
├── scripts/            # Database validation & administration scripts
├── tests/              # Database schema & RLS policy integration tests
└── README.md           # Backend documentation
```

---

## Key Principles & Security Rules

1. **Row Level Security (RLS):** Every user-owned table (`profiles`, `vaults`, `authenticator_accounts`, `devices`) strictly enforces RLS policies checking `auth.uid() = user_id`.
2. **Zero Plaintext Cloud Storage:** The database schema is designed exclusively for ciphertext blobs, nonces, and Argon2id KDF salt parameters. It never stores plaintext TOTP secrets or unencrypted keys.
3. **Optimistic Concurrency Control:** `authenticator_accounts` uses a strict version trigger `check_optimistic_concurrency()` to prevent stale writes from overwriting newer records during client sync.
4. **Soft Deletes / Tombstones:** Deleted accounts are stamped with `deleted_at` to replicate deletions accurately to offline clients before final pruning.

---

## Local Development & Testing

1. Start local Supabase instance:
   ```bash
   supabase start
   ```

2. Run database migration tests:
   ```bash
   npm test
   # or
   supabase test db
   ```

3. Reset and apply all migrations:
   ```bash
   supabase db reset
   ```
