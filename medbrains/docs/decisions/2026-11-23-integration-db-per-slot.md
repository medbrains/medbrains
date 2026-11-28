---
date: 2026-11-23
title: The server's integration tests run in parallel, one database per runner slot
status: decided
area: ci
---

## What

Under cargo-nextest, each parallel slot of a run gets its own database for the server's
integration suite, copied from the migrated template (`medbrains_db_migrations::testing::slot_db`)
and seeded with its own hospital. A test process reads its slot from `NEXTEST_TEST_GLOBAL_SLOT`
and reuses "slot N's database"; tests that land in the same slot still run one after another
on it. The `ci` profile runs 4 slots. Every other test binary runs alone, as before
(`threads-required = "num-test-threads"`). Plain `cargo test` is unchanged: one database,
`RUST_TEST_THREADS=1`.

One PostgreSQL server, no more. A slot's pools are capped at 10 connections each; 21 per slot
at worst, 84 of the default 100 with four slots.

## Why

The suite is 1,011 tests in one binary and took 44 of the Rust test job's 50 minutes, because
they share one hospital in one database and about 24 of them change hospital-wide settings; run
in parallel on one database, 17 failed. A database per slot keeps what the tests assume (nobody
else touches my hospital while I run) and removes what made them slow (nobody else runs at all).

It combines with splitting the job over runners (`--partition`): each runner has its own
PostgreSQL and its own slots.

## Rejected

- **A database per test** (`fresh_db`, as the smaller crates do). Seeding a hospital costs more
  than most of these tests; a thousand seeds is slower than today.
- **A tenant per test in one database.** The right end state, and it means editing most of the
  thousand tests. This needs none edited.
- **Several PostgreSQL servers.** More memory and set-up for nothing a database does not give.
- **Dropping the slot databases at the end of the run.** nextest has no end-of-run hook; the
  existing sweep of copies older than an hour does it, and a CI runner is thrown away.
- **`test-threads = "num-cpus"`.** The connection budget is slots x 21; a bigger runner would
  pass PostgreSQL's 100 without anyone deciding to.
