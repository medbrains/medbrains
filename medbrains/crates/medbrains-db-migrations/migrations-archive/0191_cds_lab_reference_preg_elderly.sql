-- Migration: 0191_cds_lab_reference_preg_elderly.sql
-- RLS-Posture: catalog
-- Alters the global cds_lab_reference; no tenant_id involved.
-- Pregnancy + elderly (≥65) normal ranges on the CDS lab reference. Most are
-- real values from the source lab matrix; a curated overlay (WHO/CDC/IADPSG/BNF)
-- fills the high-value gaps (Hb, creatinine, TSH, WBC, glucose). Result entry
-- applies the elderly band by age; pregnancy is exposed for reference and
-- applied once a pregnancy signal is available at order time.
ALTER TABLE public.cds_lab_reference
    ADD COLUMN IF NOT EXISTS pregnancy_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS pregnancy_high numeric(14, 4),
    ADD COLUMN IF NOT EXISTS elderly_low numeric(14, 4),
    ADD COLUMN IF NOT EXISTS elderly_high numeric(14, 4);
