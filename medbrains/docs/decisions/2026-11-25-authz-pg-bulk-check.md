---
date: 2026-11-25
title: The Postgres authorization backend answers a bulk check in one statement, and a single check is a bulk check of one
status: decided
area: authz
---

## What

`PgAuthzBackend` overrides `bulk_check`: the items are unnested into rows and each row runs the
`EXISTS` the single check ran (object or `<parent>->view` arrow, implied relations, active,
unexpired, uncaveated, user / role / department / live group member). `check` now calls it with one
item, so the resolution rules exist once. `combined_bulk_check` (SpiceDB pair) already called
`pg.bulk_check`, so it gets the same gain without a change.

An unregistered type, an invalid relation or any fault fails the whole call; no item is reported
denied because it could not be answered.

## Why

The trait default ran one transaction per item: up to ~100 per patient open and ~300 per list
page, each with its own `BEGIN`, `set_config` and `COMMIT`.

## Rejected

- A second copy of the SQL for bulk next to the single-check SQL: two copies of a security rule
  drift. One statement for both.
- Multi-hop traversal (department hierarchy, nested groups): SpiceDB, the source of truth, models
  none; adding it here would make the fallback more permissive.
- Partial answers on a fault (answered items plus unknown ones): the trait returns a map of
  booleans, so an unanswered item would have to be a missing key, which a caller could read as
  "no". A whole-call error is the trait default's behaviour too.
