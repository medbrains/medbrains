OMOP CDM v5.4 research extract from MedBrains

De-identified for one ethics-approved study. Do not attempt to re-identify anyone,
do not link with other data, and delete the files when the study ends.

Where this differs from a usual OMOP extract
- Dates are months: every date is the first day of its month. OMOP extracts usually
  shift each person's dates by a random offset; these are truncated instead, as in the
  flat export, so day-level intervals cannot be computed.
- year_of_birth is the middle of a five-year age band at the period's start (90+ as 92);
  month and day of birth are not released.
- person_id and person_source_value (a keyed hash) are valid within this export only.
- location holds only the first three digits of the pincode.
- Vitals are measurements with value_as_number empty and the band in value_source_value
  (e.g. 140-159).
- Concepts come only from licence-free vocabularies (ICD10, LOINC, ATC, RxNorm, UCUM)
  that the hospital has loaded. ICD-11 codes (condition_source_value ICD11:...), Indian
  brands and anything not loaded have concept id 0; map them with your own Athena
  vocabulary (e.g. with Usagi). Medicines are released by generic (INN) name.
- Visits are not linked to conditions, measurements or drugs (visit_occurrence_id empty).
- drug_exposure end date equals its start month; days_supply is not released.
- Values and codes held by fewer than 5 people are Other. People whose age band, sex and
  pincode prefix are shared by fewer than 5 are left out with all their records.
  Restricted clinical classes are never included.
