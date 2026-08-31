-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 3
-- Drops: none
-- microsite config — schema.
--
-- Each table is declared once, in its final shape, with its indexes, policies
-- and triggers beside it. Before this refactor the definition of a single
-- table was spread over as many as nine migrations, and reading it meant
-- replaying the history in your head.
--
-- Foreign keys are not here. They are relationships rather than structure, and
-- deferring them to the end of the file (same-module) or to
-- 0900_cross_module_foreign_keys.sql (everything else) means no file has to be
-- ordered around anything another file declares.



CREATE TABLE public.microsite_config (
    tenant_id uuid NOT NULL,
    whatsapp_number text,
    whatsapp_enabled boolean DEFAULT false NOT NULL,
    chat_widget_enabled boolean DEFAULT false NOT NULL,
    chat_greeting text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: microsite_config microsite_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.microsite_config
    ADD CONSTRAINT microsite_config_pkey PRIMARY KEY (tenant_id);

ALTER TABLE public.microsite_config ENABLE ROW LEVEL SECURITY;

-- Name: microsite_config microsite_config_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY microsite_config_tenant_isolation ON public.microsite_config USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: microsite_config microsite_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER microsite_config_updated_at BEFORE UPDATE ON public.microsite_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0261_microsite_config.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Micro-site configuration (tickets #2955 SEO, #2956 custom domain, #2959 chat widget).
-- Per-page SEO metadata, mapped custom domains, and the site-level chat/WhatsApp widget settings.
-- Tenant RLS. (Actual DNS mapping + the embedded widget are ops/frontend; this stores the config.)

CREATE TABLE public.seo_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    page_slug text NOT NULL,
    meta_title text,
    meta_description text,
    keywords text,
    og_image_url text,
    schema_markup jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: seo_settings seo_settings_page_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_page_unique UNIQUE (tenant_id, page_slug);

-- Name: seo_settings seo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_pkey PRIMARY KEY (id);

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

-- Name: seo_settings seo_settings_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seo_settings_tenant_isolation ON public.seo_settings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: seo_settings seo_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seo_settings_updated_at BEFORE UPDATE ON public.seo_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.site_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    domain text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verification_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: site_domains site_domains_domain_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_domains
    ADD CONSTRAINT site_domains_domain_unique UNIQUE (tenant_id, domain);

-- Name: site_domains site_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_domains
    ADD CONSTRAINT site_domains_pkey PRIMARY KEY (id);

ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;

-- Name: site_domains site_domains_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_domains_tenant_isolation ON public.site_domains USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: site_domains site_domains_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER site_domains_updated_at BEFORE UPDATE ON public.site_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
