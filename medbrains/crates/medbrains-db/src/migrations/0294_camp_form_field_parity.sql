-- ====================================================================
-- Migration: 0294_camp_form_field_parity.sql
-- RLS-Posture: inherits (columns added to existing tenant-scoped tables)
-- Tenant-Column: tenant_id (already present on both tables)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Make the camp tables able to hold what the paper camp form actually asks.
--
-- Measured against 1,125 real records from the F/I/B/A/E/J/C/L/H/G/D-series
-- medical camp forms: of the 46 fields the form captures, 22 had nowhere to go
-- and were being dropped or flattened into free text on the way in. The flow
-- worked; the record did not.
--
-- Types follow what the forms actually contain, not what the labels suggest:
--
--   * The eleven `mh_*` history fields are TICK BOXES. Every one of the 1,125
--     records holds either 'Yes' or nothing — never a description. So they are
--     nullable booleans, and the nullability carries meaning: NULL is "not
--     asked", false is "asked and answered no". At a screening camp the
--     difference matters, because an unasked question is not a negative
--     finding.
--   * HbA1c, haemoglobin and thyroid are recorded as numbers (310, 589 and 8
--     records respectively) and get numeric columns so they can be trended.
--   * ECG, X-ray, BMD and biothesiometry are handwritten impressions, so they
--     stay text. Forcing a code onto them would invent precision the paper
--     never had.
--   * Blood pressure needs no column: the form writes '120/80' as one string
--     and `camp_screenings` already splits systolic/diastolic. The importer
--     parses it.
--   * Random blood sugar needs no column either — `blood_sugar_random` already
--     covers the form's CBG field.
--
-- `icd_codes` is the surprise worth keeping structured: 1,075 of 1,125 records
-- carry a real ICD-10 code (Z00.0, M25.5, M54.9 …). That is a coded diagnosis
-- the hospital is already producing by hand, and it should not land in a notes
-- field.
-- ====================================================================

-- ── Registration: identity the form collects that we had nowhere to put ──
ALTER TABLE public.camp_registrations
    ADD COLUMN IF NOT EXISTS father_spouse_name text,
    ADD COLUMN IF NOT EXISTS marital_status     text,
    ADD COLUMN IF NOT EXISTS blood_group        text,
    -- The form prints one combined "Insurance name / number" box.
    ADD COLUMN IF NOT EXISTS insurance_details  text;

COMMENT ON COLUMN public.camp_registrations.blood_group IS
    'Free text as written on the camp form; not validated against the blood_group enum because a camp records what the patient reports, not a typed sample.';

-- ── Screening: the medical-history tick boxes ──
ALTER TABLE public.camp_screenings
    ADD COLUMN IF NOT EXISTS mh_diabetes           boolean,
    ADD COLUMN IF NOT EXISTS mh_hypertension       boolean,
    ADD COLUMN IF NOT EXISTS mh_asthma             boolean,
    ADD COLUMN IF NOT EXISTS mh_heart_disease      boolean,
    ADD COLUMN IF NOT EXISTS mh_thyroid_disorder   boolean,
    ADD COLUMN IF NOT EXISTS mh_previous_surgeries boolean,
    ADD COLUMN IF NOT EXISTS mh_allergies          boolean,
    ADD COLUMN IF NOT EXISTS mh_smoking_history    boolean,
    ADD COLUMN IF NOT EXISTS mh_alcohol_use        boolean,
    ADD COLUMN IF NOT EXISTS mh_family_history     boolean,
    ADD COLUMN IF NOT EXISTS mh_others             boolean,
    ADD COLUMN IF NOT EXISTS medical_history_notes text;

-- ── Screening: point-of-care test results ──
ALTER TABLE public.camp_screenings
    ADD COLUMN IF NOT EXISTS test_hba1c          numeric(5, 2),
    ADD COLUMN IF NOT EXISTS test_haemoglobin    numeric(5, 2),
    ADD COLUMN IF NOT EXISTS test_thyroid        numeric(8, 3),
    ADD COLUMN IF NOT EXISTS test_ecg            text,
    ADD COLUMN IF NOT EXISTS test_xray           text,
    ADD COLUMN IF NOT EXISTS test_bmd            text,
    ADD COLUMN IF NOT EXISTS test_biothesiometry text;

-- ── Screening: referral and coding ──
ALTER TABLE public.camp_screenings
    -- The form names a person, who is often not a user of this system.
    ADD COLUMN IF NOT EXISTS referral_doctor_name text,
    ADD COLUMN IF NOT EXISTS icd_codes            text[];

COMMENT ON COLUMN public.camp_screenings.icd_codes IS
    'ICD-10 codes assigned at the camp. An array because a single screening routinely yields more than one, and 1,075 of 1,125 audited paper records carried at least one.';

-- Comorbidity prevalence is the question a screening camp exists to answer, so
-- the partial indexes cover only the rows that said yes — the ones a report
-- counts. Partial keeps them small on a table that is mostly nulls.
CREATE INDEX IF NOT EXISTS idx_camp_screenings_mh_diabetes
    ON public.camp_screenings (tenant_id) WHERE mh_diabetes;
CREATE INDEX IF NOT EXISTS idx_camp_screenings_mh_hypertension
    ON public.camp_screenings (tenant_id) WHERE mh_hypertension;
