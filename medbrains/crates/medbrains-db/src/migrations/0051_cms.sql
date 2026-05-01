-- ============================================================
-- MedBrains schema — module: cms
-- ============================================================

--
-- Name: cms_authors; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_categories; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_media; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_pages; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_post_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_post_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    revision_number integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    excerpt text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_post_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_post_tags (
    post_id uuid NOT NULL,
    tag_id uuid NOT NULL
);



--
-- Name: cms_post_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_post_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_hash text,
    user_agent text,
    referrer text
);



--
-- Name: cms_posts; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_settings; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    name text,
    status text DEFAULT 'pending'::text NOT NULL,
    confirmation_token text,
    confirmed_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cms_authors cms_authors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_pkey PRIMARY KEY (id);



--
-- Name: cms_authors cms_authors_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_authors
    ADD CONSTRAINT cms_authors_tenant_id_slug_key UNIQUE (tenant_id, slug);



--
-- Name: cms_categories cms_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_pkey PRIMARY KEY (id);



--
-- Name: cms_categories cms_categories_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_tenant_id_slug_key UNIQUE (tenant_id, slug);



--
-- Name: cms_media cms_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_media
    ADD CONSTRAINT cms_media_pkey PRIMARY KEY (id);



--
-- Name: cms_menus cms_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_menus
    ADD CONSTRAINT cms_menus_pkey PRIMARY KEY (id);



--
-- Name: cms_menus cms_menus_tenant_id_location_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_menus
    ADD CONSTRAINT cms_menus_tenant_id_location_key UNIQUE (tenant_id, location);



--
-- Name: cms_pages cms_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_pkey PRIMARY KEY (id);



--
-- Name: cms_pages cms_pages_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_tenant_id_slug_key UNIQUE (tenant_id, slug);



--
-- Name: cms_post_revisions cms_post_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_pkey PRIMARY KEY (id);



--
-- Name: cms_post_revisions cms_post_revisions_post_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_post_id_revision_number_key UNIQUE (post_id, revision_number);



--
-- Name: cms_post_tags cms_post_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_pkey PRIMARY KEY (post_id, tag_id);



--
-- Name: cms_post_views cms_post_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_views
    ADD CONSTRAINT cms_post_views_pkey PRIMARY KEY (id);



--
-- Name: cms_posts cms_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_pkey PRIMARY KEY (id);



--
-- Name: cms_posts cms_posts_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_tenant_id_slug_key UNIQUE (tenant_id, slug);



--
-- Name: cms_settings cms_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_settings
    ADD CONSTRAINT cms_settings_pkey PRIMARY KEY (id);



--
-- Name: cms_settings cms_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_settings
    ADD CONSTRAINT cms_settings_tenant_id_key UNIQUE (tenant_id);



--
-- Name: cms_subscribers cms_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_subscribers
    ADD CONSTRAINT cms_subscribers_pkey PRIMARY KEY (id);



--
-- Name: cms_subscribers cms_subscribers_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_subscribers
    ADD CONSTRAINT cms_subscribers_tenant_id_email_key UNIQUE (tenant_id, email);



--
-- Name: cms_tags cms_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tags
    ADD CONSTRAINT cms_tags_pkey PRIMARY KEY (id);



--
-- Name: cms_tags cms_tags_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tags
    ADD CONSTRAINT cms_tags_tenant_id_slug_key UNIQUE (tenant_id, slug);



--
-- Name: idx_cms_authors_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_authors_slug ON public.cms_authors USING btree (tenant_id, slug);



--
-- Name: idx_cms_authors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_authors_tenant ON public.cms_authors USING btree (tenant_id);



--
-- Name: idx_cms_authors_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_authors_user ON public.cms_authors USING btree (user_id);



--
-- Name: idx_cms_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_categories_parent ON public.cms_categories USING btree (parent_id);



--
-- Name: idx_cms_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_categories_slug ON public.cms_categories USING btree (tenant_id, slug);



--
-- Name: idx_cms_categories_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_categories_tenant ON public.cms_categories USING btree (tenant_id);



--
-- Name: idx_cms_media_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_media_tenant ON public.cms_media USING btree (tenant_id);



--
-- Name: idx_cms_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_media_type ON public.cms_media USING btree (tenant_id, mime_type);



--
-- Name: idx_cms_menus_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_menus_tenant ON public.cms_menus USING btree (tenant_id);



--
-- Name: idx_cms_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_pages_slug ON public.cms_pages USING btree (tenant_id, slug);



--
-- Name: idx_cms_pages_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_pages_tenant ON public.cms_pages USING btree (tenant_id);



--
-- Name: idx_cms_post_revisions; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_post_revisions ON public.cms_post_revisions USING btree (post_id);



--
-- Name: idx_cms_post_tags_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_post_tags_post ON public.cms_post_tags USING btree (post_id);



--
-- Name: idx_cms_post_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_post_tags_tag ON public.cms_post_tags USING btree (tag_id);



--
-- Name: idx_cms_post_views_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_post_views_date ON public.cms_post_views USING btree (post_id, viewed_at);



--
-- Name: idx_cms_post_views_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_post_views_post ON public.cms_post_views USING btree (post_id);



--
-- Name: idx_cms_posts_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_author ON public.cms_posts USING btree (author_id);



--
-- Name: idx_cms_posts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_category ON public.cms_posts USING btree (category_id);



--
-- Name: idx_cms_posts_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_featured ON public.cms_posts USING btree (tenant_id, is_featured) WHERE (is_featured = true);



--
-- Name: idx_cms_posts_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_published ON public.cms_posts USING btree (tenant_id, published_at) WHERE (status = 'published'::public.cms_post_status);



--
-- Name: idx_cms_posts_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_slug ON public.cms_posts USING btree (tenant_id, slug);



--
-- Name: idx_cms_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_status ON public.cms_posts USING btree (tenant_id, status);



--
-- Name: idx_cms_posts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_posts_tenant ON public.cms_posts USING btree (tenant_id);



--
-- Name: idx_cms_subscribers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_subscribers_email ON public.cms_subscribers USING btree (tenant_id, email);



--
-- Name: idx_cms_subscribers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_subscribers_status ON public.cms_subscribers USING btree (tenant_id, status);



--
-- Name: idx_cms_subscribers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_subscribers_tenant ON public.cms_subscribers USING btree (tenant_id);



--
-- Name: idx_cms_tags_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_tags_slug ON public.cms_tags USING btree (tenant_id, slug);



--
-- Name: idx_cms_tags_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cms_tags_tenant ON public.cms_tags USING btree (tenant_id);



--
-- Name: cms_authors trg_cms_authors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_authors_updated_at BEFORE UPDATE ON public.cms_authors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_categories trg_cms_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_categories_updated_at BEFORE UPDATE ON public.cms_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_menus trg_cms_menus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_menus_updated_at BEFORE UPDATE ON public.cms_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_pages trg_cms_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_pages_updated_at BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_posts trg_cms_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_posts_updated_at BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_settings trg_cms_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_settings_updated_at BEFORE UPDATE ON public.cms_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cms_categories cms_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_categories
    ADD CONSTRAINT cms_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cms_categories(id);



--
-- Name: cms_post_revisions cms_post_revisions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_revisions
    ADD CONSTRAINT cms_post_revisions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;



--
-- Name: cms_post_tags cms_post_tags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;



--
-- Name: cms_post_tags cms_post_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_tags
    ADD CONSTRAINT cms_post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.cms_tags(id) ON DELETE CASCADE;



--
-- Name: cms_post_views cms_post_views_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_post_views
    ADD CONSTRAINT cms_post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.cms_posts(id) ON DELETE CASCADE;



--
-- Name: cms_posts cms_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.cms_authors(id);



--
-- Name: cms_posts cms_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.cms_categories(id);



--
-- Name: cms_posts cms_posts_feature_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_feature_image_id_fkey FOREIGN KEY (feature_image_id) REFERENCES public.cms_media(id);



--
-- Name: cms_posts cms_posts_og_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_og_image_id_fkey FOREIGN KEY (og_image_id) REFERENCES public.cms_media(id);



--
-- Name: cms_post_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cms_post_analytics AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS tenant_id,
    NULL::text AS title,
    NULL::text AS slug,
    NULL::public.cms_post_status AS status,
    NULL::timestamp with time zone AS published_at,
    NULL::text AS author_name,
    NULL::text AS category_name,
    NULL::bigint AS total_views,
    NULL::bigint AS days_with_views,
    NULL::timestamp with time zone AS last_viewed_at;



--
-- Name: cms_post_analytics _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.cms_post_analytics AS
 SELECT p.id,
    p.tenant_id,
    p.title,
    p.slug,
    p.status,
    p.published_at,
    a.name AS author_name,
    c.name AS category_name,
    count(v.id) AS total_views,
    count(DISTINCT date(v.viewed_at)) AS days_with_views,
    max(v.viewed_at) AS last_viewed_at
   FROM (((public.cms_posts p
     LEFT JOIN public.cms_authors a ON ((p.author_id = a.id)))
     LEFT JOIN public.cms_categories c ON ((p.category_id = c.id)))
     LEFT JOIN public.cms_post_views v ON ((p.id = v.post_id)))
  GROUP BY p.id, a.name, c.name;



--
-- Name: cms_authors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_authors ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_authors cms_authors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_authors_tenant ON public.cms_authors USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_categories ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_categories cms_categories_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_categories_tenant ON public.cms_categories USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_media ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_media cms_media_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_media_tenant ON public.cms_media USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_menus ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_menus cms_menus_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_menus_tenant ON public.cms_menus USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_pages cms_pages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_pages_tenant ON public.cms_pages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_posts cms_posts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_posts_tenant ON public.cms_posts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_settings cms_settings_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_settings_tenant ON public.cms_settings USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_subscribers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_subscribers ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_subscribers cms_subscribers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_subscribers_tenant ON public.cms_subscribers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cms_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_tags ENABLE ROW LEVEL SECURITY;


--
-- Name: cms_tags cms_tags_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cms_tags_tenant ON public.cms_tags USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


