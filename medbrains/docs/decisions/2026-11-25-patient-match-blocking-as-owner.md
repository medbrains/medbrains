---
date: 2026-11-25
title: The duplicate-patient check blocks candidates in a SECURITY DEFINER function
status: decided
area: patients
---

## What

`patient_match::fuzzy_matches` gets its candidates from `patient_match_candidates` (migration
1493): one indexed arm per blocking key (similar first or last name either way round, same date
of birth, same last ten mobile digits), run as the table owner, returning at most the candidate
limit of patient ids, only for a hospital the caller may see. The rows are then read as the
caller, so every `patients` policy still applies. The mobile key has an expression index
(migration 1497, built concurrently).

## Why

Every check read all of a hospital's patients: about 420 ms at 200,000 patients, on every
registration and every storefront customer. Writing the keys as a union of `%` arms is not enough,
because the request role is under row level security and PostgreSQL will not use a non-LEAKPROOF
operator (pg_trgm's `%`, `regexp_replace`) as an index condition ahead of a policy; the plan stays a
full scan of the tenant. Run as the owner, the same arms are index scans (1.3 ms).

## Rejected

- Marking `similarity_op` and `regexp_replace` LEAKPROOF: needs a superuser and is not true of them.
- A stored `phone_last10` column: a generated column rewrites `patients` under an exclusive lock,
  and a trigger plus backfill UPDATE writes an audit row and a new version of every patient.
- Lowering the similarity threshold or dropping a key: changes who is found.
