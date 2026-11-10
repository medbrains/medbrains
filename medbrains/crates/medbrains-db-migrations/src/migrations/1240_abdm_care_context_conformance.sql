-- ====================================================================
-- Migration: 1240_abdm_care_context_conformance.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- What the NRCeS structural check found wrong with a care context's bundle
-- the last time it was sent.
--
-- The HIP sends a record's FHIR bundle inside the consent's two-hour window
-- either way: holding it back would fail the patient silently. But a record
-- that breaks its profile must not pass as fine, so each rule it breaks is
-- kept here and shown with the sharing failures on the ABDM screens, until
-- a later transfer sends it clean (which empties the list).

ALTER TABLE public.abdm_care_contexts
    ADD COLUMN IF NOT EXISTS conformance_issues text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS conformance_checked_at timestamptz;
