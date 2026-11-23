# Contributing to NYX

Thank you for contributing to NYX. NYX is a security-critical, privacy-first authenticator application. All contributions must adhere to high engineering standards, rigorous testing, and strict cryptographic safeguards.

---

## 1. Code of Conduct & Security Invariants

All contributors must respect the core security invariants:
- Zero plaintext secrets sent to the cloud or logged.
- All account secrets must be encrypted with AES-256-GCM.
- Never downgrade cryptographic parameters or bypass RLS policies.

---

## 2. Branching Strategy

- `main`: Production-ready, verified code.
- `develop`: Integration branch for tested features.
- Feature branches: `feat/<feature-name>`, `fix/<issue-name>`, `security/<patch-name>`.

---

## 3. Commit Message Conventions

We enforce Conventional Commits:
```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed Types
- `feat`: A new user-facing capability or service.
- `fix`: A bug fix.
- `refactor`: Code reorganization without functional changes.
- `docs`: Documentation updates.
- `test`: Adding or updating test suites.
- `security`: Security patches, RLS hardening, or crypto improvements.
- `chore`: Tooling, configuration, or dependency updates.

---

## 4. Pull Request Standards

Before submitting a Pull Request:
1. Run static checks:
   ```bash
   npm run lint
   npm run typecheck
   ```
2. Run test suites:
   ```bash
   npm run test:frontend
   npm run test:backend
   ```
3. Update `memory.md` and `CHANGELOG.md` with relevant changes.
4. Verify no secret tokens, API keys, or personal credentials are included in the diff.
