---
date: 2026-11-28
title: Adult vitals are graded by the NEWS2 bands, generated from the server's table
status: proposed
area: clinical-safety
---
## What

The vitals entry form and the doctor's vitals chips grade respiratory rate, SpO2 (Scale 1), systolic
pressure, pulse and temperature by the adult NEWS2 bands (Royal College of Physicians 2017, Chart 1):
score 0 normal, 1-2 amber with a word, 3 red with a word. The bands come from
`packages/schemas/src/news2-bands.generated.ts`, generated from `news2_table.rs`. High blood pressure
is a separate, labelled rule, the 2017 ACC/AHA guideline: stage 2 (140/90) amber, crisis (180/120)
red; the worse of the two grades is shown. Temperature in °F is graded by its °C value charted to one
decimal.

## Why

The screens used hand-typed bands (pulse 60-100, SpO2 95+, temperature 36.1-37.2 °C) that did not
match the NEWS2 table the server scores with, so a reading could be normal on screen and score on the
server.

## Rejected

- Keeping the old hand-typed bands: two sources of truth for the same reading.
- NEWS2 for high blood pressure: NEWS2 only reaches red at a systolic of 220 and has no diastolic row.
- SpO2 Scale 2: needs a clinician's prescription and the air-or-oxygen flag the form does not carry.
- Using these bands for children or in pregnancy: NEWS2 is for adults 16 and over, not in pregnancy.
