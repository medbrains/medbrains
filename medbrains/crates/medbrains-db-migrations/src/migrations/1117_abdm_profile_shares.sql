-- ====================================================================
-- Migration: 1117_abdm_profile_shares.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abdm_profile_shares
-- Drops: none
-- ====================================================================
-- ABDM Scan & Share. Each registration counter carries a QR naming this
-- hospital's HFR facility ID (HIP ID) and the counter's code. A patient scans
-- it with an ABHA app and shares their ABHA profile; ABDM delivers that
-- profile to our HIP callback, we answer with a token number, and the
-- registration desk sees the profile waiting — linked to the patient whose
-- verified ABHA it is, or ready to register.
--
-- A counter is a `stations` row; the QR carries its `code`, which never
-- changes after the station is created. One row per gateway request: the
-- same request ID returns the same token. `expires_at` is end of the token's
-- life (never past the end of the day); a share left `waiting` beyond it is
-- marked `expired` when the desk next reads the queue.

CREATE TABLE public.abdm_profile_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    facility_id uuid NOT NULL REFERENCES public.facilities(id),
    station_id uuid REFERENCES public.stations(id),
    counter_code text,
    request_id text NOT NULL,
    abha_number text,
    abha_address text NOT NULL,
    profile jsonb NOT NULL,
    patient_id uuid REFERENCES public.patients(id),
    token_id uuid REFERENCES public.tokens(id),
    token_number text,
    status text NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'linked', 'registered', 'expired', 'dismissed')),
    verification_id uuid REFERENCES public.abha_verifications(id),
    acted_by uuid REFERENCES public.users(id),
    acted_at timestamptz,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text
);

CREATE UNIQUE INDEX uq_abdm_profile_shares_request
    ON public.abdm_profile_shares (tenant_id, request_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_abdm_profile_shares_day
    ON public.abdm_profile_shares (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_abdm_profile_shares_waiting
    ON public.abdm_profile_shares (tenant_id, expires_at)
    WHERE status = 'waiting' AND deleted_at IS NULL;
CREATE INDEX idx_abdm_profile_shares_abha
    ON public.abdm_profile_shares (tenant_id, abha_address, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.abdm_profile_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abdm_profile_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abdm_profile_shares ON public.abdm_profile_shares
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abdm_profile_shares BEFORE UPDATE ON public.abdm_profile_shares
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abdm_profile_shares_soft_delete BEFORE DELETE ON public.abdm_profile_shares
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
