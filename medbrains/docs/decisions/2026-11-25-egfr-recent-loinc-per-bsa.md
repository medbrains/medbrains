---
date: 2026-11-25
title: Renal dosing uses only a recent eGFR per 1.73 m², and says when there is none
status: proposed (clinician to confirm the 90-day window)
area: clinical-safety
---

## What

The renal check doses from the newest verified result that is an eGFR — its test carries an eGFR
LOINC code (12 codes, cited in `renal_check.rs` from the NLM Clinical Tables LOINC API) or the
analyte is named as one, and never a "clearance" — whose unit is per 1.73 m², measured in the last
`EGFR_RECENCY_DAYS` = 90 days. The alert carries the eGFR's sample date. A line with a renal rule
and no qualifying eGFR is returned as `renal_not_checked` and shown as a warning.

## Why

The old query took the latest verified result whose name contained "gfr", with no recency, no
unit and no LOINC: a value from years ago, or a creatinine clearance in mL/min, could set the dose,
and no eGFR read the same as "no adjustment needed".

## Rejected

- LOINC only: the seeded catalogue has eGFR as an unnamed-code parameter of the RFT panel; LOINC is
  on the test, not the parameter, so most real eGFRs would be missed.
- A shorter window: the right window depends on the drug and on AKI risk; 90 days is an outer bound
  for the clinician to confirm or lower.
