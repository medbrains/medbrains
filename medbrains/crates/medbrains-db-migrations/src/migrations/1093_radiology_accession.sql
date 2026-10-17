-- ====================================================================
-- Migration: 1093_radiology_accession.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Every imaging order gets an accession number (#226). The modality picks
-- the patient from the worklist under it, writes it into every image, and
-- the study comes back to the order by it — no typing patient names at the
-- console, no study filed under the wrong patient.

CREATE SEQUENCE IF NOT EXISTS public.radiology_accession_seq;

ALTER TABLE public.radiology_orders ADD COLUMN IF NOT EXISTS accession_number text;

UPDATE public.radiology_orders
   SET accession_number = 'RA' || lpad(nextval('public.radiology_accession_seq')::text, 8, '0')
 WHERE accession_number IS NULL;

ALTER TABLE public.radiology_orders
    ALTER COLUMN accession_number SET DEFAULT 'RA' || lpad(nextval('public.radiology_accession_seq')::text, 8, '0'),
    ALTER COLUMN accession_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_radiology_orders_accession
    ON public.radiology_orders (tenant_id, accession_number);

-- One study row per study, so the sync can upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_radiology_dicom_studies_uid
    ON public.radiology_dicom_studies (tenant_id, study_instance_uid);
