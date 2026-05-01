-- ============================================================
-- MedBrains schema — module: lab
-- ============================================================

--
-- Name: critical_value_rules; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT critical_value_rules_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text]))))
);



--
-- Name: histopath_results; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.histopath_results FORCE ROW LEVEL SECURITY;



--
-- Name: lab_b2b_clients; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT lab_b2b_clients_billing_cycle_check CHECK (((billing_cycle IS NULL) OR (billing_cycle = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text]))))
);



--
-- Name: lab_b2b_rates; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_calibrations; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_collection_centers; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_critical_alerts; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_cytology_reports; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_eqas_results; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_histopath_reports; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_home_collections; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_molecular_reports; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_nabl_documents; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_orders; Type: TABLE; Schema: public; Owner: -
--

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
    department_id uuid
);



--
-- Name: lab_outsourced_orders; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_panel_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_panel_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    panel_id uuid NOT NULL,
    test_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);



--
-- Name: lab_phlebotomy_queue; Type: TABLE; Schema: public; Owner: -
--

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
    is_walk_in boolean DEFAULT false NOT NULL
);



--
-- Name: lab_proficiency_tests; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_qc_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_qc_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text,
    analyte text,
    mean numeric(14,4),
    sd numeric(14,4),
    cv numeric(7,2),
    westgard_violations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.lab_qc_metrics FORCE ROW LEVEL SECURITY;



--
-- Name: lab_qc_results; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_reagent_lots; Type: TABLE; Schema: public; Owner: -
--

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
    consumption_per_test numeric(10,4)
);



--
-- Name: lab_referral_doctors; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_referral_payouts; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_report_dispatches; Type: TABLE; Schema: public; Owner: -
--

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
    qr_verification_url text
);



--
-- Name: lab_report_templates; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_result_amendments; Type: TABLE; Schema: public; Owner: -
--

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
    amended_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

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
    numeric_value numeric(14,4)
);



--
-- Name: lab_sample_archive; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_sample_rejections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_sample_rejections (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    rejected_by uuid NOT NULL,
    rejection_reason character varying(500) NOT NULL,
    rejected_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_sample_routes; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lab_test_catalog; Type: TABLE; Schema: public; Owner: -
--

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
    fallback_analyzer text
);



--
-- Name: lab_test_panels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_test_panels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: critical_value_rules critical_value_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.critical_value_rules
    ADD CONSTRAINT critical_value_rules_pkey PRIMARY KEY (id);



--
-- Name: histopath_results histopath_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.histopath_results
    ADD CONSTRAINT histopath_results_pkey PRIMARY KEY (id);



--
-- Name: lab_b2b_clients lab_b2b_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_clients
    ADD CONSTRAINT lab_b2b_clients_pkey PRIMARY KEY (id);



--
-- Name: lab_b2b_clients lab_b2b_clients_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_clients
    ADD CONSTRAINT lab_b2b_clients_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: lab_b2b_rates lab_b2b_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_pkey PRIMARY KEY (id);



--
-- Name: lab_b2b_rates lab_b2b_rates_tenant_id_client_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_tenant_id_client_id_test_id_key UNIQUE (tenant_id, client_id, test_id);



--
-- Name: lab_calibrations lab_calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_pkey PRIMARY KEY (id);



--
-- Name: lab_collection_centers lab_collection_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_collection_centers
    ADD CONSTRAINT lab_collection_centers_pkey PRIMARY KEY (id);



--
-- Name: lab_collection_centers lab_collection_centers_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_collection_centers
    ADD CONSTRAINT lab_collection_centers_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: lab_critical_alerts lab_critical_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_pkey PRIMARY KEY (id);



--
-- Name: lab_cytology_reports lab_cytology_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_pkey PRIMARY KEY (id);



--
-- Name: lab_eqas_results lab_eqas_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_eqas_results
    ADD CONSTRAINT lab_eqas_results_pkey PRIMARY KEY (id);



--
-- Name: lab_histopath_reports lab_histopath_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_pkey PRIMARY KEY (id);



--
-- Name: lab_home_collections lab_home_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_pkey PRIMARY KEY (id);



--
-- Name: lab_molecular_reports lab_molecular_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_pkey PRIMARY KEY (id);



--
-- Name: lab_nabl_documents lab_nabl_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_pkey PRIMARY KEY (id);



--
-- Name: lab_nabl_documents lab_nabl_documents_tenant_id_document_number_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_nabl_documents
    ADD CONSTRAINT lab_nabl_documents_tenant_id_document_number_version_key UNIQUE (tenant_id, document_number, version);



--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);



--
-- Name: lab_outsourced_orders lab_outsourced_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_pkey PRIMARY KEY (id);



--
-- Name: lab_panel_tests lab_panel_tests_panel_id_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_panel_id_test_id_key UNIQUE (panel_id, test_id);



--
-- Name: lab_panel_tests lab_panel_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_pkey PRIMARY KEY (id);



--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_pkey PRIMARY KEY (id);



--
-- Name: lab_proficiency_tests lab_proficiency_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_proficiency_tests
    ADD CONSTRAINT lab_proficiency_tests_pkey PRIMARY KEY (id);



--
-- Name: lab_qc_metrics lab_qc_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_metrics
    ADD CONSTRAINT lab_qc_metrics_pkey PRIMARY KEY (id);



--
-- Name: lab_qc_results lab_qc_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_pkey PRIMARY KEY (id);



--
-- Name: lab_reagent_lots lab_reagent_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_pkey PRIMARY KEY (id);



--
-- Name: lab_reagent_lots lab_reagent_lots_tenant_id_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_tenant_id_lot_number_key UNIQUE (tenant_id, lot_number);



--
-- Name: lab_referral_doctors lab_referral_doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_doctors
    ADD CONSTRAINT lab_referral_doctors_pkey PRIMARY KEY (id);



--
-- Name: lab_referral_payouts lab_referral_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_pkey PRIMARY KEY (id);



--
-- Name: lab_report_dispatches lab_report_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_pkey PRIMARY KEY (id);



--
-- Name: lab_report_templates lab_report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_pkey PRIMARY KEY (id);



--
-- Name: lab_report_templates lab_report_templates_tenant_id_department_id_template_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_templates
    ADD CONSTRAINT lab_report_templates_tenant_id_department_id_template_name_key UNIQUE (tenant_id, department_id, template_name);



--
-- Name: lab_result_amendments lab_result_amendments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_pkey PRIMARY KEY (id);



--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);



--
-- Name: lab_sample_archive lab_sample_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_pkey PRIMARY KEY (id);



--
-- Name: lab_sample_rejections lab_sample_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_pkey PRIMARY KEY (id);



--
-- Name: lab_sample_routes lab_sample_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_routes
    ADD CONSTRAINT lab_sample_routes_pkey PRIMARY KEY (id);



--
-- Name: lab_test_catalog lab_test_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_pkey PRIMARY KEY (id);



--
-- Name: lab_test_catalog lab_test_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_catalog
    ADD CONSTRAINT lab_test_catalog_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: lab_test_panels lab_test_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_panels
    ADD CONSTRAINT lab_test_panels_pkey PRIMARY KEY (id);



--
-- Name: lab_test_panels lab_test_panels_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_test_panels
    ADD CONSTRAINT lab_test_panels_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: idx_critical_value_rules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_critical_value_rules_tenant ON public.critical_value_rules USING btree (tenant_id);



--
-- Name: idx_critical_value_rules_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_critical_value_rules_test ON public.critical_value_rules USING btree (tenant_id, test_code);



--
-- Name: idx_histopath_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_histopath_order ON public.histopath_results USING btree (tenant_id, order_id);



--
-- Name: idx_lab_b2b_rates_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_b2b_rates_client ON public.lab_b2b_rates USING btree (tenant_id, client_id);



--
-- Name: idx_lab_critical_alerts_unack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_critical_alerts_unack ON public.lab_critical_alerts USING btree (tenant_id, acknowledged_at) WHERE (acknowledged_at IS NULL);



--
-- Name: idx_lab_cytology_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_cytology_order ON public.lab_cytology_reports USING btree (tenant_id, order_id);



--
-- Name: idx_lab_eqas_test_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_eqas_test_cycle ON public.lab_eqas_results USING btree (tenant_id, test_id, cycle);



--
-- Name: idx_lab_histopath_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_histopath_order ON public.lab_histopath_reports USING btree (tenant_id, order_id);



--
-- Name: idx_lab_home_collections_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_home_collections_date ON public.lab_home_collections USING btree (tenant_id, scheduled_date);



--
-- Name: idx_lab_home_collections_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_home_collections_tenant_status ON public.lab_home_collections USING btree (tenant_id, status);



--
-- Name: idx_lab_molecular_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_molecular_order ON public.lab_molecular_reports USING btree (tenant_id, order_id);



--
-- Name: idx_lab_nabl_documents_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_nabl_documents_current ON public.lab_nabl_documents USING btree (tenant_id, is_current);



--
-- Name: idx_lab_orders_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_barcode ON public.lab_orders USING btree (tenant_id, sample_barcode) WHERE (sample_barcode IS NOT NULL);



--
-- Name: idx_lab_orders_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_created_by ON public.lab_orders USING btree (created_by);



--
-- Name: idx_lab_orders_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_encounter ON public.lab_orders USING btree (encounter_id);



--
-- Name: idx_lab_orders_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_parent ON public.lab_orders USING btree (parent_order_id) WHERE (parent_order_id IS NOT NULL);



--
-- Name: idx_lab_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_patient ON public.lab_orders USING btree (patient_id);



--
-- Name: idx_lab_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_status ON public.lab_orders USING btree (tenant_id, status);



--
-- Name: idx_lab_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_orders_tenant ON public.lab_orders USING btree (tenant_id);



--
-- Name: idx_lab_panel_tests_panel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_panel_tests_panel ON public.lab_panel_tests USING btree (panel_id);



--
-- Name: idx_lab_panel_tests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_panel_tests_tenant ON public.lab_panel_tests USING btree (tenant_id);



--
-- Name: idx_lab_phlebotomy_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_phlebotomy_queue_status ON public.lab_phlebotomy_queue USING btree (tenant_id, status, assigned_to);



--
-- Name: idx_lab_proficiency_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_proficiency_test ON public.lab_proficiency_tests USING btree (tenant_id, test_id);



--
-- Name: idx_lab_qc_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_qc_period ON public.lab_qc_metrics USING btree (tenant_id, period, analyte);



--
-- Name: idx_lab_qc_results_test_lot_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_qc_results_test_lot_date ON public.lab_qc_results USING btree (tenant_id, test_id, lot_id, run_date);



--
-- Name: idx_lab_reagent_lots_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_reagent_lots_expiry ON public.lab_reagent_lots USING btree (tenant_id, expiry_date);



--
-- Name: idx_lab_referral_doctors_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_referral_doctors_phone ON public.lab_referral_doctors USING btree (phone);



--
-- Name: idx_lab_referral_doctors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_referral_doctors_tenant ON public.lab_referral_doctors USING btree (tenant_id);



--
-- Name: idx_lab_referral_payouts_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_referral_payouts_doctor ON public.lab_referral_payouts USING btree (referral_doctor_id);



--
-- Name: idx_lab_referral_payouts_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_referral_payouts_period ON public.lab_referral_payouts USING btree (period_start, period_end);



--
-- Name: idx_lab_report_dispatches_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_report_dispatches_order ON public.lab_report_dispatches USING btree (tenant_id, order_id);



--
-- Name: idx_lab_results_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_results_order ON public.lab_results USING btree (order_id);



--
-- Name: idx_lab_sample_archive_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_archive_barcode ON public.lab_sample_archive USING btree (tenant_id, sample_barcode);



--
-- Name: idx_lab_sample_archive_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_archive_tenant_status ON public.lab_sample_archive USING btree (tenant_id, status);



--
-- Name: idx_lab_sample_rejections_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_rejections_order ON public.lab_sample_rejections USING btree (order_id);



--
-- Name: idx_lab_sample_rejections_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_rejections_tenant ON public.lab_sample_rejections USING btree (tenant_id);



--
-- Name: idx_lab_sample_routes_dest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_routes_dest ON public.lab_sample_routes USING btree (dest_tenant_id);



--
-- Name: idx_lab_sample_routes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_routes_source ON public.lab_sample_routes USING btree (source_tenant_id);



--
-- Name: idx_lab_sample_routes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_sample_routes_status ON public.lab_sample_routes USING btree (status);



--
-- Name: idx_lab_test_catalog_loinc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_test_catalog_loinc ON public.lab_test_catalog USING btree (loinc_code) WHERE (loinc_code IS NOT NULL);



--
-- Name: idx_lab_test_catalog_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_test_catalog_tenant ON public.lab_test_catalog USING btree (tenant_id);



--
-- Name: idx_lab_test_panels_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_test_panels_tenant ON public.lab_test_panels USING btree (tenant_id);



--
-- Name: lab_orders audit_lab_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_lab_orders AFTER INSERT OR DELETE OR UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('lab');



--
-- Name: lab_results audit_lab_results; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_lab_results AFTER INSERT OR DELETE OR UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('lab');



--
-- Name: lab_outsourced_orders set_lab_outsourced_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_outsourced_orders_updated_at BEFORE UPDATE ON public.lab_outsourced_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_phlebotomy_queue set_lab_phlebotomy_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_phlebotomy_queue_updated_at BEFORE UPDATE ON public.lab_phlebotomy_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_reagent_lots set_lab_reagent_lots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_reagent_lots_updated_at BEFORE UPDATE ON public.lab_reagent_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_results set_lab_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lab_results_updated_at BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: critical_value_rules set_updated_at_critical_value_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_critical_value_rules BEFORE UPDATE ON public.critical_value_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_test_panels set_updated_at_lab_test_panels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_lab_test_panels BEFORE UPDATE ON public.lab_test_panels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_b2b_clients trg_lab_b2b_clients_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_clients_updated BEFORE UPDATE ON public.lab_b2b_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_b2b_rates trg_lab_b2b_rates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_b2b_rates_updated BEFORE UPDATE ON public.lab_b2b_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_collection_centers trg_lab_collection_centers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_collection_centers_updated BEFORE UPDATE ON public.lab_collection_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_cytology_reports trg_lab_cytology_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_cytology_reports_updated BEFORE UPDATE ON public.lab_cytology_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_eqas_results trg_lab_eqas_results_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_eqas_results_updated BEFORE UPDATE ON public.lab_eqas_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_histopath_reports trg_lab_histopath_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_histopath_reports_updated BEFORE UPDATE ON public.lab_histopath_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_home_collections trg_lab_home_collections_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_home_collections_updated BEFORE UPDATE ON public.lab_home_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_molecular_reports trg_lab_molecular_reports_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_molecular_reports_updated BEFORE UPDATE ON public.lab_molecular_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_nabl_documents trg_lab_nabl_documents_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_nabl_documents_updated BEFORE UPDATE ON public.lab_nabl_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_orders trg_lab_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_orders_updated_at BEFORE UPDATE ON public.lab_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_referral_doctors trg_lab_referral_doctors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_doctors_updated_at BEFORE UPDATE ON public.lab_referral_doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_referral_payouts trg_lab_referral_payouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_referral_payouts_updated_at BEFORE UPDATE ON public.lab_referral_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_report_templates trg_lab_report_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_report_templates_updated BEFORE UPDATE ON public.lab_report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_test_catalog trg_lab_test_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_test_catalog_updated_at BEFORE UPDATE ON public.lab_test_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lab_b2b_rates lab_b2b_rates_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.lab_b2b_clients(id);



--
-- Name: lab_b2b_rates lab_b2b_rates_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_b2b_rates
    ADD CONSTRAINT lab_b2b_rates_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_calibrations lab_calibrations_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_calibrations
    ADD CONSTRAINT lab_calibrations_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_critical_alerts lab_critical_alerts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_critical_alerts lab_critical_alerts_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_alerts
    ADD CONSTRAINT lab_critical_alerts_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.lab_results(id);



--
-- Name: lab_cytology_reports lab_cytology_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_cytology_reports
    ADD CONSTRAINT lab_cytology_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_eqas_results lab_eqas_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_eqas_results
    ADD CONSTRAINT lab_eqas_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_histopath_reports lab_histopath_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_histopath_reports
    ADD CONSTRAINT lab_histopath_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_home_collections lab_home_collections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_home_collections
    ADD CONSTRAINT lab_home_collections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_molecular_reports lab_molecular_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_molecular_reports
    ADD CONSTRAINT lab_molecular_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_orders lab_orders_collection_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_collection_center_id_fkey FOREIGN KEY (collection_center_id) REFERENCES public.lab_collection_centers(id);



--
-- Name: lab_orders lab_orders_parent_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_orders lab_orders_referral_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES public.lab_referral_doctors(id);



--
-- Name: lab_orders lab_orders_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_outsourced_orders lab_outsourced_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_outsourced_orders
    ADD CONSTRAINT lab_outsourced_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_panel_tests lab_panel_tests_panel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.lab_test_panels(id) ON DELETE CASCADE;



--
-- Name: lab_panel_tests lab_panel_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_panel_tests
    ADD CONSTRAINT lab_panel_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id) ON DELETE CASCADE;



--
-- Name: lab_phlebotomy_queue lab_phlebotomy_queue_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_phlebotomy_queue
    ADD CONSTRAINT lab_phlebotomy_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_proficiency_tests lab_proficiency_tests_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_proficiency_tests
    ADD CONSTRAINT lab_proficiency_tests_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_qc_results lab_qc_results_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lab_reagent_lots(id);



--
-- Name: lab_qc_results lab_qc_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_qc_results
    ADD CONSTRAINT lab_qc_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_reagent_lots lab_reagent_lots_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagent_lots
    ADD CONSTRAINT lab_reagent_lots_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_test_catalog(id);



--
-- Name: lab_referral_payouts lab_referral_payouts_referral_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_referral_payouts
    ADD CONSTRAINT lab_referral_payouts_referral_doctor_id_fkey FOREIGN KEY (referral_doctor_id) REFERENCES public.lab_referral_doctors(id);



--
-- Name: lab_report_dispatches lab_report_dispatches_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_report_dispatches
    ADD CONSTRAINT lab_report_dispatches_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_result_amendments lab_result_amendments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_result_amendments lab_result_amendments_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_amendments
    ADD CONSTRAINT lab_result_amendments_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.lab_results(id);



--
-- Name: lab_results lab_results_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_sample_archive lab_sample_archive_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_archive
    ADD CONSTRAINT lab_sample_archive_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: lab_sample_rejections lab_sample_rejections_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_sample_rejections
    ADD CONSTRAINT lab_sample_rejections_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.lab_orders(id);



--
-- Name: critical_value_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.critical_value_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: critical_value_rules critical_value_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY critical_value_rules_tenant ON public.critical_value_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_test_catalog dept_scope_lab_test_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_lab_test_catalog ON public.lab_test_catalog USING (public.check_department_access(department_id));



--
-- Name: histopath_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.histopath_results ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_b2b_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_b2b_clients ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_b2b_clients lab_b2b_clients_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_b2b_clients_tenant ON public.lab_b2b_clients USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_b2b_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_b2b_rates ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_b2b_rates lab_b2b_rates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_b2b_rates_tenant ON public.lab_b2b_rates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_calibrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_calibrations ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_collection_centers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_collection_centers ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_collection_centers lab_collection_centers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_collection_centers_tenant ON public.lab_collection_centers USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_critical_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_critical_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_cytology_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_cytology_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_cytology_reports lab_cytology_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_cytology_reports_tenant ON public.lab_cytology_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_eqas_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_eqas_results ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_eqas_results lab_eqas_results_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_eqas_results_tenant ON public.lab_eqas_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_histopath_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_histopath_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_histopath_reports lab_histopath_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_histopath_reports_tenant ON public.lab_histopath_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_home_collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_home_collections ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_home_collections lab_home_collections_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_home_collections_tenant ON public.lab_home_collections USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_molecular_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_molecular_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_molecular_reports lab_molecular_reports_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_molecular_reports_tenant ON public.lab_molecular_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_nabl_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_nabl_documents ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_nabl_documents lab_nabl_documents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_nabl_documents_tenant ON public.lab_nabl_documents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_outsourced_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_outsourced_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_panel_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_panel_tests ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_panel_tests lab_panel_tests_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_panel_tests_tenant_isolation ON public.lab_panel_tests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_phlebotomy_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_phlebotomy_queue ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_proficiency_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_proficiency_tests ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_proficiency_tests lab_proficiency_tests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_proficiency_tests_tenant ON public.lab_proficiency_tests USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_qc_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_qc_metrics ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_qc_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_qc_results ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_reagent_lots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_reagent_lots ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_referral_doctors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_referral_doctors ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_referral_doctors lab_referral_doctors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_referral_doctors_tenant ON public.lab_referral_doctors USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_referral_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_referral_payouts ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_referral_payouts lab_referral_payouts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_referral_payouts_tenant ON public.lab_referral_payouts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_report_dispatches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_report_dispatches ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_report_dispatches lab_report_dispatches_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_report_dispatches_tenant ON public.lab_report_dispatches USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_report_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_report_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_report_templates lab_report_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_report_templates_tenant ON public.lab_report_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_result_amendments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_result_amendments ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_sample_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_sample_archive ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_sample_archive lab_sample_archive_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_sample_archive_tenant ON public.lab_sample_archive USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: lab_sample_rejections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_sample_rejections ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_sample_rejections lab_sample_rejections_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_sample_rejections_tenant_isolation ON public.lab_sample_rejections USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_test_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_test_catalog ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_test_panels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_test_panels ENABLE ROW LEVEL SECURITY;


--
-- Name: lab_test_panels lab_test_panels_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_test_panels_tenant_isolation ON public.lab_test_panels USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: histopath_results tenant_isolation_histopath_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_histopath_results ON public.histopath_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_calibrations tenant_isolation_lab_calibrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_calibrations ON public.lab_calibrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_critical_alerts tenant_isolation_lab_critical_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_critical_alerts ON public.lab_critical_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_orders tenant_isolation_lab_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_orders ON public.lab_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_outsourced_orders tenant_isolation_lab_outsourced_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_outsourced_orders ON public.lab_outsourced_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_phlebotomy_queue tenant_isolation_lab_phlebotomy_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_phlebotomy_queue ON public.lab_phlebotomy_queue USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_qc_metrics tenant_isolation_lab_qc_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_qc_metrics ON public.lab_qc_metrics USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_qc_results tenant_isolation_lab_qc_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_qc_results ON public.lab_qc_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_reagent_lots tenant_isolation_lab_reagent_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_reagent_lots ON public.lab_reagent_lots USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_result_amendments tenant_isolation_lab_result_amendments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_result_amendments ON public.lab_result_amendments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_results tenant_isolation_lab_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_results ON public.lab_results USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lab_test_catalog tenant_isolation_lab_test_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_lab_test_catalog ON public.lab_test_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


