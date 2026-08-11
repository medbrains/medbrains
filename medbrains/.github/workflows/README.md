# These workflows do not run

GitHub only reads workflows from `.github/workflows/` at the **repository
root**. This directory is `medbrains/.github/workflows/`, one level down, so
nothing here has ever executed — `gh api .../actions/runs` reports zero runs for
the life of the repo.

The live pipeline is `/.github/workflows/ci.yml` at the root.

## Why these were not simply moved

They cannot pass as written:

- `ci.yml` uses `dtolnay/rust-action@stable`, which does not exist (the real
  action is `dtolnay/rust-toolchain`).
- No job sets `working-directory`, so the Python steps (which resolve from the
  repo root) and the cargo steps (which need `medbrains/`) cannot both work.
- `cargo clippy --all-targets --all-features -- -D warnings` cannot pass on
  this tree, and `cargo fmt --check` reports over a thousand diffs.

The root `ci.yml` starts from what is verified green and carries the rest as
`continue-on-error` so the gap is measured rather than hidden.

## Still to migrate

Real work lives in these files that the root pipeline does not yet cover:

| File | What it has |
|---|---|
| `ci.yml` | Playwright E2E, Docker build, `cargo audit`, `pnpm audit` |
| `security.yml` | security scanning |
| `spicedb-validate.yml` | authz schema validation |
| `release.yml`, `desktop.yml` | release + desktop packaging |

Move them job by job, verifying each against a runner rather than in bulk.
Deleting them would lose the work; leaving them unlabelled implied a safety net
that was not there.
