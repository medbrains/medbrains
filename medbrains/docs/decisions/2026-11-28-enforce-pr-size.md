---
date: 2026-11-28
title: CI and the commit hook refuse a change over the pull request size limit
status: decided
area: engineering
---
## What

`scripts/check_pr_size.py` counts hand-written lines and files (lockfiles, `.sqlx`, generated code and snapshots left out) and refuses more than 400 lines (500 when tests are at least half) or more than 10 files. It runs in the PR evidence workflow on every pull request and in the pre-commit hook against the newest release branch. A mechanical change may go over with a "mechanical: <how>" line in the body (or MB_MECHANICAL=1 when committing), never when the risk class is safety.

## Why

The owner asked for the size limits to be enforced in CI and in commit checks, not left to care: large changes are reviewed worse, conflict more and rerun CI longer.

## Rejected

A warning only: limits that are only advice get skipped under time pressure. Counting lockfiles and generated files: they are not reviewed by reading, and would make every dependency update fail.
