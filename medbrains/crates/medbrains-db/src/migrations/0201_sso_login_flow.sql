-- SSO login-flow support (OIDC; reused by SAML).
--
-- The authorize→callback round trip happens BEFORE the user is authenticated,
-- so there is no tenant context (RLS) yet. Two pieces:
--   1. sso_auth_state — short-lived CSRF/replay state bound to one login attempt.
--   2. sso_provider_for_login() — a SECURITY DEFINER read of a single provider by
--      its (unguessable UUID) id, so the pre-auth flow can load provider config
--      without an RLS tenant context. Returns only what the flow needs; the
--      client secret stays server-side.

-- ── Transient login state (state → nonce / PKCE / provider) ──────────────────
CREATE TABLE IF NOT EXISTS public.sso_auth_state (
    state          text PRIMARY KEY,            -- random, single-use
    provider_id    uuid NOT NULL REFERENCES public.identity_providers(id) ON DELETE CASCADE,
    tenant_id      uuid NOT NULL,
    nonce          text NOT NULL,               -- replay protection (id_token claim)
    pkce_verifier  text NOT NULL,               -- PKCE S256
    return_to      text,                         -- where to send the user after login
    created_at     timestamptz NOT NULL DEFAULT now(),
    expires_at     timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
-- Keyed by an unguessable random state and read with no tenant context, so no RLS.
CREATE INDEX IF NOT EXISTS idx_sso_auth_state_expiry ON public.sso_auth_state (expires_at);

-- ── Capability read of a provider for the pre-auth flow ──────────────────────
-- SECURITY DEFINER bypasses RLS to fetch ONE provider by id. Safe: the id is an
-- unguessable UUID acting as a capability, and config (not PHI) is returned.
CREATE OR REPLACE FUNCTION public.sso_provider_for_login(p_id uuid)
RETURNS public.identity_providers
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.identity_providers WHERE id = p_id AND is_active = true;
$$;
