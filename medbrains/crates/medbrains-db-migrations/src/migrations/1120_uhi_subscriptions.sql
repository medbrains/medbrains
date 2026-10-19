-- ====================================================================
-- Migration: 1120_uhi_subscriptions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: uhi_subscriptions
-- Drops: none
-- ====================================================================
-- UHI (Unified Health Interface, NHA) — this hospital as a Health Service
-- Provider App (HSPA, a Beckn BPP). Patient apps (EUAs) find and book our
-- services through the UHI gateway; every call is signed.
--
-- One subscription per hospital: the subscriber ID and unique key ID it is
-- registered under in the UHI registry, the ed25519 key pair it signs with
-- (the private half only ever stored sealed), the services it offers and
-- the campus whose HFR facility ID names it as a provider.
--
-- Inbound calls carry no session: the subscriber ID in the URL names the
-- hospital, resolved by app_uhi_subscriber_tenant() before RLS applies.

CREATE TABLE public.uhi_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    subscriber_id text NOT NULL CHECK (subscriber_id ~ '^[A-Za-z0-9._-]{3,128}$'),
    unique_key_id text NOT NULL CHECK (btrim(unique_key_id) <> ''),
    signing_public_key text,
    signing_private_key_sealed text,
    key_generated_at timestamptz,
    services text[] NOT NULL DEFAULT '{}'
        CHECK (services <@ ARRAY['teleconsultation', 'blood_bank', 'ambulance']::text[]),
    facility_id uuid REFERENCES public.facilities(id),
    city_code text,
    is_active boolean NOT NULL DEFAULT false,
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT uhi_subscriptions_key_pair
        CHECK ((signing_public_key IS NULL) = (signing_private_key_sealed IS NULL)),
    CONSTRAINT uhi_subscriptions_active_has_key
        CHECK (NOT is_active OR signing_public_key IS NOT NULL)
);

CREATE UNIQUE INDEX uq_uhi_subscriptions_tenant
    ON public.uhi_subscriptions (tenant_id) WHERE deleted_at IS NULL;
-- A subscriber ID names exactly one hospital across the whole install.
CREATE UNIQUE INDEX uq_uhi_subscriptions_subscriber
    ON public.uhi_subscriptions (lower(subscriber_id)) WHERE deleted_at IS NULL;

ALTER TABLE public.uhi_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uhi_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_uhi_subscriptions ON public.uhi_subscriptions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_uhi_subscriptions BEFORE UPDATE ON public.uhi_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_uhi_subscriptions_soft_delete BEFORE DELETE ON public.uhi_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- An inbound UHI call names its hospital by subscriber ID and has no tenant
-- yet. Returns at most one row (the index above makes the ID unique) and
-- nothing but the tenant.
CREATE OR REPLACE FUNCTION public.app_uhi_subscriber_tenant(p_subscriber_id text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.tenant_id FROM public.uhi_subscriptions s
     WHERE lower(s.subscriber_id) = lower(btrim(p_subscriber_id))
       AND s.is_active AND s.deleted_at IS NULL
     LIMIT 1
$$;

COMMENT ON FUNCTION public.app_uhi_subscriber_tenant(text) IS
    'UHI inbound calls: the tenant an active HSPA subscriber ID belongs to.';
