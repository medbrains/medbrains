---
date: 2026-11-28
title: Squawk lints every migration a pull request adds, so a lock or rewrite of a big table fails
status: decided
area: engineering
---
## What

`scripts/check_new_migrations_squawk.py` runs [Squawk](https://squawkhq.com) 2.74.0 (PostgreSQL 17 rules, config in `medbrains/.squawk.toml`) on the migration files a branch adds against its base. It blocks in the `migration-lint` CI job (a pinned binary checked by sha256) and runs in the pre-commit hook on staged new migrations, skipping with an install hint when squawk is not installed. The migrations already merged are not linted: a ratchet, like the docs and size checks.

sqlx::migrate!() runs each file in a transaction unless its first line is `-- no-transaction`, so normal files are linted with `assume_in_transaction` and marked files without it. `CREATE INDEX CONCURRENTLY` therefore passes in a `-- no-transaction` file (our pattern: one statement per file, as in 1494) and fails anywhere else. A deliberate exception is a `-- squawk-ignore <rule>` comment above the statement, with its reason.

Rules kept: everything Squawk enables by default for PostgreSQL 17 apart from those below, including `adding-not-nullable-field`, `require-concurrent-index-creation`, `adding-field-with-default` (volatile defaults), `constraint-missing-not-valid`, `adding-foreign-key-constraint`, `changing-column-type`, `renaming-column`/`renaming-table` and `require-lock-timeout` (a migration waiting on a lock queues every query behind it; `SET LOCAL lock_timeout = '5s';` is one line, as 1452 already does).

Rules excluded, one reason each:

- `require-statement-timeout`: it would abort the long backfills and index builds that must finish; waiting on locks is what stalls the hospital, and `require-lock-timeout` covers that.
- `ban-drop-column`, `ban-drop-table`, `ban-drop-constraint`, `ban-drop-function`: client compatibility, not locks; every drop is declared in the migration's `Drops:` header (`migration_header_lint.py`) and the server ships with its migrations embedded.
- `prefer-bigint-over-int`, `prefer-bigint-over-smallint`: keys are uuid and the int columns are small counters; a style rule, not a lock.
- `require-lock-timeout`, in `-- no-transaction` files only: the file must be the one CONCURRENTLY statement, since a `SET` beside it makes Postgres run the file as one implicit transaction and refuse the build.

On the last 30 migrations (1438 to 1494) the kept rules would have fired 26 times in 14 of the 17 transactional files (the 13 `-- no-transaction` index builds pass): `require-lock-timeout` in 13, and real locks in 7: CHECK constraints added without NOT VALID (1450, 1454, 1461, 1480), a volatile default (1452), SET NOT NULL (1457), foreign keys added to an existing table (1461) and non-concurrent indexes on `patients`, `encounters` and `uhi_transactions` (1461, 1475). Squawk does not see inside a `DO` block, so 1489's column type change passed; that stays a review item.

## Why

The owner approved it (MB-162): a migration that takes an ACCESS EXCLUSIVE lock or rewrites a large table stops the wards while it runs, and review alone had let several through, as the list above shows.

## Rejected

Linting every migration: the merged ones cannot be changed, and failing on them would block every PR. `npm install -g squawk-cli` unpinned: an unverified download in CI. Excluding `require-lock-timeout` everywhere because few existing files set it: it is the cheapest guard against a migration stalling every query, and it costs one line. Setting the lock timeout once in the migration runner instead: a good follow-up, but it is Rust and a separate change.
