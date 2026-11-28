---
date: 2026-11-25
title: The route table is a committed snapshot of every route and how it refuses
status: decided
area: bricks
---

## What

`crates/medbrains-server/tests/route_table_snapshot_test.rs` builds the real router, lists every
route from the router's `Debug` output (axum 0.8.9), and sends each one an anonymous request and,
for methods CSRF guards, a signed-in cookie request with no CSRF token. The
`METHOD path anon=<status> nocsrf=<status>` lines must equal `tests/route_table.snapshot`.
`UPDATE_ROUTE_SNAPSHOT=1` rewrites it.

## Why

The mount-registry and brick-split steps move routers out of `routes/mod.rs`, where auth, CSRF and
rate limits are layered by position. A move that drops a guard must show up as a changed line in
review, and a move that changes nothing must leave the file alone.

## Rejected

- A lazy pool with no database: a request with a session token checks its permission version
  in the database before CSRF runs, so every `nocsrf` line would read 503.
- Probing GET routes with the session: that runs every read handler as an admin. It is a smoke
  test, not a guard check, and its answers depend on the data. CSRF does not apply to them; they
  show `-`.
- Parsing `routes/mod.rs` source text: it misses routes that bricks' crates add, which is the half
  of the table that moves.
