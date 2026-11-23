---
date: 2026-11-23
title: Web imports between bricks are counted per pair and may only fall
status: decided
area: web
---

## What

`medbrains/apps/web/brick-units.json` names the owner of each of the 442 source units under
`apps/web/src`: a brick, `core`, or `shared`. `make check-web-brick-imports` counts the import
statements that go from one brick's units into another brick's and fails when a brick pair has
more than `scripts/web_brick_imports.baseline.txt` allows, when a new pair appears, or when a
unit has no owner. Today: 185 statements over 51 pairs.

The four pickers every clinical screen uses (`PatientSearchSelect`, `PatientNameCell`,
`DoctorSearchSelect`, `DrugSearchSelect`) are `shared`, not Registration's, OPD's or
Pharmacy's. Counted as their bricks' they add 127 statements and 9 pairs (312 over 60, the
number in the split map).

## Why

The backend had no check on brick to brick edges and neither did the web. `check-circular` finds
cycles only. Each new cross-brick import is one more thing to undo before a brick's folder can
move, load and be measured on its own.

## Rejected

- One pnpm package per brick now: the import check gives the same guarantee without new build
  configuration, and folders can become packages later.
- Biome `noRestrictedImports` now: it needs a folder per brick first; today a brick's files are
  spread over `pages/`, `components/`, `features/` and `services/`.
- Failing on every difference from the baseline: a PR that removes an import would have to
  edit the file, and those edits conflict; a drop passes and `--update` records it.
- Working the owner out from the screen registry on every run: components and services have
  no route, so most rows are a judgement either way; a file can be read and reviewed.
