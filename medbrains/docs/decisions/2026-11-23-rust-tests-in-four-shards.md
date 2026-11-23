---
date: 2026-11-23
title: CI runs the Rust tests on four runners, and one job reports for them
status: decided
area: ci
---

## What

`ci.yml`'s Rust tests job is a matrix of four shards. Each shard builds the workspace and runs
a quarter of the tests with `cargo nextest run --partition count:N/4`, against its own
PostgreSQL, one test at a time as before. Shard 1 also runs the doc tests.

A new job, `rust-test-result`, carries the name "Rust tests" that branch protection requires.
It passes only when all four shards passed, joins their JUnit files into the one `rust-junit`
artifact `e2e.yml`'s test report reads, and publishes the "Rust test results" check. When a PR
changes no Rust the shards and this job are skipped, which counts as passing, as before.

## Why

The job took 37 to 63 minutes on 22 pull request runs on 2026-11-22 (median 50). In the run
measured step by step (job 137169177222), 15 minutes were the build and 46 were the tests, and
44 of those 46 were one binary: `medbrains-server::integration`, 1,011 tests at about 2.6
seconds each, one at a time because they share one hospital in one database. Faster compiling
cannot shorten that; running the tests on more runners can. Four shards make it about 15
minutes of build plus 12 of tests on each runner.

## Rejected

- **Several tests at once on one runner.** The integration tests set hospital-wide values and
  overwrite each other (17 failed that way on their first CI run). It needs a database per
  test slot and a change to the test harness, which is a code change, not a CI setting.
- **Build once, then hand the test binaries to the shards** (`cargo nextest archive`). It saves
  runner minutes, not waiting time, and moves several gigabytes of debug binaries between
  jobs. Worth measuring after this.
- **More than four shards.** The 15-minute build is paid on every shard; past four the wait
  falls by less than two minutes a shard.
