---
date: 2026-11-25
title: The max-dose check normalises units and says when a line was not checked
status: proposed
area: clinical-safety
---

## What

`medbrains_core::dose_safety::evaluate_max_dose` returns one of three outcomes: within,
exceeded, or not checked (with the reason). Amounts are normalised before comparing: mcg, µg,
mg and g to micrograms; mL and L to millilitres; "1,000" is read as one thousand ("1,5" is
refused, not guessed); form words after the unit ("1000 mg tab") and a per-day suffix on the
maximum ("3 g/day") are accepted, anything else after the unit ("mg/kg", "2 x 500 mg") makes the
line not checked. As-needed and STAT lines are checked one dose against the daily maximum; an
as-needed line within it is "not checked" with the dose count that stays within the maximum.

The CDS rail returns `dose_not_checked` lines, the conclusion counts them as warnings (it no
longer says "Safe to proceed" over an unchecked line), and the prescription writer's "Max dose ·
24h" row shows the server's verdicts instead of its own copy of the old check.

## Why

The old check compared units as raw strings and treated a mismatch as no alert: 7 of 9 realistic
overdoses ("1 g" QID against 3000 mg, "500 mcg" against "1 mg", "1,000 mg", "1000 mg tab",
"3 g/day") passed silently, and PRN orders were never checked. An unknown is not a pass.

## Rejected

- Keeping silence on incomparable units to avoid alert noise: it hid real overdoses.
- Counting a line with no catalogue maximum as not checked: most catalogue lines have none
  today, so every order would warn. Left out; listed for the owner.
- Fixing the web copy of the check as well: two checkers drift; the web now shows the server's.
