-- ====================================================================
-- Migration: 1237_research_export_datasets.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Research exports (1221) may now also be labs, medicines and vitals.
--
-- Labs carry LOINC, numeric value, unit and flag; medicines carry WHO INN,
-- ATC, route and a banded duration; vitals are released only as bands.
-- The same de-identification applies (medbrains-research): per-export keys,
-- month dates, rare values as "Other", k = 5 over age band, sex, pincode
-- prefix and each dataset's quasi-identifiers, restricted classes left out
-- (now also by ATC code: antiretrovirals, antipsychotics, de-addiction).

ALTER TABLE public.research_exports DROP CONSTRAINT IF EXISTS research_exports_dataset_check;
ALTER TABLE public.research_exports ADD CONSTRAINT research_exports_dataset_check
    CHECK (dataset IN ('visits', 'diagnoses', 'admissions', 'labs', 'medicines', 'vitals'));
