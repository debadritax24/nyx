# NYX Changelog

All notable changes to the NYX project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Repository foundation established with two-folder root architecture (`frontend/` and `backend/`).
- Canonical environment template `.env` configured with required Supabase and application keys.
- Complete documentation suite created:
  - `README.md`: Project summary, setup, and quickstart instructions.
  - `AGENTS.md`: Mandatory instructions, invariants, and coding standards for AI agents.
  - `architecture.md`: Full architectural specification, container topologies, trust boundaries, and Mermaid diagrams.
  - `memory.md`: Engineering memory tracking active phases, milestones, and technical decisions.
  - `SECURITY.md`: Security threat model, sensitive asset classifications, and defense-in-depth rules.
  - `DATABASE.md`: PostgreSQL schema, RLS policies, indexing, and sync constraint specifications.
  - `ENCRYPTION.md`: Detailed AES-256-GCM, Argon2id, and Android Keystore cryptographic design.
  - `API.md`: Supabase Auth and PostgREST endpoint reference.
  - `TESTING.md`: Testing guidelines, official RFC 6238 test vectors, and RLS test protocols.
  - `DEVELOPMENT.md`: Fedora/Linux local development setup guide for Android and Supabase.
  - `CONTRIBUTING.md`: Contribution, commit message, and branching conventions.
  - `ROADMAP.md`: Project implementation phases and acceptance tracking.
- Backend Supabase migration `20261123000000_initial_nyx_schema.sql` defining `profiles`, `vaults`, `authenticator_accounts`, and `devices` with strict RLS policies and update triggers.
