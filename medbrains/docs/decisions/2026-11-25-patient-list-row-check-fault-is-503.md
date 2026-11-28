---
date: 2026-11-25
title: A failed per-row authorization check on the patient list is a 503
status: decided
area: authz
---

## What

`list_patients` computes row flags in `listed_patient_perms`: an error from `bulk_check` is a 503
"authorization backend unavailable", as an error from `list_accessible` already was. Viewer is no
longer re-asked for ids `list_accessible(Viewer)` just returned, and bypass roles skip the bulk
check entirely.

## Why

`unwrap_or_default()` turned an outage into rows with every action off — "a fault is not a
refusal" (ENGINEERING.md, Authorization rule 2). The Viewer check was a duplicate of the list
filter: a third of the bulk check's work.

## Rejected

- Serving the rows with flags marked unknown: the list contract has no unknown flag, and a list
  that half-answered is still not the list.
