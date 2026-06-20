-- ============================================================
-- MedBrains schema — oauth_connections (common 3rd-party OAuth token store)
-- One reusable per-tenant OAuth connection per provider (Google / Microsoft /
-- Zoom / …). Access + refresh tokens are AEAD-encrypted at rest. The shared
-- token getter refreshes transparently. Used by telemedicine (Google Meet /
-- Teams) and any future integration that needs a provider token.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oauth_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    -- google | microsoft | zoom | …
    provider text NOT NULL,
    -- authorization_code | client_credentials
    grant_type text NOT NULL DEFAULT 'authorization_code',
    -- AEAD-encrypted token envelopes (never plaintext)
    access_token_enc text,
    refresh_token_enc text,
    token_type text NOT NULL DEFAULT 'Bearer',
    scope text,
    expires_at timestamp with time zone,
    -- the connected provider account (email / account id) for display
    external_account_id text,
    -- connected | expired | revoked | error
    status text NOT NULL DEFAULT 'connected',
    last_error text,
    connected_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.oauth_connections
    ADD CONSTRAINT oauth_connections_pkey PRIMARY KEY (id);

-- One live connection per provider per tenant.
ALTER TABLE ONLY public.oauth_connections
    ADD CONSTRAINT oauth_connections_tenant_provider_key UNIQUE (tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_oauth_connections_tenant
    ON public.oauth_connections (tenant_id, provider, status);

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_oauth_connections ON public.oauth_connections;
CREATE POLICY tenant_isolation_oauth_connections ON public.oauth_connections
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER oauth_connections_set_updated_at
    BEFORE UPDATE ON public.oauth_connections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
