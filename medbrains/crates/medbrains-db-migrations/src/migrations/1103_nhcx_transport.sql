-- ====================================================================
-- Migration: 1103_nhcx_transport.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: nhcx_settings
-- Drops: insurance_claims.nhcx_correlation (unused duplicate of nhcx_correlation_id)
-- ====================================================================
-- NHCX transport: every claim message is a JWE encrypted for the payer, so
-- the payer directory carries each payer's encryption certificate. The
-- hospital's own NHCX keys live in nhcx_settings, sealed by the server —
-- the private key and client secret are never stored in the clear and no
-- endpoint returns them. A submission records the HCX correlation,
-- api-call and workflow ids on the claim in the same transaction that
-- queues it, so the payer's callback always finds its claim.

ALTER TABLE public.nhcx_participants ADD COLUMN encryption_cert text;

ALTER TABLE public.insurance_claims ADD COLUMN nhcx_workflow_id uuid;
ALTER TABLE public.insurance_claims DROP COLUMN nhcx_correlation;
CREATE INDEX idx_insurance_claims_nhcx_correlation_id ON public.insurance_claims (nhcx_correlation_id)
    WHERE nhcx_correlation_id IS NOT NULL;

-- A callback names its recipient by participant code; one code, one hospital.
CREATE UNIQUE INDEX uq_tenants_abdm_hcx_sender_code ON public.tenants (abdm_hcx_sender_code)
    WHERE abdm_hcx_sender_code IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE public.nhcx_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    client_id text,
    client_secret_sealed text,
    private_key_sealed text,
    public_cert_pem text,
    gateway_jwt_public_key_pem text,
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_nhcx_settings_tenant ON public.nhcx_settings (tenant_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.nhcx_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhcx_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_nhcx_settings ON public.nhcx_settings
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_nhcx_settings BEFORE UPDATE ON public.nhcx_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nhcx_settings_soft_delete BEFORE DELETE ON public.nhcx_settings
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
