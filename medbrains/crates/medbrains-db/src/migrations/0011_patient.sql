-- ============================================================
-- MedBrains schema — module: patient
-- ============================================================

--
-- Name: age_estimations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.age_estimations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    case_id uuid,
    voice_change boolean,
    other_findings text,
    dental_formula text,
    third_molars_status text,
    teeth_wear text,
    xray_wrist_findings text,
    xray_elbow_findings text,
    xray_shoulder_findings text,
    estimated_age_years integer,
    age_range_min integer,
    age_range_max integer,
    opinion_basis text,
    examining_doctor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.age_estimations FORCE ROW LEVEL SECURITY;



--
-- Name: master_occupations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_occupations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: master_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_relations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: master_religions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_religions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: patient_abha_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_abha_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    abha_number text NOT NULL,
    abha_address text,
    linking_token text,
    token_expiry timestamp with time zone,
    kyc_verified boolean DEFAULT false NOT NULL,
    status text DEFAULT 'linked'::text NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    unlinked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_addresses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    address_type public.address_type NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    village_town text,
    city text NOT NULL,
    district_id uuid,
    state_id uuid,
    country_id uuid NOT NULL,
    postal_code text NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    is_primary boolean DEFAULT false NOT NULL,
    valid_from date,
    valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_allergies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    allergy_type public.allergy_type NOT NULL,
    allergen_name text NOT NULL,
    allergen_code text,
    reaction text,
    severity public.allergy_severity,
    onset_date date,
    reported_by text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    contact_name text NOT NULL,
    relation text NOT NULL,
    phone text NOT NULL,
    phone_alt text,
    email text,
    address jsonb,
    is_emergency_contact boolean DEFAULT false NOT NULL,
    is_next_of_kin boolean DEFAULT false NOT NULL,
    is_legal_guardian boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    document_type text NOT NULL,
    document_name text NOT NULL,
    file_url text NOT NULL,
    file_size bigint,
    mime_type text,
    uploaded_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    material_id uuid,
    language text DEFAULT 'en'::text NOT NULL,
    provided_at timestamp with time zone DEFAULT now() NOT NULL,
    provided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.patient_education FORCE ROW LEVEL SECURITY;



--
-- Name: patient_family_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_family_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    related_patient_id uuid NOT NULL,
    relationship text NOT NULL,
    is_primary_contact boolean DEFAULT false NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_family_links_check CHECK ((patient_id <> related_patient_id))
);



--
-- Name: patient_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    doctor_id uuid,
    department_id uuid,
    rating integer,
    wait_time_rating integer,
    staff_rating integer,
    cleanliness_rating integer,
    overall_experience text,
    suggestions text,
    would_recommend boolean,
    is_anonymous boolean DEFAULT false NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_feedback_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    CONSTRAINT patient_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT patient_feedback_staff_rating_check CHECK (((staff_rating >= 1) AND (staff_rating <= 5))),
    CONSTRAINT patient_feedback_wait_time_rating_check CHECK (((wait_time_rating >= 1) AND (wait_time_rating <= 5)))
);



--
-- Name: patient_identifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_identifiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    id_type public.identifier_type NOT NULL,
    id_number text NOT NULL,
    id_number_hash text,
    issuing_authority text,
    issuing_country_id uuid,
    valid_from date,
    valid_until date,
    is_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    verification_mode text,
    document_url text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_merge_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_merge_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    surviving_patient_id uuid NOT NULL,
    merged_patient_id uuid NOT NULL,
    merged_by uuid NOT NULL,
    merge_reason text NOT NULL,
    merge_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    unmerged_at timestamp with time zone,
    unmerged_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_outcome_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_outcome_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid,
    parameter_name text NOT NULL,
    loinc_code text,
    target_value numeric NOT NULL,
    unit text NOT NULL,
    comparison text NOT NULL,
    set_by uuid NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_outcome_targets_comparison_check CHECK ((comparison = ANY (ARRAY['<'::text, '<='::text, '='::text, '>='::text, '>'::text])))
);



--
-- Name: patient_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    doctor_id uuid NOT NULL,
    reminder_type character varying(30) NOT NULL,
    reminder_date date NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    priority character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notification_channels text[] DEFAULT '{}'::text[],
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_reminders_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT patient_reminders_reminder_type_check CHECK (((reminder_type)::text = ANY ((ARRAY['follow_up'::character varying, 'lab_review'::character varying, 'medication_review'::character varying, 'vaccination'::character varying, 'screening'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT patient_reminders_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'acknowledged'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'overdue'::character varying])::text[])))
);



--
-- Name: patient_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_tenant_id uuid NOT NULL,
    dest_tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    transfer_type text DEFAULT 'clinical'::text NOT NULL,
    reason text NOT NULL,
    clinical_summary text,
    priority text DEFAULT 'routine'::text,
    status public.transfer_status DEFAULT 'requested'::public.transfer_status NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    departed_at timestamp with time zone,
    arrived_at timestamp with time zone,
    requested_by uuid NOT NULL,
    approved_by uuid,
    received_by uuid,
    transport_mode text,
    transport_details jsonb DEFAULT '{}'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    uhid text NOT NULL,
    abha_id text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date,
    gender public.gender NOT NULL,
    phone text NOT NULL,
    email text,
    address jsonb,
    category public.patient_category DEFAULT 'general'::public.patient_category NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    prefix text,
    middle_name text,
    suffix text,
    full_name_local text,
    father_name text,
    mother_name text,
    spouse_name text,
    guardian_name text,
    guardian_relation text,
    is_dob_estimated boolean DEFAULT false NOT NULL,
    biological_sex public.gender,
    gender_identity text,
    marital_status public.marital_status,
    religion text,
    nationality_id uuid,
    preferred_language text,
    birth_place text,
    blood_group public.blood_group,
    blood_group_verified boolean DEFAULT false NOT NULL,
    no_known_allergies boolean,
    occupation text,
    education_level text,
    phone_secondary text,
    preferred_contact_method text,
    registration_type public.registration_type DEFAULT 'new'::public.registration_type NOT NULL,
    registration_source public.registration_source,
    registered_by uuid,
    registered_at_facility uuid,
    financial_class public.financial_class DEFAULT 'self_pay'::public.financial_class NOT NULL,
    is_medico_legal boolean DEFAULT false NOT NULL,
    mlc_number text,
    is_unknown_patient boolean DEFAULT false NOT NULL,
    temporary_name text,
    is_vip boolean DEFAULT false NOT NULL,
    is_deceased boolean DEFAULT false NOT NULL,
    deceased_date timestamp with time zone,
    photo_url text,
    photo_captured_at timestamp with time zone,
    data_quality_score smallint,
    last_visit_date date,
    total_visits integer DEFAULT 0 NOT NULL,
    is_merged boolean DEFAULT false NOT NULL,
    merged_into_patient_id uuid,
    source_system text,
    legacy_id text,
    abha_number text,
    address_line1 text
);



--
-- Name: age_estimations age_estimations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.age_estimations
    ADD CONSTRAINT age_estimations_pkey PRIMARY KEY (id);



--
-- Name: master_occupations master_occupations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_occupations
    ADD CONSTRAINT master_occupations_pkey PRIMARY KEY (id);



--
-- Name: master_occupations master_occupations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_occupations
    ADD CONSTRAINT master_occupations_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: master_relations master_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_relations
    ADD CONSTRAINT master_relations_pkey PRIMARY KEY (id);



--
-- Name: master_relations master_relations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_relations
    ADD CONSTRAINT master_relations_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: master_religions master_religions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_religions
    ADD CONSTRAINT master_religions_pkey PRIMARY KEY (id);



--
-- Name: master_religions master_religions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_religions
    ADD CONSTRAINT master_religions_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: patient_abha_links patient_abha_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_pkey PRIMARY KEY (id);



--
-- Name: patient_abha_links patient_abha_links_tenant_id_abha_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_tenant_id_abha_number_key UNIQUE (tenant_id, abha_number);



--
-- Name: patient_abha_links patient_abha_links_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);



--
-- Name: patient_addresses patient_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_pkey PRIMARY KEY (id);



--
-- Name: patient_addresses patient_addresses_tenant_id_patient_id_address_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_tenant_id_patient_id_address_type_key UNIQUE (tenant_id, patient_id, address_type);



--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);



--
-- Name: patient_contacts patient_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_pkey PRIMARY KEY (id);



--
-- Name: patient_documents patient_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_pkey PRIMARY KEY (id);



--
-- Name: patient_education patient_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_education
    ADD CONSTRAINT patient_education_pkey PRIMARY KEY (id);



--
-- Name: patient_family_links patient_family_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_pkey PRIMARY KEY (id);



--
-- Name: patient_family_links patient_family_links_tenant_id_patient_id_related_patient_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_tenant_id_patient_id_related_patient_i_key UNIQUE (tenant_id, patient_id, related_patient_id);



--
-- Name: patient_feedback patient_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_pkey PRIMARY KEY (id);



--
-- Name: patient_identifiers patient_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_pkey PRIMARY KEY (id);



--
-- Name: patient_identifiers patient_identifiers_tenant_id_patient_id_id_type_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_tenant_id_patient_id_id_type_id_number_key UNIQUE (tenant_id, patient_id, id_type, id_number);



--
-- Name: patient_merge_history patient_merge_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_pkey PRIMARY KEY (id);



--
-- Name: patient_outcome_targets patient_outcome_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_pkey PRIMARY KEY (id);



--
-- Name: patient_reminders patient_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_pkey PRIMARY KEY (id);



--
-- Name: patient_transfers patient_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_pkey PRIMARY KEY (id);



--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);



--
-- Name: patients patients_tenant_id_uhid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_uhid_key UNIQUE (tenant_id, uhid);



--
-- Name: idx_feedback_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_doctor ON public.patient_feedback USING btree (doctor_id);



--
-- Name: idx_feedback_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_encounter ON public.patient_feedback USING btree (encounter_id);



--
-- Name: idx_feedback_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_tenant ON public.patient_feedback USING btree (tenant_id);



--
-- Name: idx_outcome_targets_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outcome_targets_patient ON public.patient_outcome_targets USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_abha_links_abha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_abha_links_abha ON public.patient_abha_links USING btree (abha_number);



--
-- Name: idx_patient_addresses_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_addresses_patient ON public.patient_addresses USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_allergies_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_contacts_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_contacts_patient ON public.patient_contacts USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_documents_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_documents_patient ON public.patient_documents USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_education_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_education_patient ON public.patient_education USING btree (tenant_id, patient_id, provided_at DESC);



--
-- Name: idx_patient_family_links_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_family_links_patient ON public.patient_family_links USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_family_links_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_family_links_related ON public.patient_family_links USING btree (tenant_id, related_patient_id);



--
-- Name: idx_patient_identifiers_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_identifiers_hash ON public.patient_identifiers USING btree (tenant_id, id_type, id_number_hash);



--
-- Name: idx_patient_identifiers_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_identifiers_number ON public.patient_identifiers USING btree (tenant_id, id_type, id_number);



--
-- Name: idx_patient_identifiers_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_identifiers_patient ON public.patient_identifiers USING btree (tenant_id, patient_id);



--
-- Name: idx_patient_transfers_dest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_transfers_dest ON public.patient_transfers USING btree (dest_tenant_id);



--
-- Name: idx_patient_transfers_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_transfers_patient ON public.patient_transfers USING btree (patient_id);



--
-- Name: idx_patient_transfers_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_transfers_source ON public.patient_transfers USING btree (source_tenant_id);



--
-- Name: idx_patient_transfers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_transfers_status ON public.patient_transfers USING btree (status);



--
-- Name: idx_patients_abha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_abha ON public.patients USING btree (abha_id) WHERE (abha_id IS NOT NULL);



--
-- Name: idx_patients_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_created_by ON public.patients USING btree (created_by);



--
-- Name: idx_patients_dob; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_dob ON public.patients USING btree (tenant_id, date_of_birth);



--
-- Name: idx_patients_first_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_first_name_trgm ON public.patients USING gin (first_name public.gin_trgm_ops);



--
-- Name: idx_patients_fulltext; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_fulltext ON public.patients USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)) || ' '::text) || COALESCE(phone, ''::text)) || ' '::text) || COALESCE(uhid, ''::text))));



--
-- Name: idx_patients_last_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_last_name_trgm ON public.patients USING gin (last_name public.gin_trgm_ops);



--
-- Name: idx_patients_mpi_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_mpi_block ON public.patients USING btree (tenant_id, date_of_birth, "substring"(first_name, 1, 3));



--
-- Name: idx_patients_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_phone ON public.patients USING btree (tenant_id, phone);



--
-- Name: idx_patients_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_tenant ON public.patients USING btree (tenant_id);



--
-- Name: idx_reminders_doctor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_doctor_date ON public.patient_reminders USING btree (doctor_id, reminder_date);



--
-- Name: idx_reminders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_patient ON public.patient_reminders USING btree (patient_id);



--
-- Name: idx_reminders_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_status_date ON public.patient_reminders USING btree (status, reminder_date);



--
-- Name: idx_reminders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reminders_tenant ON public.patient_reminders USING btree (tenant_id);



--
-- Name: patient_addresses audit_patient_addresses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_addresses AFTER INSERT OR DELETE OR UPDATE ON public.patient_addresses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');



--
-- Name: patient_allergies audit_patient_allergies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_allergies AFTER INSERT OR DELETE OR UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');



--
-- Name: patient_contacts audit_patient_contacts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_contacts AFTER INSERT OR DELETE OR UPDATE ON public.patient_contacts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');



--
-- Name: patients audit_patients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');



--
-- Name: patient_abha_links trg_patient_abha_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_abha_links_updated_at BEFORE UPDATE ON public.patient_abha_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_addresses trg_patient_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_addresses_updated_at BEFORE UPDATE ON public.patient_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_allergies trg_patient_allergies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_allergies_updated_at BEFORE UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_contacts trg_patient_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_contacts_updated_at BEFORE UPDATE ON public.patient_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_family_links trg_patient_family_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_family_links_updated_at BEFORE UPDATE ON public.patient_family_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_identifiers trg_patient_identifiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_identifiers_updated_at BEFORE UPDATE ON public.patient_identifiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_outcome_targets trg_patient_outcome_targets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_outcome_targets_updated_at BEFORE UPDATE ON public.patient_outcome_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_transfers trg_patient_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_transfers_updated_at BEFORE UPDATE ON public.patient_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patients trg_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_abha_links patient_abha_links_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_addresses patient_addresses_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_allergies patient_allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_contacts patient_contacts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_documents patient_documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_family_links patient_family_links_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_family_links patient_family_links_related_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_related_patient_id_fkey FOREIGN KEY (related_patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_feedback patient_feedback_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);



--
-- Name: patient_identifiers patient_identifiers_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;



--
-- Name: patient_merge_history patient_merge_history_merged_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_merged_patient_id_fkey FOREIGN KEY (merged_patient_id) REFERENCES public.patients(id);



--
-- Name: patient_merge_history patient_merge_history_surviving_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_surviving_patient_id_fkey FOREIGN KEY (surviving_patient_id) REFERENCES public.patients(id);



--
-- Name: patient_outcome_targets patient_outcome_targets_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);



--
-- Name: patient_reminders patient_reminders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);



--
-- Name: patient_transfers patient_transfers_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);



--
-- Name: patients patients_merged_into_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_merged_into_patient_id_fkey FOREIGN KEY (merged_into_patient_id) REFERENCES public.patients(id);



--
-- Name: age_estimations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.age_estimations ENABLE ROW LEVEL SECURITY;


--
-- Name: master_occupations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_occupations ENABLE ROW LEVEL SECURITY;


--
-- Name: master_relations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_relations ENABLE ROW LEVEL SECURITY;


--
-- Name: master_religions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_religions ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_abha_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_abha_links ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_addresses ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_allergies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_contacts ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_education; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_education ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_family_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_family_links ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_feedback patient_feedback_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_feedback_tenant ON public.patient_feedback USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: patient_identifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_identifiers ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_merge_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_merge_history ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_outcome_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_outcome_targets ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_reminders patient_reminders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_reminders_tenant ON public.patient_reminders USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_outcome_targets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_outcome_targets USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: age_estimations tenant_isolation_age_estimations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_age_estimations ON public.age_estimations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: master_occupations tenant_isolation_master_occupations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_occupations ON public.master_occupations USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: master_relations tenant_isolation_master_relations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_relations ON public.master_relations USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: master_religions tenant_isolation_master_religions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_religions ON public.master_religions USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: patient_abha_links tenant_isolation_patient_abha_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_abha_links ON public.patient_abha_links USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_addresses tenant_isolation_patient_addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_addresses ON public.patient_addresses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_allergies tenant_isolation_patient_allergies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_allergies ON public.patient_allergies USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_contacts tenant_isolation_patient_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_contacts ON public.patient_contacts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_documents tenant_isolation_patient_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_documents ON public.patient_documents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_education tenant_isolation_patient_education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_education ON public.patient_education USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_family_links tenant_isolation_patient_family_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_family_links ON public.patient_family_links USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_identifiers tenant_isolation_patient_identifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_identifiers ON public.patient_identifiers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_merge_history tenant_isolation_patient_merge_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_merge_history ON public.patient_merge_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patients tenant_isolation_patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patients ON public.patients USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


