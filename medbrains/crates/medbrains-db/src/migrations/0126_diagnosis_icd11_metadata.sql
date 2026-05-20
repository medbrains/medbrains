-- ====================================================================
-- Migration: 0126_diagnosis_icd11_metadata.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================

-- Persist terminology provenance for selected diagnosis codes.
-- ICD-11 is served from the local WHO ICD API instance by default, but
-- every saved code still records the release/source used at selection time.

ALTER TABLE public.diagnoses
    ADD COLUMN IF NOT EXISTS icd_display text,
    ADD COLUMN IF NOT EXISTS icd_source_url text,
    ADD COLUMN IF NOT EXISTS icd_source_version text,
    ADD COLUMN IF NOT EXISTS icd_provider_mode text;
