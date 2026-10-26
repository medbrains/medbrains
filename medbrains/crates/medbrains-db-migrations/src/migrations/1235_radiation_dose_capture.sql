-- ====================================================================
-- Migration: 1235_radiation_dose_capture.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Radiation dose had a table and an endpoint but nothing ever wrote to it,
-- so a patient's cumulative CT dose always read 0 and the warning on a new
-- imaging order never fired. The radiographer now records dose on the order,
-- and the PACS sync reads it from the scanner's dose report (RDSR) or the
-- image headers when the study comes back.
--
-- Added: the radiograph fields (number of exposures, kVp, mAs), where the
-- figure came from (typed by a person, the scanner's RDSR, or image
-- headers), and which study it was read from. DAP is in Gy·cm².
-- A figure entered in error is soft-deleted with a reason, never removed.

ALTER TABLE public.radiation_dose_records
    ADD COLUMN IF NOT EXISTS exposure_count integer,
    ADD COLUMN IF NOT EXISTS kvp numeric(6,1),
    ADD COLUMN IF NOT EXISTS mas numeric(10,2),
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS dicom_study_id uuid
        REFERENCES public.radiology_dicom_studies(id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiation_dose_records_source_check') THEN
        ALTER TABLE public.radiation_dose_records
            ADD CONSTRAINT radiation_dose_records_source_check
                CHECK (source IN ('manual', 'rdsr', 'dicom_header'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiation_dose_records_non_negative') THEN
        ALTER TABLE public.radiation_dose_records
            ADD CONSTRAINT radiation_dose_records_non_negative CHECK (
                COALESCE(dose_value, 0) >= 0 AND COALESCE(dlp, 0) >= 0
                AND COALESCE(ctdi_vol, 0) >= 0 AND COALESCE(dap, 0) >= 0
                AND COALESCE(fluoroscopy_time_seconds, 0) >= 0
                AND COALESCE(exposure_count, 0) >= 0
                AND COALESCE(kvp, 0) >= 0 AND COALESCE(mas, 0) >= 0
            );
    END IF;
END $$;

-- One automatic record per study and source: the sync may see a study twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_radiation_dose_records_study_source
    ON public.radiation_dose_records (tenant_id, dicom_study_id, source)
    WHERE dicom_study_id IS NOT NULL AND deleted_at IS NULL;

-- The patient's cumulative dose is read on every new imaging order.
CREATE INDEX IF NOT EXISTS idx_radiation_dose_records_patient_live
    ON public.radiation_dose_records (tenant_id, patient_id)
    WHERE deleted_at IS NULL;
