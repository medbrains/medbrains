# Contributing to MedBrains

Thank you for helping. MedBrains is a hospital information system — the code can affect patient safety — so we hold a high bar. This guide gets you set up and explains the rules that keep the project safe.

## Ways to contribute

- **Code** — fix a bug, finish a screen, improve performance or accessibility.
- **Clinical and domain review** — if you are a clinician, pharmacist, nurse or hospital administrator, tell us where a workflow or a regulatory rule is wrong. This is some of the most valuable help we get.
- **Docs and translations** — the README, RFCs, the user guide (`medbrains/apps/docs`) and UI strings (the app uses react-i18next).
- **Triage** — reproduce issues and help others.

## Before you start

1. Search the [issues](https://github.com/DomnicAmalan/MedBrains/issues). Much is already in progress; the [roadmap](./ROADMAP.md) shows what.
2. For anything non-trivial, **open an issue first** and agree the approach — especially a new screen (we plan the UI before building it) or anything touching clinical, regulatory or authorisation logic.
3. Read [`CLAUDE.md`](./CLAUDE.md). It is the source of truth for how this codebase is built: coding standards, the permissions-first rule, the module build workflow and the regulatory checklist.

Issues suited to a first contribution are labelled [`good first issue`](https://github.com/DomnicAmalan/MedBrains/labels/good%20first%20issue) when we have them.

## Licensing and the CLA

MedBrains is offered under the AGPL-3.0 or a commercial licence ([COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md)). For that to work, the project needs the right to offer every contribution under both. You keep your copyright; you grant that right by accepting the [Contributor Licence Agreement](./CLA.md):

- sign off every commit with `git commit -s`, which adds a `Signed-off-by:` line (the Developer Certificate of Origin); and
- confirm the CLA once, on your first pull request, as the PR template asks.

We do not merge a pull request whose commits are not signed off.

> **Never commit real patient data.** Use only synthetic or de-identified data in code, tests, seeds and fixtures. A pull request that contains anything resembling patient data will be closed and the history scrubbed.

## Development setup

See the [quick start](./README.md#quick-start). In short, from `medbrains/`:

```bash
cp .env.example .env
pnpm install
make db && make dev-db-roles     # Postgres and friends in Docker; dev role passwords (once)
make dev-backend                 # the API server; migrations run on start
make dev-frontend                # the web app on http://localhost:5173
```

`make doctor` looks for the usual traps (root-owned caches, low disk, a busy cargo, a missing `.env`) and prints the fix. `make help` lists every target.

The Rust workspace is large. Run `medbrains/scripts/build_guard.sh` before a cargo build, check or test — it tells you whether another build is running — and never run two at once on a laptop.

## Coding standards, in short

The full rules are in [`CLAUDE.md`](./CLAUDE.md).

**Rust**
- Edition 2024, MSRV 1.85. `unsafe` is forbidden. Clippy is strict: `unwrap_used`, `expect_used`, `panic`, `todo`, `dbg_macro` and `print_*` are denied.
- Compile-time-checked SQL (`sqlx::query!` and friends), with `.sqlx/` metadata committed and `SQLX_OFFLINE=true` for builds. Every tenant table has `tenant_id` and row-level security; set the tenant context on the transaction.
- `thiserror` in libraries, `anyhow` at the edges, `?` to propagate.
- **Permissions first:** define a new permission in `crates/medbrains-core/src/permissions.rs` before writing the handler or the screen, then run `python3 scripts/generate_permissions_ts.py` from `medbrains/`. Never hand-edit `packages/types/src/permissions.ts`.
- An authorisation fault is not a refusal: keep allow, deny and unknown distinct.

**TypeScript and React**
- Strict TypeScript, no `any`.
- Build screens from the `@/components/ui` seam, then Mantine. No raw `<button>`, `<input>`, `<table>` or inline `<svg>`; layout with Mantine's `Box`, `Stack`, `Group` and `Grid`. Icons from `@tabler/icons-react`.
- Colour only from theme tokens; both light and dark themes must pass WCAG 2.2 AA.
- **Accessibility is mandatory (WCAG 2.2 AA):** everything keyboard-operable, visible focus, 24px minimum targets, `aria-label` on icon-only controls, real labels on inputs, never colour alone, honour `prefers-reduced-motion`.
- Server data through TanStack Query, validated with Zod. Avoid `useEffect` (see the policy in `CLAUDE.md`). Forms with React Hook Form and Zod.
- Biome for lint and format.

**Native apps**
- New mobile work goes in `medbrains/apps/ios` (SwiftUI) and `medbrains/apps/android` (Compose), on both platforms together. The React Native apps are reference only — please do not send changes to them.

**Everywhere**
- Every change ships its UI: a new endpoint comes with the screen that uses it.
- Delete dead code; no commented-out blocks or code "for later".
- Check the applicable regulatory norms before building a clinical feature (`CLAUDE.md`, "Regulatory & Compliance Norms").

## Pull requests

1. Branch from `master`: `feature/<short-name>` (or `fix/…`, `docs/…`).
2. Keep each pull request to one logical change, and link its issue (`Closes #123`).
3. Make the gates pass:
   - backend: `cargo fmt --check` and `cargo clippy` for the crates you touched, and their tests;
   - frontend: `make lint`, `pnpm typecheck`, `pnpm build`;
   - both: `make check-all` (API contract, permissions, row-level security, UI seam and more). `make gate` runs the lot.
4. Write commit messages in the imperative, saying why the change matters, not only what it does — for example "Hold the discharge bill until the stay's charges are complete".
5. Describe how you verified the change. For anything with a screen, that means using it in the running app as the role that would use it.
6. New modules and endpoints need tests; new screens need an accessibility pass.

A maintainer reviews every pull request. Accepted pull requests are **squash-merged** into `master`, so the pull request title becomes the commit message — write it the same way.

## Reporting security issues

Do **not** open a public issue for a vulnerability. Follow [SECURITY.md](./SECURITY.md).

---

Questions? Open an issue or write to hello@medbrains.in. Welcome aboard.
