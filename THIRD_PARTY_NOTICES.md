# Third-party notices

MedBrains ships small sets of clinical reference data as seed files. Their
sources and terms are listed here. Vendored source code is listed in `NOTICE`.

## ICD-10 (World Health Organization)

`medbrains/crates/medbrains-seed/src/data/diagnosis_reference.csv` and the
diagnosis migrations carry a subset of ICD-10 codes and short titles.
ICD-10 is © World Health Organization. Codes and titles are used for
classification under WHO's terms for ICD use; see
<https://www.who.int/standards/classifications/classification-of-diseases>.
ICD-11 content is fetched at runtime from the WHO ICD-API and is not
redistributed here.

## LOINC (Regenstrief Institute)

`medbrains/crates/medbrains-db-migrations/src/migrations/1051_note_type_loinc.sql`
and related migrations reference LOINC codes for clinical note types and
laboratory tests.

This material contains content from LOINC® (<https://loinc.org>). LOINC is
copyright © Regenstrief Institute, Inc. and the Logical Observation
Identifiers Names and Codes (LOINC) Committee and is available at no cost
under the license at <https://loinc.org/license>. LOINC® is a registered
United States trademark of Regenstrief Institute, Inc.

## SNOMED CT

MedBrains does not ship SNOMED CT content. The files under
`medbrains/crates/medbrains-terminology/tests/fixtures/` are synthetic test
fixtures in the `XX9999999` namespace. `medbrains/scripts/load_snomed.py`
loads a release that the deploying organisation must license itself (in
India, through NRCeS).

## Drug formulary and state schemes

`drug_formulary.csv`, `drug_ingredients.csv` and `state_formulary.csv` are
compiled from public government sources: the National List of Essential
Medicines (Ministry of Health and Family Welfare, Government of India) and
state free-drug scheme lists. WHO ATC codes, where present, are © WHO
Collaborating Centre for Drug Statistics Methodology.

Clinical reference values (`lab_reference.csv`, dosing limits) are seed
defaults for configuration, not clinical advice; each hospital must review
them against its own laboratory and formulary.
