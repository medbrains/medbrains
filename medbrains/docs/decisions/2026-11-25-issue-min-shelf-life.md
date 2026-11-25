---
date: 2026-11-25
title: Stock leaves a pharmacy store only with the hospital's minimum shelf life left
status: decided
area: pharmacy
---

## What

`medbrains_db::stock::issue_fefo` (pharmacy transfers and store indents) takes batches oldest
expiry first, but only batches with at least `operations.issue_min_shelf_life_days` days left.
When the store holds the item but not enough of it that fresh, the issue is refused with a
message naming the item, the earliest batch on hand and its expiry. Every hospital gets the
setting from migration 1491 (a trigger on new tenants and a backfill for existing ones), set to
90 days, and edits it in Settings, Operations ("Minimum shelf life to issue (days)").

## Why

The only floor was "not expired today", so a ward could be sent a batch expiring tomorrow, and
nothing said so. 90 is the floor the storefront already applies to online orders
(`medbrains_core::pharmacy_storefront::DEFAULT_MIN_SHELF_LIFE_DAYS`). It is a hospital setting
because the right number depends on the ward's turnover, and because a hospital that wants
short-dated stock used up first must be able to lower it.

## Rejected

- Silently issuing the short-dated batch when nothing fresher exists: the storekeeper learns of
  it when the ward finds an expired strip.
- A floor fixed in code: setup lives in git, and the value belongs to the hospital.
- Applying it at the patient dispensing counter and the POS in the same change: they pass their
  own floor (the storefront's for online orders, 0 otherwise). That is a separate decision for
  the owner, because a 90-day floor at the counter would refuse many legitimate short courses.
