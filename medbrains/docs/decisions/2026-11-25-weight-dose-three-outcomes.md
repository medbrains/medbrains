---
date: 2026-11-25
title: A child's per-kg dose is checked in comparable units against a recent weight, or said not checked
status: proposed
area: clinical-safety
---

## What

The paediatric dose check (`medbrains_core::weight_dose`) normalises units with the max-dose parser
from #6256 (mcg / mg / g, mL / L) and reads the catalogue's dose per kg as per day ("15 mg/kg/day",
"15 mg/kg", the legacy "15 mg") or per dose ("10 mcg/kg/dose"). Every line with a rule ends in one of
three outcomes: within ±25%, over/under, or not checked with the reason. For a child (under 18, age
in months on the hospital's date) a missing weight, or one older than 7 days under a year old /
30 days otherwise, makes every per-kg line "not checked". The response carries
`weight_not_checked`; the Rx safety panel's "Paediatric dose · per kg" row warns with the reason.

## Why

Units were compared as strings ("0.5 g" against "15 mg" was silently skipped), per-dose rules were
read as per day, an as-needed line was multiplied out, and a child with no weight, or a weight from
months ago, was checked against it or not at all — all of which read as "within range".

## Rejected

- Silently skipping what cannot be compared (the old behaviour): an unknown is not a pass.
- One staleness window for all children: an infant's weight changes week to week. 7 and 30 days
  are proposed, for a clinician to confirm.
- Gating prescribing on it: the check stays advisory, as before.
