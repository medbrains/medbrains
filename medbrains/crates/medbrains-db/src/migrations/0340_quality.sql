-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 39
-- Drops: none
-- quality — schema.
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



CREATE TABLE public.antibiotic_consumption_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    antibiotic_name text NOT NULL,
    atc_code text,
    record_month date NOT NULL,
    quantity_used numeric NOT NULL,
    ddd numeric,
    patient_days integer DEFAULT 0 NOT NULL,
    ddd_per_1000_patient_days numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: antibiotic_consumption_records antibiotic_consumption_record_tenant_id_department_id_antib_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_record_tenant_id_department_id_antib_key UNIQUE (tenant_id, department_id, antibiotic_name, record_month);

-- Name: antibiotic_consumption_records antibiotic_consumption_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_abx_consumption_dept ON public.antibiotic_consumption_records USING btree (tenant_id, department_id);

CREATE INDEX idx_abx_consumption_tenant ON public.antibiotic_consumption_records USING btree (tenant_id);

CREATE INDEX idx_antibiotic_consumption_records_deleted_at_454f7747 ON public.antibiotic_consumption_records USING btree (deleted_at);

CREATE INDEX idx_antibiotic_consumption_records_department_id ON public.antibiotic_consumption_records USING btree (department_id);

ALTER TABLE public.antibiotic_consumption_records ENABLE ROW LEVEL SECURITY;

-- Name: antibiotic_consumption_records antibiotic_consumption_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY antibiotic_consumption_records_tenant ON public.antibiotic_consumption_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: antibiotic_consumption_records set_antibiotic_consumption_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_antibiotic_consumption_records_updated_at BEFORE UPDATE ON public.antibiotic_consumption_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: antibiotic_consumption_records trg_antibiotic_consumption_records_soft_delete_454f7747; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_antibiotic_consumption_records_soft_delete_454f7747 BEFORE DELETE ON public.antibiotic_consumption_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.antibiotic_stewardship_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    antibiotic_name text NOT NULL,
    dose text,
    route text,
    frequency text,
    duration_days integer,
    indication text NOT NULL,
    culture_sent boolean DEFAULT false NOT NULL,
    culture_result text,
    request_status public.antibiotic_request_status DEFAULT 'pending'::public.antibiotic_request_status NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    escalation_reason text,
    auto_stop_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    timeout_decision text,
    timeout_decision_at timestamp with time zone,
    timeout_reviewed_by uuid,
    timeout_notes text,
    CONSTRAINT antibiotic_timeout_decision_check CHECK (((timeout_decision IS NULL) OR (timeout_decision = ANY (ARRAY['continue'::text, 'de_escalate'::text, 'stop'::text, 'switch_oral'::text, 'change'::text]))))
);

-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_abx_steward_patient ON public.antibiotic_stewardship_requests USING btree (tenant_id, patient_id);

CREATE INDEX idx_abx_steward_status ON public.antibiotic_stewardship_requests USING btree (tenant_id, request_status);

CREATE INDEX idx_abx_steward_tenant ON public.antibiotic_stewardship_requests USING btree (tenant_id);

CREATE INDEX idx_antibiotic_stewardship_requests_deleted_at_7ba3f385 ON public.antibiotic_stewardship_requests USING btree (deleted_at);

CREATE INDEX idx_antibiotic_stewardship_requests_patient_id ON public.antibiotic_stewardship_requests USING btree (patient_id);

ALTER TABLE public.antibiotic_stewardship_requests ENABLE ROW LEVEL SECURITY;

-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY antibiotic_stewardship_requests_tenant ON public.antibiotic_stewardship_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: antibiotic_stewardship_requests set_antibiotic_stewardship_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_antibiotic_stewardship_requests_updated_at BEFORE UPDATE ON public.antibiotic_stewardship_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: antibiotic_stewardship_requests trg_antibiotic_stewardship_requests_soft_delete_7ba3f385; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_antibiotic_stewardship_requests_soft_delete_7ba3f385 BEFORE DELETE ON public.antibiotic_stewardship_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.culture_surveillance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    culture_type text NOT NULL,
    sample_site text NOT NULL,
    location_id uuid,
    department_id uuid,
    collection_date timestamp with time zone NOT NULL,
    result text,
    organism text,
    colony_count integer,
    acceptable boolean,
    action_taken text,
    collected_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: culture_surveillance culture_surveillance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_pkey PRIMARY KEY (id);

CREATE INDEX idx_culture_surv_dept ON public.culture_surveillance USING btree (tenant_id, department_id);

CREATE INDEX idx_culture_surv_tenant ON public.culture_surveillance USING btree (tenant_id);

CREATE INDEX idx_culture_surveillance_deleted_at_29121354 ON public.culture_surveillance USING btree (deleted_at);

CREATE INDEX idx_culture_surveillance_department_id ON public.culture_surveillance USING btree (department_id);

CREATE INDEX idx_culture_surveillance_location_id ON public.culture_surveillance USING btree (location_id);

ALTER TABLE public.culture_surveillance ENABLE ROW LEVEL SECURITY;

-- Name: culture_surveillance culture_surveillance_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY culture_surveillance_tenant ON public.culture_surveillance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: culture_surveillance set_culture_surveillance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_culture_surveillance_updated_at BEFORE UPDATE ON public.culture_surveillance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: culture_surveillance trg_culture_surveillance_soft_delete_29121354; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_culture_surveillance_soft_delete_29121354 BEFORE DELETE ON public.culture_surveillance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.data_quality_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rule_id uuid,
    category text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    field_name text,
    issue_description text NOT NULL,
    severity text,
    current_value text,
    suggested_value text,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: data_quality_issues data_quality_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_pkey PRIMARY KEY (id);

CREATE INDEX idx_data_quality_issues_deleted_at_d5cf45fb ON public.data_quality_issues USING btree (deleted_at);

CREATE INDEX idx_dq_issues_unresolved ON public.data_quality_issues USING btree (tenant_id, is_resolved, severity);

ALTER TABLE ONLY public.data_quality_issues FORCE ROW LEVEL SECURITY;

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;

-- Name: data_quality_issues tenant_isolation_data_quality_issues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_issues ON public.data_quality_issues USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: data_quality_issues trg_data_quality_issues_soft_delete_d5cf45fb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_data_quality_issues_soft_delete_d5cf45fb BEFORE DELETE ON public.data_quality_issues FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.data_quality_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    entity_type text NOT NULL,
    field_name text,
    rule_name text NOT NULL,
    rule_expression text NOT NULL,
    severity text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: data_quality_rules data_quality_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_rules
    ADD CONSTRAINT data_quality_rules_pkey PRIMARY KEY (id);

CREATE INDEX idx_data_quality_rules_deleted_at_b6ad923c ON public.data_quality_rules USING btree (deleted_at);

CREATE INDEX idx_data_quality_rules_tenant_id ON public.data_quality_rules USING btree (tenant_id);

ALTER TABLE ONLY public.data_quality_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.data_quality_rules ENABLE ROW LEVEL SECURITY;

-- Name: data_quality_rules tenant_isolation_data_quality_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_rules ON public.data_quality_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: data_quality_rules trg_data_quality_rules_soft_delete_b6ad923c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_data_quality_rules_soft_delete_b6ad923c BEFORE DELETE ON public.data_quality_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.data_quality_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    score_date date NOT NULL,
    completeness_score numeric(5,2),
    accuracy_score numeric(5,2),
    timeliness_score numeric(5,2),
    consistency_score numeric(5,2),
    overall_score numeric(5,2),
    total_records integer,
    issues_found integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: data_quality_scores data_quality_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_scores
    ADD CONSTRAINT data_quality_scores_pkey PRIMARY KEY (id);

-- Name: data_quality_scores data_quality_scores_tenant_id_entity_type_score_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_scores
    ADD CONSTRAINT data_quality_scores_tenant_id_entity_type_score_date_key UNIQUE (tenant_id, entity_type, score_date);

CREATE INDEX idx_data_quality_scores_deleted_at_2fd2eae3 ON public.data_quality_scores USING btree (deleted_at);

ALTER TABLE ONLY public.data_quality_scores FORCE ROW LEVEL SECURITY;

ALTER TABLE public.data_quality_scores ENABLE ROW LEVEL SECURITY;

-- Name: data_quality_scores tenant_isolation_data_quality_scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_scores ON public.data_quality_scores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: data_quality_scores trg_data_quality_scores_soft_delete_2fd2eae3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_data_quality_scores_soft_delete_2fd2eae3 BEFORE DELETE ON public.data_quality_scores FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.hand_hygiene_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    audit_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid NOT NULL,
    auditor_id uuid NOT NULL,
    observations integer DEFAULT 0 NOT NULL,
    compliant integer DEFAULT 0 NOT NULL,
    non_compliant integer DEFAULT 0 NOT NULL,
    compliance_rate numeric(5,2),
    moment_breakdown jsonb,
    staff_category text,
    findings text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: hand_hygiene_audits hand_hygiene_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_pkey PRIMARY KEY (id);

CREATE INDEX idx_hand_hygiene_audits_deleted_at_c35f72e7 ON public.hand_hygiene_audits USING btree (deleted_at);

CREATE INDEX idx_hand_hygiene_audits_department_id ON public.hand_hygiene_audits USING btree (department_id);

CREATE INDEX idx_hand_hygiene_audits_location_id ON public.hand_hygiene_audits USING btree (location_id);

CREATE INDEX idx_hand_hygiene_dept ON public.hand_hygiene_audits USING btree (tenant_id, department_id);

CREATE INDEX idx_hand_hygiene_tenant ON public.hand_hygiene_audits USING btree (tenant_id);

ALTER TABLE public.hand_hygiene_audits ENABLE ROW LEVEL SECURITY;

-- Name: hand_hygiene_audits hand_hygiene_audits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hand_hygiene_audits_tenant ON public.hand_hygiene_audits USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: hand_hygiene_audits set_hand_hygiene_audits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_hand_hygiene_audits_updated_at BEFORE UPDATE ON public.hand_hygiene_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: hand_hygiene_audits trg_hand_hygiene_audits_soft_delete_c35f72e7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hand_hygiene_audits_soft_delete_c35f72e7 BEFORE DELETE ON public.hand_hygiene_audits FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.infection_device_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    department_id uuid,
    record_date date NOT NULL,
    patient_days integer DEFAULT 0 NOT NULL,
    central_line_days integer DEFAULT 0 NOT NULL,
    urinary_catheter_days integer DEFAULT 0 NOT NULL,
    ventilator_days integer DEFAULT 0 NOT NULL,
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: infection_device_days infection_device_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_pkey PRIMARY KEY (id);

-- Name: infection_device_days infection_device_days_tenant_id_location_id_record_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_tenant_id_location_id_record_date_key UNIQUE (tenant_id, location_id, record_date);

CREATE INDEX idx_infection_dd_date ON public.infection_device_days USING btree (tenant_id, record_date);

CREATE INDEX idx_infection_dd_dept ON public.infection_device_days USING btree (tenant_id, department_id);

CREATE INDEX idx_infection_dd_tenant ON public.infection_device_days USING btree (tenant_id);

CREATE INDEX idx_infection_device_days_deleted_at_5265a86b ON public.infection_device_days USING btree (deleted_at);

CREATE INDEX idx_infection_device_days_department_id ON public.infection_device_days USING btree (department_id);

CREATE INDEX idx_infection_device_days_location_id ON public.infection_device_days USING btree (location_id);

ALTER TABLE public.infection_device_days ENABLE ROW LEVEL SECURITY;

-- Name: infection_device_days infection_device_days_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY infection_device_days_tenant ON public.infection_device_days USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: infection_device_days set_infection_device_days_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_infection_device_days_updated_at BEFORE UPDATE ON public.infection_device_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: infection_device_days trg_infection_device_days_soft_delete_5265a86b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_infection_device_days_soft_delete_5265a86b BEFORE DELETE ON public.infection_device_days FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.infection_surveillance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    hai_type public.hai_type NOT NULL,
    infection_status public.infection_status DEFAULT 'suspected'::public.infection_status NOT NULL,
    organism text,
    susceptibility_pattern jsonb,
    device_type text,
    insertion_date timestamp with time zone,
    infection_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    nhsn_criteria text,
    contributing_factors jsonb,
    notes text,
    reported_by uuid NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: infection_surveillance_events infection_surveillance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_infection_surv_dept ON public.infection_surveillance_events USING btree (tenant_id, department_id);

CREATE INDEX idx_infection_surv_hai_type ON public.infection_surveillance_events USING btree (tenant_id, hai_type);

CREATE INDEX idx_infection_surv_patient ON public.infection_surveillance_events USING btree (tenant_id, patient_id);

CREATE INDEX idx_infection_surv_status ON public.infection_surveillance_events USING btree (tenant_id, infection_status);

CREATE INDEX idx_infection_surv_tenant ON public.infection_surveillance_events USING btree (tenant_id);

CREATE INDEX idx_infection_surveillance_events_deleted_at_12ce8a7e ON public.infection_surveillance_events USING btree (deleted_at);

CREATE INDEX idx_infection_surveillance_events_department_id ON public.infection_surveillance_events USING btree (department_id);

CREATE INDEX idx_infection_surveillance_events_location_id ON public.infection_surveillance_events USING btree (location_id);

CREATE INDEX idx_infection_surveillance_events_patient_id ON public.infection_surveillance_events USING btree (patient_id);

ALTER TABLE public.infection_surveillance_events ENABLE ROW LEVEL SECURITY;

-- Name: infection_surveillance_events infection_surveillance_events_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY infection_surveillance_events_tenant ON public.infection_surveillance_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: infection_surveillance_events set_infection_surveillance_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_infection_surveillance_events_updated_at BEFORE UPDATE ON public.infection_surveillance_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: infection_surveillance_events trg_infection_surveillance_events_soft_delete_12ce8a7e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_infection_surveillance_events_soft_delete_12ce8a7e BEFORE DELETE ON public.infection_surveillance_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── MOM-7 / IPSG-3: Blood transfusion reactions ────────────────

CREATE TABLE public.nabh_blood_transfusion_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    transfusion_id uuid,
    blood_unit_id uuid,
    component_type text,
    reaction_at timestamp with time zone NOT NULL,
    onset_minutes integer,
    reaction_type text NOT NULL,
    severity text NOT NULL,
    symptoms text[],
    vitals_at_reaction jsonb,
    transfusion_stopped_at timestamp with time zone,
    management text,
    outcome text,
    reported_to_blood_bank boolean DEFAULT false,
    reported_to_blood_bank_at timestamp with time zone,
    haemovigilance_ref text,
    cdsco_reported_at timestamp with time zone,
    sample_sent_for_workup boolean DEFAULT false,
    investigation_findings text,
    reported_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_blood_transfusion_reactions nabh_blood_transfusion_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_blood_transfusion_reactions
    ADD CONSTRAINT nabh_blood_transfusion_reactions_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_blood_transfusion_reactions_admission_id ON public.nabh_blood_transfusion_reactions USING btree (admission_id);

CREATE INDEX idx_nabh_blood_transfusion_reactions_deleted_at_34f5a0bf ON public.nabh_blood_transfusion_reactions USING btree (deleted_at);

CREATE INDEX idx_nabh_btr_patient ON public.nabh_blood_transfusion_reactions USING btree (patient_id, reaction_at DESC);

CREATE INDEX idx_nabh_btr_pending_report ON public.nabh_blood_transfusion_reactions USING btree (tenant_id) WHERE (reported_to_blood_bank = false);

CREATE UNIQUE INDEX idx_nabh_btr_source ON public.nabh_blood_transfusion_reactions USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

ALTER TABLE public.nabh_blood_transfusion_reactions ENABLE ROW LEVEL SECURITY;

-- Name: nabh_blood_transfusion_reactions nabh_btr_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_btr_tenant ON public.nabh_blood_transfusion_reactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_blood_transfusion_reactions trg_nabh_blood_transfusion_reactions_soft_delete_34f5a0bf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_blood_transfusion_reactions_soft_delete_34f5a0bf BEFORE DELETE ON public.nabh_blood_transfusion_reactions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_blood_transfusion_reactions trg_nabh_btr_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_btr_updated_at BEFORE UPDATE ON public.nabh_blood_transfusion_reactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── FMS-4 / BMW Rules 2016: Biomedical waste disposal log ──────

CREATE TABLE public.nabh_bmw_disposal_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    disposal_date date NOT NULL,
    waste_category text NOT NULL,
    waste_subtype text,
    quantity_kg numeric(10,3) NOT NULL,
    source_department text,
    bag_count integer,
    barcode_refs text[],
    stored_at timestamp with time zone NOT NULL,
    handed_over_at timestamp with time zone NOT NULL,
    storage_hours integer GENERATED ALWAYS AS (((EXTRACT(epoch FROM (handed_over_at - stored_at)))::integer / 3600)) STORED,
    disposal_agency text NOT NULL,
    disposal_agency_licence text,
    disposal_method text NOT NULL,
    disposal_certificate_url text,
    cpcb_quarterly_ref text,
    handed_over_by uuid NOT NULL,
    received_by_agency text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_bmw_disposal_log nabh_bmw_disposal_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_bmw_disposal_log
    ADD CONSTRAINT nabh_bmw_disposal_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_bmw_category ON public.nabh_bmw_disposal_log USING btree (tenant_id, waste_category, disposal_date);

CREATE INDEX idx_nabh_bmw_disposal_log_deleted_at_c9084765 ON public.nabh_bmw_disposal_log USING btree (deleted_at);

CREATE INDEX idx_nabh_bmw_period ON public.nabh_bmw_disposal_log USING btree (tenant_id, disposal_date DESC);

CREATE UNIQUE INDEX idx_nabh_bmw_source ON public.nabh_bmw_disposal_log USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

ALTER TABLE public.nabh_bmw_disposal_log ENABLE ROW LEVEL SECURITY;

-- Name: nabh_bmw_disposal_log nabh_bmw_disposal_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_bmw_disposal_tenant ON public.nabh_bmw_disposal_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_bmw_disposal_log trg_nabh_bmw_disposal_log_soft_delete_c9084765; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_bmw_disposal_log_soft_delete_c9084765 BEFORE DELETE ON public.nabh_bmw_disposal_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_bmw_disposal_log trg_nabh_bmw_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_bmw_updated_at BEFORE UPDATE ON public.nabh_bmw_disposal_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── AOP-9: Code Blue / rapid response activations ─────────────

CREATE TABLE public.nabh_code_blue_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    activated_at timestamp with time zone NOT NULL,
    activated_by uuid NOT NULL,
    location text NOT NULL,
    location_detail text,
    patient_id uuid,
    admission_id uuid,
    team_arrived_at timestamp with time zone,
    response_seconds integer GENERATED ALWAYS AS ((EXTRACT(epoch FROM (team_arrived_at - activated_at)))::integer) STORED,
    reason text NOT NULL,
    initial_rhythm text,
    cpr_started_at timestamp with time zone,
    cpr_duration_minutes integer,
    defibrillation_count integer DEFAULT 0,
    drugs_administered jsonb,
    rosc_achieved boolean,
    rosc_at timestamp with time zone,
    outcome text,
    transferred_to text,
    debrief_completed boolean DEFAULT false,
    debrief_at timestamp with time zone,
    learning_points text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_code_blue_activations nabh_code_blue_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_code_blue_activations
    ADD CONSTRAINT nabh_code_blue_activations_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_code_blue_activations_admission_id ON public.nabh_code_blue_activations USING btree (admission_id);

CREATE INDEX idx_nabh_code_blue_activations_deleted_at_8f9c0b19 ON public.nabh_code_blue_activations USING btree (deleted_at);

CREATE INDEX idx_nabh_code_blue_activations_patient_id ON public.nabh_code_blue_activations USING btree (patient_id);

CREATE INDEX idx_nabh_code_blue_pending_debrief ON public.nabh_code_blue_activations USING btree (tenant_id) WHERE (debrief_completed = false);

CREATE INDEX idx_nabh_code_blue_period ON public.nabh_code_blue_activations USING btree (tenant_id, activated_at DESC);

CREATE UNIQUE INDEX idx_nabh_code_blue_source ON public.nabh_code_blue_activations USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

ALTER TABLE public.nabh_code_blue_activations ENABLE ROW LEVEL SECURITY;

-- Name: nabh_code_blue_activations nabh_code_blue_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_code_blue_tenant ON public.nabh_code_blue_activations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_code_blue_activations trg_nabh_code_blue_activations_soft_delete_8f9c0b19; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_code_blue_activations_soft_delete_8f9c0b19 BEFORE DELETE ON public.nabh_code_blue_activations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_code_blue_activations trg_nabh_code_blue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_code_blue_updated_at BEFORE UPDATE ON public.nabh_code_blue_activations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── HIC-7 / FMS: Equipment downtime log (BME) ──────────────────

CREATE TABLE public.nabh_equipment_downtime_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid,
    equipment_name text NOT NULL,
    equipment_serial text,
    equipment_category text,
    location text,
    downtime_start timestamp with time zone NOT NULL,
    downtime_end timestamp with time zone,
    downtime_minutes integer GENERATED ALWAYS AS (((EXTRACT(epoch FROM (downtime_end - downtime_start)))::integer / 60)) STORED,
    reason text NOT NULL,
    impact_level text NOT NULL,
    impact_summary text,
    reported_to_bme boolean DEFAULT false,
    reported_to_bme_at timestamp with time zone,
    workorder_ref text,
    vendor_engaged boolean DEFAULT false,
    vendor_arrived_at timestamp with time zone,
    resolved_by uuid,
    resolution_summary text,
    parts_replaced text,
    cost numeric(12,2),
    qa_passed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_equipment_downtime_log nabh_equipment_downtime_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_equipment_downtime_log
    ADD CONSTRAINT nabh_equipment_downtime_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_eq_downtime_open ON public.nabh_equipment_downtime_log USING btree (tenant_id, equipment_name) WHERE (downtime_end IS NULL);

CREATE INDEX idx_nabh_eq_downtime_period ON public.nabh_equipment_downtime_log USING btree (tenant_id, downtime_start DESC);

CREATE UNIQUE INDEX idx_nabh_eq_downtime_source ON public.nabh_equipment_downtime_log USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

CREATE INDEX idx_nabh_equipment_downtime_log_deleted_at_c41cf395 ON public.nabh_equipment_downtime_log USING btree (deleted_at);

ALTER TABLE public.nabh_equipment_downtime_log ENABLE ROW LEVEL SECURITY;

-- Name: nabh_equipment_downtime_log nabh_eq_downtime_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_eq_downtime_tenant ON public.nabh_equipment_downtime_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_equipment_downtime_log trg_nabh_eq_downtime_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_eq_downtime_updated_at BEFORE UPDATE ON public.nabh_equipment_downtime_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: nabh_equipment_downtime_log trg_nabh_equipment_downtime_log_soft_delete_c41cf395; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_equipment_downtime_log_soft_delete_c41cf395 BEFORE DELETE ON public.nabh_equipment_downtime_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── COP-12 / IPSG-6: Patient falls register ────────────────────

CREATE TABLE public.nabh_falls_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    fall_at timestamp with time zone NOT NULL,
    location text NOT NULL,
    location_detail text,
    fall_type text NOT NULL,
    contributing_factors text[],
    risk_assessment_done boolean DEFAULT false,
    risk_assessment_id uuid,
    morse_score integer,
    injury_level text NOT NULL,
    injury_description text,
    immediate_action text,
    notified_physician boolean DEFAULT false,
    notified_physician_at timestamp with time zone,
    notified_family boolean DEFAULT false,
    notified_family_at timestamp with time zone,
    incident_id uuid,
    rca_required boolean DEFAULT false,
    rca_id uuid,
    reported_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_falls_register nabh_falls_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_falls_register
    ADD CONSTRAINT nabh_falls_register_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_falls_open_rca ON public.nabh_falls_register USING btree (tenant_id) WHERE ((rca_required = true) AND (rca_id IS NULL));

CREATE INDEX idx_nabh_falls_patient ON public.nabh_falls_register USING btree (patient_id, fall_at DESC);

CREATE INDEX idx_nabh_falls_register_admission_id ON public.nabh_falls_register USING btree (admission_id);

CREATE INDEX idx_nabh_falls_register_deleted_at_120b44e5 ON public.nabh_falls_register USING btree (deleted_at);

CREATE UNIQUE INDEX idx_nabh_falls_source ON public.nabh_falls_register USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

CREATE INDEX idx_nabh_falls_tenant_period ON public.nabh_falls_register USING btree (tenant_id, fall_at);

ALTER TABLE public.nabh_falls_register ENABLE ROW LEVEL SECURITY;

-- Name: nabh_falls_register nabh_falls_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_falls_register_tenant ON public.nabh_falls_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_falls_register trg_nabh_falls_register_soft_delete_120b44e5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_falls_register_soft_delete_120b44e5 BEFORE DELETE ON public.nabh_falls_register FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_falls_register trg_nabh_falls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_falls_updated_at BEFORE UPDATE ON public.nabh_falls_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── FMS-2: Fire safety drills ──────────────────────────────────

CREATE TABLE public.nabh_fire_safety_drills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    drill_at timestamp with time zone NOT NULL,
    drill_type text NOT NULL,
    location text NOT NULL,
    scenario text,
    participants_count integer,
    participating_departments text[],
    incident_commander uuid,
    alarm_at timestamp with time zone,
    evacuation_started_at timestamp with time zone,
    evacuation_completed_at timestamp with time zone,
    evacuation_seconds integer GENERATED ALWAYS AS ((EXTRACT(epoch FROM (evacuation_completed_at - evacuation_started_at)))::integer) STORED,
    fire_brigade_arrived_at timestamp with time zone,
    issues_observed text[],
    corrective_actions text,
    corrective_action_owner uuid,
    corrective_action_due date,
    corrective_actions_done boolean DEFAULT false,
    photo_urls text[],
    report_url text,
    conducted_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_fire_safety_drills nabh_fire_safety_drills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_fire_safety_drills
    ADD CONSTRAINT nabh_fire_safety_drills_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_nabh_fire_drill_source ON public.nabh_fire_safety_drills USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

CREATE INDEX idx_nabh_fire_drills_open_capa ON public.nabh_fire_safety_drills USING btree (corrective_action_due) WHERE (corrective_actions_done = false);

CREATE INDEX idx_nabh_fire_drills_period ON public.nabh_fire_safety_drills USING btree (tenant_id, drill_at DESC);

CREATE INDEX idx_nabh_fire_safety_drills_deleted_at_e55d1897 ON public.nabh_fire_safety_drills USING btree (deleted_at);

ALTER TABLE public.nabh_fire_safety_drills ENABLE ROW LEVEL SECURITY;

-- Name: nabh_fire_safety_drills nabh_fire_drills_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_fire_drills_tenant ON public.nabh_fire_safety_drills USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_fire_safety_drills trg_nabh_fire_drills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_fire_drills_updated_at BEFORE UPDATE ON public.nabh_fire_safety_drills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: nabh_fire_safety_drills trg_nabh_fire_safety_drills_soft_delete_e55d1897; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_fire_safety_drills_soft_delete_e55d1897 BEFORE DELETE ON public.nabh_fire_safety_drills FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── COP-11: Pressure ulcer (Braden) assessment + incidence ─────

CREATE TABLE public.nabh_pressure_ulcer_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    assessed_by uuid NOT NULL,
    sensory_perception integer NOT NULL,
    moisture integer NOT NULL,
    activity integer NOT NULL,
    mobility integer NOT NULL,
    nutrition integer NOT NULL,
    friction_shear integer NOT NULL,
    braden_total integer GENERATED ALWAYS AS ((((((sensory_perception + moisture) + activity) + mobility) + nutrition) + friction_shear)) STORED,
    risk_level text NOT NULL,
    injury_present boolean DEFAULT false,
    injury_stage text,
    injury_location text,
    injury_acquired text,
    injury_description text,
    repositioning_plan text,
    nutritional_plan text,
    skin_care_plan text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nabh_pressure_ulcer_assessments_activity_check CHECK (((activity >= 1) AND (activity <= 4))),
    CONSTRAINT nabh_pressure_ulcer_assessments_friction_shear_check CHECK (((friction_shear >= 1) AND (friction_shear <= 3))),
    CONSTRAINT nabh_pressure_ulcer_assessments_mobility_check CHECK (((mobility >= 1) AND (mobility <= 4))),
    CONSTRAINT nabh_pressure_ulcer_assessments_moisture_check CHECK (((moisture >= 1) AND (moisture <= 4))),
    CONSTRAINT nabh_pressure_ulcer_assessments_nutrition_check CHECK (((nutrition >= 1) AND (nutrition <= 4))),
    CONSTRAINT nabh_pressure_ulcer_assessments_sensory_perception_check CHECK (((sensory_perception >= 1) AND (sensory_perception <= 4)))
);

-- Name: nabh_pressure_ulcer_assessments nabh_pressure_ulcer_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_pressure_ulcer_assessments
    ADD CONSTRAINT nabh_pressure_ulcer_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_pressure_ulcer_assessments_admission_id ON public.nabh_pressure_ulcer_assessments USING btree (admission_id);

CREATE INDEX idx_nabh_pressure_ulcer_assessments_deleted_at_78b3ac5b ON public.nabh_pressure_ulcer_assessments USING btree (deleted_at);

CREATE INDEX idx_nabh_pu_hospital_acquired ON public.nabh_pressure_ulcer_assessments USING btree (tenant_id, assessed_at) WHERE ((injury_present = true) AND (injury_acquired = 'hospital_acquired'::text));

CREATE INDEX idx_nabh_pu_patient ON public.nabh_pressure_ulcer_assessments USING btree (patient_id, assessed_at DESC);

CREATE UNIQUE INDEX idx_nabh_pu_source ON public.nabh_pressure_ulcer_assessments USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

ALTER TABLE public.nabh_pressure_ulcer_assessments ENABLE ROW LEVEL SECURITY;

-- Name: nabh_pressure_ulcer_assessments nabh_pressure_ulcer_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_pressure_ulcer_tenant ON public.nabh_pressure_ulcer_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_pressure_ulcer_assessments trg_nabh_pressure_ulcer_assessments_soft_delete_78b3ac5b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_pressure_ulcer_assessments_soft_delete_78b3ac5b BEFORE DELETE ON public.nabh_pressure_ulcer_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_pressure_ulcer_assessments trg_nabh_pu_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_pu_updated_at BEFORE UPDATE ON public.nabh_pressure_ulcer_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── PSQ-6: Sentinel events / never events register ─────────────

CREATE TABLE public.nabh_sentinel_event_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_at timestamp with time zone NOT NULL,
    event_category text NOT NULL,
    event_subtype text,
    severity text NOT NULL,
    patient_id uuid,
    admission_id uuid,
    location text,
    description text NOT NULL,
    immediate_actions text,
    reportable_to_authority boolean DEFAULT false,
    reported_to_authority_at timestamp with time zone,
    authority_reference text,
    reportable_to_nqf boolean DEFAULT false,
    rca_required boolean DEFAULT true,
    rca_id uuid,
    rca_due_at timestamp with time zone,
    rca_completed_at timestamp with time zone,
    capa_id uuid,
    review_status text DEFAULT 'open'::text NOT NULL,
    closed_at timestamp with time zone,
    reported_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_module text,
    source_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabh_sentinel_event_register nabh_sentinel_event_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabh_sentinel_event_register
    ADD CONSTRAINT nabh_sentinel_event_register_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabh_sentinel_event_register_admission_id ON public.nabh_sentinel_event_register USING btree (admission_id);

CREATE INDEX idx_nabh_sentinel_event_register_deleted_at_56b02ac3 ON public.nabh_sentinel_event_register USING btree (deleted_at);

CREATE INDEX idx_nabh_sentinel_event_register_patient_id ON public.nabh_sentinel_event_register USING btree (patient_id);

CREATE INDEX idx_nabh_sentinel_open ON public.nabh_sentinel_event_register USING btree (tenant_id, event_at DESC) WHERE (review_status <> 'closed'::text);

CREATE INDEX idx_nabh_sentinel_rca_due ON public.nabh_sentinel_event_register USING btree (rca_due_at) WHERE ((rca_required = true) AND (rca_completed_at IS NULL));

CREATE UNIQUE INDEX idx_nabh_sentinel_source ON public.nabh_sentinel_event_register USING btree (tenant_id, source_module, source_record_id) WHERE ((source_module IS NOT NULL) AND (source_record_id IS NOT NULL));

ALTER TABLE public.nabh_sentinel_event_register ENABLE ROW LEVEL SECURITY;

-- Name: nabh_sentinel_event_register nabh_sentinel_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabh_sentinel_tenant ON public.nabh_sentinel_event_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nabh_sentinel_event_register trg_nabh_sentinel_event_register_soft_delete_56b02ac3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_sentinel_event_register_soft_delete_56b02ac3 BEFORE DELETE ON public.nabh_sentinel_event_register FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nabh_sentinel_event_register trg_nabh_sentinel_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabh_sentinel_updated_at BEFORE UPDATE ON public.nabh_sentinel_event_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.needle_stick_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL,
    staff_id uuid NOT NULL,
    incident_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    device_type text NOT NULL,
    procedure_during text,
    body_part text,
    depth text,
    source_patient_id uuid,
    hiv_status text,
    hbv_status text,
    hcv_status text,
    pep_initiated boolean DEFAULT false NOT NULL,
    pep_details text,
    follow_up_schedule jsonb,
    outcome text,
    reported_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: needle_stick_incidents needle_stick_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_pkey PRIMARY KEY (id);

CREATE INDEX idx_needle_stick_dept ON public.needle_stick_incidents USING btree (tenant_id, department_id);

CREATE INDEX idx_needle_stick_incidents_deleted_at_79be5ecf ON public.needle_stick_incidents USING btree (deleted_at);

CREATE INDEX idx_needle_stick_incidents_department_id ON public.needle_stick_incidents USING btree (department_id);

CREATE INDEX idx_needle_stick_incidents_location_id ON public.needle_stick_incidents USING btree (location_id);

CREATE INDEX idx_needle_stick_patient ON public.needle_stick_incidents USING btree (tenant_id, source_patient_id);

CREATE INDEX idx_needle_stick_tenant ON public.needle_stick_incidents USING btree (tenant_id);

ALTER TABLE public.needle_stick_incidents ENABLE ROW LEVEL SECURITY;

-- Name: needle_stick_incidents needle_stick_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY needle_stick_incidents_tenant ON public.needle_stick_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: needle_stick_incidents set_needle_stick_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_needle_stick_incidents_updated_at BEFORE UPDATE ON public.needle_stick_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: needle_stick_incidents trg_needle_stick_incidents_soft_delete_79be5ecf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_needle_stick_incidents_soft_delete_79be5ecf BEFORE DELETE ON public.needle_stick_incidents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.outbreak_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    outbreak_id uuid NOT NULL,
    patient_id uuid,
    staff_id uuid,
    contact_type text NOT NULL,
    exposure_date timestamp with time zone,
    screening_date timestamp with time zone,
    screening_result text,
    quarantine_required boolean DEFAULT false NOT NULL,
    quarantine_start date,
    quarantine_end date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: outbreak_contacts outbreak_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_pkey PRIMARY KEY (id);

CREATE INDEX idx_outbreak_contacts_deleted_at_2c6517bf ON public.outbreak_contacts USING btree (deleted_at);

CREATE INDEX idx_outbreak_contacts_outbreak ON public.outbreak_contacts USING btree (tenant_id, outbreak_id);

CREATE INDEX idx_outbreak_contacts_patient_id ON public.outbreak_contacts USING btree (patient_id);

CREATE INDEX idx_outbreak_contacts_tenant ON public.outbreak_contacts USING btree (tenant_id);

ALTER TABLE public.outbreak_contacts ENABLE ROW LEVEL SECURITY;

-- Name: outbreak_contacts outbreak_contacts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbreak_contacts_tenant ON public.outbreak_contacts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: outbreak_contacts set_outbreak_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_outbreak_contacts_updated_at BEFORE UPDATE ON public.outbreak_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: outbreak_contacts trg_outbreak_contacts_soft_delete_2c6517bf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_outbreak_contacts_soft_delete_2c6517bf BEFORE DELETE ON public.outbreak_contacts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.outbreak_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    outbreak_number text NOT NULL,
    organism text NOT NULL,
    outbreak_status public.outbreak_status DEFAULT 'suspected'::public.outbreak_status NOT NULL,
    detected_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    initial_cases integer DEFAULT 1 NOT NULL,
    total_cases integer DEFAULT 1 NOT NULL,
    description text,
    control_measures jsonb,
    hicc_notified boolean DEFAULT false NOT NULL,
    hicc_notified_at timestamp with time zone,
    containment_date timestamp with time zone,
    closure_date timestamp with time zone,
    root_cause text,
    lessons_learned text,
    reported_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: outbreak_events outbreak_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_outbreak_events_deleted_at_1d3292ae ON public.outbreak_events USING btree (deleted_at);

CREATE INDEX idx_outbreak_events_department_id ON public.outbreak_events USING btree (department_id);

CREATE INDEX idx_outbreak_events_dept ON public.outbreak_events USING btree (tenant_id, department_id);

CREATE INDEX idx_outbreak_events_location_id ON public.outbreak_events USING btree (location_id);

CREATE INDEX idx_outbreak_events_status ON public.outbreak_events USING btree (tenant_id, outbreak_status);

CREATE INDEX idx_outbreak_events_tenant ON public.outbreak_events USING btree (tenant_id);

ALTER TABLE public.outbreak_events ENABLE ROW LEVEL SECURITY;

-- Name: outbreak_events outbreak_events_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbreak_events_tenant ON public.outbreak_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: outbreak_events set_outbreak_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_outbreak_events_updated_at BEFORE UPDATE ON public.outbreak_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: outbreak_events trg_outbreak_events_soft_delete_1d3292ae; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_outbreak_events_soft_delete_1d3292ae BEFORE DELETE ON public.outbreak_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.polypharmacy_interaction_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid,
    drug_a_name text NOT NULL,
    drug_b_name text NOT NULL,
    interaction_id uuid,
    severity text NOT NULL,
    description text,
    management text,
    status text DEFAULT 'active'::text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    override_reason text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT polypharmacy_interaction_alerts_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'contraindicated'::text]))),
    CONSTRAINT polypharmacy_interaction_alerts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'overridden'::text, 'resolved'::text])))
);

-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_polypharmacy_alerts_active ON public.polypharmacy_interaction_alerts USING btree (tenant_id, patient_id, status) WHERE (status = 'active'::text);

CREATE INDEX idx_polypharmacy_interaction_alerts_deleted_at_e3a7d3aa ON public.polypharmacy_interaction_alerts USING btree (deleted_at);

CREATE INDEX idx_polypharmacy_interaction_alerts_patient_id ON public.polypharmacy_interaction_alerts USING btree (patient_id);

ALTER TABLE public.polypharmacy_interaction_alerts ENABLE ROW LEVEL SECURITY;

-- Name: polypharmacy_interaction_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.polypharmacy_interaction_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: polypharmacy_interaction_alerts trg_polypharmacy_interaction_alerts_soft_delete_e3a7d3aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_polypharmacy_interaction_alerts_soft_delete_e3a7d3aa BEFORE DELETE ON public.polypharmacy_interaction_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_accreditation_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    standard_id uuid NOT NULL,
    compliance public.compliance_status DEFAULT 'not_applicable'::public.compliance_status NOT NULL,
    evidence_summary text,
    evidence_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    gap_description text,
    action_plan text,
    responsible_person_id uuid,
    target_date date,
    assessed_at timestamp with time zone,
    assessed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_accreditation_compliance quality_accreditation_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_pkey PRIMARY KEY (id);

-- Name: quality_accreditation_compliance quality_accreditation_compliance_tenant_id_standard_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_tenant_id_standard_id_key UNIQUE (tenant_id, standard_id);

CREATE INDEX idx_quality_accred_compliance_standard ON public.quality_accreditation_compliance USING btree (tenant_id, standard_id);

CREATE INDEX idx_quality_accred_compliance_tenant ON public.quality_accreditation_compliance USING btree (tenant_id);

CREATE INDEX idx_quality_accreditation_compliance_deleted_at_1468c268 ON public.quality_accreditation_compliance USING btree (deleted_at);

ALTER TABLE public.quality_accreditation_compliance ENABLE ROW LEVEL SECURITY;

-- Name: quality_accreditation_compliance quality_accreditation_compliance_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_accreditation_compliance_tenant ON public.quality_accreditation_compliance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_accreditation_compliance set_quality_accred_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_accred_compliance_updated_at BEFORE UPDATE ON public.quality_accreditation_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_accreditation_compliance trg_quality_accreditation_compliance_soft_delete_1468c268; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_accreditation_compliance_soft_delete_1468c268 BEFORE DELETE ON public.quality_accreditation_compliance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_accreditation_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    body public.accreditation_body NOT NULL,
    standard_code character varying(50) NOT NULL,
    standard_name character varying(300) NOT NULL,
    chapter character varying(100),
    description text,
    measurable_elements jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_accreditation_standards quality_accreditation_standard_tenant_id_body_standard_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_standards
    ADD CONSTRAINT quality_accreditation_standard_tenant_id_body_standard_code_key UNIQUE (tenant_id, body, standard_code);

-- Name: quality_accreditation_standards quality_accreditation_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_standards
    ADD CONSTRAINT quality_accreditation_standards_pkey PRIMARY KEY (id);

CREATE INDEX idx_quality_accred_standards_tenant ON public.quality_accreditation_standards USING btree (tenant_id);

CREATE INDEX idx_quality_accreditation_standards_deleted_at_240bc6c1 ON public.quality_accreditation_standards USING btree (deleted_at);

ALTER TABLE public.quality_accreditation_standards ENABLE ROW LEVEL SECURITY;

-- Name: quality_accreditation_standards quality_accreditation_standards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_accreditation_standards_tenant ON public.quality_accreditation_standards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_accreditation_standards set_quality_accred_standards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_accred_standards_updated_at BEFORE UPDATE ON public.quality_accreditation_standards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_accreditation_standards trg_quality_accreditation_standards_soft_delete_240bc6c1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_accreditation_standards_soft_delete_240bc6c1 BEFORE DELETE ON public.quality_accreditation_standards FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_action_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type character varying(50),
    source_id uuid,
    description text,
    assigned_to uuid,
    due_date date,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    completed_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_action_items quality_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_action_items
    ADD CONSTRAINT quality_action_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_quality_action_items_deleted_at_845c568f ON public.quality_action_items USING btree (deleted_at);

CREATE INDEX idx_quality_action_items_source ON public.quality_action_items USING btree (tenant_id, source_type, source_id);

CREATE INDEX idx_quality_action_items_tenant ON public.quality_action_items USING btree (tenant_id);

ALTER TABLE public.quality_action_items ENABLE ROW LEVEL SECURITY;

-- Name: quality_action_items quality_action_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_action_items_tenant ON public.quality_action_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_action_items set_quality_action_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_action_items_updated_at BEFORE UPDATE ON public.quality_action_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_action_items trg_quality_action_items_soft_delete_845c568f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_action_items_soft_delete_845c568f BEFORE DELETE ON public.quality_action_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    audit_number character varying(50) NOT NULL,
    audit_type character varying(50),
    title character varying(300) NOT NULL,
    scope text,
    department_id uuid,
    auditor_id uuid,
    audit_date date,
    report_date date,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    non_conformities integer DEFAULT 0 NOT NULL,
    observations integer DEFAULT 0 NOT NULL,
    opportunities integer DEFAULT 0 NOT NULL,
    overall_score numeric(5,2),
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_audits quality_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_pkey PRIMARY KEY (id);

-- Name: quality_audits quality_audits_tenant_id_audit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_tenant_id_audit_number_key UNIQUE (tenant_id, audit_number);

CREATE INDEX idx_quality_audits_deleted_at_3c308a6e ON public.quality_audits USING btree (deleted_at);

CREATE INDEX idx_quality_audits_dept ON public.quality_audits USING btree (tenant_id, department_id);

CREATE INDEX idx_quality_audits_status ON public.quality_audits USING btree (tenant_id, status);

CREATE INDEX idx_quality_audits_tenant ON public.quality_audits USING btree (tenant_id);

ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;

-- Name: quality_audits quality_audits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_tenant ON public.quality_audits USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_audits set_quality_audits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_audits_updated_at BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_audits trg_quality_audits_soft_delete_3c308a6e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_audits_soft_delete_3c308a6e BEFORE DELETE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_capa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_id uuid,
    capa_number character varying(50) NOT NULL,
    capa_type character varying(20),
    description text,
    action_plan text,
    status public.capa_status DEFAULT 'open'::public.capa_status NOT NULL,
    assigned_to uuid,
    due_date date,
    completed_at timestamp with time zone,
    verified_by uuid,
    verified_at timestamp with time zone,
    effectiveness_check text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_capa quality_capa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_pkey PRIMARY KEY (id);

-- Name: quality_capa quality_capa_tenant_id_capa_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_tenant_id_capa_number_key UNIQUE (tenant_id, capa_number);

CREATE INDEX idx_quality_capa_deleted_at_8b7bd162 ON public.quality_capa USING btree (deleted_at);

CREATE INDEX idx_quality_capa_incident ON public.quality_capa USING btree (tenant_id, incident_id);

CREATE INDEX idx_quality_capa_tenant ON public.quality_capa USING btree (tenant_id);

ALTER TABLE public.quality_capa ENABLE ROW LEVEL SECURITY;

-- Name: quality_capa quality_capa_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_capa_tenant ON public.quality_capa USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_capa set_quality_capa_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_capa_updated_at BEFORE UPDATE ON public.quality_capa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_capa trg_quality_capa_soft_delete_8b7bd162; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_capa_soft_delete_8b7bd162 BEFORE DELETE ON public.quality_capa FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_committee_meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    committee_id uuid NOT NULL,
    meeting_number character varying(50),
    scheduled_date timestamp with time zone,
    actual_date timestamp with time zone,
    venue character varying(200),
    agenda jsonb DEFAULT '[]'::jsonb NOT NULL,
    minutes text,
    attendees jsonb DEFAULT '[]'::jsonb NOT NULL,
    absentees jsonb DEFAULT '[]'::jsonb NOT NULL,
    decisions jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_committee_meetings quality_committee_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committee_meetings
    ADD CONSTRAINT quality_committee_meetings_pkey PRIMARY KEY (id);

CREATE INDEX idx_quality_committee_meetings_deleted_at_31c9ee7c ON public.quality_committee_meetings USING btree (deleted_at);

CREATE INDEX idx_quality_committee_meetings_lookup ON public.quality_committee_meetings USING btree (tenant_id, committee_id, scheduled_date);

CREATE INDEX idx_quality_committee_meetings_tenant ON public.quality_committee_meetings USING btree (tenant_id);

ALTER TABLE public.quality_committee_meetings ENABLE ROW LEVEL SECURITY;

-- Name: quality_committee_meetings quality_committee_meetings_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_committee_meetings_tenant ON public.quality_committee_meetings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_committee_meetings set_quality_committee_meetings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_committee_meetings_updated_at BEFORE UPDATE ON public.quality_committee_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_committee_meetings trg_quality_committee_meetings_soft_delete_31c9ee7c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_committee_meetings_soft_delete_31c9ee7c BEFORE DELETE ON public.quality_committee_meetings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_committees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    committee_type character varying(100),
    chairperson_id uuid,
    secretary_id uuid,
    members jsonb DEFAULT '[]'::jsonb NOT NULL,
    meeting_frequency public.committee_frequency,
    charter text,
    is_mandatory boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_committees quality_committees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_pkey PRIMARY KEY (id);

-- Name: quality_committees quality_committees_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_quality_committees_deleted_at_7e6e45be ON public.quality_committees USING btree (deleted_at);

CREATE INDEX idx_quality_committees_tenant ON public.quality_committees USING btree (tenant_id);

ALTER TABLE public.quality_committees ENABLE ROW LEVEL SECURITY;

-- Name: quality_committees quality_committees_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_committees_tenant ON public.quality_committees USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_committees set_quality_committees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_committees_updated_at BEFORE UPDATE ON public.quality_committees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_committees trg_quality_committees_soft_delete_7e6e45be; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_committees_soft_delete_7e6e45be BEFORE DELETE ON public.quality_committees FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_document_acknowledgments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_document_acknowledgments quality_document_acknowledgme_tenant_id_document_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgme_tenant_id_document_id_user_id_key UNIQUE (tenant_id, document_id, user_id);

-- Name: quality_document_acknowledgments quality_document_acknowledgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_pkey PRIMARY KEY (id);

CREATE INDEX idx_quality_doc_acks_doc ON public.quality_document_acknowledgments USING btree (tenant_id, document_id);

CREATE INDEX idx_quality_doc_acks_tenant ON public.quality_document_acknowledgments USING btree (tenant_id);

CREATE INDEX idx_quality_document_acknowledgments_deleted_at_3b420bd1 ON public.quality_document_acknowledgments USING btree (deleted_at);

ALTER TABLE public.quality_document_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Name: quality_document_acknowledgments quality_document_acknowledgments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_document_acknowledgments_tenant ON public.quality_document_acknowledgments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_document_acknowledgments set_quality_document_acks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_document_acks_updated_at BEFORE UPDATE ON public.quality_document_acknowledgments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_document_acknowledgments trg_quality_document_acknowledgments_soft_delete_3b420bd1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_document_acknowledgments_soft_delete_3b420bd1 BEFORE DELETE ON public.quality_document_acknowledgments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    change_summary text,
    content text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_document_versions quality_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_pkey PRIMARY KEY (id);

CREATE INDEX idx_quality_document_versions_deleted_at_3354dc20 ON public.quality_document_versions USING btree (deleted_at);

CREATE INDEX idx_quality_document_versions_doc ON public.quality_document_versions USING btree (tenant_id, document_id);

CREATE INDEX idx_quality_document_versions_tenant ON public.quality_document_versions USING btree (tenant_id);

ALTER TABLE public.quality_document_versions ENABLE ROW LEVEL SECURITY;

-- Name: quality_document_versions quality_document_versions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_document_versions_tenant ON public.quality_document_versions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_document_versions set_quality_document_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_document_versions_updated_at BEFORE UPDATE ON public.quality_document_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_document_versions trg_quality_document_versions_soft_delete_3354dc20; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_document_versions_soft_delete_3354dc20 BEFORE DELETE ON public.quality_document_versions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_number character varying(50) NOT NULL,
    title character varying(300) NOT NULL,
    category character varying(100),
    department_id uuid,
    current_version integer DEFAULT 1 NOT NULL,
    status public.document_status DEFAULT 'draft'::public.document_status NOT NULL,
    content text,
    summary text,
    author_id uuid,
    reviewer_id uuid,
    approver_id uuid,
    released_at timestamp with time zone,
    next_review_date date,
    review_cycle_months integer DEFAULT 12,
    is_training_required boolean DEFAULT false NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_documents quality_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_pkey PRIMARY KEY (id);

-- Name: quality_documents quality_documents_tenant_id_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_tenant_id_document_number_key UNIQUE (tenant_id, document_number);

CREATE INDEX idx_quality_documents_deleted_at_cec0cf99 ON public.quality_documents USING btree (deleted_at);

CREATE INDEX idx_quality_documents_dept ON public.quality_documents USING btree (tenant_id, department_id);

CREATE INDEX idx_quality_documents_status ON public.quality_documents USING btree (tenant_id, status);

CREATE INDEX idx_quality_documents_tenant ON public.quality_documents USING btree (tenant_id);

ALTER TABLE public.quality_documents ENABLE ROW LEVEL SECURITY;

-- Name: quality_documents quality_documents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_documents_tenant ON public.quality_documents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_documents set_quality_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_documents_updated_at BEFORE UPDATE ON public.quality_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_documents trg_quality_documents_soft_delete_cec0cf99; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_documents_soft_delete_cec0cf99 BEFORE DELETE ON public.quality_documents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number character varying(50) NOT NULL,
    title character varying(300) NOT NULL,
    description text,
    incident_type character varying(100),
    severity public.incident_severity,
    status public.incident_status DEFAULT 'reported'::public.incident_status NOT NULL,
    department_id uuid,
    location character varying(200),
    incident_date timestamp with time zone,
    reported_by uuid,
    is_anonymous boolean DEFAULT false NOT NULL,
    patient_id uuid,
    affected_persons jsonb DEFAULT '[]'::jsonb NOT NULL,
    immediate_action text,
    root_cause text,
    contributing_factors jsonb DEFAULT '[]'::jsonb NOT NULL,
    assigned_to uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    is_reportable boolean DEFAULT false NOT NULL,
    regulatory_body character varying(100),
    regulatory_reported_at timestamp with time zone,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_incidents quality_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_pkey PRIMARY KEY (id);

-- Name: quality_incidents quality_incidents_tenant_id_incident_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_tenant_id_incident_number_key UNIQUE (tenant_id, incident_number);

CREATE INDEX idx_quality_incidents_contributing_factors ON public.quality_incidents USING gin (contributing_factors jsonb_path_ops);

CREATE INDEX idx_quality_incidents_date ON public.quality_incidents USING btree (tenant_id, incident_date);

CREATE INDEX idx_quality_incidents_deleted_at_e6174d24 ON public.quality_incidents USING btree (deleted_at);

CREATE INDEX idx_quality_incidents_severity ON public.quality_incidents USING btree (tenant_id, severity);

CREATE INDEX idx_quality_incidents_status ON public.quality_incidents USING btree (tenant_id, status);

CREATE INDEX idx_quality_incidents_tenant ON public.quality_incidents USING btree (tenant_id);

ALTER TABLE public.quality_incidents ENABLE ROW LEVEL SECURITY;

-- Name: quality_incidents quality_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_incidents_tenant ON public.quality_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_incidents set_quality_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_incidents_updated_at BEFORE UPDATE ON public.quality_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_incidents trg_quality_incidents_soft_delete_e6174d24; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_incidents_soft_delete_e6174d24 BEFORE DELETE ON public.quality_incidents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_indicator_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    indicator_id uuid,
    numerator integer,
    denominator integer,
    rate numeric(7,2),
    status text,
    trend text,
    period text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_indicator_data quality_indicator_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_data
    ADD CONSTRAINT quality_indicator_data_pkey PRIMARY KEY (id);

CREATE INDEX idx_qid_period ON public.quality_indicator_data USING btree (tenant_id, indicator_id, period DESC);

CREATE INDEX idx_quality_indicator_data_deleted_at_2d828660 ON public.quality_indicator_data USING btree (deleted_at);

ALTER TABLE ONLY public.quality_indicator_data FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quality_indicator_data ENABLE ROW LEVEL SECURITY;

-- Name: quality_indicator_data tenant_isolation_quality_indicator_data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_quality_indicator_data ON public.quality_indicator_data USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: quality_indicator_data trg_quality_indicator_data_soft_delete_2d828660; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_indicator_data_soft_delete_2d828660 BEFORE DELETE ON public.quality_indicator_data FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_indicator_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    indicator_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    numerator_value numeric(12,4),
    denominator_value numeric(12,4),
    calculated_value numeric(10,4),
    department_id uuid,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_indicator_values quality_indicator_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_pkey PRIMARY KEY (id);

-- Name: quality_indicator_values quality_indicator_values_tenant_id_indicator_id_period_star_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_tenant_id_indicator_id_period_star_key UNIQUE (tenant_id, indicator_id, period_start, period_end, department_id);

CREATE INDEX idx_quality_indicator_values_deleted_at_94c5f7b7 ON public.quality_indicator_values USING btree (deleted_at);

CREATE INDEX idx_quality_indicator_values_lookup ON public.quality_indicator_values USING btree (tenant_id, indicator_id, period_start);

CREATE INDEX idx_quality_indicator_values_tenant ON public.quality_indicator_values USING btree (tenant_id);

ALTER TABLE public.quality_indicator_values ENABLE ROW LEVEL SECURITY;

-- Name: quality_indicator_values quality_indicator_values_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_indicator_values_tenant ON public.quality_indicator_values USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_indicator_values set_quality_indicator_values_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_indicator_values_updated_at BEFORE UPDATE ON public.quality_indicator_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_indicator_values trg_quality_indicator_values_soft_delete_94c5f7b7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_indicator_values_soft_delete_94c5f7b7 BEFORE DELETE ON public.quality_indicator_values FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.quality_indicators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    sub_category character varying(100),
    numerator_description text,
    denominator_description text,
    unit character varying(50),
    frequency public.indicator_frequency,
    target_value numeric(10,4),
    threshold_warning numeric(10,4),
    threshold_critical numeric(10,4),
    benchmark_national numeric(10,4),
    benchmark_international numeric(10,4),
    auto_calculated boolean DEFAULT false NOT NULL,
    calculation_query text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    indicator_code text,
    indicator_name text,
    benchmark double precision,
    display_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: quality_indicators quality_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicators
    ADD CONSTRAINT quality_indicators_pkey PRIMARY KEY (id);

-- Name: quality_indicators quality_indicators_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicators
    ADD CONSTRAINT quality_indicators_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_quality_indicators_deleted_at_5122aac1 ON public.quality_indicators USING btree (deleted_at);

CREATE INDEX idx_quality_indicators_tenant ON public.quality_indicators USING btree (tenant_id);

ALTER TABLE public.quality_indicators ENABLE ROW LEVEL SECURITY;

-- Name: quality_indicators quality_indicators_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_indicators_tenant ON public.quality_indicators USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: quality_indicators set_quality_indicators_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_indicators_updated_at BEFORE UPDATE ON public.quality_indicators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: quality_indicators trg_quality_indicators_soft_delete_5122aac1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quality_indicators_soft_delete_5122aac1 BEFORE DELETE ON public.quality_indicators FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rca_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rca_number text,
    incident_id uuid,
    rca_start_date date,
    rca_completion_date date,
    problem_statement text,
    analysis_method text,
    prepared_by uuid,
    reviewed_by uuid,
    approved_by uuid,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prepared_by_id uuid,
    reviewed_by_id uuid,
    approved_by_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rca_reports rca_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_rca_reports_deleted_at_55405654 ON public.rca_reports USING btree (deleted_at);

CREATE INDEX idx_rca_reports_tenant_id ON public.rca_reports USING btree (tenant_id);

ALTER TABLE ONLY public.rca_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.rca_reports ENABLE ROW LEVEL SECURITY;

-- Name: rca_reports tenant_isolation_rca_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_rca_reports ON public.rca_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: rca_reports trg_rca_reports_soft_delete_55405654; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_reports_soft_delete_55405654 BEFORE DELETE ON public.rca_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tat_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tat_record_id uuid NOT NULL,
    alert_type text NOT NULL,
    notified_users uuid[],
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tat_alerts tat_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_tat_alerts_deleted_at_d111f5ca ON public.tat_alerts USING btree (deleted_at);

CREATE INDEX idx_tat_alerts_tenant_id ON public.tat_alerts USING btree (tenant_id);

ALTER TABLE ONLY public.tat_alerts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tat_alerts ENABLE ROW LEVEL SECURITY;

-- Name: tat_alerts tenant_isolation_tat_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_alerts ON public.tat_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tat_alerts trg_tat_alerts_soft_delete_d111f5ca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tat_alerts_soft_delete_d111f5ca BEFORE DELETE ON public.tat_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tat_benchmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    sub_category text,
    benchmark_minutes integer NOT NULL,
    warning_minutes integer,
    critical_minutes integer,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tat_benchmarks tat_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_benchmarks
    ADD CONSTRAINT tat_benchmarks_pkey PRIMARY KEY (id);

CREATE INDEX idx_tat_benchmarks_deleted_at_3cc2e106 ON public.tat_benchmarks USING btree (deleted_at);

CREATE INDEX idx_tat_benchmarks_department_id ON public.tat_benchmarks USING btree (department_id);

CREATE INDEX idx_tat_benchmarks_tenant ON public.tat_benchmarks USING btree (tenant_id, category);

ALTER TABLE ONLY public.tat_benchmarks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tat_benchmarks ENABLE ROW LEVEL SECURITY;

-- Name: tat_benchmarks tenant_isolation_tat_benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_benchmarks ON public.tat_benchmarks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tat_benchmarks trg_tat_benchmarks_soft_delete_3cc2e106; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tat_benchmarks_soft_delete_3cc2e106 BEFORE DELETE ON public.tat_benchmarks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tat_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    sub_category text,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    patient_id uuid,
    department_id uuid,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    elapsed_minutes integer,
    benchmark_minutes integer,
    status text,
    breach_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tat_records tat_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_records
    ADD CONSTRAINT tat_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_tat_records_deleted_at_78e2baaf ON public.tat_records USING btree (deleted_at);

CREATE INDEX idx_tat_records_department_id ON public.tat_records USING btree (department_id);

CREATE INDEX idx_tat_records_tenant ON public.tat_records USING btree (tenant_id, category, start_time DESC);

ALTER TABLE ONLY public.tat_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tat_records ENABLE ROW LEVEL SECURITY;

-- Name: tat_records tenant_isolation_tat_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_records ON public.tat_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tat_records trg_tat_records_soft_delete_78e2baaf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tat_records_soft_delete_78e2baaf BEFORE DELETE ON public.tat_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: data_quality_issues data_quality_issues_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.data_quality_rules(id) ON DELETE SET NULL;

-- Name: outbreak_contacts outbreak_contacts_outbreak_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_outbreak_id_fkey FOREIGN KEY (outbreak_id) REFERENCES public.outbreak_events(id) ON DELETE CASCADE;

-- Name: quality_accreditation_compliance quality_accreditation_compliance_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.quality_accreditation_standards(id);

-- Name: quality_capa quality_capa_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.quality_incidents(id);

-- Name: quality_committee_meetings quality_committee_meetings_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committee_meetings
    ADD CONSTRAINT quality_committee_meetings_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.quality_committees(id);

-- Name: quality_document_acknowledgments quality_document_acknowledgments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.quality_documents(id);

-- Name: quality_document_versions quality_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.quality_documents(id);

-- Name: quality_indicator_values quality_indicator_values_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.quality_indicators(id);

-- Name: tat_alerts tat_alerts_tat_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_tat_record_id_fkey FOREIGN KEY (tat_record_id) REFERENCES public.tat_records(id) ON DELETE CASCADE;
