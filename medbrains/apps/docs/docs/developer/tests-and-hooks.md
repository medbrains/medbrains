---
title: Tests, checks and hooks
sidebar_position: 3
description: "How to run MedBrains tests and static checks locally: Rust and TypeScript tests, Playwright journeys, make check-all, the pre-merge gate and git hooks."
---

# Tests, checks and hooks

All commands run from `medbrains/`.

## Tests

| Command | Runs |
|---|---|
| `make test-unit` | Rust unit tests that need no database |
| `make test-rust` | All Rust tests |
| `make test-ts` | TypeScript unit tests (Vitest) |
| `make test-e2e` | Playwright end-to-end journeys |
| `make test-all` | Rust and TypeScript tests |

## Static checks

| Command | Checks |
|---|---|
| `make check-all` | About 55 static checks: API contract, UI coverage, types, RLS, permissions and more |
| `make check-api` | Every client method has a route, and every route a client method |
| `make check-permissions` | The TypeScript permission catalogue matches the Rust constants |
| `make check-docs` | Every function this branch adds or changes has a doc comment |
| `make lint` | Biome lint and format check |
| `make gate` | The strict pre-merge gate |

The [ratchets and quality gates](/developer/reference/ratchets/) page lists
the checks that only ever allow things to get better.

## Hooks

:::note
There is no `make hooks` target yet. The migration hook in
`medbrains/.githooks/pre-commit-migrations.sh` lints migration headers and
row-level security on staged migrations. Install it with
`git config core.hooksPath .githooks`.
:::

Contributors using Claude Code get the versioned hooks in
`.claude/settings.json`, which run each edited file's fast checks.
