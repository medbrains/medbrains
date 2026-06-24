-- ====================================================================
-- Migration: 0204_sso_providers_by_host.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Scope the pre-auth SSO provider list to the hospital resolved from the
-- request's custom domain. The login page is pre-auth (no tenant RLS context),
-- so it cannot read identity_providers directly; this SECURITY DEFINER function
-- exposes only non-sensitive fields (id, display name, protocol).
--
-- When `p_domain` matches a tenant's custom_domain, only THAT tenant's active
-- providers are returned (no cross-tenant exposure). When it doesn't match (no
-- custom domain in play — e.g. the default deployment), it falls back to the
-- global list, preserving the previous behaviour.

CREATE OR REPLACE FUNCTION public.sso_active_providers_by_host(p_domain text)
RETURNS TABLE(id uuid, name text, protocol text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH host_tenant AS (
        SELECT t.id AS tenant_id
        FROM public.tenants t
        WHERE p_domain IS NOT NULL
          AND lower(t.custom_domain) = lower(p_domain)
          AND t.is_active = true
        LIMIT 1
    )
    SELECT ip.id, ip.name, ip.protocol
    FROM public.identity_providers ip
    WHERE ip.is_active = true
      AND (
        NOT EXISTS (SELECT 1 FROM host_tenant)
        OR ip.tenant_id = (SELECT tenant_id FROM host_tenant)
      )
    ORDER BY ip.name;
$$;
