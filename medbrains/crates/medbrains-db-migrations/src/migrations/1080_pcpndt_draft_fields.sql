-- ====================================================================
-- Migration: 1080_pcpndt_draft_fields.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A Form F opened when an ultrasound is ordered (1079) cannot yet name who
-- will perform the scan or why it is done. Those stay required, but only once
-- the form leaves draft: a submitted or registered Form F always has both.

ALTER TABLE public.pcpndt_forms ALTER COLUMN performing_doctor_id DROP NOT NULL;
ALTER TABLE public.pcpndt_forms ALTER COLUMN indication DROP NOT NULL;

ALTER TABLE public.pcpndt_forms DROP CONSTRAINT IF EXISTS pcpndt_forms_complete_when_filed;
ALTER TABLE public.pcpndt_forms ADD CONSTRAINT pcpndt_forms_complete_when_filed
    CHECK (status = 'draft' OR (performing_doctor_id IS NOT NULL AND indication IS NOT NULL));
