-- ============================================================
-- MedBrains schema — module: dashboards
-- ============================================================

--
-- Name: dashboard_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dashboard_id uuid NOT NULL,
    widget_type public.widget_type NOT NULL,
    title text NOT NULL,
    subtitle text,
    icon text,
    color text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    data_source jsonb DEFAULT '{}'::jsonb NOT NULL,
    position_x integer DEFAULT 0 NOT NULL,
    position_y integer DEFAULT 0 NOT NULL,
    width integer DEFAULT 4 NOT NULL,
    height integer DEFAULT 2 NOT NULL,
    min_width integer DEFAULT 2 NOT NULL,
    min_height integer DEFAULT 1 NOT NULL,
    refresh_interval integer,
    is_visible boolean DEFAULT true NOT NULL,
    permission_code text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    data_filters jsonb DEFAULT '{}'::jsonb NOT NULL
);



--
-- Name: dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    is_default boolean DEFAULT false NOT NULL,
    role_codes jsonb DEFAULT '[]'::jsonb NOT NULL,
    department_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    layout_config jsonb DEFAULT '{"gap": 16, "columns": 12, "row_height": 80}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    cloned_from uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: widget_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.widget_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    description text,
    widget_type public.widget_type NOT NULL,
    icon text,
    color text,
    default_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_source jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_width integer DEFAULT 4 NOT NULL,
    default_height integer DEFAULT 2 NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    required_permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    required_departments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: dashboard_widgets dashboard_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);



--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);



--
-- Name: dashboards dashboards_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: widget_templates widget_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_templates
    ADD CONSTRAINT widget_templates_pkey PRIMARY KEY (id);



--
-- Name: idx_dashboards_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_active ON public.dashboards USING btree (tenant_id, is_active) WHERE (is_active = true);



--
-- Name: idx_dashboards_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_dept ON public.dashboards USING gin (department_ids jsonb_path_ops);



--
-- Name: idx_dashboards_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_tenant ON public.dashboards USING btree (tenant_id);



--
-- Name: idx_dashboards_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_user ON public.dashboards USING btree (user_id) WHERE (user_id IS NOT NULL);



--
-- Name: idx_dw_dashboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dw_dashboard ON public.dashboard_widgets USING btree (dashboard_id);



--
-- Name: idx_wt_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wt_category ON public.widget_templates USING btree (category);



--
-- Name: idx_wt_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wt_tenant ON public.widget_templates USING btree (tenant_id);



--
-- Name: dashboard_widgets dashboard_widgets_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.dashboards(id) ON DELETE CASCADE;



--
-- Name: dashboards dashboards_cloned_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_cloned_from_fkey FOREIGN KEY (cloned_from) REFERENCES public.dashboards(id) ON DELETE SET NULL;



--
-- Name: dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;


--
-- Name: dashboards dashboards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dashboards_tenant ON public.dashboards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: widget_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.widget_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: widget_templates wt_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wt_tenant ON public.widget_templates USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));


--
-- PostgreSQL database dump complete
--




