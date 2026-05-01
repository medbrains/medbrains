-- ============================================================
-- MedBrains schema — module: ipd
-- ============================================================

--
-- Name: admission_attenders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_attenders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    relationship text NOT NULL,
    name text NOT NULL,
    phone text,
    alt_phone text,
    address text,
    id_proof_type text,
    id_proof_number text,
    is_primary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: admission_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    item_label character varying(300) NOT NULL,
    category character varying(100),
    is_completed boolean DEFAULT false NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: admissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    bed_id uuid,
    admitting_doctor uuid NOT NULL,
    status public.admission_status DEFAULT 'admitted'::public.admission_status NOT NULL,
    admitted_at timestamp with time zone DEFAULT now() NOT NULL,
    discharged_at timestamp with time zone,
    discharge_type public.discharge_type,
    discharge_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    provisional_diagnosis text,
    comorbidities jsonb DEFAULT '[]'::jsonb NOT NULL,
    estimated_los_days integer,
    deposit_amount numeric(12,2),
    deposit_paid boolean DEFAULT false NOT NULL,
    priority character varying(20) DEFAULT 'routine'::character varying NOT NULL,
    admission_source public.admission_source DEFAULT 'direct'::public.admission_source,
    referral_from text,
    referral_doctor text,
    referral_notes text,
    admission_weight_kg numeric(6,2),
    admission_height_cm numeric(6,2),
    expected_discharge_date date,
    ward_id uuid,
    mlc_case_id uuid,
    ip_type public.ip_type,
    estimated_cost numeric(12,2),
    is_critical boolean DEFAULT false NOT NULL,
    isolation_required boolean DEFAULT false NOT NULL,
    isolation_reason text,
    primary_nurse_id uuid
);



--
-- Name: bed_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bed_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bed_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    reserved_by uuid NOT NULL,
    status public.bed_reservation_status DEFAULT 'active'::public.bed_reservation_status NOT NULL,
    reserved_from timestamp with time zone DEFAULT now() NOT NULL,
    reserved_until timestamp with time zone NOT NULL,
    purpose character varying(200),
    notes text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bed_turnaround_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bed_turnaround_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bed_id uuid NOT NULL,
    admission_id uuid,
    vacated_at timestamp with time zone DEFAULT now() NOT NULL,
    cleaning_started_at timestamp with time zone,
    cleaning_completed_at timestamp with time zone,
    ready_at timestamp with time zone,
    turnaround_minutes integer,
    cleaned_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bed_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bed_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    daily_rate numeric(10,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: beds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bed_number text,
    ward_id uuid,
    is_occupied boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.beds FORCE ROW LEVEL SECURITY;



--
-- Name: discharge_barriers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discharge_barriers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    case_assignment_id uuid NOT NULL,
    barrier_type public.discharge_barrier_type NOT NULL,
    description text NOT NULL,
    identified_date date DEFAULT CURRENT_DATE NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_date date,
    resolved_by uuid,
    escalated_to text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: discharge_summary_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discharge_summary_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: dnr_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dnr_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    status public.dnr_status DEFAULT 'active'::public.dnr_status NOT NULL,
    scope text NOT NULL,
    authorized_by uuid NOT NULL,
    witness_name text,
    review_due_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revocation_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fall_risk_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fall_risk_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    scale text NOT NULL,
    score integer NOT NULL,
    risk_level text NOT NULL,
    interventions jsonb DEFAULT '[]'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    admission_id uuid,
    CONSTRAINT fall_risk_assessments_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT fall_risk_assessments_scale_check CHECK ((scale = ANY (ARRAY['morse'::text, 'hendrich'::text, 'stratify'::text]))),
    CONSTRAINT fall_risk_assessments_score_check CHECK ((score >= 0))
);

ALTER TABLE ONLY public.fall_risk_assessments FORCE ROW LEVEL SECURITY;



--
-- Name: intake_output_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intake_output_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    category text NOT NULL,
    direction text NOT NULL,
    volume_ml integer NOT NULL,
    notes text,
    CONSTRAINT intake_output_entries_category_check CHECK ((category = ANY (ARRAY['oral'::text, 'iv'::text, 'tube'::text, 'blood'::text, 'tpn'::text, 'urine'::text, 'stool'::text, 'emesis'::text, 'drain'::text, 'other'::text]))),
    CONSTRAINT intake_output_entries_direction_check CHECK ((direction = ANY (ARRAY['intake'::text, 'output'::text]))),
    CONSTRAINT intake_output_entries_volume_ml_check CHECK ((volume_ml > 0))
);

ALTER TABLE ONLY public.intake_output_entries FORCE ROW LEVEL SECURITY;



--
-- Name: ip_type_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_type_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ip_type public.ip_type NOT NULL,
    label character varying(100) NOT NULL,
    daily_rate numeric(10,2) DEFAULT 0 NOT NULL,
    nursing_charge numeric(10,2) DEFAULT 0 NOT NULL,
    deposit_required numeric(10,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_alert_threshold numeric(12,2),
    auto_billing_enabled boolean DEFAULT false NOT NULL
);



--
-- Name: ipd_birth_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_birth_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    mother_patient_id uuid NOT NULL,
    baby_patient_id uuid,
    date_of_birth date NOT NULL,
    time_of_birth time without time zone NOT NULL,
    gender character varying(20) NOT NULL,
    weight_grams numeric(7,1),
    length_cm numeric(5,1),
    head_circumference_cm numeric(5,1),
    apgar_1min integer,
    apgar_5min integer,
    delivery_type character varying(100),
    is_live_birth boolean DEFAULT true NOT NULL,
    birth_certificate_number character varying(100),
    complications text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_care_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_care_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    nursing_diagnosis text NOT NULL,
    goals text,
    interventions jsonb DEFAULT '[]'::jsonb NOT NULL,
    evaluation text,
    status public.care_plan_status DEFAULT 'active'::public.care_plan_status NOT NULL,
    initiated_by uuid NOT NULL,
    initiated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_clinical_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_clinical_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    assessment_type public.clinical_assessment_type NOT NULL,
    score_value numeric(8,2),
    risk_level character varying(20),
    score_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_clinical_documentations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_clinical_documentations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doc_type public.ipd_clinical_doc_type NOT NULL,
    title character varying(300) NOT NULL,
    body jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_by uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    next_review_at timestamp with time zone,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_death_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_death_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    date_of_death date NOT NULL,
    time_of_death time without time zone NOT NULL,
    cause_of_death_primary text NOT NULL,
    cause_of_death_secondary text,
    cause_of_death_tertiary text,
    cause_of_death_underlying text,
    manner_of_death character varying(100),
    duration_of_illness text,
    autopsy_requested boolean DEFAULT false NOT NULL,
    is_medico_legal boolean DEFAULT false NOT NULL,
    form_type public.death_cert_form_type DEFAULT 'form_4'::public.death_cert_form_type NOT NULL,
    certifying_doctor_id uuid,
    witness_name character varying(200),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_discharge_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_discharge_checklists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    item_code character varying(50) NOT NULL,
    item_label text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_discharge_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_discharge_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    template_id uuid,
    status public.discharge_summary_status DEFAULT 'draft'::public.discharge_summary_status NOT NULL,
    final_diagnosis text,
    condition_at_discharge text,
    course_in_hospital text,
    treatment_given text,
    procedures_performed jsonb DEFAULT '[]'::jsonb NOT NULL,
    investigation_summary text,
    medications_on_discharge jsonb DEFAULT '[]'::jsonb NOT NULL,
    follow_up_instructions text,
    follow_up_date date,
    dietary_advice text,
    activity_restrictions text,
    warning_signs text,
    emergency_contact_info text,
    prepared_by uuid,
    verified_by uuid,
    finalized_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_discharge_tat_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_discharge_tat_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    discharge_initiated_at timestamp with time zone,
    billing_cleared_at timestamp with time zone,
    pharmacy_cleared_at timestamp with time zone,
    nursing_cleared_at timestamp with time zone,
    doctor_cleared_at timestamp with time zone,
    discharge_completed_at timestamp with time zone,
    total_tat_minutes integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_handover_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_handover_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    shift public.nursing_shift NOT NULL,
    handover_date date DEFAULT CURRENT_DATE NOT NULL,
    outgoing_nurse uuid NOT NULL,
    incoming_nurse uuid NOT NULL,
    identification text,
    situation text,
    background text,
    assessment text,
    recommendation text,
    pending_tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_intake_output; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_intake_output (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    is_intake boolean NOT NULL,
    category character varying(50) NOT NULL,
    volume_ml numeric(10,2) NOT NULL,
    description text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    shift public.nursing_shift NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_medication_administration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_medication_administration (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    prescription_item_id uuid,
    drug_name text NOT NULL,
    dose text NOT NULL,
    route character varying(30) NOT NULL,
    frequency character varying(50),
    scheduled_at timestamp with time zone NOT NULL,
    administered_at timestamp with time zone,
    status public.mar_status DEFAULT 'scheduled'::public.mar_status NOT NULL,
    administered_by uuid,
    witnessed_by uuid,
    barcode_verified boolean DEFAULT false NOT NULL,
    is_high_alert boolean DEFAULT false NOT NULL,
    hold_reason text,
    refused_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prn_reason text,
    missed_reason text,
    double_checked_by uuid
);



--
-- Name: ipd_nursing_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_nursing_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    general_appearance jsonb DEFAULT '{}'::jsonb NOT NULL,
    skin_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    pain_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    nutritional_status jsonb DEFAULT '{}'::jsonb NOT NULL,
    elimination_status jsonb DEFAULT '{}'::jsonb NOT NULL,
    respiratory_status jsonb DEFAULT '{}'::jsonb NOT NULL,
    psychosocial_status jsonb DEFAULT '{}'::jsonb NOT NULL,
    fall_risk_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    allergies text,
    medications_on_admission text,
    personal_belongings jsonb DEFAULT '[]'::jsonb NOT NULL,
    patient_education_needs text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_progress_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_progress_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    encounter_id uuid,
    note_type public.progress_note_type NOT NULL,
    author_id uuid NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    is_addendum boolean DEFAULT false NOT NULL,
    parent_note_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ipd_transfer_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ipd_transfer_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    transfer_type public.transfer_type NOT NULL,
    from_ward_id uuid,
    to_ward_id uuid,
    from_bed_id uuid,
    to_bed_id uuid,
    reason text,
    clinical_summary text,
    transferred_by uuid NOT NULL,
    transferred_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: newborn_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newborn_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    labor_id uuid NOT NULL,
    birth_date timestamp with time zone NOT NULL,
    gender text NOT NULL,
    weight_gm integer NOT NULL,
    length_cm numeric(5,2),
    head_circumference_cm numeric(5,2),
    apgar_1min integer,
    apgar_5min integer,
    apgar_10min integer,
    resuscitation_needed boolean DEFAULT false NOT NULL,
    bcg_given boolean DEFAULT false NOT NULL,
    opv_given boolean DEFAULT false NOT NULL,
    hep_b_given boolean DEFAULT false NOT NULL,
    vitamin_k_given boolean DEFAULT false NOT NULL,
    nicu_admission_needed boolean DEFAULT false NOT NULL,
    nicu_admission_reason text,
    birth_certificate_number text,
    congenital_anomalies text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mother_id uuid
);



--
-- Name: pain_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    pain_score integer NOT NULL,
    pain_location text,
    pain_character text,
    who_ladder_step integer,
    opioid_dose_morphine_eq numeric(8,2),
    breakthrough_doses integer DEFAULT 0 NOT NULL,
    current_medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pain_score_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pain_score_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    scale text NOT NULL,
    score integer NOT NULL,
    location text,
    "character" text,
    intervention_taken text,
    recheck_due_at timestamp with time zone,
    notes text,
    CONSTRAINT pain_score_entries_scale_check CHECK ((scale = ANY (ARRAY['numeric'::text, 'wong_baker'::text, 'flacc'::text, 'bps'::text, 'cpot'::text, 'comfort'::text]))),
    CONSTRAINT pain_score_entries_score_check CHECK (((score >= 0) AND (score <= 30)))
);

ALTER TABLE ONLY public.pain_score_entries FORCE ROW LEVEL SECURITY;



--
-- Name: restraint_documentation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restraint_documentation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    form_number text,
    patient_id uuid NOT NULL,
    admission_id uuid,
    ward_id uuid,
    diagnosis text,
    restraint_type text,
    restraint_device text,
    indication text,
    start_datetime timestamp with time zone,
    planned_duration text,
    actual_end timestamp with time zone,
    ordering_physician_id uuid,
    physician_assessment text,
    patient_condition_on_release text,
    family_notified boolean DEFAULT false NOT NULL,
    family_notification_datetime timestamp with time zone,
    patient_rights_explained boolean DEFAULT false NOT NULL,
    consent_obtained boolean DEFAULT false NOT NULL,
    consent_from text,
    review_by_psychiatrist boolean DEFAULT false NOT NULL,
    psychiatrist_id uuid,
    mhca_compliance_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.restraint_documentation FORCE ROW LEVEL SECURITY;



--
-- Name: restraint_monitoring_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restraint_monitoring_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    restraint_order_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    monitored_at timestamp with time zone DEFAULT now() NOT NULL,
    monitored_by uuid NOT NULL,
    skin_intact boolean NOT NULL,
    circulation_normal boolean NOT NULL,
    distress_observed boolean DEFAULT false NOT NULL,
    continue_restraint boolean NOT NULL,
    witness_user_id uuid,
    notes text
);

ALTER TABLE ONLY public.restraint_monitoring_events FORCE ROW LEVEL SECURITY;



--
-- Name: restraint_monitoring_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restraint_monitoring_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    clinical_doc_id uuid NOT NULL,
    check_time timestamp with time zone DEFAULT now() NOT NULL,
    status public.restraint_check_status NOT NULL,
    circulation_status text,
    skin_status text,
    patient_response text,
    checked_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: room_turnarounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_turnarounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    patient_id uuid,
    discharge_at timestamp with time zone,
    dirty_at timestamp with time zone,
    cleaning_started_at timestamp with time zone,
    cleaning_completed_at timestamp with time zone,
    ready_at timestamp with time zone,
    turnaround_minutes integer,
    cleaned_by text,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ward_bed_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ward_bed_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ward_id uuid NOT NULL,
    bed_location_id uuid NOT NULL,
    bed_type_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: wards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    department_id uuid,
    ward_type text DEFAULT 'general'::text NOT NULL,
    total_beds integer DEFAULT 0 NOT NULL,
    gender_restriction text DEFAULT 'any'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: wound_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wound_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    body_site text NOT NULL,
    classification text,
    stage text,
    length_cm numeric(6,2),
    width_cm numeric(6,2),
    depth_cm numeric(6,2),
    exudate text,
    odor text,
    photo_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    dressing_type text,
    dressing_changed_at timestamp with time zone,
    dressing_change_due_at timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    notes text
);

ALTER TABLE ONLY public.wound_assessments FORCE ROW LEVEL SECURITY;



--
-- Name: admission_attenders admission_attenders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_attenders
    ADD CONSTRAINT admission_attenders_pkey PRIMARY KEY (id);



--
-- Name: admission_checklists admission_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_pkey PRIMARY KEY (id);



--
-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (id);



--
-- Name: bed_reservations bed_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_pkey PRIMARY KEY (id);



--
-- Name: bed_turnaround_log bed_turnaround_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_pkey PRIMARY KEY (id);



--
-- Name: bed_types bed_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_types
    ADD CONSTRAINT bed_types_pkey PRIMARY KEY (id);



--
-- Name: bed_types bed_types_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_types
    ADD CONSTRAINT bed_types_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (id);



--
-- Name: discharge_barriers discharge_barriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_barriers
    ADD CONSTRAINT discharge_barriers_pkey PRIMARY KEY (id);



--
-- Name: discharge_summary_templates discharge_summary_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summary_templates
    ADD CONSTRAINT discharge_summary_templates_pkey PRIMARY KEY (id);



--
-- Name: discharge_summary_templates discharge_summary_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summary_templates
    ADD CONSTRAINT discharge_summary_templates_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: dnr_orders dnr_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_pkey PRIMARY KEY (id);



--
-- Name: fall_risk_assessments fall_risk_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_risk_assessments
    ADD CONSTRAINT fall_risk_assessments_pkey PRIMARY KEY (id);



--
-- Name: intake_output_entries intake_output_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_output_entries
    ADD CONSTRAINT intake_output_entries_pkey PRIMARY KEY (id);



--
-- Name: ip_type_configurations ip_type_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_type_configurations
    ADD CONSTRAINT ip_type_configurations_pkey PRIMARY KEY (id);



--
-- Name: ip_type_configurations ip_type_configurations_tenant_id_ip_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_type_configurations
    ADD CONSTRAINT ip_type_configurations_tenant_id_ip_type_key UNIQUE (tenant_id, ip_type);



--
-- Name: ipd_birth_records ipd_birth_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_pkey PRIMARY KEY (id);



--
-- Name: ipd_care_plans ipd_care_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_pkey PRIMARY KEY (id);



--
-- Name: ipd_clinical_assessments ipd_clinical_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_pkey PRIMARY KEY (id);



--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_pkey PRIMARY KEY (id);



--
-- Name: ipd_death_summaries ipd_death_summaries_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_admission_id_key UNIQUE (admission_id);



--
-- Name: ipd_death_summaries ipd_death_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_pkey PRIMARY KEY (id);



--
-- Name: ipd_discharge_checklists ipd_discharge_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_pkey PRIMARY KEY (id);



--
-- Name: ipd_discharge_checklists ipd_discharge_checklists_tenant_id_admission_id_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_tenant_id_admission_id_item_code_key UNIQUE (tenant_id, admission_id, item_code);



--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_admission_id_key UNIQUE (admission_id);



--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_pkey PRIMARY KEY (id);



--
-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_admission_id_key UNIQUE (admission_id);



--
-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_pkey PRIMARY KEY (id);



--
-- Name: ipd_handover_reports ipd_handover_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_pkey PRIMARY KEY (id);



--
-- Name: ipd_intake_output ipd_intake_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_pkey PRIMARY KEY (id);



--
-- Name: ipd_medication_administration ipd_medication_administration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_pkey PRIMARY KEY (id);



--
-- Name: ipd_nursing_assessments ipd_nursing_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_pkey PRIMARY KEY (id);



--
-- Name: ipd_progress_notes ipd_progress_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_pkey PRIMARY KEY (id);



--
-- Name: ipd_transfer_logs ipd_transfer_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_pkey PRIMARY KEY (id);



--
-- Name: newborn_records newborn_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newborn_records
    ADD CONSTRAINT newborn_records_pkey PRIMARY KEY (id);



--
-- Name: pain_assessments pain_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_assessments
    ADD CONSTRAINT pain_assessments_pkey PRIMARY KEY (id);



--
-- Name: pain_score_entries pain_score_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_score_entries
    ADD CONSTRAINT pain_score_entries_pkey PRIMARY KEY (id);



--
-- Name: restraint_documentation restraint_documentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_documentation
    ADD CONSTRAINT restraint_documentation_pkey PRIMARY KEY (id);



--
-- Name: restraint_monitoring_events restraint_monitoring_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_events
    ADD CONSTRAINT restraint_monitoring_events_pkey PRIMARY KEY (id);



--
-- Name: restraint_monitoring_logs restraint_monitoring_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_pkey PRIMARY KEY (id);



--
-- Name: room_turnarounds room_turnarounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_pkey PRIMARY KEY (id);



--
-- Name: ward_bed_mappings ward_bed_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_pkey PRIMARY KEY (id);



--
-- Name: ward_bed_mappings ward_bed_mappings_tenant_id_bed_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_tenant_id_bed_location_id_key UNIQUE (tenant_id, bed_location_id);



--
-- Name: wards wards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_pkey PRIMARY KEY (id);



--
-- Name: wards wards_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: wound_assessments wound_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wound_assessments
    ADD CONSTRAINT wound_assessments_pkey PRIMARY KEY (id);



--
-- Name: fall_risk_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fall_risk_encounter_idx ON public.fall_risk_assessments USING btree (tenant_id, encounter_id, recorded_at DESC);



--
-- Name: idx_admission_attenders_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_attenders_admission ON public.admission_attenders USING btree (admission_id);



--
-- Name: idx_admission_checklists_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admission_checklists_admission ON public.admission_checklists USING btree (admission_id);



--
-- Name: idx_admissions_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_bed ON public.admissions USING btree (bed_id);



--
-- Name: idx_admissions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_created_by ON public.admissions USING btree (created_by);



--
-- Name: idx_admissions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_patient ON public.admissions USING btree (patient_id);



--
-- Name: idx_admissions_primary_nurse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_primary_nurse ON public.admissions USING btree (tenant_id, primary_nurse_id) WHERE ((status = 'admitted'::public.admission_status) AND (primary_nurse_id IS NOT NULL));



--
-- Name: idx_admissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_status ON public.admissions USING btree (tenant_id, status);



--
-- Name: idx_admissions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_tenant ON public.admissions USING btree (tenant_id);



--
-- Name: idx_admissions_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_ward ON public.admissions USING btree (ward_id);



--
-- Name: idx_bed_reservations_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_reservations_bed ON public.bed_reservations USING btree (bed_id, status);



--
-- Name: idx_bed_reservations_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_reservations_patient ON public.bed_reservations USING btree (patient_id);



--
-- Name: idx_bed_turnaround_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_turnaround_bed ON public.bed_turnaround_log USING btree (bed_id);



--
-- Name: idx_bed_types_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bed_types_tenant ON public.bed_types USING btree (tenant_id);



--
-- Name: idx_beds_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beds_ward ON public.beds USING btree (tenant_id, ward_id);



--
-- Name: idx_discharge_barriers_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discharge_barriers_case ON public.discharge_barriers USING btree (tenant_id, case_assignment_id, is_resolved);



--
-- Name: idx_dnr_orders_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dnr_orders_active ON public.dnr_orders USING btree (tenant_id, status) WHERE (status = 'active'::public.dnr_status);



--
-- Name: idx_dnr_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dnr_orders_patient ON public.dnr_orders USING btree (tenant_id, patient_id);



--
-- Name: idx_dnr_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dnr_orders_tenant ON public.dnr_orders USING btree (tenant_id);



--
-- Name: idx_ipd_birth_records_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_birth_records_admission ON public.ipd_birth_records USING btree (admission_id);



--
-- Name: idx_ipd_care_plans_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_care_plans_admission ON public.ipd_care_plans USING btree (admission_id);



--
-- Name: idx_ipd_care_plans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_care_plans_status ON public.ipd_care_plans USING btree (admission_id, status);



--
-- Name: idx_ipd_care_plans_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_care_plans_tenant ON public.ipd_care_plans USING btree (tenant_id);



--
-- Name: idx_ipd_clinical_assessments_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_clinical_assessments_admission ON public.ipd_clinical_assessments USING btree (admission_id);



--
-- Name: idx_ipd_clinical_assessments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_clinical_assessments_tenant ON public.ipd_clinical_assessments USING btree (tenant_id);



--
-- Name: idx_ipd_clinical_assessments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_clinical_assessments_type ON public.ipd_clinical_assessments USING btree (admission_id, assessment_type);



--
-- Name: idx_ipd_clinical_docs_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_clinical_docs_admission ON public.ipd_clinical_documentations USING btree (admission_id);



--
-- Name: idx_ipd_clinical_docs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_clinical_docs_type ON public.ipd_clinical_documentations USING btree (admission_id, doc_type);



--
-- Name: idx_ipd_death_summaries_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_death_summaries_admission ON public.ipd_death_summaries USING btree (admission_id);



--
-- Name: idx_ipd_discharge_cl_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_discharge_cl_admission ON public.ipd_discharge_checklists USING btree (admission_id);



--
-- Name: idx_ipd_discharge_cl_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_discharge_cl_tenant ON public.ipd_discharge_checklists USING btree (tenant_id);



--
-- Name: idx_ipd_discharge_summaries_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_discharge_summaries_admission ON public.ipd_discharge_summaries USING btree (admission_id);



--
-- Name: idx_ipd_discharge_tat_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_discharge_tat_admission ON public.ipd_discharge_tat_log USING btree (admission_id);



--
-- Name: idx_ipd_handover_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_handover_admission ON public.ipd_handover_reports USING btree (admission_id);



--
-- Name: idx_ipd_handover_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_handover_date ON public.ipd_handover_reports USING btree (admission_id, handover_date DESC);



--
-- Name: idx_ipd_handover_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_handover_tenant ON public.ipd_handover_reports USING btree (tenant_id);



--
-- Name: idx_ipd_io_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_io_admission ON public.ipd_intake_output USING btree (admission_id);



--
-- Name: idx_ipd_io_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_io_recorded ON public.ipd_intake_output USING btree (admission_id, recorded_at);



--
-- Name: idx_ipd_io_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_io_shift ON public.ipd_intake_output USING btree (admission_id, shift);



--
-- Name: idx_ipd_io_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_io_tenant ON public.ipd_intake_output USING btree (tenant_id);



--
-- Name: idx_ipd_mar_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_mar_admission ON public.ipd_medication_administration USING btree (admission_id);



--
-- Name: idx_ipd_mar_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_mar_scheduled ON public.ipd_medication_administration USING btree (admission_id, scheduled_at);



--
-- Name: idx_ipd_mar_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_mar_status ON public.ipd_medication_administration USING btree (admission_id, status);



--
-- Name: idx_ipd_mar_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_mar_tenant ON public.ipd_medication_administration USING btree (tenant_id);



--
-- Name: idx_ipd_nursing_assess_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_nursing_assess_admission ON public.ipd_nursing_assessments USING btree (admission_id);



--
-- Name: idx_ipd_nursing_assess_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_nursing_assess_tenant ON public.ipd_nursing_assessments USING btree (tenant_id);



--
-- Name: idx_ipd_progress_notes_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_progress_notes_admission ON public.ipd_progress_notes USING btree (admission_id);



--
-- Name: idx_ipd_progress_notes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_progress_notes_date ON public.ipd_progress_notes USING btree (admission_id, note_date DESC);



--
-- Name: idx_ipd_progress_notes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_progress_notes_tenant ON public.ipd_progress_notes USING btree (tenant_id);



--
-- Name: idx_ipd_transfers_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ipd_transfers_admission ON public.ipd_transfer_logs USING btree (admission_id);



--
-- Name: idx_mar_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mar_pending ON public.ipd_medication_administration USING btree (tenant_id, admission_id, scheduled_at) WHERE (status = 'scheduled'::public.mar_status);



--
-- Name: idx_newborn_records_labor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newborn_records_labor ON public.newborn_records USING btree (labor_id);



--
-- Name: idx_newborn_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newborn_records_tenant ON public.newborn_records USING btree (tenant_id);



--
-- Name: idx_pain_assessments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pain_assessments_patient ON public.pain_assessments USING btree (tenant_id, patient_id);



--
-- Name: idx_pain_assessments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pain_assessments_tenant ON public.pain_assessments USING btree (tenant_id);



--
-- Name: idx_restraint_doc_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restraint_doc_patient ON public.restraint_documentation USING btree (tenant_id, patient_id, start_datetime DESC);



--
-- Name: idx_restraint_logs_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restraint_logs_doc ON public.restraint_monitoring_logs USING btree (clinical_doc_id);



--
-- Name: idx_room_turnarounds_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_turnarounds_tenant ON public.room_turnarounds USING btree (tenant_id);



--
-- Name: idx_ward_bed_mappings_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ward_bed_mappings_ward ON public.ward_bed_mappings USING btree (ward_id);



--
-- Name: io_entries_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX io_entries_encounter_idx ON public.intake_output_entries USING btree (tenant_id, encounter_id, recorded_at DESC);



--
-- Name: pain_score_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pain_score_encounter_idx ON public.pain_score_entries USING btree (tenant_id, encounter_id, recorded_at DESC);



--
-- Name: restraint_monitoring_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restraint_monitoring_idx ON public.restraint_monitoring_events USING btree (tenant_id, restraint_order_id, monitored_at DESC);



--
-- Name: wound_assessments_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wound_assessments_encounter_idx ON public.wound_assessments USING btree (tenant_id, encounter_id, recorded_at DESC);



--
-- Name: admissions audit_admissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_admissions AFTER INSERT OR DELETE OR UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('ipd');



--
-- Name: room_turnarounds set_room_turnarounds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_room_turnarounds_updated_at BEFORE UPDATE ON public.room_turnarounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: admission_checklists set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admission_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bed_reservations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bed_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: discharge_summary_templates set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.discharge_summary_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ip_type_configurations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ip_type_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_birth_records set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_birth_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_clinical_documentations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_clinical_documentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_death_summaries set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_death_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_discharge_summaries set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_discharge_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_discharge_tat_log set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_discharge_tat_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: wards set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.wards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: discharge_barriers set_updated_at_discharge_barriers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_discharge_barriers BEFORE UPDATE ON public.discharge_barriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: admissions trg_admissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admissions_updated_at BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bed_types trg_bed_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_types_updated_at BEFORE UPDATE ON public.bed_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: dnr_orders trg_dnr_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dnr_orders_updated_at BEFORE UPDATE ON public.dnr_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_care_plans trg_ipd_care_plans_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_care_plans_updated BEFORE UPDATE ON public.ipd_care_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_clinical_assessments trg_ipd_clinical_assessments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_clinical_assessments_updated BEFORE UPDATE ON public.ipd_clinical_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_discharge_checklists trg_ipd_discharge_cl_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_cl_updated BEFORE UPDATE ON public.ipd_discharge_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_handover_reports trg_ipd_handover_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_handover_updated BEFORE UPDATE ON public.ipd_handover_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_medication_administration trg_ipd_mar_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_mar_updated BEFORE UPDATE ON public.ipd_medication_administration FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_nursing_assessments trg_ipd_nursing_assess_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_nursing_assess_updated BEFORE UPDATE ON public.ipd_nursing_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ipd_progress_notes trg_ipd_progress_notes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_progress_notes_updated BEFORE UPDATE ON public.ipd_progress_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: newborn_records trg_newborn_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_newborn_records_updated_at BEFORE UPDATE ON public.newborn_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pain_assessments trg_pain_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pain_assessments_updated_at BEFORE UPDATE ON public.pain_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: admission_attenders admission_attenders_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_attenders
    ADD CONSTRAINT admission_attenders_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: admission_checklists admission_checklists_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: admissions admissions_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id);



--
-- Name: bed_turnaround_log bed_turnaround_log_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_birth_records ipd_birth_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_care_plans ipd_care_plans_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_clinical_assessments ipd_clinical_assessments_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_clinical_documentations ipd_clinical_documentations_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_death_summaries ipd_death_summaries_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_discharge_checklists ipd_discharge_checklists_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_discharge_summaries ipd_discharge_summaries_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.discharge_summary_templates(id);



--
-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_handover_reports ipd_handover_reports_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_intake_output ipd_intake_output_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_medication_administration ipd_medication_administration_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_nursing_assessments ipd_nursing_assessments_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_progress_notes ipd_progress_notes_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_progress_notes ipd_progress_notes_parent_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_parent_note_id_fkey FOREIGN KEY (parent_note_id) REFERENCES public.ipd_progress_notes(id);



--
-- Name: ipd_transfer_logs ipd_transfer_logs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: ipd_transfer_logs ipd_transfer_logs_from_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_from_ward_id_fkey FOREIGN KEY (from_ward_id) REFERENCES public.wards(id);



--
-- Name: ipd_transfer_logs ipd_transfer_logs_to_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_to_ward_id_fkey FOREIGN KEY (to_ward_id) REFERENCES public.wards(id);



--
-- Name: restraint_monitoring_logs restraint_monitoring_logs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);



--
-- Name: restraint_monitoring_logs restraint_monitoring_logs_clinical_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_clinical_doc_id_fkey FOREIGN KEY (clinical_doc_id) REFERENCES public.ipd_clinical_documentations(id);



--
-- Name: ward_bed_mappings ward_bed_mappings_bed_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_bed_type_id_fkey FOREIGN KEY (bed_type_id) REFERENCES public.bed_types(id);



--
-- Name: ward_bed_mappings ward_bed_mappings_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id) ON DELETE CASCADE;



--
-- Name: admission_attenders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admission_attenders ENABLE ROW LEVEL SECURITY;


--
-- Name: admission_checklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admission_checklists ENABLE ROW LEVEL SECURITY;


--
-- Name: admissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;


--
-- Name: bed_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bed_reservations ENABLE ROW LEVEL SECURITY;


--
-- Name: bed_turnaround_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bed_turnaround_log ENABLE ROW LEVEL SECURITY;


--
-- Name: bed_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bed_types ENABLE ROW LEVEL SECURITY;


--
-- Name: bed_types bed_types_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bed_types_tenant_isolation ON public.bed_types USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: beds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;


--
-- Name: discharge_barriers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discharge_barriers ENABLE ROW LEVEL SECURITY;


--
-- Name: discharge_summary_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discharge_summary_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: dnr_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dnr_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: fall_risk_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fall_risk_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: intake_output_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intake_output_entries ENABLE ROW LEVEL SECURITY;


--
-- Name: ip_type_configurations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ip_type_configurations ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_birth_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_birth_records ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_care_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_care_plans ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_clinical_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_clinical_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_clinical_documentations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_clinical_documentations ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_death_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_death_summaries ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_discharge_checklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_discharge_checklists ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_discharge_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_discharge_summaries ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_discharge_tat_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_discharge_tat_log ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_handover_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_handover_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_intake_output; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_intake_output ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_medication_administration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_medication_administration ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_nursing_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_nursing_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_progress_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_progress_notes ENABLE ROW LEVEL SECURITY;


--
-- Name: ipd_transfer_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ipd_transfer_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: newborn_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newborn_records ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: pain_score_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pain_score_entries ENABLE ROW LEVEL SECURITY;


--
-- Name: restraint_documentation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restraint_documentation ENABLE ROW LEVEL SECURITY;


--
-- Name: restraint_monitoring_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restraint_monitoring_events ENABLE ROW LEVEL SECURITY;


--
-- Name: restraint_monitoring_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restraint_monitoring_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: room_turnarounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_turnarounds ENABLE ROW LEVEL SECURITY;


--
-- Name: admission_attenders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.admission_attenders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: admission_checklists tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.admission_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bed_reservations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bed_reservations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bed_turnaround_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bed_turnaround_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: discharge_barriers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discharge_barriers USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: discharge_summary_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discharge_summary_templates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: dnr_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dnr_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ip_type_configurations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ip_type_configurations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_birth_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_birth_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_clinical_documentations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_clinical_documentations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_death_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_death_summaries USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_discharge_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_discharge_summaries USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_discharge_tat_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_discharge_tat_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_transfer_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_transfer_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: newborn_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.newborn_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pain_assessments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pain_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: restraint_monitoring_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.restraint_monitoring_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: room_turnarounds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.room_turnarounds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: ward_bed_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ward_bed_mappings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: wards tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.wards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: admissions tenant_isolation_admissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_admissions ON public.admissions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: beds tenant_isolation_beds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_beds ON public.beds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: fall_risk_assessments tenant_isolation_fall_risk_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fall_risk_assessments ON public.fall_risk_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: intake_output_entries tenant_isolation_intake_output_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_intake_output_entries ON public.intake_output_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: ipd_care_plans tenant_isolation_ipd_care_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_care_plans ON public.ipd_care_plans USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_clinical_assessments tenant_isolation_ipd_clinical_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_clinical_assessments ON public.ipd_clinical_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_discharge_checklists tenant_isolation_ipd_discharge_cl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_discharge_cl ON public.ipd_discharge_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_handover_reports tenant_isolation_ipd_handover; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_handover ON public.ipd_handover_reports USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_intake_output tenant_isolation_ipd_io; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_io ON public.ipd_intake_output USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_medication_administration tenant_isolation_ipd_mar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_mar ON public.ipd_medication_administration USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_nursing_assessments tenant_isolation_ipd_nursing_assess; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_nursing_assess ON public.ipd_nursing_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ipd_progress_notes tenant_isolation_ipd_progress_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_progress_notes ON public.ipd_progress_notes USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pain_score_entries tenant_isolation_pain_score_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pain_score_entries ON public.pain_score_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: restraint_documentation tenant_isolation_restraint_documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_restraint_documentation ON public.restraint_documentation USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: restraint_monitoring_events tenant_isolation_restraint_monitoring_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_restraint_monitoring_events ON public.restraint_monitoring_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: wound_assessments tenant_isolation_wound_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_wound_assessments ON public.wound_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: ward_bed_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ward_bed_mappings ENABLE ROW LEVEL SECURITY;


--
-- Name: wards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;


--
-- Name: wound_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wound_assessments ENABLE ROW LEVEL SECURITY;

