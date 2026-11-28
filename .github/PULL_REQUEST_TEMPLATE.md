<!-- One logical change, about 400 changed lines. The lifecycle is in medbrains/docs/AI-SDLC.md. -->

## Not verified

<!-- FIRST, not last: every part you did not check, and why. Write "Nothing" if that is true. -->

## What & why

<!-- What changes, why, and what could break, in words the owner can check. Link the issue: Closes #123 -->

- Risk class: <!-- safety (medication, patient identity, money, authorization, migrations, update path, security) | standard | low -->
- Severity, for a defect: <!-- S1 | S2 | S3 | S4 -->

## Acceptance scenarios

<!-- Each Given/When/Then from the ticket, with pass or fail and how it was checked. -->

## Permission and screen

- Permission: <!-- the Rust constant; or "new: ..." (defined in Rust first); or "none, because ..." -->
- Screen: <!-- route and role; or "no screen, unblocks <screen>" -->

## How verified on screen

<!-- For any change under apps/web/src, apps/ios, apps/android or packages/design-system: screenshots from the running app at 1024, 1366 and 1920 wide, in light and dark, for each state touched (loading, empty, error, permission denied), signed in as the role that uses it. Synthetic data only. Otherwise: "No screen change". -->

## Call path

<!-- For new or changed behaviour, show how a request flows, entry point first, one line per call, with file:line. New functions marked with +. Skip for docs-only changes. Example:

POST /api/hr/leave-requests                  routes/mod.rs:812
└─ create_leave_request(claims, body)        hr/src/leave.rs:44
   ├─ require_permission(HR_LEAVE_REQUEST)   server-core/.../authorization.rs:18
   ├─ + check_overlap(staff_id, range)       hr/src/leave.rs:101
   └─ + debit_balance(tx, staff_id, days)    hr/src/leave.rs:130
-->

## Gate output

<!-- The last lines of `make gate`, and of `cargo clippy --locked --workspace --exclude medbrains-desktop` for Rust changes (the whole workspace, as CI runs it, not -p <crate>). -->

## Checklist

- [ ] I have signed the [contributor licence agreement](../CLA.md), or I am a maintainer — required
- [ ] No real patient data (PHI) anywhere — synthetic/de-identified only
- [ ] A test that failed on the old code comes with the change
- [ ] The gate passed locally: the same commands CI runs
- [ ] `make check-all` passes (API contract / UI-API / type contracts) where relevant
- [ ] Reviewed by someone, or an agent, that did not write it; findings fixed
- [ ] Safety class: the owner's read is requested
- [ ] CI is green for the current head commit, and the base branch is not in a release freeze
- [ ] New/changed UI is accessible (keyboard, focus, labels, `prefers-reduced-motion`)
- [ ] Checked applicable regulatory norms for clinical changes (see ENGINEERING.md)
- [ ] Follows `medbrains/docs/OS-PRINCIPLES.md`: least privilege, fail-safe defaults (faults are Unknown, never Allow), complete mediation through the kernel, crash-only/idempotent, everything bounded
- [ ] Docs/RFCs updated if behaviour or architecture changed
- [ ] Decision made, or a failure that could recur? Row added to `medbrains/docs/DECISIONS.md`
- [ ] Written by AI: the `ai-authored` label is set

## Notes for reviewers

<!-- Anything reviewers should pay special attention to (safety-critical paths, migrations, etc.) -->
