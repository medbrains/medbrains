---
date: 2026-11-25
title: Pre-contrast kidney risk reads the same recent eGFR per 1.73 m² as renal dosing
status: proposed
area: clinical-safety
---

## What

Radiology's pre-contrast screening no longer has its own eGFR query. It calls
`medbrains_telehealth::renal_check::patient_latest_egfr`, the selector renal dosing uses: newest
verified result that is an eGFR (eGFR LOINC on the test, or named as one, never a clearance), per
1.73 m², from the last 90 days. With none, the screening says "Contrast kidney risk not checked"
(`cin_risk = not_checked`) and the clearance is "proceed with caution", never "proceed". The result
carries the eGFR's sample date and the order form shows it.

## Why

The radiology query took the latest verified result named like "gfr" with no recency and no unit:
a year-old eGFR of 90, or a creatinine clearance in mL/min, cleared a patient for iodinated
contrast as "low" risk.

## Rejected

- A second copy of the selector in radiology: two selectors drift, and the same patient would get
  one kidney answer for dosing and another for contrast.
- Moving the selector to `medbrains-core`: it needs a database read and `AppError`; core has
  neither. Radiology depending on telehealth follows the existing pattern (OPD, pharmacy and the
  order basket already do).
- A different window for contrast: the 90 days is #6257's proposed outer bound; one window, for the
  clinician to confirm or lower, in one place.
