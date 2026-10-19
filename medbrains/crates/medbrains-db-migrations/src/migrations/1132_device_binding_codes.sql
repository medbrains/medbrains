-- ====================================================================
-- Migration: 1132_device_binding_codes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: device_binding_codes, device_binding_redemptions
-- Drops: none
-- ====================================================================
-- A hospital administrator prints a signed QR; a staff or patient app scans
-- it and binds itself to this hospital's server, pinned to its TLS key. The
-- QR's nonce (jti) is single- or limited-use: every redemption is counted
-- here, atomically, and recorded against the paired device it created, so a
-- photographed code cannot bind more devices than it was issued for.

CREATE TABLE public.device_binding_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    jti text NOT NULL,
    label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 120),
    max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 500),
    use_count integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    issued_by uuid NOT NULL REFERENCES public.users(id),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES public.users(id),
    revoke_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_binding_codes_uses CHECK (use_count BETWEEN 0 AND max_uses),
    CONSTRAINT device_binding_codes_expiry CHECK (expires_at > created_at)
);

-- A nonce names one code, across every hospital.
CREATE UNIQUE INDEX uq_device_binding_codes_jti ON public.device_binding_codes (jti);
CREATE INDEX idx_device_binding_codes_tenant ON public.device_binding_codes (tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.device_binding_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_binding_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_device_binding_codes ON public.device_binding_codes
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_device_binding_codes BEFORE UPDATE ON public.device_binding_codes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_device_binding_codes_soft_delete BEFORE DELETE ON public.device_binding_codes
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.device_binding_redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code_id uuid NOT NULL REFERENCES public.device_binding_codes(id),
    paired_device_id uuid NOT NULL REFERENCES public.paired_devices(id),
    app_variant text NOT NULL,
    redeemed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_device_binding_redemptions_code ON public.device_binding_redemptions (code_id);
CREATE INDEX idx_device_binding_redemptions_device ON public.device_binding_redemptions (paired_device_id);

ALTER TABLE public.device_binding_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_binding_redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_device_binding_redemptions ON public.device_binding_redemptions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_device_binding_redemptions BEFORE UPDATE ON public.device_binding_redemptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_device_binding_redemptions_soft_delete BEFORE DELETE ON public.device_binding_redemptions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
