-- ====================================================================
-- Migration: 1485_er_visit_suspected_mlc.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A complaint that reads like a medico-legal case ("road traffic accident",
-- "assault") used to demand emergency.mlc.create from whoever was saving the
-- visit or the triage, so a nurse or receptionist was refused and the
-- patient could not be registered. The visit now saves and carries a
-- suspicion for a doctor to decide: 'suspected' until a doctor confirms it
-- (which registers the MLC case and sets is_mlc) or dismisses it with a
-- reason. NULL means the complaint never raised the question. is_mlc stays
-- the registered fact.

ALTER TABLE public.er_visits
    ADD COLUMN IF NOT EXISTS mlc_suspicion text
        CONSTRAINT chk_er_visits_mlc_suspicion
        CHECK (mlc_suspicion IN ('suspected', 'confirmed', 'dismissed')),
    ADD COLUMN IF NOT EXISTS mlc_suspected_type text,
    ADD COLUMN IF NOT EXISTS mlc_suspicion_reason text,
    ADD COLUMN IF NOT EXISTS mlc_suspicion_decided_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS mlc_suspicion_decided_at timestamptz;
