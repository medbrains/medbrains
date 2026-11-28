---
date: 2026-11-25
title: Remove GET /api/audit/verify-integrity and its "Verify Integrity" button
status: decided
area: audit
---

## What

The route, handler, client method, service entry and the button on Audit log are removed. The
Audit page's "Chain integrity" tab, which lists the nightly verifier's results
(`/api/audit/chain-verifications`), is the only integrity answer on screen.

## Why

It read the first 5,000 rows, recomputed no hash, and reported "valid across N entries": a false
"valid" on any chain longer than 5,000 rows, and a tamper it could not see.

## Rejected

- Pointing the button at the real verifier: a full walk of a hospital's chain is minutes of a
  database connection, not a button press. The nightly result is already on the next tab.
