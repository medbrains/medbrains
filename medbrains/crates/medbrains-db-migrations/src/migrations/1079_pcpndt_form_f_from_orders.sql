-- ====================================================================
-- Migration: 1079_pcpndt_form_f_from_orders.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- PC-PNDT Act 1994, Rule 9(4): a Form F is kept for every ultrasonography of
-- a pregnant woman, filled before the scan is reported, with her declaration
-- and the doctor's declaration that the sex of the fetus was not disclosed.
-- Failing to keep it is itself an offence. Forms were typed in by hand, so
-- most scans had none.
--
-- * An ultrasound order for a pregnant woman now opens a draft Form F linked
--   to it. "Pregnant" is: the exam is marked PCPNDT-applicable (obstetric,
--   NT, anomaly, fetal echo), or the modality is ultrasound and she has an
--   active antenatal registration, or the ordering clinician says so.
-- * The report cannot be verified until that Form F is complete.

ALTER TABLE public.radiology_modalities
    ADD COLUMN IF NOT EXISTS is_ultrasound boolean NOT NULL DEFAULT false;

-- Existing modalities named as ultrasound are marked; the screen edits it.
UPDATE public.radiology_modalities
   SET is_ultrasound = true
 WHERE is_ultrasound = false
   AND (name ~* '(ultra ?sound|sonograph|\musg\M|\mdoppler\M)' OR code ~* '^(US|USG)\M');

ALTER TABLE public.radiology_exams
    ADD COLUMN IF NOT EXISTS pcpndt_applicable boolean NOT NULL DEFAULT false;

UPDATE public.radiology_exams
   SET pcpndt_applicable = true
 WHERE pcpndt_applicable = false
   AND name ~* '(obstetric|antenatal|fetal|foetal|anomaly scan|nuchal|\mnt scan|growth scan|biophysical|early pregnancy|viability)';

ALTER TABLE public.radiology_orders
    ADD COLUMN IF NOT EXISTS patient_pregnant boolean NOT NULL DEFAULT false;

ALTER TABLE public.pcpndt_forms
    ADD COLUMN IF NOT EXISTS radiology_order_id uuid REFERENCES public.radiology_orders(id),
    ADD COLUMN IF NOT EXISTS living_sons        integer CHECK (living_sons >= 0),
    ADD COLUMN IF NOT EXISTS living_daughters   integer CHECK (living_daughters >= 0),
    ADD COLUMN IF NOT EXISTS self_referred      boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS result_summary     text,
    -- Her declaration that she does not want to know the sex of the fetus.
    ADD COLUMN IF NOT EXISTS woman_declared_at  timestamptz,
    -- The doctor's declaration that the sex was neither detected nor disclosed.
    ADD COLUMN IF NOT EXISTS doctor_declared_at timestamptz,
    ADD COLUMN IF NOT EXISTS doctor_declared_by uuid REFERENCES public.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcpndt_forms_radiology_order
    ON public.pcpndt_forms (tenant_id, radiology_order_id)
    WHERE radiology_order_id IS NOT NULL AND deleted_at IS NULL;
