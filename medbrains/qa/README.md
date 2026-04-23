# QA — Test Case Management

## Architecture

```
qa/test-cases/*.yml          ← Source of truth (git-tracked)
     │
     ├── python3 qa/sync.py  → Kiwi TCMS (localhost:8443)
     │
     ├── Playwright tests    → qa/kiwi-results/ → Kiwi
     │   (tcms annotations)
     │
     └── cargo test          → qa/kiwi-results/ → Kiwi
         (mapped by test name)
```

## Quick Start

```bash
# 1. Start Kiwi TCMS
docker compose up -d kiwi
# First run: open https://localhost:8443, create admin user

# 2. Preview what would sync
python3 qa/sync.py --dry-run

# 3. Sync YAML → Kiwi
python3 qa/sync.py

# 4. Run tests + report to Kiwi
make test-unit               # Rust unit tests
make test-e2e                # Playwright E2E
KIWI_REPORT=1 make test-e2e  # + report results to Kiwi

# 5. View results
open https://localhost:8443   # Kiwi dashboard
make test-coverage            # CLI coverage matrix
```

## YAML Test Case Format

```yaml
module: auth
description: Authentication and session management
tests:
  - id: AUTH-001
    summary: Login with valid credentials
    layer: api          # api | unit | e2e | load
    priority: P0        # P0 (critical) → P3 (nice-to-have)
    automated: true
    test_file: "crates/medbrains-server/tests/auth_test.rs::test_login_valid"
    steps:
      - POST /api/auth/login with admin/admin123
      - Assert 200 + user.role = super_admin
```

## Commands

| Command | What |
|---------|------|
| `python3 qa/sync.py` | Push YAML test cases → Kiwi |
| `python3 qa/sync.py --dry-run` | Preview without writing |
| `python3 qa/sync.py --module auth` | Sync one module only |
| `make test-unit` | Run Rust unit tests |
| `make test-e2e` | Run Playwright E2E |
| `make test-rust` | Run all Rust tests + report |
| `make test-coverage` | Show YAML coverage matrix |

## Reporters

- **Playwright → Kiwi**: `qa/reporters/kiwi-reporter.ts` — annotate tests with `{ annotation: { type: "tcms", description: "module::summary" } }`
- **Cargo → Kiwi**: `qa/reporters/cargo-kiwi-report.py` — maps test function names to YAML case IDs

## Adding a New Test Case

1. Edit `qa/test-cases/{module}.yml`
2. Add entry with unique ID (MODULE-NNN)
3. `python3 qa/sync.py` to push to Kiwi
4. Write the actual test (Playwright or Rust)
5. Add `tcms` annotation or matching test name
6. Run tests — results appear in Kiwi
