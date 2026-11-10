---
title: Ratchets and quality gates
sidebar_position: 3
description: "The MedBrains ratchets and quality gates: kernel boundary, size budgets, file length, UI slop, coverage and Sonar: what each measures and who updates it."
---

# Ratchets and quality gates

A ratchet records today's number in a baseline file and fails when a change
makes it worse. Improvements are locked in with `--update`.

:::info Who runs `--update`
Only the owner runs `--update` on a baseline. If your change improves a
number, say so in the PR. If it makes one worse, fix the change, or explain
why in the PR and ask.
:::

| Gate | Command | Measures | Baseline |
|---|---|---|---|
| Kernel boundary | `make check-kernel-boundary` | App crates that reach tenancy, authorization, audit, sequences, storage or config without going through `medbrains-kernel` | `crates/medbrains-kernel/boundary.txt` |
| Kernel has no domain | `make check-kernel-no-domain` | No domain crates below the kernel and no hospital words in it | none: any hit fails |
| Size budgets | `make check-size-budgets` | Kernel lines and dependencies, package and crate counts, web first-load size | `scripts/size_budgets.json`; a new kernel dependency needs a reasoned hand edit |
| UI slop | `make check-ui-slop` | Decorative effects in the web app; any rise fails | `scripts/ui_slop_baseline.json` |
| File length | `python3 scripts/check_file_lengths.py` | Lines per `.rs`, `.ts`, `.tsx`, `.scss` file (450 by default) | none; not wired into CI yet |
| Coverage ledger | `make coverage-ledger-check` | End-to-end coverage per module | `scripts/coverage_ledger.baseline.json` |
| Authz ledger | `make authz-ledger` | Authorization conformance per module on four axes | reports only, does not gate |
| Sonar | `sonarqube.yml` | Code quality, duplication, hotspots, web coverage | ignores in `sonar-project.properties`; not a required check |

Other ratchets with baselines: UI permission match, soft-delete filters,
tenant leaks and runtime SQLx calls. The CI contracts job runs the kernel,
size-budget and UI-slop checks.

## Why ratchets

A hospital system grows by hundreds of files a month. A rule enforced only on
new code lets the old debt stand; a ratchet lets the debt only shrink, without
blocking work on a big-bang cleanup.
