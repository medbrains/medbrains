-- ============================================================
-- MedBrains schema — module: specialty
-- ============================================================

--
-- Name: anc_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anc_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    visit_number integer NOT NULL,
    gestational_weeks numeric(4,1) NOT NULL,
    weight_kg numeric(5,2),
    bp_systolic integer,
    bp_diastolic integer,
    fundal_height_cm numeric(5,2),
    fetal_heart_rate integer,
    hemoglobin numeric(4,1),
    urine_protein text,
    urine_sugar text,
    pcpndt_form_f_filed boolean DEFAULT false NOT NULL,
    pcpndt_form_f_number text,
    ultrasound_done boolean DEFAULT false NOT NULL,
    examined_by uuid NOT NULL,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    next_visit_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: audiology_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audiology_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    test_type public.hearing_test_type NOT NULL,
    right_ear_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    left_ear_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_nhsp boolean DEFAULT false NOT NULL,
    nhsp_referral_needed boolean DEFAULT false NOT NULL,
    audiogram_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    performed_by uuid NOT NULL,
    test_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cath_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cath_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    device_type public.cath_device_type NOT NULL,
    manufacturer text,
    model text,
    lot_number text,
    barcode text,
    size text,
    is_consignment boolean DEFAULT false NOT NULL,
    vendor_id uuid,
    unit_cost numeric(12,2),
    billed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cath_hemodynamics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cath_hemodynamics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    site public.hemodynamic_site NOT NULL,
    systolic_mmhg numeric(6,2),
    diastolic_mmhg numeric(6,2),
    mean_mmhg numeric(6,2),
    saturation_pct numeric(5,2),
    gradient_mmhg numeric(6,2),
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cath_post_monitoring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cath_post_monitoring (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    monitored_at timestamp with time zone DEFAULT now() NOT NULL,
    sheath_status text,
    access_site_status text,
    vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    ambulation_started boolean DEFAULT false NOT NULL,
    monitored_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cath_procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cath_procedures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    procedure_type public.cath_procedure_type NOT NULL,
    operator_id uuid NOT NULL,
    assistant_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    is_stemi boolean DEFAULT false NOT NULL,
    door_time timestamp with time zone,
    balloon_time timestamp with time zone,
    door_to_balloon_minutes integer,
    fluoroscopy_time_seconds integer,
    total_dap numeric(12,4),
    total_air_kerma numeric(12,4),
    contrast_type text,
    contrast_volume_ml numeric(8,2),
    access_site text,
    findings jsonb DEFAULT '{}'::jsonb NOT NULL,
    complications text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cath_stemi_timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cath_stemi_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    event public.stemi_pathway_status NOT NULL,
    event_time timestamp with time zone NOT NULL,
    recorded_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: chemo_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chemo_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    protocol_name text NOT NULL,
    cancer_type text NOT NULL,
    staging text,
    regimen jsonb DEFAULT '[]'::jsonb NOT NULL,
    cycle_number integer DEFAULT 1 NOT NULL,
    total_cycles integer,
    toxicity_grade integer,
    recist_response text,
    tumor_board_discussed boolean DEFAULT false NOT NULL,
    tumor_board_date date,
    tumor_board_recommendation text,
    treating_oncologist_id uuid,
    cycle_date date DEFAULT CURRENT_DATE NOT NULL,
    next_cycle_date date,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: chronic_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chronic_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    program_id uuid NOT NULL,
    enrolled_by uuid NOT NULL,
    primary_doctor_id uuid,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_end_date date,
    actual_end_date date,
    status public.enrollment_status DEFAULT 'active'::public.enrollment_status NOT NULL,
    status_reason text,
    diagnosis_id uuid,
    icd_code text,
    target_overrides jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: chronic_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chronic_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    program_type public.chronic_program_type NOT NULL,
    description text,
    protocol_id uuid,
    default_duration_months integer,
    target_outcomes jsonb DEFAULT '[]'::jsonb NOT NULL,
    monitoring_schedule jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: dialysis_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dialysis_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    machine_number text,
    access_type text NOT NULL,
    dialyzer_type text,
    pre_weight_kg numeric(6,2),
    post_weight_kg numeric(6,2),
    uf_goal_ml integer,
    uf_achieved_ml integer,
    duration_minutes integer,
    pre_vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    post_vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    intradialytic_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    kt_v numeric(4,2),
    urr_pct numeric(5,2),
    heparin_dose text,
    performed_by uuid NOT NULL,
    session_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: endoscopy_biopsy_specimens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endoscopy_biopsy_specimens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    site text NOT NULL,
    container_label text NOT NULL,
    fixative text,
    chain_of_custody jsonb DEFAULT '[]'::jsonb NOT NULL,
    pathology_result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: endoscopy_procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endoscopy_procedures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    scope_id uuid,
    procedure_type text NOT NULL,
    operator_id uuid NOT NULL,
    sedation_type text,
    sedation_drugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    findings jsonb DEFAULT '{}'::jsonb NOT NULL,
    biopsy_taken boolean DEFAULT false NOT NULL,
    aldrete_score_pre integer,
    aldrete_score_post integer,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: endoscopy_reprocessing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endoscopy_reprocessing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_id uuid NOT NULL,
    procedure_id uuid,
    leak_test_passed boolean DEFAULT true NOT NULL,
    hld_chemical text NOT NULL,
    hld_concentration numeric(6,3),
    hld_soak_minutes integer NOT NULL,
    hld_temperature numeric(5,2),
    hld_result public.hld_result DEFAULT 'pending'::public.hld_result NOT NULL,
    reprocessed_by uuid NOT NULL,
    reprocessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: endoscopy_scopes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endoscopy_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    serial_number text NOT NULL,
    model text NOT NULL,
    scope_type text NOT NULL,
    manufacturer text,
    status public.scope_status DEFAULT 'available'::public.scope_status NOT NULL,
    last_hld_at timestamp with time zone,
    total_uses integer DEFAULT 0 NOT NULL,
    last_culture_date date,
    last_culture_result text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: labor_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labor_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    admission_id uuid,
    labor_onset_time timestamp with time zone,
    current_stage public.labor_stage DEFAULT 'first_latent'::public.labor_stage NOT NULL,
    partograph_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    cervical_dilation_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    delivery_type public.delivery_type,
    delivery_time timestamp with time zone,
    placenta_delivery_time timestamp with time zone,
    blood_loss_ml integer,
    episiotomy boolean DEFAULT false NOT NULL,
    perineal_tear_grade integer,
    apgar_1min integer,
    apgar_5min integer,
    baby_weight_gm integer,
    attending_doctor_id uuid,
    midwife_id uuid,
    complications text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: maternity_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maternity_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    registration_number text NOT NULL,
    lmp_date date NOT NULL,
    edd_date date NOT NULL,
    gravida integer DEFAULT 1 NOT NULL,
    para integer DEFAULT 0 NOT NULL,
    abortion integer DEFAULT 0 NOT NULL,
    living integer DEFAULT 0 NOT NULL,
    risk_category public.anc_risk_category DEFAULT 'low'::public.anc_risk_category NOT NULL,
    blood_group text,
    rh_factor text,
    is_high_risk boolean DEFAULT false NOT NULL,
    high_risk_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: occ_health_drug_screens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occ_health_drug_screens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    screening_id uuid,
    specimen_id text,
    status public.drug_screen_status DEFAULT 'ordered'::public.drug_screen_status NOT NULL,
    chain_of_custody jsonb DEFAULT '{}'::jsonb NOT NULL,
    panel text DEFAULT 'standard_5'::text NOT NULL,
    results jsonb DEFAULT '{}'::jsonb NOT NULL,
    mro_reviewer_id uuid,
    mro_decision text,
    mro_reviewed_at timestamp with time zone,
    collected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: occ_health_injury_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occ_health_injury_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    report_number text NOT NULL,
    injury_date date NOT NULL,
    injury_type text NOT NULL,
    injury_description text,
    body_part_affected text,
    location_of_incident text,
    is_osha_recordable boolean DEFAULT false NOT NULL,
    lost_work_days integer DEFAULT 0 NOT NULL,
    restricted_days integer DEFAULT 0 NOT NULL,
    workers_comp_claim_number text,
    workers_comp_status text,
    rtw_status public.rtw_clearance_status DEFAULT 'pending_evaluation'::public.rtw_clearance_status NOT NULL,
    rtw_restrictions jsonb DEFAULT '[]'::jsonb NOT NULL,
    rtw_cleared_date date,
    rtw_cleared_by uuid,
    employer_access_notes text,
    reported_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: occ_health_screenings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occ_health_screenings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    examiner_id uuid,
    screening_type text NOT NULL,
    screening_date date NOT NULL,
    fitness_status text DEFAULT 'pending'::text NOT NULL,
    findings jsonb DEFAULT '{}'::jsonb NOT NULL,
    restrictions jsonb DEFAULT '[]'::jsonb NOT NULL,
    next_due_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT occ_health_screenings_fitness_status_check CHECK ((fitness_status = ANY (ARRAY['pending'::text, 'fit'::text, 'fit_with_restrictions'::text, 'unfit'::text, 'referred'::text]))),
    CONSTRAINT occ_health_screenings_screening_type_check CHECK ((screening_type = ANY (ARRAY['pre_employment'::text, 'periodic'::text, 'special'::text, 'exit'::text])))
);



--
-- Name: occ_health_vaccinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.occ_health_vaccinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    vaccine_name text NOT NULL,
    dose_number integer DEFAULT 1 NOT NULL,
    administered_date date NOT NULL,
    batch_number text,
    administered_by uuid,
    next_due_date date,
    is_compliant boolean DEFAULT true NOT NULL,
    exemption_type text,
    exemption_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: postnatal_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postnatal_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    day_postpartum integer NOT NULL,
    mother_vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    uterus_involution text,
    lochia text,
    breast_feeding_status text,
    baby_vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    baby_weight_gm integer,
    baby_feeding text,
    examined_by uuid NOT NULL,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    psych_patient_id uuid NOT NULL,
    assessment_type text NOT NULL,
    mental_status_exam jsonb DEFAULT '{}'::jsonb NOT NULL,
    ham_d_score integer,
    bprs_score integer,
    gaf_score integer,
    risk_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_counseling_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_counseling_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    psych_patient_id uuid NOT NULL,
    session_type text NOT NULL,
    therapist_id uuid NOT NULL,
    modality text,
    duration_minutes integer,
    outcome_rating integer,
    session_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_ect_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_ect_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    psych_patient_id uuid NOT NULL,
    session_number integer NOT NULL,
    consent_obtained boolean DEFAULT true NOT NULL,
    laterality public.ect_laterality NOT NULL,
    stimulus_dose numeric(6,2),
    seizure_duration_sec integer,
    anesthetic text,
    muscle_relaxant text,
    performed_by uuid NOT NULL,
    anesthetist_id uuid,
    session_date timestamp with time zone DEFAULT now() NOT NULL,
    complications text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_mhrb_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_mhrb_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    psych_patient_id uuid NOT NULL,
    notification_type text NOT NULL,
    reference_number text,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_category public.psych_admission_category DEFAULT 'independent'::public.psych_admission_category NOT NULL,
    advance_directive_text text,
    nominated_rep_name text,
    nominated_rep_relation text,
    nominated_rep_contact text,
    substance_abuse_flag boolean DEFAULT false NOT NULL,
    is_restricted boolean DEFAULT true NOT NULL,
    treating_psychiatrist_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psych_seclusion_restraint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psych_seclusion_restraint (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    psych_patient_id uuid NOT NULL,
    restraint_type public.restraint_type NOT NULL,
    reason text NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    review_due_at timestamp with time zone NOT NULL,
    reviewed_at timestamp with time zone,
    end_time timestamp with time zone,
    ordered_by uuid NOT NULL,
    released_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: psychometric_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psychometric_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    test_name text NOT NULL,
    raw_data_encrypted jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary_for_clinician text,
    is_restricted boolean DEFAULT true NOT NULL,
    administered_by uuid NOT NULL,
    test_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: rehab_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rehab_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    discipline public.rehab_discipline NOT NULL,
    diagnosis text,
    goals text NOT NULL,
    plan_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    fim_score_initial integer,
    barthel_score_initial integer,
    status text DEFAULT 'active'::text NOT NULL,
    therapist_id uuid,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    target_end_date date,
    actual_end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: rehab_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rehab_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    session_number integer NOT NULL,
    therapist_id uuid NOT NULL,
    intervention text NOT NULL,
    pain_score integer,
    rom_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    strength_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    fim_score integer,
    barthel_score integer,
    session_date timestamp with time zone DEFAULT now() NOT NULL,
    duration_minutes integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: specialty_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialty_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    specialty text NOT NULL,
    template_id uuid,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_by uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: specialty_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialty_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    specialty text NOT NULL,
    template_name text NOT NULL,
    template_code text NOT NULL,
    form_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: anc_visits anc_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anc_visits
    ADD CONSTRAINT anc_visits_pkey PRIMARY KEY (id);



--
-- Name: audiology_tests audiology_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audiology_tests
    ADD CONSTRAINT audiology_tests_pkey PRIMARY KEY (id);



--
-- Name: cath_devices cath_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_devices
    ADD CONSTRAINT cath_devices_pkey PRIMARY KEY (id);



--
-- Name: cath_hemodynamics cath_hemodynamics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_hemodynamics
    ADD CONSTRAINT cath_hemodynamics_pkey PRIMARY KEY (id);



--
-- Name: cath_post_monitoring cath_post_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_post_monitoring
    ADD CONSTRAINT cath_post_monitoring_pkey PRIMARY KEY (id);



--
-- Name: cath_procedures cath_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_procedures
    ADD CONSTRAINT cath_procedures_pkey PRIMARY KEY (id);



--
-- Name: cath_stemi_timeline cath_stemi_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_stemi_timeline
    ADD CONSTRAINT cath_stemi_timeline_pkey PRIMARY KEY (id);



--
-- Name: chemo_protocols chemo_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chemo_protocols
    ADD CONSTRAINT chemo_protocols_pkey PRIMARY KEY (id);



--
-- Name: chronic_enrollments chronic_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_pkey PRIMARY KEY (id);



--
-- Name: chronic_programs chronic_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_programs
    ADD CONSTRAINT chronic_programs_pkey PRIMARY KEY (id);



--
-- Name: chronic_programs chronic_programs_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_programs
    ADD CONSTRAINT chronic_programs_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: dialysis_sessions dialysis_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dialysis_sessions
    ADD CONSTRAINT dialysis_sessions_pkey PRIMARY KEY (id);



--
-- Name: endoscopy_biopsy_specimens endoscopy_biopsy_specimens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_biopsy_specimens
    ADD CONSTRAINT endoscopy_biopsy_specimens_pkey PRIMARY KEY (id);



--
-- Name: endoscopy_procedures endoscopy_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_procedures
    ADD CONSTRAINT endoscopy_procedures_pkey PRIMARY KEY (id);



--
-- Name: endoscopy_reprocessing endoscopy_reprocessing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_reprocessing
    ADD CONSTRAINT endoscopy_reprocessing_pkey PRIMARY KEY (id);



--
-- Name: endoscopy_scopes endoscopy_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_scopes
    ADD CONSTRAINT endoscopy_scopes_pkey PRIMARY KEY (id);



--
-- Name: endoscopy_scopes endoscopy_scopes_tenant_id_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_scopes
    ADD CONSTRAINT endoscopy_scopes_tenant_id_serial_number_key UNIQUE (tenant_id, serial_number);



--
-- Name: labor_records labor_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_records
    ADD CONSTRAINT labor_records_pkey PRIMARY KEY (id);



--
-- Name: maternity_registrations maternity_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maternity_registrations
    ADD CONSTRAINT maternity_registrations_pkey PRIMARY KEY (id);



--
-- Name: maternity_registrations maternity_registrations_tenant_id_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maternity_registrations
    ADD CONSTRAINT maternity_registrations_tenant_id_registration_number_key UNIQUE (tenant_id, registration_number);



--
-- Name: occ_health_drug_screens occ_health_drug_screens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_drug_screens
    ADD CONSTRAINT occ_health_drug_screens_pkey PRIMARY KEY (id);



--
-- Name: occ_health_injury_reports occ_health_injury_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_injury_reports
    ADD CONSTRAINT occ_health_injury_reports_pkey PRIMARY KEY (id);



--
-- Name: occ_health_screenings occ_health_screenings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_screenings
    ADD CONSTRAINT occ_health_screenings_pkey PRIMARY KEY (id);



--
-- Name: occ_health_vaccinations occ_health_vaccinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_vaccinations
    ADD CONSTRAINT occ_health_vaccinations_pkey PRIMARY KEY (id);



--
-- Name: postnatal_records postnatal_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_records
    ADD CONSTRAINT postnatal_records_pkey PRIMARY KEY (id);



--
-- Name: psych_assessments psych_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_assessments
    ADD CONSTRAINT psych_assessments_pkey PRIMARY KEY (id);



--
-- Name: psych_counseling_sessions psych_counseling_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_counseling_sessions
    ADD CONSTRAINT psych_counseling_sessions_pkey PRIMARY KEY (id);



--
-- Name: psych_ect_register psych_ect_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_ect_register
    ADD CONSTRAINT psych_ect_register_pkey PRIMARY KEY (id);



--
-- Name: psych_mhrb_notifications psych_mhrb_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_mhrb_notifications
    ADD CONSTRAINT psych_mhrb_notifications_pkey PRIMARY KEY (id);



--
-- Name: psych_patients psych_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_patients
    ADD CONSTRAINT psych_patients_pkey PRIMARY KEY (id);



--
-- Name: psych_patients psych_patients_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_patients
    ADD CONSTRAINT psych_patients_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);



--
-- Name: psych_seclusion_restraint psych_seclusion_restraint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_seclusion_restraint
    ADD CONSTRAINT psych_seclusion_restraint_pkey PRIMARY KEY (id);



--
-- Name: psychometric_tests psychometric_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psychometric_tests
    ADD CONSTRAINT psychometric_tests_pkey PRIMARY KEY (id);



--
-- Name: rehab_plans rehab_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_plans
    ADD CONSTRAINT rehab_plans_pkey PRIMARY KEY (id);



--
-- Name: rehab_sessions rehab_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_sessions
    ADD CONSTRAINT rehab_sessions_pkey PRIMARY KEY (id);



--
-- Name: specialty_records specialty_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_records
    ADD CONSTRAINT specialty_records_pkey PRIMARY KEY (id);



--
-- Name: specialty_templates specialty_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_templates
    ADD CONSTRAINT specialty_templates_pkey PRIMARY KEY (id);



--
-- Name: specialty_templates specialty_templates_tenant_id_template_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_templates
    ADD CONSTRAINT specialty_templates_tenant_id_template_code_key UNIQUE (tenant_id, template_code);



--
-- Name: idx_anc_visits_registration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anc_visits_registration ON public.anc_visits USING btree (registration_id);



--
-- Name: idx_anc_visits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anc_visits_tenant ON public.anc_visits USING btree (tenant_id);



--
-- Name: idx_audiology_tests_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audiology_tests_patient ON public.audiology_tests USING btree (tenant_id, patient_id);



--
-- Name: idx_audiology_tests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audiology_tests_tenant ON public.audiology_tests USING btree (tenant_id);



--
-- Name: idx_cath_devices_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_devices_procedure ON public.cath_devices USING btree (procedure_id);



--
-- Name: idx_cath_devices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_devices_tenant ON public.cath_devices USING btree (tenant_id);



--
-- Name: idx_cath_hemodynamics_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_hemodynamics_procedure ON public.cath_hemodynamics USING btree (procedure_id);



--
-- Name: idx_cath_hemodynamics_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_hemodynamics_tenant ON public.cath_hemodynamics USING btree (tenant_id);



--
-- Name: idx_cath_post_monitoring_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_post_monitoring_procedure ON public.cath_post_monitoring USING btree (procedure_id);



--
-- Name: idx_cath_post_monitoring_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_post_monitoring_tenant ON public.cath_post_monitoring USING btree (tenant_id);



--
-- Name: idx_cath_procedures_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_procedures_patient ON public.cath_procedures USING btree (tenant_id, patient_id);



--
-- Name: idx_cath_procedures_stemi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_procedures_stemi ON public.cath_procedures USING btree (tenant_id, is_stemi) WHERE (is_stemi = true);



--
-- Name: idx_cath_procedures_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_procedures_tenant ON public.cath_procedures USING btree (tenant_id);



--
-- Name: idx_cath_stemi_timeline_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_stemi_timeline_procedure ON public.cath_stemi_timeline USING btree (procedure_id);



--
-- Name: idx_cath_stemi_timeline_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cath_stemi_timeline_tenant ON public.cath_stemi_timeline USING btree (tenant_id);



--
-- Name: idx_chemo_protocols_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chemo_protocols_patient ON public.chemo_protocols USING btree (tenant_id, patient_id);



--
-- Name: idx_chemo_protocols_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chemo_protocols_tenant ON public.chemo_protocols USING btree (tenant_id);



--
-- Name: idx_chronic_enrollments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chronic_enrollments_active ON public.chronic_enrollments USING btree (tenant_id, patient_id, status) WHERE (status = 'active'::public.enrollment_status);



--
-- Name: idx_chronic_programs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chronic_programs_type ON public.chronic_programs USING btree (tenant_id, program_type);



--
-- Name: idx_dialysis_sessions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dialysis_sessions_patient ON public.dialysis_sessions USING btree (tenant_id, patient_id);



--
-- Name: idx_dialysis_sessions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dialysis_sessions_tenant ON public.dialysis_sessions USING btree (tenant_id);



--
-- Name: idx_endoscopy_biopsy_procedure; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_biopsy_procedure ON public.endoscopy_biopsy_specimens USING btree (procedure_id);



--
-- Name: idx_endoscopy_biopsy_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_biopsy_tenant ON public.endoscopy_biopsy_specimens USING btree (tenant_id);



--
-- Name: idx_endoscopy_procedures_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_procedures_patient ON public.endoscopy_procedures USING btree (tenant_id, patient_id);



--
-- Name: idx_endoscopy_procedures_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_procedures_tenant ON public.endoscopy_procedures USING btree (tenant_id);



--
-- Name: idx_endoscopy_reprocessing_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_reprocessing_scope ON public.endoscopy_reprocessing USING btree (scope_id);



--
-- Name: idx_endoscopy_reprocessing_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_reprocessing_tenant ON public.endoscopy_reprocessing USING btree (tenant_id);



--
-- Name: idx_endoscopy_scopes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_scopes_status ON public.endoscopy_scopes USING btree (tenant_id, status);



--
-- Name: idx_endoscopy_scopes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_endoscopy_scopes_tenant ON public.endoscopy_scopes USING btree (tenant_id);



--
-- Name: idx_labor_records_registration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_records_registration ON public.labor_records USING btree (registration_id);



--
-- Name: idx_labor_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labor_records_tenant ON public.labor_records USING btree (tenant_id);



--
-- Name: idx_maternity_reg_high_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maternity_reg_high_risk ON public.maternity_registrations USING btree (tenant_id, is_high_risk) WHERE (is_high_risk = true);



--
-- Name: idx_maternity_reg_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maternity_reg_patient ON public.maternity_registrations USING btree (tenant_id, patient_id);



--
-- Name: idx_maternity_reg_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maternity_reg_tenant ON public.maternity_registrations USING btree (tenant_id);



--
-- Name: idx_occ_drug_screens_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_drug_screens_employee ON public.occ_health_drug_screens USING btree (tenant_id, employee_id);



--
-- Name: idx_occ_injuries_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_injuries_employee ON public.occ_health_injury_reports USING btree (tenant_id, employee_id);



--
-- Name: idx_occ_injuries_rtw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_injuries_rtw ON public.occ_health_injury_reports USING btree (tenant_id, rtw_status) WHERE (rtw_status <> 'cleared_full'::public.rtw_clearance_status);



--
-- Name: idx_occ_screenings_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_screenings_due ON public.occ_health_screenings USING btree (tenant_id, next_due_date) WHERE (next_due_date IS NOT NULL);



--
-- Name: idx_occ_screenings_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_screenings_employee ON public.occ_health_screenings USING btree (tenant_id, employee_id);



--
-- Name: idx_occ_vaccinations_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_occ_vaccinations_employee ON public.occ_health_vaccinations USING btree (tenant_id, employee_id, is_compliant);



--
-- Name: idx_postnatal_records_registration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postnatal_records_registration ON public.postnatal_records USING btree (registration_id);



--
-- Name: idx_postnatal_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postnatal_records_tenant ON public.postnatal_records USING btree (tenant_id);



--
-- Name: idx_psych_assessments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_assessments_patient ON public.psych_assessments USING btree (psych_patient_id);



--
-- Name: idx_psych_assessments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_assessments_tenant ON public.psych_assessments USING btree (tenant_id);



--
-- Name: idx_psych_counseling_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_counseling_patient ON public.psych_counseling_sessions USING btree (psych_patient_id);



--
-- Name: idx_psych_counseling_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_counseling_tenant ON public.psych_counseling_sessions USING btree (tenant_id);



--
-- Name: idx_psych_ect_register_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_ect_register_patient ON public.psych_ect_register USING btree (psych_patient_id);



--
-- Name: idx_psych_ect_register_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_ect_register_tenant ON public.psych_ect_register USING btree (tenant_id);



--
-- Name: idx_psych_mhrb_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_mhrb_patient ON public.psych_mhrb_notifications USING btree (psych_patient_id);



--
-- Name: idx_psych_mhrb_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_mhrb_tenant ON public.psych_mhrb_notifications USING btree (tenant_id);



--
-- Name: idx_psych_patients_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_patients_patient ON public.psych_patients USING btree (tenant_id, patient_id);



--
-- Name: idx_psych_patients_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_patients_tenant ON public.psych_patients USING btree (tenant_id);



--
-- Name: idx_psych_seclusion_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_seclusion_active ON public.psych_seclusion_restraint USING btree (tenant_id, end_time) WHERE (end_time IS NULL);



--
-- Name: idx_psych_seclusion_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_seclusion_patient ON public.psych_seclusion_restraint USING btree (psych_patient_id);



--
-- Name: idx_psych_seclusion_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psych_seclusion_tenant ON public.psych_seclusion_restraint USING btree (tenant_id);



--
-- Name: idx_psychometric_tests_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psychometric_tests_patient ON public.psychometric_tests USING btree (tenant_id, patient_id);



--
-- Name: idx_psychometric_tests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psychometric_tests_tenant ON public.psychometric_tests USING btree (tenant_id);



--
-- Name: idx_rehab_plans_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rehab_plans_patient ON public.rehab_plans USING btree (tenant_id, patient_id);



--
-- Name: idx_rehab_plans_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rehab_plans_tenant ON public.rehab_plans USING btree (tenant_id);



--
-- Name: idx_rehab_sessions_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rehab_sessions_plan ON public.rehab_sessions USING btree (plan_id);



--
-- Name: idx_rehab_sessions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rehab_sessions_tenant ON public.rehab_sessions USING btree (tenant_id);



--
-- Name: idx_specialty_records_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_records_patient ON public.specialty_records USING btree (tenant_id, patient_id);



--
-- Name: idx_specialty_records_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_records_specialty ON public.specialty_records USING btree (tenant_id, specialty);



--
-- Name: idx_specialty_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_records_tenant ON public.specialty_records USING btree (tenant_id);



--
-- Name: idx_specialty_templates_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_templates_specialty ON public.specialty_templates USING btree (tenant_id, specialty);



--
-- Name: idx_specialty_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_specialty_templates_tenant ON public.specialty_templates USING btree (tenant_id);



--
-- Name: occ_health_drug_screens set_updated_at_occ_health_drug_screens; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_occ_health_drug_screens BEFORE UPDATE ON public.occ_health_drug_screens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: occ_health_injury_reports set_updated_at_occ_health_injury_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_occ_health_injury_reports BEFORE UPDATE ON public.occ_health_injury_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: occ_health_screenings set_updated_at_occ_health_screenings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_occ_health_screenings BEFORE UPDATE ON public.occ_health_screenings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: occ_health_vaccinations set_updated_at_occ_health_vaccinations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_occ_health_vaccinations BEFORE UPDATE ON public.occ_health_vaccinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: anc_visits trg_anc_visits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_anc_visits_updated_at BEFORE UPDATE ON public.anc_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: audiology_tests trg_audiology_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audiology_tests_updated_at BEFORE UPDATE ON public.audiology_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cath_devices trg_cath_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cath_devices_updated_at BEFORE UPDATE ON public.cath_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cath_hemodynamics trg_cath_hemodynamics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cath_hemodynamics_updated_at BEFORE UPDATE ON public.cath_hemodynamics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cath_post_monitoring trg_cath_post_monitoring_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cath_post_monitoring_updated_at BEFORE UPDATE ON public.cath_post_monitoring FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cath_procedures trg_cath_procedures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cath_procedures_updated_at BEFORE UPDATE ON public.cath_procedures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cath_stemi_timeline trg_cath_stemi_timeline_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cath_stemi_timeline_updated_at BEFORE UPDATE ON public.cath_stemi_timeline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: chemo_protocols trg_chemo_protocols_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chemo_protocols_updated_at BEFORE UPDATE ON public.chemo_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: chronic_enrollments trg_chronic_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chronic_enrollments_updated_at BEFORE UPDATE ON public.chronic_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: chronic_programs trg_chronic_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chronic_programs_updated_at BEFORE UPDATE ON public.chronic_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: dialysis_sessions trg_dialysis_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dialysis_sessions_updated_at BEFORE UPDATE ON public.dialysis_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: endoscopy_biopsy_specimens trg_endoscopy_biopsy_specimens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_endoscopy_biopsy_specimens_updated_at BEFORE UPDATE ON public.endoscopy_biopsy_specimens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: endoscopy_procedures trg_endoscopy_procedures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_endoscopy_procedures_updated_at BEFORE UPDATE ON public.endoscopy_procedures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: endoscopy_reprocessing trg_endoscopy_reprocessing_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_endoscopy_reprocessing_updated_at BEFORE UPDATE ON public.endoscopy_reprocessing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: endoscopy_scopes trg_endoscopy_scopes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_endoscopy_scopes_updated_at BEFORE UPDATE ON public.endoscopy_scopes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: labor_records trg_labor_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_labor_records_updated_at BEFORE UPDATE ON public.labor_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: maternity_registrations trg_maternity_registrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_maternity_registrations_updated_at BEFORE UPDATE ON public.maternity_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: postnatal_records trg_postnatal_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_postnatal_records_updated_at BEFORE UPDATE ON public.postnatal_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_assessments trg_psych_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_assessments_updated_at BEFORE UPDATE ON public.psych_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_counseling_sessions trg_psych_counseling_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_counseling_sessions_updated_at BEFORE UPDATE ON public.psych_counseling_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_ect_register trg_psych_ect_register_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_ect_register_updated_at BEFORE UPDATE ON public.psych_ect_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_mhrb_notifications trg_psych_mhrb_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_mhrb_notifications_updated_at BEFORE UPDATE ON public.psych_mhrb_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_patients trg_psych_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_patients_updated_at BEFORE UPDATE ON public.psych_patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psych_seclusion_restraint trg_psych_seclusion_restraint_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psych_seclusion_restraint_updated_at BEFORE UPDATE ON public.psych_seclusion_restraint FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: psychometric_tests trg_psychometric_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psychometric_tests_updated_at BEFORE UPDATE ON public.psychometric_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: rehab_plans trg_rehab_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rehab_plans_updated_at BEFORE UPDATE ON public.rehab_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: rehab_sessions trg_rehab_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rehab_sessions_updated_at BEFORE UPDATE ON public.rehab_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: specialty_records trg_specialty_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_specialty_records_updated_at BEFORE UPDATE ON public.specialty_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: specialty_templates trg_specialty_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_specialty_templates_updated_at BEFORE UPDATE ON public.specialty_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: anc_visits anc_visits_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anc_visits
    ADD CONSTRAINT anc_visits_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.maternity_registrations(id);



--
-- Name: cath_devices cath_devices_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_devices
    ADD CONSTRAINT cath_devices_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.cath_procedures(id) ON DELETE CASCADE;



--
-- Name: cath_hemodynamics cath_hemodynamics_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_hemodynamics
    ADD CONSTRAINT cath_hemodynamics_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.cath_procedures(id) ON DELETE CASCADE;



--
-- Name: cath_post_monitoring cath_post_monitoring_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_post_monitoring
    ADD CONSTRAINT cath_post_monitoring_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.cath_procedures(id) ON DELETE CASCADE;



--
-- Name: cath_stemi_timeline cath_stemi_timeline_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cath_stemi_timeline
    ADD CONSTRAINT cath_stemi_timeline_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.cath_procedures(id) ON DELETE CASCADE;



--
-- Name: chronic_enrollments chronic_enrollments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chronic_enrollments
    ADD CONSTRAINT chronic_enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.chronic_programs(id);



--
-- Name: endoscopy_biopsy_specimens endoscopy_biopsy_specimens_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_biopsy_specimens
    ADD CONSTRAINT endoscopy_biopsy_specimens_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.endoscopy_procedures(id) ON DELETE CASCADE;



--
-- Name: endoscopy_procedures endoscopy_procedures_scope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_procedures
    ADD CONSTRAINT endoscopy_procedures_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.endoscopy_scopes(id);



--
-- Name: endoscopy_reprocessing endoscopy_reprocessing_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_reprocessing
    ADD CONSTRAINT endoscopy_reprocessing_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.endoscopy_procedures(id);



--
-- Name: endoscopy_reprocessing endoscopy_reprocessing_scope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endoscopy_reprocessing
    ADD CONSTRAINT endoscopy_reprocessing_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.endoscopy_scopes(id);



--
-- Name: labor_records labor_records_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_records
    ADD CONSTRAINT labor_records_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.maternity_registrations(id);



--
-- Name: occ_health_drug_screens occ_health_drug_screens_screening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_drug_screens
    ADD CONSTRAINT occ_health_drug_screens_screening_id_fkey FOREIGN KEY (screening_id) REFERENCES public.occ_health_screenings(id);



--
-- Name: postnatal_records postnatal_records_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_records
    ADD CONSTRAINT postnatal_records_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.maternity_registrations(id);



--
-- Name: psych_assessments psych_assessments_psych_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_assessments
    ADD CONSTRAINT psych_assessments_psych_patient_id_fkey FOREIGN KEY (psych_patient_id) REFERENCES public.psych_patients(id);



--
-- Name: psych_counseling_sessions psych_counseling_sessions_psych_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_counseling_sessions
    ADD CONSTRAINT psych_counseling_sessions_psych_patient_id_fkey FOREIGN KEY (psych_patient_id) REFERENCES public.psych_patients(id);



--
-- Name: psych_ect_register psych_ect_register_psych_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_ect_register
    ADD CONSTRAINT psych_ect_register_psych_patient_id_fkey FOREIGN KEY (psych_patient_id) REFERENCES public.psych_patients(id);



--
-- Name: psych_mhrb_notifications psych_mhrb_notifications_psych_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_mhrb_notifications
    ADD CONSTRAINT psych_mhrb_notifications_psych_patient_id_fkey FOREIGN KEY (psych_patient_id) REFERENCES public.psych_patients(id);



--
-- Name: psych_seclusion_restraint psych_seclusion_restraint_psych_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psych_seclusion_restraint
    ADD CONSTRAINT psych_seclusion_restraint_psych_patient_id_fkey FOREIGN KEY (psych_patient_id) REFERENCES public.psych_patients(id);



--
-- Name: rehab_sessions rehab_sessions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rehab_sessions
    ADD CONSTRAINT rehab_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.rehab_plans(id);



--
-- Name: specialty_records specialty_records_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_records
    ADD CONSTRAINT specialty_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.specialty_templates(id);



--
-- Name: anc_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anc_visits ENABLE ROW LEVEL SECURITY;


--
-- Name: audiology_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audiology_tests ENABLE ROW LEVEL SECURITY;


--
-- Name: cath_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cath_devices ENABLE ROW LEVEL SECURITY;


--
-- Name: cath_hemodynamics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cath_hemodynamics ENABLE ROW LEVEL SECURITY;


--
-- Name: cath_post_monitoring; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cath_post_monitoring ENABLE ROW LEVEL SECURITY;


--
-- Name: cath_procedures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cath_procedures ENABLE ROW LEVEL SECURITY;


--
-- Name: cath_stemi_timeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cath_stemi_timeline ENABLE ROW LEVEL SECURITY;


--
-- Name: chemo_protocols; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chemo_protocols ENABLE ROW LEVEL SECURITY;


--
-- Name: chronic_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chronic_enrollments ENABLE ROW LEVEL SECURITY;


--
-- Name: chronic_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chronic_programs ENABLE ROW LEVEL SECURITY;


--
-- Name: dialysis_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dialysis_sessions ENABLE ROW LEVEL SECURITY;


--
-- Name: endoscopy_biopsy_specimens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.endoscopy_biopsy_specimens ENABLE ROW LEVEL SECURITY;


--
-- Name: endoscopy_procedures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.endoscopy_procedures ENABLE ROW LEVEL SECURITY;


--
-- Name: endoscopy_reprocessing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.endoscopy_reprocessing ENABLE ROW LEVEL SECURITY;


--
-- Name: endoscopy_scopes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.endoscopy_scopes ENABLE ROW LEVEL SECURITY;


--
-- Name: labor_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labor_records ENABLE ROW LEVEL SECURITY;


--
-- Name: maternity_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maternity_registrations ENABLE ROW LEVEL SECURITY;


--
-- Name: occ_health_drug_screens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occ_health_drug_screens ENABLE ROW LEVEL SECURITY;


--
-- Name: occ_health_injury_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occ_health_injury_reports ENABLE ROW LEVEL SECURITY;


--
-- Name: occ_health_screenings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occ_health_screenings ENABLE ROW LEVEL SECURITY;


--
-- Name: occ_health_vaccinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.occ_health_vaccinations ENABLE ROW LEVEL SECURITY;


--
-- Name: postnatal_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.postnatal_records ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_counseling_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_counseling_sessions ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_ect_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_ect_register ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_mhrb_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_mhrb_notifications ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_patients ENABLE ROW LEVEL SECURITY;


--
-- Name: psych_seclusion_restraint; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psych_seclusion_restraint ENABLE ROW LEVEL SECURITY;


--
-- Name: psychometric_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psychometric_tests ENABLE ROW LEVEL SECURITY;


--
-- Name: rehab_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rehab_plans ENABLE ROW LEVEL SECURITY;


--
-- Name: rehab_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rehab_sessions ENABLE ROW LEVEL SECURITY;


--
-- Name: specialty_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specialty_records ENABLE ROW LEVEL SECURITY;


--
-- Name: specialty_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specialty_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: anc_visits tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.anc_visits USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: audiology_tests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.audiology_tests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cath_devices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cath_devices USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cath_hemodynamics tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cath_hemodynamics USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cath_post_monitoring tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cath_post_monitoring USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cath_procedures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cath_procedures USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cath_stemi_timeline tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cath_stemi_timeline USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: chemo_protocols tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chemo_protocols USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: chronic_enrollments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chronic_enrollments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: chronic_programs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.chronic_programs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: dialysis_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dialysis_sessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: endoscopy_biopsy_specimens tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.endoscopy_biopsy_specimens USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: endoscopy_procedures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.endoscopy_procedures USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: endoscopy_reprocessing tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.endoscopy_reprocessing USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: endoscopy_scopes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.endoscopy_scopes USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: labor_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.labor_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: maternity_registrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.maternity_registrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: occ_health_drug_screens tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.occ_health_drug_screens USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: occ_health_injury_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.occ_health_injury_reports USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: occ_health_screenings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.occ_health_screenings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: occ_health_vaccinations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.occ_health_vaccinations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: postnatal_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.postnatal_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_assessments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_counseling_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_counseling_sessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_ect_register tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_ect_register USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_mhrb_notifications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_mhrb_notifications USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_patients tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_patients USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psych_seclusion_restraint tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psych_seclusion_restraint USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: psychometric_tests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.psychometric_tests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: rehab_plans tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rehab_plans USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: rehab_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rehab_sessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: specialty_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.specialty_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: specialty_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.specialty_templates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


