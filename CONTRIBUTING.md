# Contributing to MedBrains

Thank you for helping build open health infrastructure. MedBrains is a hospital management system — the code can affect patient safety, so we hold a high bar. This guide gets you productive and explains the rules that keep the project safe and sustainable.

## Ways to contribute

- **Code** — fix a bug, build a module, improve performance or accessibility.
- **Clinical/domain review** — you're a clinician, pharmacist, or hospital administrator? Tell us where our workflows or regulatory logic are wrong. This is gold.
- **Docs & translations** — README, module RFCs, UI strings (the app is i18n-ready).
- **Triage** — reproduce issues, label, and help others.

## Before you start

1. **Search existing [issues](https://github.com/DomnicAmalan/MedBrains/issues) and [discussions](https://github.com/DomnicAmalan/MedBrains/discussions).** Many things are already in progress.
2. For anything non-trivial, **open an issue first** to agree on the approach — especially for new screens (we plan UI before building) and anything touching clinical or regulatory logic.
3. Read the architecture, coding standards, and module workflow in [`medbrains/CLAUDE.md`](./medbrains/CLAUDE.md). It's the source of truth for how this codebase is built.

## Licensing & the CLA

MedBrains is **dual-licensed** (AGPL-3.0 + commercial). To keep that sustainable, every contributor accepts the [Contributor License Agreement](./CLA.md) once, via:

- **Sign-off on every commit:** `git commit -s` (adds `Signed-off-by:` — the Developer Certificate of Origin).
- A one-time CLA confirmation on your first PR (a bot will prompt you).

No sign-off, no merge — the CI checks for it.

> **Never commit real patient data.** Use only synthetic or de-identified data in code, tests, seeds, and fixtures. This is a hard rule; PRs containing anything resembling PHI will be rejected and the history scrubbed.

## Development setup

See the [Quickstart](./README.md#quickstart). In short:

```bash
cd medbrains
docker compose up -d                       # PostgreSQL 16
make dev-backend                           # Axum on :8080 (migrations auto-apply)
pnpm install && pnpm --filter=@medbrains/web dev   # Vite on :5173
```

## Coding standards (the short version)

Full rules live in [`CLAUDE.md`](./medbrains/CLAUDE.md). The essentials:

**Rust**
- Edition 2024, MSRV 1.85. `unsafe` is forbidden. Strict clippy (`all` denied; `unwrap_used`/`expect_used`/`panic`/`todo`/`print_*` denied).
- Compile-time-checked SQL only (`sqlx::query!` family). Every tenant-scoped table has `tenant_id` + RLS; set context per request.
- Errors: `thiserror` in libraries, `anyhow` at application edges. Propagate with `?`.
- `cargo fmt` + `cargo clippy` must be clean.

**TypeScript / React**
- Strict TypeScript — no `any`, no plain `.js`.
- Build UI from the `@/components/ui` seam; **never hand-roll raw HTML** (`<button>`/`<input>`/`<table>`/inline `<svg>`) — use a component. Layout via Mantine primitives (`Box`/`Stack`/`Group`/`Grid`), not bare `<div>`.
- **Accessibility is mandatory (WCAG 2.1 AA).** Keyboard-operable everything, visible focus ring, `aria-label` on icon-only controls, real labels on inputs, honour `prefers-reduced-motion`. Enforced by strict Biome a11y rules.
- All server data through TanStack Query; validate responses with Zod. Avoid `useEffect` (see the useEffect policy in CLAUDE.md).
- Biome for lint + format.

**General**
- Remove dead code immediately — no commented-out blocks, no "for later" speculation.
- Boy-Scout Rule: leave files better than you found them.
- Check applicable regulatory norms **before** building a clinical feature (see CLAUDE.md → Regulatory & Compliance).

## Pull requests

1. Branch from `master`: `feature/<short-name>`.
2. Keep PRs focused — one logical change.
3. Make the checks pass: `cargo clippy`, `cargo fmt --check`, `pnpm typecheck`, `pnpm build`, `make check-all` (API contract + UI/API coverage + type contracts), and the relevant tests.
4. Write a clear PR description: what changed, why, and how you verified it. Reference the issue.
5. New modules/endpoints need tests (CRUD + integration). New screens need an accessibility pass.

A maintainer will review. We aim to be responsive and kind — see the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Reporting security issues

**Do not** open a public issue for a vulnerability. Follow [SECURITY.md](./SECURITY.md).

---

Questions? Open a [Discussion](https://github.com/DomnicAmalan/MedBrains/discussions). Welcome aboard. 💚
