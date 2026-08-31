-- Migration: 0200_sso_foundation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Enterprise SSO foundation — protocol-agnostic (OIDC + SAML).
--
-- Lets a tenant federate authentication to a corporate IdP (Azure AD / Entra,
-- Okta, Keycloak, ADFS, …) and map the user's AD/IdP groups to MedBrains roles
-- and access-groups. This migration adds only the data model + federation
-- targets; the OIDC and SAML flows are wired in follow-up migrations/routes.

-- ── Identity providers (per tenant) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.identity_providers (
    id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id       uuid NOT NULL,
    code            text NOT NULL,                 -- stable slug, e.g. 'entra'
    name            text NOT NULL,                 -- display label
    protocol        text NOT NULL CHECK (protocol IN ('oidc', 'saml')),
    is_active       boolean NOT NULL DEFAULT true,
    -- OIDC: discovery URL + client creds. SAML: metadata URL + cert (in config).
    discovery_url   text,
    metadata_url    text,
    client_id       text,
    -- AEAD-encrypted (medbrains_crypto::aead::encrypt_token → string), like oauth.rs.
    client_secret_enc text,
    -- The claim/attribute carrying the user's groups (default 'groups').
    group_claim     text NOT NULL DEFAULT 'groups',
    -- Role assigned when no group mapping matches (NULL = no access until mapped).
    default_role    text,
    -- Just-in-time provisioning: create the user on first SSO login.
    jit_enabled     boolean NOT NULL DEFAULT true,
    -- Protocol-specific extras (OIDC scopes, SAML cert/entity_id, etc.).
    config          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

DROP TRIGGER IF EXISTS identity_providers_set_updated_at ON public.identity_providers;
CREATE TRIGGER identity_providers_set_updated_at
    BEFORE UPDATE ON public.identity_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.identity_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS identity_providers_tenant ON public.identity_providers;
CREATE POLICY identity_providers_tenant ON public.identity_providers
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── IdP group → MedBrains role / access-group mappings ──────────────────────
CREATE TABLE IF NOT EXISTS public.idp_group_mappings (
    id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id       uuid NOT NULL,
    provider_id     uuid NOT NULL REFERENCES public.identity_providers(id) ON DELETE CASCADE,
    -- The AD/IdP group value (object id or display name, as the IdP emits it).
    idp_group       text NOT NULL,
    -- Targets — at least one. Both may be set (assign a role AND a group).
    role_code       text,
    access_group_id uuid REFERENCES public.access_groups(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, idp_group, role_code, access_group_id)
);

CREATE INDEX IF NOT EXISTS idx_idp_group_mappings_provider
    ON public.idp_group_mappings (provider_id);

ALTER TABLE public.idp_group_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idp_group_mappings_tenant ON public.idp_group_mappings;
CREATE POLICY idp_group_mappings_tenant ON public.idp_group_mappings
    USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── User federation ─────────────────────────────────────────────────────────
-- The federated identity (which IdP + the IdP's stable subject id). SSO-only
-- users have no local password, so password_hash becomes nullable.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS idp_id uuid REFERENCES public.identity_providers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_subject text;

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- One MedBrains user per (provider, subject).
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_idp_subject
    ON public.users (idp_id, external_subject)
    WHERE idp_id IS NOT NULL AND external_subject IS NOT NULL;

-- How an access-group membership was granted. SSO re-sync manages only its own
-- ('sso') memberships on each login, never touching 'manual' admin grants.
ALTER TABLE public.access_group_members
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
