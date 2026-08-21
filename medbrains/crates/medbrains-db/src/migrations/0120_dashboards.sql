-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 7
-- Drops: none
-- dashboards — schema.
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
    data_filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    variants jsonb DEFAULT '[]'::jsonb NOT NULL
);

-- Name: dashboard_widgets dashboard_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);

CREATE INDEX idx_dashboard_widgets_deleted_at_a63d914c ON public.dashboard_widgets USING btree (deleted_at);

CREATE INDEX idx_dw_dashboard ON public.dashboard_widgets USING btree (dashboard_id);

-- Name: dashboard_widgets trg_dashboard_widgets_soft_delete_a63d914c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dashboard_widgets_soft_delete_a63d914c BEFORE DELETE ON public.dashboard_widgets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    group_ids jsonb DEFAULT '[]'::jsonb NOT NULL
);

-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);

-- Name: dashboards dashboards_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_dashboards_active ON public.dashboards USING btree (tenant_id, is_active) WHERE (is_active = true);

CREATE INDEX idx_dashboards_deleted_at_126c4c32 ON public.dashboards USING btree (deleted_at);

CREATE INDEX idx_dashboards_dept ON public.dashboards USING gin (department_ids);

CREATE INDEX idx_dashboards_groups ON public.dashboards USING gin (group_ids jsonb_path_ops);

CREATE INDEX idx_dashboards_role_codes ON public.dashboards USING gin (role_codes jsonb_path_ops);

CREATE INDEX idx_dashboards_tenant ON public.dashboards USING btree (tenant_id);

CREATE INDEX idx_dashboards_user ON public.dashboards USING btree (user_id) WHERE (user_id IS NOT NULL);

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Name: dashboards dashboards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dashboards_tenant ON public.dashboards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: dashboards trg_dashboards_soft_delete_126c4c32; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dashboards_soft_delete_126c4c32 BEFORE DELETE ON public.dashboards FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.department_alert_thresholds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    metric_code character varying(50) NOT NULL,
    warning_threshold numeric,
    critical_threshold numeric,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: department_alert_thresholds department_alert_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_pkey PRIMARY KEY (id);

-- Name: department_alert_thresholds department_alert_thresholds_tenant_id_department_id_metric__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_tenant_id_department_id_metric__key UNIQUE (tenant_id, department_id, metric_code);

CREATE INDEX idx_department_alert_thresholds_deleted_at_3090f4c7 ON public.department_alert_thresholds USING btree (deleted_at);

CREATE INDEX idx_department_alert_thresholds_department_id ON public.department_alert_thresholds USING btree (department_id);

CREATE INDEX idx_dept_alert_thresholds_dept ON public.department_alert_thresholds USING btree (tenant_id, department_id) WHERE (is_active = true);

CREATE INDEX idx_dept_alert_thresholds_tenant ON public.department_alert_thresholds USING btree (tenant_id);

ALTER TABLE public.department_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- Name: department_alert_thresholds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.department_alert_thresholds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: department_alert_thresholds set_dept_alert_thresholds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_dept_alert_thresholds_updated_at BEFORE UPDATE ON public.department_alert_thresholds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: department_alert_thresholds trg_department_alert_thresholds_soft_delete_3090f4c7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_department_alert_thresholds_soft_delete_3090f4c7 BEFORE DELETE ON public.department_alert_thresholds FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.department_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    threshold_id uuid,
    alert_level character varying(20) NOT NULL,
    metric_code character varying(50) NOT NULL,
    current_value numeric NOT NULL,
    threshold_value numeric NOT NULL,
    message text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: department_alerts department_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_department_alerts_deleted_at_acdfad75 ON public.department_alerts USING btree (deleted_at);

CREATE INDEX idx_department_alerts_department_id ON public.department_alerts USING btree (department_id);

CREATE INDEX idx_dept_alerts_active ON public.department_alerts USING btree (tenant_id, department_id) WHERE ((acknowledged_at IS NULL) AND (resolved_at IS NULL));

CREATE INDEX idx_dept_alerts_created ON public.department_alerts USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_dept_alerts_tenant ON public.department_alerts USING btree (tenant_id);

ALTER TABLE public.department_alerts ENABLE ROW LEVEL SECURITY;

-- Name: department_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.department_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: department_alerts trg_department_alerts_soft_delete_acdfad75; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_department_alerts_soft_delete_acdfad75 BEFORE DELETE ON public.department_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.eod_digest_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    digest_date date NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    sent_at timestamp with time zone,
    delivery_status text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: eod_digest_history eod_digest_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_history
    ADD CONSTRAINT eod_digest_history_pkey PRIMARY KEY (id);

CREATE INDEX idx_eod_digest_history_deleted_at_8e7e8ccc ON public.eod_digest_history USING btree (deleted_at);

CREATE INDEX idx_eod_digest_history_user ON public.eod_digest_history USING btree (tenant_id, user_id, digest_date DESC);

ALTER TABLE ONLY public.eod_digest_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.eod_digest_history ENABLE ROW LEVEL SECURITY;

-- Name: eod_digest_history tenant_isolation_eod_digest_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_eod_digest_history ON public.eod_digest_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: eod_digest_history trg_eod_digest_history_soft_delete_8e7e8ccc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eod_digest_history_soft_delete_8e7e8ccc BEFORE DELETE ON public.eod_digest_history FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.eod_digest_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    frequency text DEFAULT 'daily'::text NOT NULL,
    delivery_time time without time zone,
    delivery_days integer[],
    modules text[],
    include_summary boolean DEFAULT true NOT NULL,
    include_alerts boolean DEFAULT true NOT NULL,
    include_pending_tasks boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: eod_digest_subscriptions eod_digest_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_pkey PRIMARY KEY (id);

-- Name: eod_digest_subscriptions eod_digest_subscriptions_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_tenant_id_user_id_key UNIQUE (tenant_id, user_id);

CREATE INDEX idx_eod_digest_subscriptions_deleted_at_f2834409 ON public.eod_digest_subscriptions USING btree (deleted_at);

ALTER TABLE ONLY public.eod_digest_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.eod_digest_subscriptions ENABLE ROW LEVEL SECURITY;

-- Name: eod_digest_subscriptions tenant_isolation_eod_digest_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_eod_digest_subscriptions ON public.eod_digest_subscriptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: eod_digest_subscriptions trg_eod_digest_subscriptions_soft_delete_f2834409; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eod_digest_subscriptions_soft_delete_f2834409 BEFORE DELETE ON public.eod_digest_subscriptions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: widget_templates widget_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.widget_templates
    ADD CONSTRAINT widget_templates_pkey PRIMARY KEY (id);

CREATE INDEX idx_widget_templates_deleted_at_5ae4362d ON public.widget_templates USING btree (deleted_at);

CREATE INDEX idx_wt_category ON public.widget_templates USING btree (category);

CREATE INDEX idx_wt_tenant ON public.widget_templates USING btree (tenant_id);

ALTER TABLE public.widget_templates ENABLE ROW LEVEL SECURITY;

-- Name: widget_templates wt_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wt_tenant ON public.widget_templates USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));

-- Name: widget_templates trg_widget_templates_soft_delete_5ae4362d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_widget_templates_soft_delete_5ae4362d BEFORE DELETE ON public.widget_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: dashboard_widgets dashboard_widgets_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.dashboards(id) ON DELETE CASCADE;

-- Name: dashboards dashboards_cloned_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_cloned_from_fkey FOREIGN KEY (cloned_from) REFERENCES public.dashboards(id) ON DELETE SET NULL;

-- Name: department_alerts department_alerts_threshold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_threshold_id_fkey FOREIGN KEY (threshold_id) REFERENCES public.department_alert_thresholds(id);
