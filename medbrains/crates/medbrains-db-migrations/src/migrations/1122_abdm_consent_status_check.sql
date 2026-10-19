-- ====================================================================
-- Migration: 1122_abdm_consent_status_check.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ABDM M3 (HIU): a consent request whose `notify` never came can be asked
-- about (v3 `consent/request/status`, answered at `on-status`). We keep when
-- it was last asked — shown to staff, and what bounds how often it is asked —
-- and the REQUEST-ID of that call, stored before it goes out so an answer
-- that arrives first finds its request.

ALTER TABLE public.abdm_consent_requests
    ADD COLUMN IF NOT EXISTS status_checked_at timestamptz,
    ADD COLUMN IF NOT EXISTS status_request_id uuid;

CREATE INDEX IF NOT EXISTS idx_abdm_consent_requests_status_request
    ON public.abdm_consent_requests (tenant_id, status_request_id)
    WHERE status_request_id IS NOT NULL;
