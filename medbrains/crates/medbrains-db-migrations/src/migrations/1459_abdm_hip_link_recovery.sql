-- ====================================================================
-- Migration: 1459_abdm_hip_link_recovery.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_callback_replays
-- Drops: none
-- ====================================================================
-- ABDM M2 linking robustness (#5711).
--
-- patient_abha_links gains three columns:
--   * token_request_id / token_requested_at: the link-token request in
--     flight for this patient. Two records finalised together join the one
--     request instead of each asking ABDM for a token (HIP_INTI_LINK_504).
--     A request older than ten minutes is treated as lost and asked again.
--   * token_rejected_at: when ABDM last refused the stored token (ABDM-1026
--     or 1038). The token is cleared and a new one asked for once; a second
--     refusal within the hour is left on screen instead of looping.
--
-- abdm_callback_replays: the REQUEST-ID of every gateway callback whose
-- handling changed something (an OTP sent, a link confirmed), with the
-- answer we sent. The gateway repeats a delivery (~16 minutes later); a
-- repeat finds its row, gets the same answer again, and changes nothing: no
-- second OTP, no second SMS. A churn table: rows are only useful for a few
-- hours, so it has no soft-delete columns and old rows are deleted by the
-- handler that writes new ones. Re-runnable.

ALTER TABLE public.patient_abha_links
    ADD COLUMN IF NOT EXISTS token_request_id uuid,
    ADD COLUMN IF NOT EXISTS token_requested_at timestamptz,
    ADD COLUMN IF NOT EXISTS token_rejected_at timestamptz;

CREATE TABLE IF NOT EXISTS public.abdm_callback_replays (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    request_id text NOT NULL CHECK (request_id <> ''),
    path text NOT NULL,
    answer jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_abdm_callback_replays_received
    ON public.abdm_callback_replays (tenant_id, received_at);

ALTER TABLE public.abdm_callback_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_callback_replays FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_abdm_callback_replays ON public.abdm_callback_replays;
CREATE POLICY tenant_isolation_abdm_callback_replays ON public.abdm_callback_replays
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
