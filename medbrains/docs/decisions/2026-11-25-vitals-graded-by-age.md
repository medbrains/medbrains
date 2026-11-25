---
date: 2026-11-25
title: The vitals recorder grades pulse, breathing and blood pressure for the patient's age
status: proposed
area: clinical-safety
---

## What

Under 16, the vitals recorder grades heart rate, respiratory rate and systolic pressure on the
four age charts of the Health Quality & Safety Commission New Zealand *Paediatric vital signs chart:
user guide* (2023), Table 1 — the same charts the server already scores PEWS from
(`medbrains-clinical-scores/src/ews/pews_table.rs`). White zone is normal, yellow is borderline,
anything outside is critical. From 16 the adult ranges are unchanged. Age is completed years on
the hospital's date (tenant time zone), from the patient's date of birth, or the camp
registration's age. With no age, those three are shown ungraded with "age needed to grade". A
child's BMI is shown without the adult category.

## Why

Adult ranges applied at every age: a healthy newborn's pulse of 140 and breathing of 40 showed as
"Critical high".

## Rejected

- Inventing or mixing bands from several sources: every band here is one published chart, cited in
  `apps/web/src/lib/paediatric-vital-bands.ts`.
- Falling back to adult ranges when the age is unknown: that is the defect, applied to everyone
  whose age is missing.
- Sharing the Rust table with the web: there is no route for it today; the TS copy names the Rust
  file and the Rust file's chart, so a change to one is seen in the other.
