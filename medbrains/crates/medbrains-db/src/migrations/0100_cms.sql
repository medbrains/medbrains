-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 18
-- Drops: none
-- cms — schema.
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



-- Migration: 0161_blog_posts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Hospital blog — tenant-authored posts shown in Health Pulse alongside the
-- ingested news feed. Tenant-scoped with RLS (transaction-scoped app.tenant_id).

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    body_html text DEFAULT ''::text NOT NULL,
    cover_image_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    author_id uuid,
    author_name text,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);

-- Name: blog_posts blog_posts_tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_tenant_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_blog_posts_status_pub ON public.blog_posts USING btree (tenant_id, status, published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Name: blog_posts tenant_isolation_blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_blog_posts ON public.blog_posts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: blog_posts trg_blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_authors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    bio text,
    credentials text,
    designation text,
    avatar_url text,
    website text,
    twitter text,
    linkedin text,
    role text DEFAULT 'author'::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_authors cms_authors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_pkey PRIMARY KEY (id);

-- Name: cms_authors cms_authors_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_tenant_id_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_cms_authors_deleted_at_8efe2af2 ON public.cms_authors USING btree (deleted_at);

CREATE INDEX idx_cms_authors_slug ON public.cms_authors USING btree (tenant_id, slug);

CREATE INDEX idx_cms_authors_tenant ON public.cms_authors USING btree (tenant_id);

CREATE INDEX idx_cms_authors_user ON public.cms_authors USING btree (user_id);

ALTER TABLE public.cms_authors ENABLE ROW LEVEL SECURITY;

-- Name: cms_authors cms_authors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_authors_tenant ON public.cms_authors USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_authors trg_cms_authors_soft_delete_8efe2af2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_authors_soft_delete_8efe2af2 BEFORE DELETE ON public.cms_authors FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_authors trg_cms_authors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_authors_updated_at BEFORE UPDATE ON public.cms_authors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    color text DEFAULT '#228be6'::text,
    icon text,
    requires_medical_review boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_categories cms_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_pkey PRIMARY KEY (id);

-- Name: cms_categories cms_categories_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_tenant_id_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_cms_categories_deleted_at_be833d03 ON public.cms_categories USING btree (deleted_at);

CREATE INDEX idx_cms_categories_parent ON public.cms_categories USING btree (parent_id);

CREATE INDEX idx_cms_categories_slug ON public.cms_categories USING btree (tenant_id, slug);

CREATE INDEX idx_cms_categories_tenant ON public.cms_categories USING btree (tenant_id);

ALTER TABLE public.cms_categories ENABLE ROW LEVEL SECURITY;

-- Name: cms_categories cms_categories_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_categories_tenant ON public.cms_categories USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_categories trg_cms_categories_soft_delete_be833d03; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_categories_soft_delete_be833d03 BEFORE DELETE ON public.cms_categories FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_categories trg_cms_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_categories_updated_at BEFORE UPDATE ON public.cms_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    filename text NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    alt_text text,
    caption text,
    width integer,
    height integer,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_media cms_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_media
    ADD CONSTRAINT cms_media_pkey PRIMARY KEY (id);

CREATE INDEX idx_cms_media_deleted_at_504fee2c ON public.cms_media USING btree (deleted_at);

CREATE INDEX idx_cms_media_tenant ON public.cms_media USING btree (tenant_id);

CREATE INDEX idx_cms_media_type ON public.cms_media USING btree (tenant_id, mime_type);

ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;

-- Name: cms_media cms_media_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_media_tenant ON public.cms_media USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_media trg_cms_media_soft_delete_504fee2c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_media_soft_delete_504fee2c BEFORE DELETE ON public.cms_media FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cms_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_menus cms_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_menus
    ADD CONSTRAINT cms_menus_pkey PRIMARY KEY (id);

-- Name: cms_menus cms_menus_tenant_id_location_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_menus
    ADD CONSTRAINT cms_menus_tenant_id_location_key UNIQUE (tenant_id, location);

CREATE INDEX idx_cms_menus_deleted_at_5df4a012 ON public.cms_menus USING btree (deleted_at);

CREATE INDEX idx_cms_menus_tenant ON public.cms_menus USING btree (tenant_id);

ALTER TABLE public.cms_menus ENABLE ROW LEVEL SECURITY;

-- Name: cms_menus cms_menus_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_menus_tenant ON public.cms_menus USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_menus trg_cms_menus_soft_delete_5df4a012; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_menus_soft_delete_5df4a012 BEFORE DELETE ON public.cms_menus FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_menus trg_cms_menus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_menus_updated_at BEFORE UPDATE ON public.cms_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    template text DEFAULT 'default'::text,
    meta_title text,
    meta_description text,
    is_published boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_pages cms_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_pkey PRIMARY KEY (id);

-- Name: cms_pages cms_pages_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_tenant_id_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_cms_pages_deleted_at_506662b3 ON public.cms_pages USING btree (deleted_at);

CREATE INDEX idx_cms_pages_slug ON public.cms_pages USING btree (tenant_id, slug);

CREATE INDEX idx_cms_pages_tenant ON public.cms_pages USING btree (tenant_id);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

-- Name: cms_pages cms_pages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_pages_tenant ON public.cms_pages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_pages trg_cms_pages_soft_delete_506662b3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_pages_soft_delete_506662b3 BEFORE DELETE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_pages trg_cms_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_pages_updated_at BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_post_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    revision_number integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    excerpt text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_post_revisions cms_post_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_pkey PRIMARY KEY (id);

-- Name: cms_post_revisions cms_post_revisions_post_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_post_id_revision_number_key UNIQUE (post_id, revision_number);

CREATE INDEX idx_cms_post_revisions ON public.cms_post_revisions USING btree (post_id);

CREATE INDEX idx_cms_post_revisions_deleted_at_4194ac32 ON public.cms_post_revisions USING btree (deleted_at);

-- Name: cms_post_revisions trg_cms_post_revisions_soft_delete_4194ac32; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_post_revisions_soft_delete_4194ac32 BEFORE DELETE ON public.cms_post_revisions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cms_post_tags (
    post_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_post_tags cms_post_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_pkey PRIMARY KEY (post_id, tag_id);

CREATE INDEX idx_cms_post_tags_deleted_at_fce6aebe ON public.cms_post_tags USING btree (deleted_at);

CREATE INDEX idx_cms_post_tags_post ON public.cms_post_tags USING btree (post_id);

CREATE INDEX idx_cms_post_tags_tag ON public.cms_post_tags USING btree (tag_id);

-- Name: cms_post_tags trg_cms_post_tags_soft_delete_fce6aebe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_post_tags_soft_delete_fce6aebe BEFORE DELETE ON public.cms_post_tags FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cms_post_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_hash text,
    user_agent text,
    referrer text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_post_views cms_post_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_views
    ADD CONSTRAINT cms_post_views_pkey PRIMARY KEY (id);

CREATE INDEX idx_cms_post_views_date ON public.cms_post_views USING btree (post_id, viewed_at);

CREATE INDEX idx_cms_post_views_deleted_at_40d07e1c ON public.cms_post_views USING btree (deleted_at);

CREATE INDEX idx_cms_post_views_post ON public.cms_post_views USING btree (post_id);

-- Name: cms_post_views trg_cms_post_views_soft_delete_40d07e1c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_post_views_soft_delete_40d07e1c BEFORE DELETE ON public.cms_post_views FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cms_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    author_id uuid NOT NULL,
    category_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text NOT NULL,
    content_type public.cms_content_type DEFAULT 'article'::public.cms_content_type NOT NULL,
    feature_image_id uuid,
    feature_image_alt text,
    feature_image_caption text,
    meta_title text,
    meta_description text,
    og_image_id uuid,
    canonical_url text,
    status public.cms_post_status DEFAULT 'draft'::public.cms_post_status NOT NULL,
    is_featured boolean DEFAULT false,
    reading_time_minutes integer,
    published_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    submitted_for_review_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    medical_reviewed_by uuid,
    medical_reviewed_at timestamp with time zone,
    medical_review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_posts cms_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_pkey PRIMARY KEY (id);

-- Name: cms_posts cms_posts_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_tenant_id_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_cms_posts_author ON public.cms_posts USING btree (author_id);

CREATE INDEX idx_cms_posts_category ON public.cms_posts USING btree (category_id);

CREATE INDEX idx_cms_posts_deleted_at_5571b2b0 ON public.cms_posts USING btree (deleted_at);

CREATE INDEX idx_cms_posts_featured ON public.cms_posts USING btree (tenant_id, is_featured) WHERE (is_featured = true);

CREATE INDEX idx_cms_posts_published ON public.cms_posts USING btree (tenant_id, published_at) WHERE (status = 'published'::public.cms_post_status);

CREATE INDEX idx_cms_posts_slug ON public.cms_posts USING btree (tenant_id, slug);

CREATE INDEX idx_cms_posts_status ON public.cms_posts USING btree (tenant_id, status);

CREATE INDEX idx_cms_posts_tenant ON public.cms_posts USING btree (tenant_id);

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;

-- Name: cms_posts cms_posts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_posts_tenant ON public.cms_posts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_posts trg_cms_posts_soft_delete_5571b2b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_posts_soft_delete_5571b2b0 BEFORE DELETE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_posts trg_cms_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_posts_updated_at BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    site_title text,
    site_tagline text,
    site_description text,
    logo_url text,
    favicon_url text,
    twitter_handle text,
    facebook_url text,
    instagram_url text,
    youtube_url text,
    linkedin_url text,
    default_meta_title text,
    default_meta_description text,
    google_analytics_id text,
    posts_per_page integer DEFAULT 10,
    show_author_bio boolean DEFAULT true,
    enable_comments boolean DEFAULT false,
    contact_email text,
    contact_phone text,
    address text,
    custom_css text,
    custom_js text,
    custom_head text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_settings cms_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_settings
    ADD CONSTRAINT cms_settings_pkey PRIMARY KEY (id);

-- Name: cms_settings cms_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_settings
    ADD CONSTRAINT cms_settings_tenant_id_key UNIQUE (tenant_id);

CREATE INDEX idx_cms_settings_deleted_at_038ddb33 ON public.cms_settings USING btree (deleted_at);

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;

-- Name: cms_settings cms_settings_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_settings_tenant ON public.cms_settings USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_settings trg_cms_settings_soft_delete_038ddb33; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_settings_soft_delete_038ddb33 BEFORE DELETE ON public.cms_settings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: cms_settings trg_cms_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_settings_updated_at BEFORE UPDATE ON public.cms_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cms_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    name text,
    status text DEFAULT 'pending'::text NOT NULL,
    confirmation_token text,
    confirmed_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_subscribers cms_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_subscribers
    ADD CONSTRAINT cms_subscribers_pkey PRIMARY KEY (id);

-- Name: cms_subscribers cms_subscribers_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_subscribers
    ADD CONSTRAINT cms_subscribers_tenant_id_email_key UNIQUE (tenant_id, email);

CREATE INDEX idx_cms_subscribers_deleted_at_2bf102ea ON public.cms_subscribers USING btree (deleted_at);

CREATE INDEX idx_cms_subscribers_email ON public.cms_subscribers USING btree (tenant_id, email);

CREATE INDEX idx_cms_subscribers_status ON public.cms_subscribers USING btree (tenant_id, status);

CREATE INDEX idx_cms_subscribers_tenant ON public.cms_subscribers USING btree (tenant_id);

ALTER TABLE public.cms_subscribers ENABLE ROW LEVEL SECURITY;

-- Name: cms_subscribers cms_subscribers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_subscribers_tenant ON public.cms_subscribers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_subscribers trg_cms_subscribers_soft_delete_2bf102ea; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_subscribers_soft_delete_2bf102ea BEFORE DELETE ON public.cms_subscribers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cms_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cms_tags cms_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tags
    ADD CONSTRAINT cms_tags_pkey PRIMARY KEY (id);

-- Name: cms_tags cms_tags_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tags
    ADD CONSTRAINT cms_tags_tenant_id_slug_key UNIQUE (tenant_id, slug);

CREATE INDEX idx_cms_tags_deleted_at_ce81eee1 ON public.cms_tags USING btree (deleted_at);

CREATE INDEX idx_cms_tags_slug ON public.cms_tags USING btree (tenant_id, slug);

CREATE INDEX idx_cms_tags_tenant ON public.cms_tags USING btree (tenant_id);

ALTER TABLE public.cms_tags ENABLE ROW LEVEL SECURITY;

-- Name: cms_tags cms_tags_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_tags_tenant ON public.cms_tags USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cms_tags trg_cms_tags_soft_delete_ce81eee1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_tags_soft_delete_ce81eee1 BEFORE DELETE ON public.cms_tags FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A patient's booking of a package; the booking id is the auto_charge source_id (idempotent per
-- booking), and invoice_id points at the payable invoice the patient settles online.

CREATE TABLE public.health_package_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    invoice_id uuid,
    booked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: health_package_bookings health_package_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_package_bookings
    ADD CONSTRAINT health_package_bookings_pkey PRIMARY KEY (id);

CREATE INDEX idx_health_package_bookings_pkg ON public.health_package_bookings USING btree (tenant_id, package_id, created_at DESC);

ALTER TABLE public.health_package_bookings ENABLE ROW LEVEL SECURITY;

-- Name: health_package_bookings health_package_bookings_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY health_package_bookings_tenant_isolation ON public.health_package_bookings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0259_health_packages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Health packages / promotions (ticket #2953): pre-priced health check-up / service packages a
-- hospital markets to patients (e.g. "Master Health Check"), optionally promoted with a validity.
-- Booking a package auto-charges its price (reusing the billing seam); the resulting invoice is
-- what the patient pays online via the existing payment providers. Tenant RLS.

CREATE TABLE public.health_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    includes text,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    is_promoted boolean DEFAULT false NOT NULL,
    valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: health_packages health_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_packages
    ADD CONSTRAINT health_packages_pkey PRIMARY KEY (id);

CREATE INDEX idx_health_packages_active ON public.health_packages USING btree (tenant_id, is_active, is_promoted);

ALTER TABLE public.health_packages ENABLE ROW LEVEL SECURITY;

-- Name: health_packages health_packages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY health_packages_tenant_isolation ON public.health_packages USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: health_packages health_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER health_packages_updated_at BEFORE UPDATE ON public.health_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS-Posture: tenant-scoped
-- Hospital news / advisories module.
-- Categories:
--   outbreak_alert       — disease surge (dengue, flu) — drives simulator
--                          ICD bias when active
--   weather_advisory     — heat wave, severe rain, cyclone
--   festival_advisory    — operational note tied to a festival
--   internal_notice      — staff / admin broadcast
-- `icd_boost` is a text[] of ICD-10 codes the simulator should over-
-- represent in its diagnosis pool while the article is active. Empty
-- array = no influence on the engine (still shown in the UI).

CREATE TABLE public.news_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    source text,
    icd_boost text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT news_articles_category_check CHECK ((category = ANY (ARRAY['outbreak_alert'::text, 'weather_advisory'::text, 'festival_advisory'::text, 'internal_notice'::text]))),
    CONSTRAINT news_articles_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);

-- Name: news_articles news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_articles
    ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);

CREATE INDEX idx_news_articles_active ON public.news_articles USING btree (tenant_id, category, published_at DESC) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE INDEX idx_news_articles_simulator_outbreak ON public.news_articles USING btree (tenant_id, expires_at) WHERE ((is_active = true) AND (deleted_at IS NULL) AND (category = 'outbreak_alert'::text));

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Name: news_articles news_articles_tenant_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY news_articles_tenant_rls ON public.news_articles USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: news_articles news_articles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER news_articles_set_updated_at BEFORE UPDATE ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0160_news_articles.sql
-- RLS-Posture: catalog
-- news_feed_articles is global public content: no tenant_id, read via the pool.
-- External medical news, ingested by the newspaper4k worker from public feeds.
-- Distinct from `news_articles` (0141, tenant-scoped internal advisories): this
-- is GLOBAL public content (no tenant_id / RLS), queried via the pool directly
-- like other reference tables. Full-text searchable. Articles-only (no read state).

CREATE TABLE public.news_feed_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    source text NOT NULL,
    title text NOT NULL,
    summary text,
    content text,
    url text NOT NULL,
    image_url text,
    author text,
    lang text DEFAULT 'en'::text NOT NULL,
    published_at timestamp with time zone,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((COALESCE(title, ''::text) || ' '::text) || COALESCE(summary, ''::text)) || ' '::text) || COALESCE(content, ''::text)))) STORED
);

-- Name: news_feed_articles news_feed_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_feed_articles
    ADD CONSTRAINT news_feed_articles_pkey PRIMARY KEY (id);

-- Name: news_feed_articles news_feed_articles_topic_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_feed_articles
    ADD CONSTRAINT news_feed_articles_topic_url_key UNIQUE (topic, url);

CREATE INDEX idx_news_feed_pub ON public.news_feed_articles USING btree (published_at DESC);

CREATE INDEX idx_news_feed_search ON public.news_feed_articles USING gin (search_tsv);

CREATE INDEX idx_news_feed_topic_pub ON public.news_feed_articles USING btree (topic, published_at DESC);

-- Name: news_feed_articles trg_news_feed_articles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_news_feed_articles_updated_at BEFORE UPDATE ON public.news_feed_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0260_testimonials.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Patient testimonials / reviews (ticket #2954): patient-submitted reviews shown on the hospital
-- micro-site, moderated (approved) before being published. Tenant RLS.

CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_name text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    service text,
    body text NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT testimonial_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);

CREATE INDEX idx_testimonials_published ON public.testimonials USING btree (tenant_id, is_published, created_at DESC);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Name: testimonials testimonials_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY testimonials_tenant_isolation ON public.testimonials USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: testimonials testimonials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: cms_categories cms_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cms_categories(id);

-- Name: cms_post_revisions cms_post_revisions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;

-- Name: cms_post_tags cms_post_tags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;

-- Name: cms_post_tags cms_post_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cms_tags(id) ON DELETE CASCADE;

-- Name: cms_post_views cms_post_views_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_views
    ADD CONSTRAINT cms_post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;

-- Name: cms_posts cms_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.cms_authors(id);

-- Name: cms_posts cms_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.cms_categories(id);

-- Name: cms_posts cms_posts_feature_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_feature_image_id_fkey FOREIGN KEY (feature_image_id) REFERENCES public.cms_media(id);

-- Name: cms_posts cms_posts_og_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_og_image_id_fkey FOREIGN KEY (og_image_id) REFERENCES public.cms_media(id);

-- Name: health_package_bookings health_package_bookings_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_package_bookings
    ADD CONSTRAINT health_package_bookings_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.health_packages(id) ON DELETE CASCADE;
