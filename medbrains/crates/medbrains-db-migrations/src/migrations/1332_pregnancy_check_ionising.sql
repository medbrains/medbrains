-- ====================================================================
-- Migration: 1332_pregnancy_check_ionising.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Before an X-ray, CT, fluoroscopy or nuclear medicine exposure of a woman
-- of reproductive age (12 to 50), the radiographer asks whether she is or
-- may be pregnant, and the answer is recorded — AERB's notice to patients,
-- ICRP 84, NABH. `pregnancy_checked` was a tick nobody had to make. Now:
--
-- - a modality says whether it uses ionising radiation (backfilled from the
--   DICOM modality code; ultrasound and MRI do not);
-- - an order records the answer — not pregnant, pregnant, or cannot be
--   ruled out — how it was established, who asked and when, and, when she
--   is or may be pregnant, why the exam still goes ahead;
-- - the exam cannot be started without it.

ALTER TABLE public.radiology_modalities
    ADD COLUMN IF NOT EXISTS is_ionising boolean NOT NULL DEFAULT false;

UPDATE public.radiology_modalities
   SET is_ionising = true
 WHERE NOT is_ionising
   AND upper(code) ~ '^(CT|CR|DX|XA|RF|MG|NM|PT|IO|PX|DXA|BMD|XR|FL|OPG)';

ALTER TABLE public.radiology_orders
    ADD COLUMN IF NOT EXISTS pregnancy_status text,
    ADD COLUMN IF NOT EXISTS pregnancy_check_method text,
    ADD COLUMN IF NOT EXISTS pregnancy_justification text,
    ADD COLUMN IF NOT EXISTS pregnancy_checked_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS pregnancy_checked_at timestamp with time zone;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiology_orders_pregnancy_status_check') THEN
        ALTER TABLE public.radiology_orders
            ADD CONSTRAINT radiology_orders_pregnancy_status_check CHECK (
                pregnancy_status IS NULL
                OR pregnancy_status IN ('not_pregnant', 'pregnant', 'cannot_rule_out')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiology_orders_pregnancy_justified') THEN
        ALTER TABLE public.radiology_orders
            ADD CONSTRAINT radiology_orders_pregnancy_justified CHECK (
                pregnancy_status IS NULL OR pregnancy_status = 'not_pregnant'
                OR btrim(COALESCE(pregnancy_justification, '')) <> ''
            ) NOT VALID;
    END IF;
END $$;
