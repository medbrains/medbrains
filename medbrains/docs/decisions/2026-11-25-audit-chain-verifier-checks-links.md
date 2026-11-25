---
date: 2026-11-25
title: The audit chain verifier checks prev_hash links, allowing the trigger's late writers
status: decided
area: audit
---

## What

`AuditLogger::verify_chain_since` (nightly and hourly) checks each row's `prev_hash` as well as its
own hash (`medbrains-db/src/audit_chain.rs`). Walking in `(created_at, id)` order, a row whose
`prev_hash` is the current head is on the main line; any other row must be a "late writer" — a
transaction that began before its parent but wrote after it — and waits for its parent later in
the walk. A row still waiting at the end, or a hash that does not recompute, breaks the chain.

Open: changing the trigger so the chain is strictly linear is the owner's call.

## Why

`_stored_prev` was read and ignored: deleting a row, or inserting one with an honestly computed
hash, left every remaining row valid and the nightly job said "valid".

A strict "previous row in created_at order" check is wrong for this trigger: `created_at` is the
transaction start, so concurrent requests produce rows linked out of that order every day, and the
strict check would page on healthy chains.

What it cannot catch, measured: rows one transaction writes share `created_at`, and the trigger
then links each to the greatest random `id` so far, so most are leaves (a new hospital's setup
rows are). Deleting or forging a leaf leaves nothing dangling. Only a trigger that stamps rows in
lock order makes the chain a line in which every deletion shows.

## Rejected

- Strict order: false alarms on every concurrent write.
- Changing the trigger to stamp rows in lock order (`clock_timestamp()` or a per-tenant counter) so
  no late writers exist: it would also catch a forged late writer, which this cannot, but it is a
  migration on the hottest table. Proposed to the owner as a follow-up, with incremental
  checkpointing (not re-walking every row nightly).
