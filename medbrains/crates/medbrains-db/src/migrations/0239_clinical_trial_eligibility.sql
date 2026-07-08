-- Patient-trial matching (ticket #2984): structured eligibility on a trial — age band, biological
-- sex, required diagnosis ICD codes — used to auto-screen candidate patients. Age / sex / diagnosis
-- are covered; lab-value + medication screening is a later refinement.

ALTER TABLE clinical_trials
    ADD COLUMN IF NOT EXISTS min_age         integer,
    ADD COLUMN IF NOT EXISTS max_age         integer,
    ADD COLUMN IF NOT EXISTS eligibility_sex text,
    ADD COLUMN IF NOT EXISTS diagnosis_codes text[];
