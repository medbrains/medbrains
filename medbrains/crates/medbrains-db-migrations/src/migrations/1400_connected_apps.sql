-- ====================================================================
-- Migration: 1400_connected_apps.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: connected_apps
-- Drops: none
-- ====================================================================
-- Vendor apps (RFC-HOSPITAL-OS §6 C1, §8g): an outside service the hospital
-- lets in, described by one manifest (what it does, the permissions it needs,
-- the data classes it touches, where it sends data) and approved by a person
-- who can see exactly that.
--
-- An app signs in with OAuth 2.0 client credentials (SMART Backend Services
-- style). The client secret is stored only as an Argon2 hash. A successful
-- exchange mints a short-lived access token that is an ordinary `api_keys`
-- row tied to the app (`api_keys.connected_app_id`): the same verification,
-- rate limit, usage log and service identity every machine credential has,
-- so the request path has one way in, not two. Revoking the app revokes its
-- tokens and deactivates its identity in one transaction; the next call fails.
--
-- `status` moves pending -> approved -> revoked and never back: a revoked app
-- is registered again, so its history stays attached to the old row.

CREATE TABLE public.connected_apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    -- Public identifier the app presents. Globally unique: the token endpoint
    -- learns the hospital from it.
    client_id text NOT NULL UNIQUE CHECK (client_id ~ '^mbapp_[0-9a-f]{24}$'),
    client_secret_hash text NOT NULL,
    -- `mbcs_a3f2c1`: identifies the current secret on screen, useless alone.
    secret_prefix text NOT NULL,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
    publisher text NOT NULL CHECK (length(btrim(publisher)) BETWEEN 1 AND 120),
    purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 1 AND 200),
    version text NOT NULL,
    -- The manifest as submitted, validated server-side at registration.
    manifest jsonb NOT NULL,
    -- What the app may do: exactly the manifest's permissions, never a role.
    permissions jsonb NOT NULL CHECK (jsonb_array_length(permissions) > 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'revoked')),
    -- The identity the app acts as; audit rows name it.
    service_user_id uuid NOT NULL REFERENCES public.users(id),
    -- Where its events go, when the manifest asks for any.
    webhook_subscription_id uuid REFERENCES public.webhook_subscriptions(id),
    approved_at timestamptz,
    approved_by uuid REFERENCES public.users(id),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES public.users(id),
    revoke_reason text,
    secret_rotated_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT connected_apps_approved_has_time
        CHECK (status <> 'approved' OR approved_at IS NOT NULL),
    CONSTRAINT connected_apps_revoked_has_time
        CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);

CREATE INDEX idx_connected_apps_tenant ON public.connected_apps (tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.connected_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_apps FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_connected_apps ON public.connected_apps
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_connected_apps BEFORE UPDATE ON public.connected_apps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_connected_apps_soft_delete BEFORE DELETE ON public.connected_apps
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A token minted for an app. NULL for keys a person issued on the API keys
-- screen, which lists only those.
ALTER TABLE public.api_keys
    ADD COLUMN connected_app_id uuid REFERENCES public.connected_apps(id);

CREATE INDEX idx_api_keys_connected_app ON public.api_keys (connected_app_id, expires_at)
    WHERE connected_app_id IS NOT NULL;

-- One key, one identity (0971) still holds for keys a person issues. An app's
-- short-lived tokens all act as the app's one identity on purpose: the audit
-- actor is the app, and each token's own usage log says which token acted.
DROP INDEX IF EXISTS public.uq_api_keys_service_user;
CREATE UNIQUE INDEX uq_api_keys_service_user
    ON public.api_keys (service_user_id)
    WHERE service_user_id IS NOT NULL AND connected_app_id IS NULL;

-- Pre-auth lookup for the token endpoint: the client id is how the hospital
-- is learned, so this runs before any tenant context exists. It returns one
-- row for an id the caller already holds and cannot enumerate; the secret is
-- still verified (Argon2) by the caller.
CREATE OR REPLACE FUNCTION public.app_connected_app_by_client_id(p_client_id TEXT)
RETURNS TABLE (
    id                 UUID,
    tenant_id          UUID,
    client_secret_hash TEXT,
    status             TEXT,
    permissions        JSONB,
    service_user_id    UUID,
    name               TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT a.id, a.tenant_id, a.client_secret_hash, a.status, a.permissions,
           a.service_user_id, a.name
      FROM public.connected_apps a
     WHERE a.client_id = p_client_id
       AND a.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.app_connected_app_by_client_id(TEXT) IS
    'Pre-auth lookup: a connected app by the client id it presents to the token endpoint. '
    'Runs without a tenant because the row is how the tenant is discovered.';

GRANT EXECUTE ON FUNCTION public.app_connected_app_by_client_id(TEXT) TO PUBLIC;
