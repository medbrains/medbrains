-- ============================================================
-- MedBrains schema — module: quality
-- ============================================================

--
-- Name: data_quality_issues; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.data_quality_issues FORCE ROW LEVEL SECURITY;



--
-- Name: data_quality_rules; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.data_quality_rules FORCE ROW LEVEL SECURITY;



--
-- Name: data_quality_scores; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.data_quality_scores FORCE ROW LEVEL SECURITY;



--
-- Name: quality_accreditation_compliance; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_accreditation_standards; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_action_items; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_audits; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_capa; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_committee_meetings; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_committees; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_document_acknowledgments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_document_acknowledgments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    change_summary text,
    content text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_documents; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_incidents; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_indicator_data; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.quality_indicator_data FORCE ROW LEVEL SECURITY;



--
-- Name: quality_indicator_values; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: quality_indicators; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: rca_reports; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.rca_reports FORCE ROW LEVEL SECURITY;



--
-- Name: tat_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tat_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tat_record_id uuid NOT NULL,
    alert_type text NOT NULL,
    notified_users uuid[],
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tat_alerts FORCE ROW LEVEL SECURITY;



--
-- Name: tat_benchmarks; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tat_benchmarks FORCE ROW LEVEL SECURITY;



--
-- Name: tat_records; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tat_records FORCE ROW LEVEL SECURITY;



--
-- Name: data_quality_issues data_quality_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_pkey PRIMARY KEY (id);



--
-- Name: data_quality_rules data_quality_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_rules
    ADD CONSTRAINT data_quality_rules_pkey PRIMARY KEY (id);



--
-- Name: data_quality_scores data_quality_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_scores
    ADD CONSTRAINT data_quality_scores_pkey PRIMARY KEY (id);



--
-- Name: data_quality_scores data_quality_scores_tenant_id_entity_type_score_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_scores
    ADD CONSTRAINT data_quality_scores_tenant_id_entity_type_score_date_key UNIQUE (tenant_id, entity_type, score_date);



--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_pkey PRIMARY KEY (id);



--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_tenant_id_standard_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_tenant_id_standard_id_key UNIQUE (tenant_id, standard_id);



--
-- Name: quality_accreditation_standards quality_accreditation_standard_tenant_id_body_standard_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_standards
    ADD CONSTRAINT quality_accreditation_standard_tenant_id_body_standard_code_key UNIQUE (tenant_id, body, standard_code);



--
-- Name: quality_accreditation_standards quality_accreditation_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_standards
    ADD CONSTRAINT quality_accreditation_standards_pkey PRIMARY KEY (id);



--
-- Name: quality_action_items quality_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_action_items
    ADD CONSTRAINT quality_action_items_pkey PRIMARY KEY (id);



--
-- Name: quality_audits quality_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_pkey PRIMARY KEY (id);



--
-- Name: quality_audits quality_audits_tenant_id_audit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_audits
    ADD CONSTRAINT quality_audits_tenant_id_audit_number_key UNIQUE (tenant_id, audit_number);



--
-- Name: quality_capa quality_capa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_pkey PRIMARY KEY (id);



--
-- Name: quality_capa quality_capa_tenant_id_capa_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_tenant_id_capa_number_key UNIQUE (tenant_id, capa_number);



--
-- Name: quality_committee_meetings quality_committee_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committee_meetings
    ADD CONSTRAINT quality_committee_meetings_pkey PRIMARY KEY (id);



--
-- Name: quality_committees quality_committees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_pkey PRIMARY KEY (id);



--
-- Name: quality_committees quality_committees_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committees
    ADD CONSTRAINT quality_committees_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: quality_document_acknowledgments quality_document_acknowledgme_tenant_id_document_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgme_tenant_id_document_id_user_id_key UNIQUE (tenant_id, document_id, user_id);



--
-- Name: quality_document_acknowledgments quality_document_acknowledgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_pkey PRIMARY KEY (id);



--
-- Name: quality_document_versions quality_document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_pkey PRIMARY KEY (id);



--
-- Name: quality_documents quality_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_pkey PRIMARY KEY (id);



--
-- Name: quality_documents quality_documents_tenant_id_document_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_documents
    ADD CONSTRAINT quality_documents_tenant_id_document_number_key UNIQUE (tenant_id, document_number);



--
-- Name: quality_incidents quality_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_pkey PRIMARY KEY (id);



--
-- Name: quality_incidents quality_incidents_tenant_id_incident_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_incidents
    ADD CONSTRAINT quality_incidents_tenant_id_incident_number_key UNIQUE (tenant_id, incident_number);



--
-- Name: quality_indicator_data quality_indicator_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_data
    ADD CONSTRAINT quality_indicator_data_pkey PRIMARY KEY (id);



--
-- Name: quality_indicator_values quality_indicator_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_pkey PRIMARY KEY (id);



--
-- Name: quality_indicator_values quality_indicator_values_tenant_id_indicator_id_period_star_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_tenant_id_indicator_id_period_star_key UNIQUE (tenant_id, indicator_id, period_start, period_end, department_id);



--
-- Name: quality_indicators quality_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicators
    ADD CONSTRAINT quality_indicators_pkey PRIMARY KEY (id);



--
-- Name: quality_indicators quality_indicators_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicators
    ADD CONSTRAINT quality_indicators_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: rca_reports rca_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_reports
    ADD CONSTRAINT rca_reports_pkey PRIMARY KEY (id);



--
-- Name: tat_alerts tat_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_pkey PRIMARY KEY (id);



--
-- Name: tat_benchmarks tat_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_benchmarks
    ADD CONSTRAINT tat_benchmarks_pkey PRIMARY KEY (id);



--
-- Name: tat_records tat_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_records
    ADD CONSTRAINT tat_records_pkey PRIMARY KEY (id);



--
-- Name: idx_dq_issues_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dq_issues_unresolved ON public.data_quality_issues USING btree (tenant_id, is_resolved, severity);



--
-- Name: idx_qid_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qid_period ON public.quality_indicator_data USING btree (tenant_id, indicator_id, period DESC);



--
-- Name: idx_quality_accred_compliance_standard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_accred_compliance_standard ON public.quality_accreditation_compliance USING btree (tenant_id, standard_id);



--
-- Name: idx_quality_accred_compliance_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_accred_compliance_tenant ON public.quality_accreditation_compliance USING btree (tenant_id);



--
-- Name: idx_quality_accred_standards_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_accred_standards_tenant ON public.quality_accreditation_standards USING btree (tenant_id);



--
-- Name: idx_quality_action_items_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_action_items_source ON public.quality_action_items USING btree (tenant_id, source_type, source_id);



--
-- Name: idx_quality_action_items_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_action_items_tenant ON public.quality_action_items USING btree (tenant_id);



--
-- Name: idx_quality_audits_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_audits_dept ON public.quality_audits USING btree (tenant_id, department_id);



--
-- Name: idx_quality_audits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_audits_status ON public.quality_audits USING btree (tenant_id, status);



--
-- Name: idx_quality_audits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_audits_tenant ON public.quality_audits USING btree (tenant_id);



--
-- Name: idx_quality_capa_incident; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_capa_incident ON public.quality_capa USING btree (tenant_id, incident_id);



--
-- Name: idx_quality_capa_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_capa_tenant ON public.quality_capa USING btree (tenant_id);



--
-- Name: idx_quality_committee_meetings_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_committee_meetings_lookup ON public.quality_committee_meetings USING btree (tenant_id, committee_id, scheduled_date);



--
-- Name: idx_quality_committee_meetings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_committee_meetings_tenant ON public.quality_committee_meetings USING btree (tenant_id);



--
-- Name: idx_quality_committees_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_committees_tenant ON public.quality_committees USING btree (tenant_id);



--
-- Name: idx_quality_doc_acks_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_doc_acks_doc ON public.quality_document_acknowledgments USING btree (tenant_id, document_id);



--
-- Name: idx_quality_doc_acks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_doc_acks_tenant ON public.quality_document_acknowledgments USING btree (tenant_id);



--
-- Name: idx_quality_document_versions_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_document_versions_doc ON public.quality_document_versions USING btree (tenant_id, document_id);



--
-- Name: idx_quality_document_versions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_document_versions_tenant ON public.quality_document_versions USING btree (tenant_id);



--
-- Name: idx_quality_documents_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_documents_dept ON public.quality_documents USING btree (tenant_id, department_id);



--
-- Name: idx_quality_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_documents_status ON public.quality_documents USING btree (tenant_id, status);



--
-- Name: idx_quality_documents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_documents_tenant ON public.quality_documents USING btree (tenant_id);



--
-- Name: idx_quality_incidents_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_date ON public.quality_incidents USING btree (tenant_id, incident_date);



--
-- Name: idx_quality_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_severity ON public.quality_incidents USING btree (tenant_id, severity);



--
-- Name: idx_quality_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_status ON public.quality_incidents USING btree (tenant_id, status);



--
-- Name: idx_quality_incidents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_tenant ON public.quality_incidents USING btree (tenant_id);



--
-- Name: idx_quality_indicator_values_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_indicator_values_lookup ON public.quality_indicator_values USING btree (tenant_id, indicator_id, period_start);



--
-- Name: idx_quality_indicator_values_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_indicator_values_tenant ON public.quality_indicator_values USING btree (tenant_id);



--
-- Name: idx_quality_indicators_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_indicators_tenant ON public.quality_indicators USING btree (tenant_id);



--
-- Name: idx_tat_benchmarks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tat_benchmarks_tenant ON public.tat_benchmarks USING btree (tenant_id, category);



--
-- Name: idx_tat_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tat_records_tenant ON public.tat_records USING btree (tenant_id, category, start_time DESC);



--
-- Name: quality_accreditation_compliance set_quality_accred_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_accred_compliance_updated_at BEFORE UPDATE ON public.quality_accreditation_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_accreditation_standards set_quality_accred_standards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_accred_standards_updated_at BEFORE UPDATE ON public.quality_accreditation_standards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_action_items set_quality_action_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_action_items_updated_at BEFORE UPDATE ON public.quality_action_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_audits set_quality_audits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_audits_updated_at BEFORE UPDATE ON public.quality_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_capa set_quality_capa_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_capa_updated_at BEFORE UPDATE ON public.quality_capa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_committee_meetings set_quality_committee_meetings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_committee_meetings_updated_at BEFORE UPDATE ON public.quality_committee_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_committees set_quality_committees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_committees_updated_at BEFORE UPDATE ON public.quality_committees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_document_acknowledgments set_quality_document_acks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_document_acks_updated_at BEFORE UPDATE ON public.quality_document_acknowledgments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_document_versions set_quality_document_versions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_document_versions_updated_at BEFORE UPDATE ON public.quality_document_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_documents set_quality_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_documents_updated_at BEFORE UPDATE ON public.quality_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_incidents set_quality_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_incidents_updated_at BEFORE UPDATE ON public.quality_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_indicator_values set_quality_indicator_values_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_indicator_values_updated_at BEFORE UPDATE ON public.quality_indicator_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: quality_indicators set_quality_indicators_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quality_indicators_updated_at BEFORE UPDATE ON public.quality_indicators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: data_quality_issues data_quality_issues_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.data_quality_rules(id) ON DELETE SET NULL;



--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_accreditation_compliance
    ADD CONSTRAINT quality_accreditation_compliance_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.quality_accreditation_standards(id);



--
-- Name: quality_capa quality_capa_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_capa
    ADD CONSTRAINT quality_capa_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.quality_incidents(id);



--
-- Name: quality_committee_meetings quality_committee_meetings_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_committee_meetings
    ADD CONSTRAINT quality_committee_meetings_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.quality_committees(id);



--
-- Name: quality_document_acknowledgments quality_document_acknowledgments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_acknowledgments
    ADD CONSTRAINT quality_document_acknowledgments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.quality_documents(id);



--
-- Name: quality_document_versions quality_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_document_versions
    ADD CONSTRAINT quality_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.quality_documents(id);



--
-- Name: quality_indicator_values quality_indicator_values_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_indicator_values
    ADD CONSTRAINT quality_indicator_values_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.quality_indicators(id);



--
-- Name: tat_alerts tat_alerts_tat_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tat_alerts
    ADD CONSTRAINT tat_alerts_tat_record_id_fkey FOREIGN KEY (tat_record_id) REFERENCES public.tat_records(id) ON DELETE CASCADE;



--
-- Name: data_quality_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;


--
-- Name: data_quality_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_quality_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: data_quality_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_quality_scores ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_accreditation_compliance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_accreditation_compliance ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_accreditation_compliance quality_accreditation_compliance_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_accreditation_compliance_tenant ON public.quality_accreditation_compliance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_accreditation_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_accreditation_standards ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_accreditation_standards quality_accreditation_standards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_accreditation_standards_tenant ON public.quality_accreditation_standards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_action_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_action_items ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_action_items quality_action_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_action_items_tenant ON public.quality_action_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_audits ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_audits quality_audits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_audits_tenant ON public.quality_audits USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_capa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_capa ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_capa quality_capa_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_capa_tenant ON public.quality_capa USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_committee_meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_committee_meetings ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_committee_meetings quality_committee_meetings_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_committee_meetings_tenant ON public.quality_committee_meetings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_committees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_committees ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_committees quality_committees_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_committees_tenant ON public.quality_committees USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_document_acknowledgments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_document_acknowledgments ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_document_acknowledgments quality_document_acknowledgments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_document_acknowledgments_tenant ON public.quality_document_acknowledgments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_document_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_document_versions ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_document_versions quality_document_versions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_document_versions_tenant ON public.quality_document_versions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_documents ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_documents quality_documents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_documents_tenant ON public.quality_documents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_incidents ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_incidents quality_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_incidents_tenant ON public.quality_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_indicator_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_indicator_data ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_indicator_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_indicator_values ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_indicator_values quality_indicator_values_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_indicator_values_tenant ON public.quality_indicator_values USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: quality_indicators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quality_indicators ENABLE ROW LEVEL SECURITY;


--
-- Name: quality_indicators quality_indicators_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quality_indicators_tenant ON public.quality_indicators USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: rca_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rca_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: tat_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tat_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: tat_benchmarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tat_benchmarks ENABLE ROW LEVEL SECURITY;


--
-- Name: tat_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tat_records ENABLE ROW LEVEL SECURITY;


--
-- Name: data_quality_issues tenant_isolation_data_quality_issues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_issues ON public.data_quality_issues USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: data_quality_rules tenant_isolation_data_quality_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_rules ON public.data_quality_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: data_quality_scores tenant_isolation_data_quality_scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_quality_scores ON public.data_quality_scores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: quality_indicator_data tenant_isolation_quality_indicator_data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_quality_indicator_data ON public.quality_indicator_data USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: rca_reports tenant_isolation_rca_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_rca_reports ON public.rca_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tat_alerts tenant_isolation_tat_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_alerts ON public.tat_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tat_benchmarks tenant_isolation_tat_benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_benchmarks ON public.tat_benchmarks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tat_records tenant_isolation_tat_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tat_records ON public.tat_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


