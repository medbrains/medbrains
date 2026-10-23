-- ====================================================================
-- Migration: 1182_uhi_onboarding_and_trust.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: function app_uhi_subscriber_tenant(text) (replaced by app_uhi_hspa_tenant)
-- ====================================================================
-- UHI provider: onboarding in NHA's order, and callbacks only to the
-- registered patient app.
--
-- * NHA issues the subscriber ID and key ID *after* the hospital submits
--   its callback URL and public key. The URL therefore cannot contain the
--   subscriber ID: it is now `/api/uhi/hspa/{hospital code}`, and both IDs
--   may be empty until NHA sends them. Switching on still needs both.
-- * gateway_spec: the gateway contract this hospital's environment follows
--   — 'v2_0_2' (default: Gateway spec v2.0.2, docs.abdm.gov.in, 28 Sep 2026:
--   /api/v1/uhi/… paths, Proxy-Authorization, Digest header, ACK with
--   error {}) or 's2' (the earlier github.com/NHA-ABDM/UHI contract).
-- * bap_key_id: the patient app's registry key that signed the last direct
--   call. A callback is sent only after the registry confirms the URL it
--   goes to is that app's registered subscriber URL; this names the record.

ALTER TABLE public.uhi_subscriptions
    ALTER COLUMN subscriber_id DROP NOT NULL,
    ALTER COLUMN unique_key_id DROP NOT NULL,
    ADD COLUMN gateway_spec text NOT NULL DEFAULT 'v2_0_2'
        CHECK (gateway_spec IN ('v2_0_2', 's2')),
    ADD CONSTRAINT uhi_subscriptions_ids_together
        CHECK ((subscriber_id IS NULL) = (unique_key_id IS NULL)),
    ADD CONSTRAINT uhi_subscriptions_active_registered
        CHECK (NOT is_active OR subscriber_id IS NOT NULL);

ALTER TABLE public.uhi_transactions ADD COLUMN bap_key_id text;

DROP FUNCTION public.app_uhi_subscriber_tenant(text);

-- An inbound UHI call names its hospital by the code in its URL and has no
-- tenant yet. Returns at most one row (tenant codes and subscriptions are
-- unique) and nothing but the tenant, and only while UHI is switched on.
CREATE FUNCTION public.app_uhi_hspa_tenant(p_hospital text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.tenant_id FROM public.uhi_subscriptions s
      JOIN public.tenants t ON t.id = s.tenant_id
     WHERE lower(t.code) = lower(btrim(p_hospital))
       AND s.is_active AND s.deleted_at IS NULL
     LIMIT 1
$$;

COMMENT ON FUNCTION public.app_uhi_hspa_tenant(text) IS
    'UHI inbound calls: the tenant whose code is in the URL, when its UHI provider is on.';
