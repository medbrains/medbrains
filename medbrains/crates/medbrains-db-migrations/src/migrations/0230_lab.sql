-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 32
-- Drops: none
-- lab — schema.
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



CREATE TABLE public.critical_value_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    test_code text NOT NULL,
    test_name text NOT NULL,
    low_critical numeric(12,4),
    high_critical numeric(12,4),
    unit text,
    age_min integer,
    age_max integer,
    gender text,
    alert_message text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT critical_value_rules_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text]))))
);

-- Name: critical_value_rules critical_value_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_value_rules
    ADD CONSTRAINT critical_value_rules_pkey PRIMARY KEY (id);

CREATE INDEX idx_critical_value_rules_deleted_at_5026ba1a ON public.critical_value_rules USING btree (deleted_at);

CREATE INDEX idx_critical_value_rules_tenant ON public.critical_value_rules USING btree (tenant_id);

CREATE INDEX idx_critical_value_rules_test ON public.critical_value_rules USING btree (tenant_id, test_code);

ALTER TABLE public.critical_value_rules ENABLE ROW LEVEL SECURITY;

-- Name: critical_value_rules critical_value_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY critical_value_rules_tenant ON public.critical_value_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: critical_value_rules set_updated_at_critical_value_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_critical_value_rules BEFORE UPDATE ON public.critical_value_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: critical_value_rules trg_critical_value_rules_soft_delete_5026ba1a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_critical_value_rules_soft_delete_5026ba1a BEFORE DELETE ON public.critical_value_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.histopath_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid,
    gross_description text,
    microscopic_description text,
    diagnosis text,
    icd_o_morphology text,
    icd_o_topography text,
    staging text,
    grade text,
    margin_status text,
    lymph_node_status text,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: histopath_results histopath_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.histopath_results
    ADD CONSTRAINT histopath_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_histopath_order ON public.histopath_results USING btree (tenant_id, order_id);

CREATE INDEX idx_histopath_results_deleted_at_8651262b ON public.histopath_results USING btree (deleted_at);

ALTER TABLE ONLY public.histopath_results FORCE ROW LEVEL SECURITY;

ALTER TABLE public.histopath_results ENABLE ROW LEVEL SECURITY;

-- Name: histopath_results tenant_isolation_histopath_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_histopath_results ON public.histopath_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: histopath_results trg_histopath_results_soft_delete_8651262b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_histopath_results_soft_delete_8651262b BEFORE DELETE ON public.histopath_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_b2b_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    client_type character varying(50),
    address text,
    city character varying(100),
    phone character varying(20),
    email character varying(200),
    contact_person character varying(200),
    credit_limit numeric(12,2),
    payment_terms_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credit_used numeric(12,2) DEFAULT 0,
    billing_cycle text DEFAULT 'monthly'::text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT lab_b2b_clients_billing_cycle_check CHECK (((billing_cycle IS NULL) OR (billing_cycle = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text]))))
);

-- Name: lab_b2b_clients lab_b2b_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_clients
    ADD CONSTRAINT lab_b2b_clients_pkey PRIMARY KEY (id);

-- Name: lab_b2b_clients lab_b2b_clients_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_clients
    ADD CONSTRAINT lab_b2b_clients_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lab_b2b_clients_deleted_at_106c8127 ON public.lab_b2b_clients USING btree (deleted_at);

ALTER TABLE public.lab_b2b_clients ENABLE ROW LEVEL SECURITY;

-- Name: lab_b2b_clients lab_b2b_clients_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_b2b_clients_tenant ON public.lab_b2b_clients USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_b2b_clients trg_lab_b2b_clients_soft_delete_106c8127; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_clients_soft_delete_106c8127 BEFORE DELETE ON public.lab_b2b_clients FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_b2b_clients trg_lab_b2b_clients_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_clients_updated BEFORE UPDATE ON public.lab_b2b_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_b2b_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    client_id uuid NOT NULL,
    test_id uuid NOT NULL,
    agreed_price numeric(10,2),
    discount_percent numeric(5,2),
    effective_from date,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_b2b_rates lab_b2b_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_pkey PRIMARY KEY (id);

-- Name: lab_b2b_rates lab_b2b_rates_tenant_id_client_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_tenant_id_client_id_test_id_key UNIQUE (tenant_id, client_id, test_id);

CREATE INDEX idx_lab_b2b_rates_client ON public.lab_b2b_rates USING btree (tenant_id, client_id);

CREATE INDEX idx_lab_b2b_rates_deleted_at_fa5fc33a ON public.lab_b2b_rates USING btree (deleted_at);

CREATE INDEX idx_lab_b2b_rates_test_id ON public.lab_b2b_rates USING btree (test_id);

ALTER TABLE public.lab_b2b_rates ENABLE ROW LEVEL SECURITY;

-- Name: lab_b2b_rates lab_b2b_rates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_b2b_rates_tenant ON public.lab_b2b_rates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_b2b_rates trg_lab_b2b_rates_soft_delete_fa5fc33a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_rates_soft_delete_fa5fc33a BEFORE DELETE ON public.lab_b2b_rates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_b2b_rates trg_lab_b2b_rates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_rates_updated BEFORE UPDATE ON public.lab_b2b_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_calibrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    test_id uuid NOT NULL,
    instrument_name character varying(200),
    calibrator_lot character varying(100),
    calibration_date date,
    next_calibration_date date,
    result_summary jsonb,
    is_passed boolean DEFAULT true NOT NULL,
    performed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_calibrations lab_calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_calibrations_deleted_at_15a2213b ON public.lab_calibrations USING btree (deleted_at);

CREATE INDEX idx_lab_calibrations_tenant_id ON public.lab_calibrations USING btree (tenant_id);

CREATE INDEX idx_lab_calibrations_test_id ON public.lab_calibrations USING btree (test_id);

ALTER TABLE public.lab_calibrations ENABLE ROW LEVEL SECURITY;

-- Name: lab_calibrations tenant_isolation_lab_calibrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_calibrations ON public.lab_calibrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_calibrations trg_lab_calibrations_soft_delete_15a2213b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_calibrations_soft_delete_15a2213b BEFORE DELETE ON public.lab_calibrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_collection_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    center_type public.lab_collection_center_type DEFAULT 'hospital'::public.lab_collection_center_type NOT NULL,
    address text,
    city character varying(100),
    phone character varying(20),
    contact_person character varying(200),
    is_active boolean DEFAULT true NOT NULL,
    operating_hours jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_collection_centers lab_collection_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_collection_centers
    ADD CONSTRAINT lab_collection_centers_pkey PRIMARY KEY (id);

-- Name: lab_collection_centers lab_collection_centers_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_collection_centers
    ADD CONSTRAINT lab_collection_centers_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lab_collection_centers_deleted_at_c743e5c0 ON public.lab_collection_centers USING btree (deleted_at);

ALTER TABLE public.lab_collection_centers ENABLE ROW LEVEL SECURITY;

-- Name: lab_collection_centers lab_collection_centers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_collection_centers_tenant ON public.lab_collection_centers USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_collection_centers trg_lab_collection_centers_soft_delete_c743e5c0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_collection_centers_soft_delete_c743e5c0 BEFORE DELETE ON public.lab_collection_centers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_collection_centers trg_lab_collection_centers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_collection_centers_updated BEFORE UPDATE ON public.lab_collection_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_critical_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    result_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    parameter_name text NOT NULL,
    value text NOT NULL,
    flag public.lab_result_flag NOT NULL,
    notified_to uuid,
    notified_at timestamp with time zone,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    escalated_at timestamp with time zone,
    escalated_to uuid,
    readback_value text,
    readback_verified boolean DEFAULT false NOT NULL
);

-- Name: lab_critical_alerts lab_critical_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_critical_alerts_deleted_at_b4fe7a61 ON public.lab_critical_alerts USING btree (deleted_at);

CREATE INDEX idx_lab_critical_alerts_order_id ON public.lab_critical_alerts USING btree (order_id);

CREATE INDEX idx_lab_critical_alerts_patient_id ON public.lab_critical_alerts USING btree (patient_id);

CREATE INDEX idx_lab_critical_alerts_unack ON public.lab_critical_alerts USING btree (tenant_id, acknowledged_at) WHERE (acknowledged_at IS NULL);

CREATE INDEX idx_lab_critical_alerts_unacked ON public.lab_critical_alerts USING btree (tenant_id, created_at) WHERE ((acknowledged_at IS NULL) AND (escalated_at IS NULL));

ALTER TABLE public.lab_critical_alerts ENABLE ROW LEVEL SECURITY;

-- Name: lab_critical_alerts tenant_isolation_lab_critical_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_critical_alerts ON public.lab_critical_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_critical_alerts trg_lab_critical_alerts_soft_delete_b4fe7a61; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_critical_alerts_soft_delete_b4fe7a61 BEFORE DELETE ON public.lab_critical_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_cytology_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    specimen_type character varying(100),
    clinical_indication text,
    adequacy character varying(100),
    screening_findings text,
    diagnosis text,
    bethesda_category character varying(100),
    cytopathologist_id uuid,
    reported_at timestamp with time zone,
    icd_code character varying(20),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_cytology_reports lab_cytology_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_cytology_order ON public.lab_cytology_reports USING btree (tenant_id, order_id);

CREATE INDEX idx_lab_cytology_reports_deleted_at_f0ec2c19 ON public.lab_cytology_reports USING btree (deleted_at);

CREATE INDEX idx_lab_cytology_reports_order_id ON public.lab_cytology_reports USING btree (order_id);

CREATE INDEX idx_lab_cytology_reports_patient_id ON public.lab_cytology_reports USING btree (patient_id);

ALTER TABLE public.lab_cytology_reports ENABLE ROW LEVEL SECURITY;

-- Name: lab_cytology_reports lab_cytology_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_cytology_reports_tenant ON public.lab_cytology_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_cytology_reports trg_lab_cytology_reports_soft_delete_f0ec2c19; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_cytology_reports_soft_delete_f0ec2c19 BEFORE DELETE ON public.lab_cytology_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_cytology_reports trg_lab_cytology_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_cytology_reports_updated BEFORE UPDATE ON public.lab_cytology_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_eqas_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    program_name character varying(200) NOT NULL,
    provider character varying(200),
    test_id uuid NOT NULL,
    cycle character varying(50),
    sample_number character varying(50),
    expected_value numeric(12,4),
    reported_value numeric(12,4),
    evaluation public.lab_eqas_evaluation DEFAULT 'pending'::public.lab_eqas_evaluation NOT NULL,
    bias_percent numeric(8,2),
    z_score numeric(6,2),
    report_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_eqas_results lab_eqas_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_eqas_results
    ADD CONSTRAINT lab_eqas_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_eqas_results_deleted_at_4a1fb352 ON public.lab_eqas_results USING btree (deleted_at);

CREATE INDEX idx_lab_eqas_results_test_id ON public.lab_eqas_results USING btree (test_id);

CREATE INDEX idx_lab_eqas_test_cycle ON public.lab_eqas_results USING btree (tenant_id, test_id, cycle);

ALTER TABLE public.lab_eqas_results ENABLE ROW LEVEL SECURITY;

-- Name: lab_eqas_results lab_eqas_results_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_eqas_results_tenant ON public.lab_eqas_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_eqas_results trg_lab_eqas_results_soft_delete_4a1fb352; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_eqas_results_soft_delete_4a1fb352 BEFORE DELETE ON public.lab_eqas_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_eqas_results trg_lab_eqas_results_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_eqas_results_updated BEFORE UPDATE ON public.lab_eqas_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_histopath_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    specimen_type character varying(200),
    clinical_history text,
    gross_description text,
    microscopy_findings text,
    special_stains jsonb,
    immunohistochemistry jsonb,
    synoptic_data jsonb,
    diagnosis text,
    icd_code character varying(20),
    pathologist_id uuid,
    reported_at timestamp with time zone,
    notes text,
    turnaround_days integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_histopath_reports lab_histopath_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_histopath_order ON public.lab_histopath_reports USING btree (tenant_id, order_id);

CREATE INDEX idx_lab_histopath_reports_deleted_at_0e26ba32 ON public.lab_histopath_reports USING btree (deleted_at);

CREATE INDEX idx_lab_histopath_reports_order_id ON public.lab_histopath_reports USING btree (order_id);

CREATE INDEX idx_lab_histopath_reports_patient_id ON public.lab_histopath_reports USING btree (patient_id);

ALTER TABLE public.lab_histopath_reports ENABLE ROW LEVEL SECURITY;

-- Name: lab_histopath_reports lab_histopath_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_histopath_reports_tenant ON public.lab_histopath_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_histopath_reports trg_lab_histopath_reports_soft_delete_0e26ba32; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_histopath_reports_soft_delete_0e26ba32 BEFORE DELETE ON public.lab_histopath_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_histopath_reports trg_lab_histopath_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_histopath_reports_updated BEFORE UPDATE ON public.lab_histopath_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_home_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time_slot character varying(50),
    address_line text NOT NULL,
    city character varying(100),
    pincode character varying(20),
    contact_phone character varying(20),
    assigned_phlebotomist uuid,
    status public.lab_home_collection_status DEFAULT 'scheduled'::public.lab_home_collection_status NOT NULL,
    special_instructions text,
    collected_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_home_collections lab_home_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_home_collections_date ON public.lab_home_collections USING btree (tenant_id, scheduled_date);

CREATE INDEX idx_lab_home_collections_deleted_at_99051dd4 ON public.lab_home_collections USING btree (deleted_at);

CREATE INDEX idx_lab_home_collections_order_id ON public.lab_home_collections USING btree (order_id);

CREATE INDEX idx_lab_home_collections_patient_id ON public.lab_home_collections USING btree (patient_id);

CREATE INDEX idx_lab_home_collections_tenant_status ON public.lab_home_collections USING btree (tenant_id, status);

ALTER TABLE public.lab_home_collections ENABLE ROW LEVEL SECURITY;

-- Name: lab_home_collections lab_home_collections_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_home_collections_tenant ON public.lab_home_collections USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_home_collections trg_lab_home_collections_soft_delete_99051dd4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_home_collections_soft_delete_99051dd4 BEFORE DELETE ON public.lab_home_collections FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_home_collections trg_lab_home_collections_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_home_collections_updated BEFORE UPDATE ON public.lab_home_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_molecular_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    test_method character varying(100),
    target_gene character varying(200),
    primer_details text,
    amplification_data jsonb,
    ct_value numeric(8,2),
    result_interpretation character varying(200),
    quantitative_value numeric(15,4),
    quantitative_unit character varying(50),
    kit_name character varying(200),
    kit_lot character varying(100),
    performed_by uuid,
    reported_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_molecular_reports lab_molecular_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_molecular_order ON public.lab_molecular_reports USING btree (tenant_id, order_id);

CREATE INDEX idx_lab_molecular_reports_deleted_at_2689f779 ON public.lab_molecular_reports USING btree (deleted_at);

CREATE INDEX idx_lab_molecular_reports_order_id ON public.lab_molecular_reports USING btree (order_id);

CREATE INDEX idx_lab_molecular_reports_patient_id ON public.lab_molecular_reports USING btree (patient_id);

ALTER TABLE public.lab_molecular_reports ENABLE ROW LEVEL SECURITY;

-- Name: lab_molecular_reports lab_molecular_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_molecular_reports_tenant ON public.lab_molecular_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_molecular_reports trg_lab_molecular_reports_soft_delete_2689f779; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_molecular_reports_soft_delete_2689f779 BEFORE DELETE ON public.lab_molecular_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_molecular_reports trg_lab_molecular_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_molecular_reports_updated BEFORE UPDATE ON public.lab_molecular_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_nabl_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_number character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    version character varying(20),
    effective_date date,
    review_date date,
    approved_by uuid,
    file_path text,
    is_current boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_nabl_documents lab_nabl_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_pkey PRIMARY KEY (id);

-- Name: lab_nabl_documents lab_nabl_documents_tenant_id_document_number_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_tenant_id_document_number_version_key UNIQUE (tenant_id, document_number, version);

CREATE INDEX idx_lab_nabl_documents_current ON public.lab_nabl_documents USING btree (tenant_id, is_current);

CREATE INDEX idx_lab_nabl_documents_deleted_at_abd11c0c ON public.lab_nabl_documents USING btree (deleted_at);

ALTER TABLE public.lab_nabl_documents ENABLE ROW LEVEL SECURITY;

-- Name: lab_nabl_documents lab_nabl_documents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_nabl_documents_tenant ON public.lab_nabl_documents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_nabl_documents trg_lab_nabl_documents_soft_delete_abd11c0c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_nabl_documents_soft_delete_abd11c0c BEFORE DELETE ON public.lab_nabl_documents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_nabl_documents trg_lab_nabl_documents_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_nabl_documents_updated BEFORE UPDATE ON public.lab_nabl_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    test_id uuid NOT NULL,
    ordered_by uuid NOT NULL,
    status public.lab_order_status DEFAULT 'ordered'::public.lab_order_status NOT NULL,
    priority public.lab_priority DEFAULT 'routine'::public.lab_priority NOT NULL,
    collected_at timestamp with time zone,
    collected_by uuid,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    rejection_reason character varying(500),
    sample_barcode character varying(100),
    is_outsourced boolean DEFAULT false NOT NULL,
    report_status public.lab_report_status,
    is_report_locked boolean DEFAULT false NOT NULL,
    expected_tat_minutes integer,
    completed_at timestamp with time zone,
    parent_order_id uuid,
    is_stat boolean DEFAULT false NOT NULL,
    collection_center_id uuid,
    camp_id uuid,
    referral_doctor_id uuid,
    department_id uuid,
    sample_type text,
    sample_id text,
    report_date timestamp with time zone,
    received_at timestamp with time zone,
    accession_number text,
    order_date timestamp with time zone,
    collection_date timestamp with time zone,
    ordering_doctor_id uuid,
    verified_by_id uuid,
    performed_by_id uuid,
    clinical_history text,
    interpretation text,
    comments text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    is_dummy boolean DEFAULT false NOT NULL
);

-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_orders_barcode ON public.lab_orders USING btree (tenant_id, sample_barcode) WHERE (sample_barcode IS NOT NULL);

CREATE INDEX idx_lab_orders_created_by ON public.lab_orders USING btree (created_by);

CREATE INDEX idx_lab_orders_deleted_at_2076b8a2 ON public.lab_orders USING btree (deleted_at);

CREATE INDEX idx_lab_orders_encounter ON public.lab_orders USING btree (encounter_id);

CREATE INDEX idx_lab_orders_live ON public.lab_orders USING btree (tenant_id, patient_id) WHERE (is_dummy = false);

CREATE INDEX idx_lab_orders_parent ON public.lab_orders USING btree (parent_order_id) WHERE (parent_order_id IS NOT NULL);

CREATE INDEX idx_lab_orders_patient ON public.lab_orders USING btree (patient_id);

CREATE INDEX idx_lab_orders_status ON public.lab_orders USING btree (tenant_id, status);

CREATE INDEX idx_lab_orders_tenant ON public.lab_orders USING btree (tenant_id);

CREATE INDEX idx_lab_orders_test_id ON public.lab_orders USING btree (test_id);

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- Name: lab_orders tenant_isolation_lab_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_orders ON public.lab_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_orders audit_lab_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_lab_orders AFTER INSERT OR DELETE OR UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('lab');

-- Name: lab_orders trg_lab_orders_soft_delete_2076b8a2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_orders_soft_delete_2076b8a2 BEFORE DELETE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_orders trg_lab_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_orders_updated_at BEFORE UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_outsourced_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    external_lab_name character varying(200) NOT NULL,
    external_lab_code character varying(50),
    sent_date date,
    expected_return_date date,
    actual_return_date date,
    external_ref_number character varying(100),
    status public.lab_outsource_status DEFAULT 'pending_send'::public.lab_outsource_status NOT NULL,
    cost numeric(10,2),
    notes text,
    sent_by uuid,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_outsourced_orders lab_outsourced_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_outsourced_orders_deleted_at_bd389c5c ON public.lab_outsourced_orders USING btree (deleted_at);

CREATE INDEX idx_lab_outsourced_orders_order_id ON public.lab_outsourced_orders USING btree (order_id);

CREATE INDEX idx_lab_outsourced_orders_tenant_id ON public.lab_outsourced_orders USING btree (tenant_id);

ALTER TABLE public.lab_outsourced_orders ENABLE ROW LEVEL SECURITY;

-- Name: lab_outsourced_orders tenant_isolation_lab_outsourced_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_outsourced_orders ON public.lab_outsourced_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_outsourced_orders set_lab_outsourced_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_outsourced_orders_updated_at BEFORE UPDATE ON public.lab_outsourced_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: lab_outsourced_orders trg_lab_outsourced_orders_soft_delete_bd389c5c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_outsourced_orders_soft_delete_bd389c5c BEFORE DELETE ON public.lab_outsourced_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_panel_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    panel_id uuid NOT NULL,
    test_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_panel_tests lab_panel_tests_panel_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_panel_id_test_id_key UNIQUE (panel_id, test_id);

-- Name: lab_panel_tests lab_panel_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_panel_tests_deleted_at_ecc76cd8 ON public.lab_panel_tests USING btree (deleted_at);

CREATE INDEX idx_lab_panel_tests_panel ON public.lab_panel_tests USING btree (panel_id);

CREATE INDEX idx_lab_panel_tests_tenant ON public.lab_panel_tests USING btree (tenant_id);

CREATE INDEX idx_lab_panel_tests_test_id ON public.lab_panel_tests USING btree (test_id);

ALTER TABLE public.lab_panel_tests ENABLE ROW LEVEL SECURITY;

-- Name: lab_panel_tests lab_panel_tests_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_panel_tests_tenant_isolation ON public.lab_panel_tests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_panel_tests trg_lab_panel_tests_soft_delete_ecc76cd8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_panel_tests_soft_delete_ecc76cd8 BEFORE DELETE ON public.lab_panel_tests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_phlebotomy_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    priority public.lab_priority DEFAULT 'routine'::public.lab_priority NOT NULL,
    queue_number integer,
    status public.lab_phlebotomy_status DEFAULT 'waiting'::public.lab_phlebotomy_status NOT NULL,
    assigned_to uuid,
    location_id uuid,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_walk_in boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_phlebotomy_queue_deleted_at_c8d3058e ON public.lab_phlebotomy_queue USING btree (deleted_at);

CREATE INDEX idx_lab_phlebotomy_queue_location_id ON public.lab_phlebotomy_queue USING btree (location_id);

CREATE INDEX idx_lab_phlebotomy_queue_order_id ON public.lab_phlebotomy_queue USING btree (order_id);

CREATE INDEX idx_lab_phlebotomy_queue_patient_id ON public.lab_phlebotomy_queue USING btree (patient_id);

CREATE INDEX idx_lab_phlebotomy_queue_status ON public.lab_phlebotomy_queue USING btree (tenant_id, status, assigned_to);

ALTER TABLE public.lab_phlebotomy_queue ENABLE ROW LEVEL SECURITY;

-- Name: lab_phlebotomy_queue tenant_isolation_lab_phlebotomy_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_phlebotomy_queue ON public.lab_phlebotomy_queue USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_phlebotomy_queue set_lab_phlebotomy_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_phlebotomy_queue_updated_at BEFORE UPDATE ON public.lab_phlebotomy_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: lab_phlebotomy_queue trg_lab_phlebotomy_queue_soft_delete_c8d3058e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_phlebotomy_queue_soft_delete_c8d3058e BEFORE DELETE ON public.lab_phlebotomy_queue FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_proficiency_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    program character varying(200) NOT NULL,
    test_id uuid NOT NULL,
    survey_round character varying(50),
    sample_id character varying(50),
    assigned_value numeric(12,4),
    reported_value numeric(12,4),
    acceptable_range_low numeric(12,4),
    acceptable_range_high numeric(12,4),
    is_acceptable boolean,
    evaluation_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_proficiency_tests lab_proficiency_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_proficiency_tests
    ADD CONSTRAINT lab_proficiency_tests_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_proficiency_test ON public.lab_proficiency_tests USING btree (tenant_id, test_id);

CREATE INDEX idx_lab_proficiency_tests_deleted_at_940443a7 ON public.lab_proficiency_tests USING btree (deleted_at);

CREATE INDEX idx_lab_proficiency_tests_test_id ON public.lab_proficiency_tests USING btree (test_id);

ALTER TABLE public.lab_proficiency_tests ENABLE ROW LEVEL SECURITY;

-- Name: lab_proficiency_tests lab_proficiency_tests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_proficiency_tests_tenant ON public.lab_proficiency_tests USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_proficiency_tests trg_lab_proficiency_tests_soft_delete_940443a7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_proficiency_tests_soft_delete_940443a7 BEFORE DELETE ON public.lab_proficiency_tests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_qc_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text,
    analyte text,
    mean numeric(14,4),
    sd numeric(14,4),
    cv numeric(7,2),
    westgard_violations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_qc_metrics lab_qc_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_metrics
    ADD CONSTRAINT lab_qc_metrics_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_qc_metrics_deleted_at_bf070cdb ON public.lab_qc_metrics USING btree (deleted_at);

CREATE INDEX idx_lab_qc_period ON public.lab_qc_metrics USING btree (tenant_id, period, analyte);

ALTER TABLE ONLY public.lab_qc_metrics FORCE ROW LEVEL SECURITY;

ALTER TABLE public.lab_qc_metrics ENABLE ROW LEVEL SECURITY;

-- Name: lab_qc_metrics tenant_isolation_lab_qc_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_qc_metrics ON public.lab_qc_metrics USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_qc_metrics trg_lab_qc_metrics_soft_delete_bf070cdb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_qc_metrics_soft_delete_bf070cdb BEFORE DELETE ON public.lab_qc_metrics FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_qc_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    test_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    level character varying(20) NOT NULL,
    target_mean numeric(12,4),
    target_sd numeric(12,4),
    observed_value numeric(12,4),
    sd_index numeric(6,2),
    status public.lab_qc_status DEFAULT 'accepted'::public.lab_qc_status NOT NULL,
    westgard_violations public.lab_westgard_rule[],
    run_date date,
    run_time timestamp with time zone DEFAULT now() NOT NULL,
    performed_by uuid,
    reviewer_notes text,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_qc_results lab_qc_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_qc_results_deleted_at_b2b0bcfb ON public.lab_qc_results USING btree (deleted_at);

CREATE INDEX idx_lab_qc_results_test_id ON public.lab_qc_results USING btree (test_id);

CREATE INDEX idx_lab_qc_results_test_lot_date ON public.lab_qc_results USING btree (tenant_id, test_id, lot_id, run_date);

ALTER TABLE public.lab_qc_results ENABLE ROW LEVEL SECURITY;

-- Name: lab_qc_results tenant_isolation_lab_qc_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_qc_results ON public.lab_qc_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_qc_results trg_lab_qc_results_soft_delete_b2b0bcfb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_qc_results_soft_delete_b2b0bcfb BEFORE DELETE ON public.lab_qc_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_reagent_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reagent_name text NOT NULL,
    lot_number character varying(100) NOT NULL,
    manufacturer character varying(200),
    test_id uuid,
    received_date date,
    expiry_date date,
    quantity numeric(10,2),
    quantity_unit character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reorder_level numeric(10,2),
    consumption_per_test numeric(10,4),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_reagent_lots lab_reagent_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_pkey PRIMARY KEY (id);

-- Name: lab_reagent_lots lab_reagent_lots_tenant_id_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_tenant_id_lot_number_key UNIQUE (tenant_id, lot_number);

CREATE INDEX idx_lab_reagent_lots_deleted_at_ef9e84ad ON public.lab_reagent_lots USING btree (deleted_at);

CREATE INDEX idx_lab_reagent_lots_expiry ON public.lab_reagent_lots USING btree (tenant_id, expiry_date);

CREATE INDEX idx_lab_reagent_lots_test_id ON public.lab_reagent_lots USING btree (test_id);

ALTER TABLE public.lab_reagent_lots ENABLE ROW LEVEL SECURITY;

-- Name: lab_reagent_lots tenant_isolation_lab_reagent_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_reagent_lots ON public.lab_reagent_lots USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_reagent_lots set_lab_reagent_lots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_reagent_lots_updated_at BEFORE UPDATE ON public.lab_reagent_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: lab_reagent_lots trg_lab_reagent_lots_soft_delete_ef9e84ad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_reagent_lots_soft_delete_ef9e84ad BEFORE DELETE ON public.lab_reagent_lots FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_referral_doctors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    phone character varying(20),
    email character varying(200),
    specialization text,
    hospital_name text,
    registration_no text,
    commission_pct numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_referral_doctors lab_referral_doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_doctors
    ADD CONSTRAINT lab_referral_doctors_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_referral_doctors_deleted_at_ba05db72 ON public.lab_referral_doctors USING btree (deleted_at);

CREATE INDEX idx_lab_referral_doctors_phone ON public.lab_referral_doctors USING btree (phone);

CREATE INDEX idx_lab_referral_doctors_tenant ON public.lab_referral_doctors USING btree (tenant_id);

ALTER TABLE public.lab_referral_doctors ENABLE ROW LEVEL SECURITY;

-- Name: lab_referral_doctors lab_referral_doctors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_referral_doctors_tenant ON public.lab_referral_doctors USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_referral_doctors trg_lab_referral_doctors_soft_delete_ba05db72; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_doctors_soft_delete_ba05db72 BEFORE DELETE ON public.lab_referral_doctors FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_referral_doctors trg_lab_referral_doctors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_doctors_updated_at BEFORE UPDATE ON public.lab_referral_doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_referral_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    referral_doctor_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    order_count integer DEFAULT 0 NOT NULL,
    total_revenue numeric(12,2) DEFAULT 0 NOT NULL,
    commission_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.lab_payout_status DEFAULT 'pending'::public.lab_payout_status NOT NULL,
    paid_at timestamp with time zone,
    paid_by uuid,
    payment_reference text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_referral_payouts lab_referral_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_referral_payouts_deleted_at_8bbbe83a ON public.lab_referral_payouts USING btree (deleted_at);

CREATE INDEX idx_lab_referral_payouts_doctor ON public.lab_referral_payouts USING btree (referral_doctor_id);

CREATE INDEX idx_lab_referral_payouts_period ON public.lab_referral_payouts USING btree (period_start, period_end);

CREATE INDEX idx_lab_referral_payouts_tenant_id ON public.lab_referral_payouts USING btree (tenant_id);

ALTER TABLE public.lab_referral_payouts ENABLE ROW LEVEL SECURITY;

-- Name: lab_referral_payouts lab_referral_payouts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_referral_payouts_tenant ON public.lab_referral_payouts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_referral_payouts trg_lab_referral_payouts_soft_delete_8bbbe83a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_payouts_soft_delete_8bbbe83a BEFORE DELETE ON public.lab_referral_payouts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_referral_payouts trg_lab_referral_payouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_payouts_updated_at BEFORE UPDATE ON public.lab_referral_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_report_dispatches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    dispatch_method public.lab_dispatch_method NOT NULL,
    dispatched_to text,
    dispatched_by uuid NOT NULL,
    dispatched_at timestamp with time zone DEFAULT now() NOT NULL,
    received_confirmation boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    qr_verification_url text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_report_dispatches lab_report_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_report_dispatches_deleted_at_ae4a3c0a ON public.lab_report_dispatches USING btree (deleted_at);

CREATE INDEX idx_lab_report_dispatches_order ON public.lab_report_dispatches USING btree (tenant_id, order_id);

CREATE INDEX idx_lab_report_dispatches_order_id ON public.lab_report_dispatches USING btree (order_id);

CREATE INDEX idx_lab_report_dispatches_patient_id ON public.lab_report_dispatches USING btree (patient_id);

ALTER TABLE public.lab_report_dispatches ENABLE ROW LEVEL SECURITY;

-- Name: lab_report_dispatches lab_report_dispatches_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_report_dispatches_tenant ON public.lab_report_dispatches USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_report_dispatches trg_lab_report_dispatches_soft_delete_ae4a3c0a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_report_dispatches_soft_delete_ae4a3c0a BEFORE DELETE ON public.lab_report_dispatches FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    template_name character varying(200) NOT NULL,
    header_html text,
    footer_html text,
    logo_url text,
    report_format jsonb,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_report_templates lab_report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_pkey PRIMARY KEY (id);

-- Name: lab_report_templates lab_report_templates_tenant_id_department_id_template_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_tenant_id_department_id_template_name_key UNIQUE (tenant_id, department_id, template_name);

CREATE INDEX idx_lab_report_templates_deleted_at_3cbb6448 ON public.lab_report_templates USING btree (deleted_at);

CREATE INDEX idx_lab_report_templates_department_id ON public.lab_report_templates USING btree (department_id);

ALTER TABLE public.lab_report_templates ENABLE ROW LEVEL SECURITY;

-- Name: lab_report_templates lab_report_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_report_templates_tenant ON public.lab_report_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_report_templates trg_lab_report_templates_soft_delete_3cbb6448; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_report_templates_soft_delete_3cbb6448 BEFORE DELETE ON public.lab_report_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_report_templates trg_lab_report_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_report_templates_updated BEFORE UPDATE ON public.lab_report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_result_amendments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    result_id uuid NOT NULL,
    order_id uuid NOT NULL,
    original_value text,
    amended_value text,
    original_flag public.lab_result_flag,
    amended_flag public.lab_result_flag,
    reason text NOT NULL,
    amended_by uuid NOT NULL,
    amended_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_result_amendments lab_result_amendments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_result_amendments_deleted_at_a8732709 ON public.lab_result_amendments USING btree (deleted_at);

CREATE INDEX idx_lab_result_amendments_order_id ON public.lab_result_amendments USING btree (order_id);

CREATE INDEX idx_lab_result_amendments_tenant_id ON public.lab_result_amendments USING btree (tenant_id);

ALTER TABLE public.lab_result_amendments ENABLE ROW LEVEL SECURITY;

-- Name: lab_result_amendments tenant_isolation_lab_result_amendments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_result_amendments ON public.lab_result_amendments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_result_amendments trg_lab_result_amendments_soft_delete_a8732709; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_result_amendments_soft_delete_a8732709 BEFORE DELETE ON public.lab_result_amendments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    parameter_name text NOT NULL,
    value text NOT NULL,
    unit text,
    normal_range text,
    flag public.lab_result_flag,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_value text,
    delta_percent numeric(8,2),
    is_delta_flagged boolean DEFAULT false NOT NULL,
    is_auto_validated boolean DEFAULT false NOT NULL,
    entered_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    signed_record_id uuid,
    numeric_value numeric(14,4),
    reference_range text,
    result_value text,
    is_abnormal boolean DEFAULT false NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    critical_flag text,
    method text,
    display_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_results_deleted_at_8cf192ef ON public.lab_results USING btree (deleted_at);

CREATE INDEX idx_lab_results_order ON public.lab_results USING btree (order_id);

CREATE INDEX idx_lab_results_tenant_id ON public.lab_results USING btree (tenant_id);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- Name: lab_results tenant_isolation_lab_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_results ON public.lab_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_results audit_lab_results; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_lab_results AFTER INSERT OR DELETE OR UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('lab');

-- Name: lab_results set_lab_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_results_updated_at BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: lab_results trg_lab_results_soft_delete_8cf192ef; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_results_soft_delete_8cf192ef BEFORE DELETE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_sample_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    sample_barcode character varying(100),
    storage_location character varying(200),
    stored_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_by uuid NOT NULL,
    status public.lab_sample_archive_status DEFAULT 'stored'::public.lab_sample_archive_status NOT NULL,
    retrieved_at timestamp with time zone,
    retrieved_by uuid,
    disposal_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_sample_archive lab_sample_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_sample_archive_barcode ON public.lab_sample_archive USING btree (tenant_id, sample_barcode);

CREATE INDEX idx_lab_sample_archive_deleted_at_2364c8b8 ON public.lab_sample_archive USING btree (deleted_at);

CREATE INDEX idx_lab_sample_archive_order_id ON public.lab_sample_archive USING btree (order_id);

CREATE INDEX idx_lab_sample_archive_patient_id ON public.lab_sample_archive USING btree (patient_id);

CREATE INDEX idx_lab_sample_archive_tenant_status ON public.lab_sample_archive USING btree (tenant_id, status);

ALTER TABLE public.lab_sample_archive ENABLE ROW LEVEL SECURITY;

-- Name: lab_sample_archive lab_sample_archive_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_sample_archive_tenant ON public.lab_sample_archive USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_sample_archive trg_lab_sample_archive_soft_delete_2364c8b8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_sample_archive_soft_delete_2364c8b8 BEFORE DELETE ON public.lab_sample_archive FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_sample_rejections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    rejected_by uuid NOT NULL,
    rejection_reason character varying(500) NOT NULL,
    rejected_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_sample_rejections lab_sample_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_sample_rejections_deleted_at_f31e615d ON public.lab_sample_rejections USING btree (deleted_at);

CREATE INDEX idx_lab_sample_rejections_order ON public.lab_sample_rejections USING btree (order_id);

CREATE INDEX idx_lab_sample_rejections_tenant ON public.lab_sample_rejections USING btree (tenant_id);

ALTER TABLE public.lab_sample_rejections ENABLE ROW LEVEL SECURITY;

-- Name: lab_sample_rejections lab_sample_rejections_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_sample_rejections_tenant_isolation ON public.lab_sample_rejections USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_sample_rejections trg_lab_sample_rejections_soft_delete_f31e615d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_sample_rejections_soft_delete_f31e615d BEFORE DELETE ON public.lab_sample_rejections FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_sample_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_tenant_id uuid NOT NULL,
    dest_tenant_id uuid NOT NULL,
    lab_order_id uuid NOT NULL,
    sample_id uuid,
    test_code text NOT NULL,
    test_name text NOT NULL,
    status text DEFAULT 'pending_collection'::text NOT NULL,
    collected_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    received_at timestamp with time zone,
    resulted_at timestamp with time zone,
    courier_name text,
    tracking_number text,
    temperature_log jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_sample_routes lab_sample_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_routes
    ADD CONSTRAINT lab_sample_routes_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_sample_routes_deleted_at_49089045 ON public.lab_sample_routes USING btree (deleted_at);

CREATE INDEX idx_lab_sample_routes_dest ON public.lab_sample_routes USING btree (dest_tenant_id);

CREATE INDEX idx_lab_sample_routes_source ON public.lab_sample_routes USING btree (source_tenant_id);

CREATE INDEX idx_lab_sample_routes_status ON public.lab_sample_routes USING btree (status);

-- Name: lab_sample_routes trg_lab_sample_routes_soft_delete_49089045; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_sample_routes_soft_delete_49089045 BEFORE DELETE ON public.lab_sample_routes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_test_catalog (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    department_id uuid,
    sample_type text,
    normal_range text,
    unit text,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    tat_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    loinc_code character varying(20),
    method character varying(200),
    specimen_volume character varying(50),
    critical_low numeric(12,4),
    critical_high numeric(12,4),
    delta_check_percent numeric(5,2),
    auto_validation_rules jsonb,
    allows_add_on boolean DEFAULT false NOT NULL,
    fallback_analyzer text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_test_catalog lab_test_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_pkey PRIMARY KEY (id);

-- Name: lab_test_catalog lab_test_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lab_test_catalog_deleted_at_86d07372 ON public.lab_test_catalog USING btree (deleted_at);

CREATE INDEX idx_lab_test_catalog_department_id ON public.lab_test_catalog USING btree (department_id);

CREATE INDEX idx_lab_test_catalog_loinc ON public.lab_test_catalog USING btree (loinc_code) WHERE (loinc_code IS NOT NULL);

CREATE INDEX idx_lab_test_catalog_tenant ON public.lab_test_catalog USING btree (tenant_id);

ALTER TABLE public.lab_test_catalog ENABLE ROW LEVEL SECURITY;

-- Name: lab_test_catalog dept_scope_lab_test_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_lab_test_catalog ON public.lab_test_catalog USING (public.check_department_access(department_id));

-- Name: lab_test_catalog tenant_isolation_lab_test_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_test_catalog ON public.lab_test_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_test_catalog trg_lab_test_catalog_soft_delete_86d07372; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_test_catalog_soft_delete_86d07372 BEFORE DELETE ON public.lab_test_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lab_test_catalog trg_lab_test_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_test_catalog_updated_at BEFORE UPDATE ON public.lab_test_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lab_test_panels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_test_panels lab_test_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_panels
    ADD CONSTRAINT lab_test_panels_pkey PRIMARY KEY (id);

-- Name: lab_test_panels lab_test_panels_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_panels
    ADD CONSTRAINT lab_test_panels_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lab_test_panels_deleted_at_5cbab9b9 ON public.lab_test_panels USING btree (deleted_at);

CREATE INDEX idx_lab_test_panels_tenant ON public.lab_test_panels USING btree (tenant_id);

ALTER TABLE public.lab_test_panels ENABLE ROW LEVEL SECURITY;

-- Name: lab_test_panels lab_test_panels_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_test_panels_tenant_isolation ON public.lab_test_panels USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lab_test_panels set_updated_at_lab_test_panels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_lab_test_panels BEFORE UPDATE ON public.lab_test_panels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: lab_test_panels trg_lab_test_panels_soft_delete_5cbab9b9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_test_panels_soft_delete_5cbab9b9 BEFORE DELETE ON public.lab_test_panels FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: lab_b2b_rates lab_b2b_rates_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.lab_b2b_clients(id);

-- Name: lab_b2b_rates lab_b2b_rates_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_calibrations lab_calibrations_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_critical_alerts lab_critical_alerts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_critical_alerts lab_critical_alerts_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.lab_results(id);

-- Name: lab_cytology_reports lab_cytology_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_eqas_results lab_eqas_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_eqas_results
    ADD CONSTRAINT lab_eqas_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_histopath_reports lab_histopath_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_home_collections lab_home_collections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_molecular_reports lab_molecular_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_orders lab_orders_collection_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_collection_center_id_fkey FOREIGN KEY (collection_center_id) REFERENCES public.lab_collection_centers(id);

-- Name: lab_orders lab_orders_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.lab_orders(id);

-- Name: lab_orders lab_orders_referral_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES public.lab_referral_doctors(id);

-- Name: lab_orders lab_orders_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_outsourced_orders lab_outsourced_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_panel_tests lab_panel_tests_panel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.lab_test_panels(id) ON DELETE CASCADE;

-- Name: lab_panel_tests lab_panel_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id) ON DELETE CASCADE;

-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_proficiency_tests lab_proficiency_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_proficiency_tests
    ADD CONSTRAINT lab_proficiency_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_qc_results lab_qc_results_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lab_reagent_lots(id);

-- Name: lab_qc_results lab_qc_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_reagent_lots lab_reagent_lots_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);

-- Name: lab_referral_payouts lab_referral_payouts_referral_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES public.lab_referral_doctors(id);

-- Name: lab_report_dispatches lab_report_dispatches_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_result_amendments lab_result_amendments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_result_amendments lab_result_amendments_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.lab_results(id);

-- Name: lab_results lab_results_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_sample_archive lab_sample_archive_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);

-- Name: lab_sample_rejections lab_sample_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);
