-- ====================================================================
-- Migration: 1081_dpdp_consent_ledger.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- DPDP Act 2023 s.5–6 and Rules 2025 r.3: a patient is given a notice in a
-- language they read, and agrees purpose by purpose. `dpdp_consents` existed
-- but nothing wrote it. It becomes an append-only ledger: each row is one
-- decision — the purposes agreed at that moment, the notice version and
-- language shown, who recorded it and where. The newest row is the patient's
-- current answer; a withdrawal is a new row with fewer purposes, so the
-- history of both stays.

ALTER TABLE public.dpdp_consents
    ADD COLUMN IF NOT EXISTS purposes text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS notice_version text,
    ADD COLUMN IF NOT EXISTS notice_language text,
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'registration',
    ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id);

ALTER TABLE public.dpdp_consents DROP CONSTRAINT IF EXISTS dpdp_consents_source_check;
ALTER TABLE public.dpdp_consents
    ADD CONSTRAINT dpdp_consents_source_check
    CHECK (source IN ('registration', 'patient_update', 'portal'));

-- Purposes are the ones the notice names; nothing else can be agreed to.
ALTER TABLE public.dpdp_consents DROP CONSTRAINT IF EXISTS dpdp_consents_purposes_check;
ALTER TABLE public.dpdp_consents
    ADD CONSTRAINT dpdp_consents_purposes_check
    CHECK (purposes <@ ARRAY['abdm_linking', 'insurance_claims', 'health_reminders', 'research']::text[]);
