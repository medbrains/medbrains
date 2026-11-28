---
date: 2026-11-25
title: Pre-contrast kidney risk reads the same recent eGFR per 1.73 m² as renal dosing
status: proposed
area: clinical-safety
---

## What

Radiology's pre-contrast screening no longer has its own eGFR query. It calls
`medbrains_health_services::egfr::patient_latest_egfr`, the shared selector renal dosing uses: newest
verified result that is an eGFR (eGFR LOINC on the test, or named as one, never a clearance), per
1.73 m², within the hospital's window (7 days for an inpatient, 30 for an outpatient by default).
With none, the screening asks for a creatinine/eGFR before contrast (`cin_risk = not_checked`,
clearance `egfr_required`, shown in danger), never "proceed". High risk is below the hospital's
threshold: eGFR 30 (ACR–NKF consensus 2020) by default, 45 selectable (ESUR; KDIGO); see
2026-11-28-kidney-function-checks-setting. The result
carries the eGFR's sample date and the order form shows it.

## Why

The radiology query took the latest verified result named like "gfr" with no recency and no unit:
a year-old eGFR of 90, or a creatinine clearance in mL/min, cleared a patient for iodinated
contrast as "low" risk.

## Rejected

- A second copy of the selector in radiology: two selectors drift, and the same patient would get
  one kidney answer for dosing and another for contrast.
- Moving the selector to `medbrains-core`: it needs a database read; core has none.
- Radiology depending on telehealth (the OPD brick): a brick-to-brick crate edge, which the brick
  edge ratchet refuses. The selector lives in `medbrains-health-services`, a shared health crate
  both bricks may depend on.
- A different window for contrast: one per-hospital window, shared with renal dosing.
- "Proceed with caution" with no eGFR (this PR's first version): it still read as permission to go
  ahead; the clearance now waits on an eGFR.
