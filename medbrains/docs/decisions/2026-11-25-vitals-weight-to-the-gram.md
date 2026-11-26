---
date: 2026-11-25
title: A charted weight is kept to the gram
status: proposed
area: clinical-safety
---

## What

The vitals recorder takes weight to three decimals of a kilogram (two of a pound) and sends it to
the gram; its lower bound is 0.3 kg, the plausibility floor history import already uses.
`vitals.weight_kg` drops its `numeric(5,2)` typmod for plain `numeric` (as `patients.weight_kg`
already is): a catalogue-only change, no table rewrite. The sign-every-record trigger that names
the column is dropped and restored from its own catalogue definition around the change.

## Why

The recorder rounded to 0.1 kg and the column to 0.01 kg. For a 1.2 kg preterm baby dosed per
kilogram, 0.1 kg is an 8% dosing error; the minimum of 0.5 kg refused the smallest babies outright.

## Rejected

- Infant-only precision: a gram field for everyone costs nothing; an adult types 70.5 as before.
- `numeric(6,3)`: changing the scale rewrites the whole vitals table under an exclusive lock;
  dropping the typmod does not.
- Grams as a separate column or unit: one column in kilograms, exact, is what every reader expects.
