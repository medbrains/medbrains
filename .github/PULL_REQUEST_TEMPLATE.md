<!-- Thanks for contributing to MedBrains! Keep PRs focused on one logical change. -->

## What & why

<!-- What does this change do, and why? Link the issue: Closes #123 -->

## How I verified

<!-- Commands run / scenarios tested. e.g. cargo clippy, pnpm typecheck, make check-all, manual steps -->

## Checklist

- [ ] Commits are signed off (`git commit -s`) — required (DCO/CLA)
- [ ] No real patient data (PHI) anywhere — synthetic/de-identified only
- [ ] `cargo clippy` + `cargo fmt --check` clean (backend changes)
- [ ] `pnpm typecheck` + `pnpm build` pass (frontend changes)
- [ ] `make check-all` passes (API contract / UI-API / type contracts) where relevant
- [ ] Tests added/updated for new modules or endpoints
- [ ] New/changed UI is accessible (keyboard, focus, labels, `prefers-reduced-motion`)
- [ ] Checked applicable regulatory norms for clinical changes (see CLAUDE.md)
- [ ] Docs/RFCs updated if behaviour or architecture changed

## Notes for reviewers

<!-- Anything reviewers should pay special attention to (safety-critical paths, migrations, etc.) -->
