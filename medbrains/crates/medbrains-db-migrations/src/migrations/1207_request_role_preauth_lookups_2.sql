-- ====================================================================
-- Migration: 1207_request_role_preauth_lookups_2.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The pre-tenant lookups 1206 did not cover, answered the same way.
--
-- Each caller below arrives with no hospital, and under row level security
-- (`medbrains_app`) its lookup found nothing: a CCAvenue notice matched no
-- payment, an invitation or email-verification link read as expired, a
-- refresh token was refused (signing every session out when its access token
-- expired), and a new hospital's sign-up could not see an admin already
-- registered with the same email. Each function does one fixed thing, returns the least the
-- caller needs, and is executable by `medbrains_app` only.

-- CCAvenue's notice is encrypted with the hospital's working key and names no
-- hospital in the clear, so the webhook tries the keys of the hospitals that
-- are waiting on a CCAvenue payment. Tenants only, most recent first, bounded.
CREATE OR REPLACE FUNCTION public.app_ccavenue_pending_tenants()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT t.tenant_id
      FROM public.payment_gateway_transactions t
     WHERE t.gateway = 'ccavenue' AND t.status = 'pending_gateway'
     GROUP BY t.tenant_id
     ORDER BY max(t.created_at) DESC
     LIMIT 10
$$;

-- Which hospital a live (unaccepted, unexpired) invitation belongs to.
CREATE OR REPLACE FUNCTION public.app_invitation_tenant(p_token_hash TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT i.tenant_id
      FROM public.user_invitations i
     WHERE i.token_hash = p_token_hash
       AND i.accepted_at IS NULL AND i.expires_at > now()
     LIMIT 1
$$;

-- Which hospital a live email-verification token belongs to.
CREATE OR REPLACE FUNCTION public.app_email_verification_tenant(p_token_hash TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT v.tenant_id
      FROM public.email_verification_tokens v
     WHERE v.token_hash = p_token_hash
       AND v.used_at IS NULL AND v.expires_at > now()
     LIMIT 1
$$;

-- Which hospital a refresh token belongs to. Revoked tokens too: presenting a
-- rotated token is how reuse (theft) is detected, and that check runs under
-- the hospital this answers.
CREATE OR REPLACE FUNCTION public.app_refresh_token_tenant(p_token_hash TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.tenant_id
      FROM public.refresh_tokens r
     WHERE r.token_hash = p_token_hash AND r.expires_at > now()
     LIMIT 1
$$;

-- Sign-up allows one admin per organisation: is an admin already registered
-- with this email (`p_exact`) or this email domain (`p_email` is then an
-- ILIKE pattern)? Answers yes or no, nothing about the account.
CREATE OR REPLACE FUNCTION public.app_admin_email_registered(p_email TEXT, p_exact BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
         WHERE u.role IN ('super_admin', 'hospital_admin')
           AND CASE WHEN p_exact THEN u.email = p_email ELSE u.email ILIKE p_email END
    )
$$;

DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'app_ccavenue_pending_tenants()',
        'app_invitation_tenant(TEXT)',
        'app_email_verification_tenant(TEXT)',
        'app_refresh_token_tenant(TEXT)',
        'app_admin_email_registered(TEXT, BOOLEAN)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO medbrains_app', fn);
    END LOOP;
END $$;
