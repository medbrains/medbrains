# Contributing to MedBrains

Thank you for helping. MedBrains runs hospitals, so the code can affect patient safety. We keep a high bar, and we are glad to help you meet it.

## Ways to contribute

- **Clinical review.** Doctors, nurses, pharmacists and administrators: tell us where a workflow or rule is wrong. Open an issue and describe what really happens on the ward.
- **Code.** Fix a bug, finish a roadmap item, improve speed or accessibility.
- **Translations.** The web app's interface text is translatable.
- **Docs.** Setup guides, how-tos, screenshots.
- **Triage.** Reproduce bugs and help others in Discussions.

Good first tasks are listed in the README under [Contributing](./README.md#contributing) and labelled `good first issue`.

## Before you start

1. Search the [issues](https://github.com/medbrains/medbrains/issues) and [discussions](https://github.com/medbrains/medbrains/discussions). Someone may already be on it.
2. For anything bigger than a small fix, **open an issue first** and agree on the approach. This matters most for new screens and for anything touching clinical or regulatory rules.
3. Read [`CLAUDE.md`](./CLAUDE.md). It holds the architecture, coding standards and module workflow.

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/). By signing off you confirm that you wrote the change, or have the right to submit it, under the project's [Apache 2.0 licence](./LICENSE).

Add `-s` to every commit:

```bash
git commit -s -m "Explain why the change is needed"
```

This adds `Signed-off-by: Your Name <you@example.com>`. Use your real name. Pull requests with unsigned commits cannot be merged. To fix the last commit, run `git commit --amend -s`.

## Never commit real patient data

Use only synthetic or fully de-identified data in code, tests, seeds, screenshots and issues. No real names, phone numbers, IDs or records, and no hospital's internal documents. Pull requests containing anything that looks like patient data are closed, and the history is cleaned.

## Development setup

**You need:** macOS or Linux, Docker, Rust 1.85+ via `rustup`, Node 24 and pnpm 10.

```bash
cd medbrains
cp .env.example .env
make db              # PostgreSQL and supporting services in Docker
make dev-db-roles    # database roles for the app
make dev-backend     # server on :3000, runs migrations
pnpm install
pnpm dev:web         # web app on http://localhost:5173
```

The workspace has about 119 Rust crates. The first build is slow and uses a lot of disk. Run only one cargo build at a time, and build just the crate you changed (`cargo clippy -p <crate>`). SQL metadata is committed in `.sqlx/`, so builds work offline with `SQLX_OFFLINE=true`.

## Code style

The full rules are in [`CLAUDE.md`](./CLAUDE.md). The essentials:

**Rust**
- Edition 2024. `unsafe` is forbidden.
- Strict clippy: `unwrap`, `expect`, `panic`, `todo` and `print*` are denied. Propagate errors with `?`, and use `thiserror` in library crates.
- Compile-time-checked SQL only (`sqlx::query!` and related macros). Every hospital-scoped table has `tenant_id` and row-level security.
- `cargo fmt` and `cargo clippy` must be clean.

**TypeScript / React**
- Strict TypeScript, no `any`.
- Build screens from the `@/components/ui` components and Mantine. No raw `<button>`, `<input>` or `<table>`, and no inline `<svg>` (icons come from `@tabler/icons-react`).
- Server data goes through TanStack Query; forms use React Hook Form and Zod.
- Biome formats and lints: run `pnpm lint`.

**Accessibility (required).** Follow WCAG 2.2 AA: everything works from the keyboard, focus is visible, icon-only buttons have an `aria-label`, inputs have labels, and meaning is never shown by colour alone.

**Permissions first.** A new action defines its permission in Rust (`medbrains/crates/medbrains-core/src/permissions.rs`) before any handler or screen. Then run `python3 scripts/generate_permissions_ts.py` from `medbrains/`, and never hand-edit `packages/types/src/permissions.ts`.

**Keep it clean.** Delete dead code; don't comment it out. Don't add code "for later".

## Pull requests

1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Keep one logical change per PR, with its screen, its API and its tests together.
3. Make the checks pass: `cargo fmt --check`, `cargo clippy`, `pnpm typecheck`, `pnpm build` and `make check-all`.
4. In the description, say what changed, why, and how you checked it. Link the issue (`Closes #123`).
5. Add tests for new endpoints and screens. A test should fail if the behaviour breaks.

A maintainer will review. Please be kind; see the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](./SECURITY.md).

## Licence

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](./LICENSE). You keep your copyright.
