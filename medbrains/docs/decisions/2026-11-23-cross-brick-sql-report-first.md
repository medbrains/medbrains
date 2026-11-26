---
date: 2026-11-23
title: Cross-brick SQL is reported and warned on before it is enforced
status: decided
area: architecture
---

## What

`scripts/check_brick_tables.py` counts SQL references from one brick's crates to tables another
brick owns: 807 reads and 92 writes over 124 brick pairs on 2026-11-23. The numbers per pair
are in `scripts/brick_tables.baseline.txt`. The CI step prints what changed and raises a
warning when a pair's writes rise. It never fails a run, and it is not in `make check-all`.

It turns into a failing check, writes first, once the owner map is settled (the brick manifests
of #6196 give a stricter one) and a few weeks of runs have shown what it gets wrong.

## Why

The crate graph has 18 brick to brick edges; the tables have about 900 references. That is
where bricks are really joined. But the count comes from matching SQL keywords in text and
from guessing a table's owner by who writes it most. A check like that blocks honest work on
its false alarms, and a check that blocks honest work gets switched off.

## Rejected

- Failing from day one: the owner of `encounters`, `invoices` and `vitals` is a guess, and a
  move of code can change the guess and the counts with no new SQL written.
- Waiting for #6196 before measuring anything: writes are being added now.
- Reading the `.sqlx` offline cache for exact statements: it covers the checked macros only,
  not SQL passed to `sqlx::query(` as a string, and does not say which crate a query is in.
- Counting base and shared crates as well (print data alone has about 580 references): they
  are not bricks, and their reads need views owned by each brick, which is later work.
