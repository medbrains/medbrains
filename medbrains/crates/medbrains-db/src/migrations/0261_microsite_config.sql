-- Micro-site configuration (tickets #2955 SEO, #2956 custom domain, #2959 chat widget).
-- Per-page SEO metadata, mapped custom domains, and the site-level chat/WhatsApp widget settings.
-- Tenant RLS. (Actual DNS mapping + the embedded widget are ops/frontend; this stores the config.)

CREATE TABLE IF NOT EXISTS seo_settings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    page_slug        text NOT NULL,
    meta_title       text,
    meta_description text,
    keywords         text,
    og_image_url     text,
    schema_markup    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT seo_settings_page_unique UNIQUE (tenant_id, page_slug)
);
ALTER TABLE seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY seo_settings_tenant_isolation ON seo_settings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER seo_settings_updated_at BEFORE UPDATE ON seo_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS site_domains (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain             text NOT NULL,
    is_primary         boolean NOT NULL DEFAULT false,
    is_verified        boolean NOT NULL DEFAULT false,
    verification_token text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT site_domains_domain_unique UNIQUE (tenant_id, domain)
);
ALTER TABLE site_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_domains_tenant_isolation ON site_domains
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER site_domains_updated_at BEFORE UPDATE ON site_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS microsite_config (
    tenant_id            uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    whatsapp_number      text,
    whatsapp_enabled     boolean NOT NULL DEFAULT false,
    chat_widget_enabled  boolean NOT NULL DEFAULT false,
    chat_greeting        text,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE microsite_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY microsite_config_tenant_isolation ON microsite_config
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER microsite_config_updated_at BEFORE UPDATE ON microsite_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
