-- ============================================================
-- MedBrains schema — module: command_center
-- ============================================================

--
-- Name: department_alert_thresholds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_alert_thresholds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    metric_code character varying(50) NOT NULL,
    warning_threshold numeric,
    critical_threshold numeric,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: department_alerts; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: eod_digest_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eod_digest_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    digest_date date NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    sent_at timestamp with time zone,
    delivery_status text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.eod_digest_history FORCE ROW LEVEL SECURITY;



--
-- Name: eod_digest_subscriptions; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.eod_digest_subscriptions FORCE ROW LEVEL SECURITY;



--
-- Name: department_alert_thresholds department_alert_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_pkey PRIMARY KEY (id);



--
-- Name: department_alert_thresholds department_alert_thresholds_tenant_id_department_id_metric__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alert_thresholds
    ADD CONSTRAINT department_alert_thresholds_tenant_id_department_id_metric__key UNIQUE (tenant_id, department_id, metric_code);



--
-- Name: department_alerts department_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_pkey PRIMARY KEY (id);



--
-- Name: eod_digest_history eod_digest_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_history
    ADD CONSTRAINT eod_digest_history_pkey PRIMARY KEY (id);



--
-- Name: eod_digest_subscriptions eod_digest_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_pkey PRIMARY KEY (id);



--
-- Name: eod_digest_subscriptions eod_digest_subscriptions_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eod_digest_subscriptions
    ADD CONSTRAINT eod_digest_subscriptions_tenant_id_user_id_key UNIQUE (tenant_id, user_id);



--
-- Name: idx_dept_alert_thresholds_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_alert_thresholds_dept ON public.department_alert_thresholds USING btree (tenant_id, department_id) WHERE (is_active = true);



--
-- Name: idx_dept_alert_thresholds_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_alert_thresholds_tenant ON public.department_alert_thresholds USING btree (tenant_id);



--
-- Name: idx_dept_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_alerts_active ON public.department_alerts USING btree (tenant_id, department_id) WHERE ((acknowledged_at IS NULL) AND (resolved_at IS NULL));



--
-- Name: idx_dept_alerts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_alerts_created ON public.department_alerts USING btree (tenant_id, created_at DESC);



--
-- Name: idx_dept_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dept_alerts_tenant ON public.department_alerts USING btree (tenant_id);



--
-- Name: idx_eod_digest_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eod_digest_history_user ON public.eod_digest_history USING btree (tenant_id, user_id, digest_date DESC);



--
-- Name: department_alert_thresholds set_dept_alert_thresholds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_dept_alert_thresholds_updated_at BEFORE UPDATE ON public.department_alert_thresholds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: department_alerts department_alerts_threshold_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_alerts
    ADD CONSTRAINT department_alerts_threshold_id_fkey FOREIGN KEY (threshold_id) REFERENCES public.department_alert_thresholds(id);



--
-- Name: department_alert_thresholds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.department_alert_thresholds ENABLE ROW LEVEL SECURITY;


--
-- Name: department_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.department_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: eod_digest_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eod_digest_history ENABLE ROW LEVEL SECURITY;


--
-- Name: eod_digest_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eod_digest_subscriptions ENABLE ROW LEVEL SECURITY;


--
-- Name: department_alert_thresholds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.department_alert_thresholds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: department_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.department_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: eod_digest_history tenant_isolation_eod_digest_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_eod_digest_history ON public.eod_digest_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: eod_digest_subscriptions tenant_isolation_eod_digest_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_eod_digest_subscriptions ON public.eod_digest_subscriptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


