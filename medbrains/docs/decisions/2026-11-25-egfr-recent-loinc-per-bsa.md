---
date: 2026-11-25
title: Renal dosing uses only a recent eGFR per 1.73 m², and says when there is none
status: proposed
area: clinical-safety
---

## What

The renal check doses from the newest verified result that is an eGFR — its test carries an eGFR
LOINC code (12 codes, cited in `medbrains-health-services/src/egfr.rs` from the NLM Clinical Tables LOINC API) or the
analyte is named as one, and never a "clearance" — whose unit is per 1.73 m², measured within the
hospital's window (`tenant_settings` clinical / `kidney_function_checks`: 7 days for an admitted
patient, 30 for an outpatient by default; see 2026-11-28-kidney-function-checks-setting). The alert carries the eGFR's sample date. A line with a renal rule
and no qualifying eGFR is returned as `renal_not_checked` and shown as a warning.

The selector lives in the shared health-services crate, not in the OPD brick, so radiology's
contrast screening can use the same one without a brick-to-brick crate edge.

## Why

The old query took the latest verified result whose name contained "gfr", with no recency, no
unit and no LOINC: a value from years ago, or a creatinine clearance in mL/min, could set the dose,
and no eGFR read the same as "no adjustment needed".

## Rejected

- LOINC only: the seeded catalogue has eGFR as an unnamed-code parameter of the RFT panel; LOINC is
  on the test, not the parameter, so most real eGFRs would be missed.
- A fixed 90-day window (this PR's first version): too long for an inpatient whose kidney function
  can change within days; replaced by the per-hospital inpatient/outpatient window.
