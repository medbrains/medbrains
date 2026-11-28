---
date: 2026-11-28
title: How recent an eGFR must be, and the contrast threshold, are per-hospital settings
status: proposed
area: clinical-safety
---

## What

`tenant_settings` clinical / `kidney_function_checks` holds three rules, seeded for every hospital
(new and existing) by migration 1498 and edited on Settings → Clinical configuration under
`admin.settings.general.manage`:

- an eGFR counts for an admitted patient for 7 days, for an outpatient for 30 (ACR Manual on
  Contrast Media: the interval is institutional practice; one week for inpatients is the common
  policy);
- contrast is held for review below eGFR 30 mL/min/1.73 m² (ACR–NKF consensus, Davenport et al.,
  Radiology 2020), or 45 if the hospital chooses (ESUR; KDIGO).

`kidney_settings.rs` (health services) reads them; a bad field takes its default. A clinician
must confirm these defaults.

## Why

Owner decision 2026-11-28: thresholds follow published standards and are the hospital's to set.
A fixed 90-day window let a weeks-old eGFR dose an inpatient whose kidney function can change in
days.

## Rejected

- One window for everyone: inpatients and outpatients differ in how fast kidney function changes.
- A free threshold or its own endpoint: only the two published cut-offs; the reader validates.
