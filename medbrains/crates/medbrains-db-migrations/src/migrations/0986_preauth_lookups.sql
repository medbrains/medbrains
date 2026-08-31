-- The two lookups that happen before anybody has a tenant.
--
-- Row level security answers "which hospital may this session see", and both
-- of these run before there is an answer. An API key's fingerprint is how the
-- tenant is discovered; an SSO state token is how a callback is matched back
-- to the login that started it. Under enforcement both find nothing, which
-- means every API key is rejected and every SSO callback fails.
--
-- This schema already solves this exact problem for SSO providers, with
-- `sso_provider_for_login`, `sso_active_providers` and
-- `sso_active_providers_by_host` — all `SECURITY DEFINER`, each performing one
-- fixed lookup. These follow that, rather than inventing a second answer.
--
-- Why a function and not an exemption on the table: `api_keys` is a managed
-- resource with a list screen and a revoke button, and that screen is what
-- row level security is protecting. A function can only do the one thing it
-- was written to do — look a key up by a fingerprint the caller had to already
-- possess — and cannot be persuaded to enumerate anything.
--
-- `sso_auth_state` is different in kind: two statements exist for it in the
-- whole codebase, an insert and a single-use consume. It is never listed. It
-- gets a function anyway, so both halves of pre-auth read the same way.

-- Look up an API key by the fingerprint of the secret the caller presented.
--
-- Returns the row without checking a tenant, because the row is how the tenant
-- is learned. The secret is the authorisation: this can only be called by
-- somebody who already holds the key, and it cannot list, filter or scan.
-- Verification of the presented secret still happens in the application, in
-- constant time.
CREATE OR REPLACE FUNCTION public.app_api_key_by_fingerprint(p_key_hash TEXT)
RETURNS TABLE (
    id              UUID,
    tenant_id       UUID,
    key_hash        TEXT,
    permissions     JSONB,
    service_user_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT k.id, k.tenant_id, k.key_hash, k.permissions, k.service_user_id
      FROM public.api_keys k
     WHERE k.key_hash = p_key_hash
       AND k.revoked_at IS NULL
       AND k.expires_at > now();
$$;

COMMENT ON FUNCTION public.app_api_key_by_fingerprint(TEXT) IS
    'Pre-auth lookup: an API key by the fingerprint of the presented secret. '
    'Runs without a tenant because the row is how the tenant is discovered.';

-- Consume an SSO state token, returning what the callback needs to continue.
--
-- Single use by construction: the delete and the read are one statement, so a
-- replayed state token finds nothing.
CREATE OR REPLACE FUNCTION public.app_consume_sso_state(p_state TEXT)
RETURNS TABLE (
    provider_id   UUID,
    tenant_id     UUID,
    nonce         TEXT,
    pkce_verifier TEXT,
    return_to     TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    DELETE FROM public.sso_auth_state
     WHERE state = p_state AND expires_at > now()
    RETURNING provider_id, tenant_id, nonce, pkce_verifier, return_to;
$$;

COMMENT ON FUNCTION public.app_consume_sso_state(TEXT) IS
    'Pre-auth lookup: exchange an SSO state token for the login it belongs to, '
    'once. Runs without a tenant because the token is how the tenant is found.';

GRANT EXECUTE ON FUNCTION public.app_api_key_by_fingerprint(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_consume_sso_state(TEXT) TO PUBLIC;
