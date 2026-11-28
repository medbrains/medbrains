---
date: 2026-11-25
title: The CDS rail's allergy screen uses the same matcher as the save-time backstops
status: decided
area: clinical-safety
---

## What

`cds::check_drug_safety` matches drugs to allergies through `medbrains_core::allergy`, the matcher
the OPD prescribe, pharmacy dispense and camp backstops already use: direct name match, or a shared
cross-reactivity class. Conflicts carry `cross_reactive_class`, shown on the rail.

Open: the cross-reactivity class table still needs a cited source, checked by a pharmacist.

## Why

The rail matched substrings only, so a penicillin allergy did not flag amoxicillin on the rail
while save refused it: the screen and the backstop disagreed.

## Rejected

- ATC class matching: `pharmacy_catalog.atc_code` exists but allergens are free text
  (`patient_allergies.allergen_name`; `allergen_code` is uncoded), so there is nothing to compare
  the drug's ATC with. Needs allergens coded (ATC or SNOMED substance) first.
- A larger cross-reactivity table: not without a cited source. The existing three classes
  (beta-lactam, sulfonamide, NSAID) are in the code without one; a pharmacist should cite or
  correct them.
