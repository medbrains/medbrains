-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 26
-- Drops: none
-- patient — schema.
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    certificate_number text,
    certificate_date date,
    person_name text,
    person_gender text,
    stated_age text,
    purpose_of_examination text,
    requisition_from text,
    requisition_number text,
    requisition_date date,
    general_physical_development text,
    height_cm numeric,
    weight_kg numeric,
    breast_development text,
    pubic_hair text,
    axillary_hair text,
    facial_hair text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: age_estimations age_estimations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.age_estimations
    ADD CONSTRAINT age_estimations_pkey PRIMARY KEY (id);

CREATE INDEX idx_age_estimations_deleted_at_0b28defb ON public.age_estimations USING btree (deleted_at);

CREATE INDEX idx_age_estimations_tenant_id ON public.age_estimations USING btree (tenant_id);

ALTER TABLE ONLY public.age_estimations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.age_estimations ENABLE ROW LEVEL SECURITY;

-- Name: age_estimations tenant_isolation_age_estimations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_age_estimations ON public.age_estimations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: age_estimations trg_age_estimations_soft_delete_0b28defb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_age_estimations_soft_delete_0b28defb BEFORE DELETE ON public.age_estimations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.consent_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consent_source text NOT NULL,
    consent_id uuid NOT NULL,
    action public.consent_audit_action NOT NULL,
    old_status text,
    new_status text,
    changed_by uuid,
    change_reason text,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT consent_audit_log_consent_source_check CHECK ((consent_source = ANY (ARRAY['patient_consent'::text, 'procedure_consent'::text])))
);

-- Name: consent_audit_log consent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_consent_audit_consent ON public.consent_audit_log USING btree (consent_source, consent_id);

CREATE INDEX idx_consent_audit_log_deleted_at_7f874fa4 ON public.consent_audit_log USING btree (deleted_at);

CREATE INDEX idx_consent_audit_log_patient_id ON public.consent_audit_log USING btree (patient_id);

CREATE INDEX idx_consent_audit_patient ON public.consent_audit_log USING btree (tenant_id, patient_id);

CREATE INDEX idx_consent_audit_tenant ON public.consent_audit_log USING btree (tenant_id);

ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

-- Name: consent_audit_log tenant_isolation_consent_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_audit ON public.consent_audit_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: consent_audit_log trg_consent_audit_log_soft_delete_7f874fa4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_audit_log_soft_delete_7f874fa4 BEFORE DELETE ON public.consent_audit_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    encounter_id uuid,
    booking_id uuid,
    consent_type character varying(50) NOT NULL,
    template_id uuid,
    procedure_name text,
    risks_explained text,
    alternatives_discussed text,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    signed_by_patient boolean DEFAULT false,
    patient_signature_data text,
    patient_signed_at timestamp with time zone,
    patient_capacity_confirmed boolean DEFAULT true,
    guardian_name character varying(200),
    guardian_relation character varying(100),
    guardian_signature_data text,
    guardian_signed_at timestamp with time zone,
    witness_name character varying(200),
    witness_designation character varying(100),
    witness_signature_data text,
    witness_signed_at timestamp with time zone,
    obtained_by uuid,
    obtained_at timestamp with time zone,
    pdf_url text,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revocation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    trial_id uuid,
    CONSTRAINT consent_records_consent_type_check CHECK (((consent_type)::text = ANY (ARRAY[('general_admission'::character varying)::text, ('surgical'::character varying)::text, ('anesthesia'::character varying)::text, ('blood_transfusion'::character varying)::text, ('hiv_testing'::character varying)::text, ('ama'::character varying)::text, ('photography'::character varying)::text, ('teaching'::character varying)::text, ('research'::character varying)::text, ('dnr'::character varying)::text, ('organ_donation'::character varying)::text, ('abdm'::character varying)::text, ('refusal_treatment'::character varying)::text])))
);

-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_consent_records_active ON public.consent_records USING btree (patient_id, consent_type) WHERE (NOT is_revoked);

CREATE INDEX idx_consent_records_admission ON public.consent_records USING btree (admission_id) WHERE (admission_id IS NOT NULL);

CREATE INDEX idx_consent_records_deleted_at_3924f05b ON public.consent_records USING btree (deleted_at);

CREATE INDEX idx_consent_records_encounter_id ON public.consent_records USING btree (encounter_id);

CREATE INDEX idx_consent_records_patient ON public.consent_records USING btree (patient_id);

CREATE INDEX idx_consent_records_template_id ON public.consent_records USING btree (template_id);

CREATE INDEX idx_consent_records_tenant ON public.consent_records USING btree (tenant_id);

CREATE INDEX idx_consent_records_trial ON public.consent_records USING btree (tenant_id, trial_id) WHERE (trial_id IS NOT NULL);

CREATE INDEX idx_consent_records_type ON public.consent_records USING btree (consent_type);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Name: consent_records consent_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_records_tenant ON public.consent_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: consent_records trg_consent_records_soft_delete_3924f05b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_records_soft_delete_3924f05b BEFORE DELETE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: consent_records trg_consent_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_records_updated_at BEFORE UPDATE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.consent_signature_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consent_source text NOT NULL,
    consent_id uuid NOT NULL,
    signature_type public.signature_type NOT NULL,
    signature_image_url text,
    video_consent_url text,
    aadhaar_esign_ref text,
    aadhaar_esign_timestamp timestamp with time zone,
    biometric_hash text,
    biometric_device_id text,
    witness_name text,
    witness_designation text,
    witness_signature_url text,
    doctor_signature_url text,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    captured_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT consent_signature_metadata_consent_source_check CHECK ((consent_source = ANY (ARRAY['patient_consent'::text, 'procedure_consent'::text])))
);

-- Name: consent_signature_metadata consent_signature_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_signature_metadata
    ADD CONSTRAINT consent_signature_metadata_pkey PRIMARY KEY (id);

CREATE INDEX idx_consent_sig_consent ON public.consent_signature_metadata USING btree (consent_source, consent_id);

CREATE INDEX idx_consent_sig_tenant ON public.consent_signature_metadata USING btree (tenant_id);

CREATE INDEX idx_consent_signature_metadata_deleted_at_73c36cf2 ON public.consent_signature_metadata USING btree (deleted_at);

ALTER TABLE public.consent_signature_metadata ENABLE ROW LEVEL SECURITY;

-- Name: consent_signature_metadata tenant_isolation_consent_sig; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_sig ON public.consent_signature_metadata USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: consent_signature_metadata trg_consent_signature_metadata_soft_delete_73c36cf2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_signature_metadata_soft_delete_73c36cf2 BEFORE DELETE ON public.consent_signature_metadata FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.consent_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category public.consent_template_category DEFAULT 'general'::public.consent_template_category NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    body_text jsonb DEFAULT '{}'::jsonb NOT NULL,
    risks_section jsonb,
    alternatives_section jsonb,
    benefits_section jsonb,
    required_fields text[] DEFAULT '{}'::text[],
    requires_witness boolean DEFAULT false NOT NULL,
    requires_doctor boolean DEFAULT true NOT NULL,
    validity_days integer,
    applicable_departments uuid[],
    is_read_aloud_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: consent_templates consent_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_pkey PRIMARY KEY (id);

-- Name: consent_templates consent_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_consent_templates_category ON public.consent_templates USING btree (tenant_id, category);

CREATE INDEX idx_consent_templates_deleted_at_4900bf64 ON public.consent_templates USING btree (deleted_at);

CREATE INDEX idx_consent_templates_tenant ON public.consent_templates USING btree (tenant_id);

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

-- Name: consent_templates tenant_isolation_consent_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_templates ON public.consent_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: consent_templates trg_consent_templates_soft_delete_4900bf64; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_templates_soft_delete_4900bf64 BEFORE DELETE ON public.consent_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: consent_templates trg_consent_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_templates_updated_at BEFORE UPDATE ON public.consent_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.master_occupations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: master_occupations master_occupations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_occupations
    ADD CONSTRAINT master_occupations_pkey PRIMARY KEY (id);

-- Name: master_occupations master_occupations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_occupations
    ADD CONSTRAINT master_occupations_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_master_occupations_deleted_at_869f4de1 ON public.master_occupations USING btree (deleted_at);

ALTER TABLE public.master_occupations ENABLE ROW LEVEL SECURITY;

-- Name: master_occupations tenant_isolation_master_occupations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_occupations ON public.master_occupations USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: master_occupations trg_master_occupations_soft_delete_869f4de1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_occupations_soft_delete_869f4de1 BEFORE DELETE ON public.master_occupations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.master_relations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: master_relations master_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_relations
    ADD CONSTRAINT master_relations_pkey PRIMARY KEY (id);

-- Name: master_relations master_relations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_relations
    ADD CONSTRAINT master_relations_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_master_relations_deleted_at_89d6849f ON public.master_relations USING btree (deleted_at);

ALTER TABLE public.master_relations ENABLE ROW LEVEL SECURITY;

-- Name: master_relations tenant_isolation_master_relations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_relations ON public.master_relations USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: master_relations trg_master_relations_soft_delete_89d6849f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_relations_soft_delete_89d6849f BEFORE DELETE ON public.master_relations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.master_religions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: master_religions master_religions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_religions
    ADD CONSTRAINT master_religions_pkey PRIMARY KEY (id);

-- Name: master_religions master_religions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_religions
    ADD CONSTRAINT master_religions_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_master_religions_deleted_at_9becdfca ON public.master_religions USING btree (deleted_at);

ALTER TABLE public.master_religions ENABLE ROW LEVEL SECURITY;

-- Name: master_religions tenant_isolation_master_religions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_religions ON public.master_religions USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: master_religions trg_master_religions_soft_delete_9becdfca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_religions_soft_delete_9becdfca BEFORE DELETE ON public.master_religions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_abha_links patient_abha_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_pkey PRIMARY KEY (id);

-- Name: patient_abha_links patient_abha_links_tenant_id_abha_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_tenant_id_abha_number_key UNIQUE (tenant_id, abha_number);

-- Name: patient_abha_links patient_abha_links_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);

CREATE INDEX idx_patient_abha_links_abha ON public.patient_abha_links USING btree (abha_number);

CREATE INDEX idx_patient_abha_links_deleted_at_927bb3bd ON public.patient_abha_links USING btree (deleted_at);

CREATE INDEX idx_patient_abha_links_patient_id ON public.patient_abha_links USING btree (patient_id);

ALTER TABLE public.patient_abha_links ENABLE ROW LEVEL SECURITY;

-- Name: patient_abha_links tenant_isolation_patient_abha_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_abha_links ON public.patient_abha_links USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_abha_links trg_patient_abha_links_soft_delete_927bb3bd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_abha_links_soft_delete_927bb3bd BEFORE DELETE ON public.patient_abha_links FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_abha_links trg_patient_abha_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_abha_links_updated_at BEFORE UPDATE ON public.patient_abha_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_addresses patient_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_pkey PRIMARY KEY (id);

-- Name: patient_addresses patient_addresses_tenant_id_patient_id_address_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_tenant_id_patient_id_address_type_key UNIQUE (tenant_id, patient_id, address_type);

CREATE INDEX idx_patient_addresses_deleted_at_2e3a97b0 ON public.patient_addresses USING btree (deleted_at);

CREATE INDEX idx_patient_addresses_patient ON public.patient_addresses USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_addresses_patient_id ON public.patient_addresses USING btree (patient_id);

ALTER TABLE public.patient_addresses ENABLE ROW LEVEL SECURITY;

-- Name: patient_addresses tenant_isolation_patient_addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_addresses ON public.patient_addresses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_addresses audit_patient_addresses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_addresses AFTER INSERT OR DELETE OR UPDATE ON public.patient_addresses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

-- Name: patient_addresses trg_patient_addresses_soft_delete_2e3a97b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_addresses_soft_delete_2e3a97b0 BEFORE DELETE ON public.patient_addresses FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_addresses trg_patient_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_addresses_updated_at BEFORE UPDATE ON public.patient_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_allergies_deleted_at_375caab9 ON public.patient_allergies USING btree (deleted_at);

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_allergies_patient_id ON public.patient_allergies USING btree (patient_id);

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

-- Name: patient_allergies tenant_isolation_patient_allergies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_allergies ON public.patient_allergies USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_allergies audit_patient_allergies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_allergies AFTER INSERT OR DELETE OR UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

-- Name: patient_allergies trg_patient_allergies_soft_delete_375caab9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_allergies_soft_delete_375caab9 BEFORE DELETE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_allergies trg_patient_allergies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_allergies_updated_at BEFORE UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.patient_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consent_type public.consent_type NOT NULL,
    consent_status public.consent_status DEFAULT 'pending'::public.consent_status NOT NULL,
    consent_date timestamp with time zone DEFAULT now() NOT NULL,
    consent_version text,
    consented_by text NOT NULL,
    consented_by_relation text,
    witness_name text,
    capture_mode public.consent_capture_mode NOT NULL,
    document_url text,
    valid_until date,
    notes text,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id uuid,
    signature_metadata_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_consents patient_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_consents_deleted_at_ed67ab5e ON public.patient_consents USING btree (deleted_at);

CREATE INDEX idx_patient_consents_patient ON public.patient_consents USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_consents_patient_id ON public.patient_consents USING btree (patient_id);

CREATE INDEX idx_patient_consents_template_id ON public.patient_consents USING btree (template_id);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

-- Name: patient_consents tenant_isolation_patient_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_consents ON public.patient_consents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_consents audit_patient_consents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_consents AFTER INSERT OR DELETE OR UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('consent');

-- Name: patient_consents trg_patient_consents_soft_delete_ed67ab5e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consents_soft_delete_ed67ab5e BEFORE DELETE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_consents trg_patient_consents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consents_updated_at BEFORE UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_contacts patient_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_contacts_deleted_at_1e0111dd ON public.patient_contacts USING btree (deleted_at);

CREATE INDEX idx_patient_contacts_patient ON public.patient_contacts USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_contacts_patient_id ON public.patient_contacts USING btree (patient_id);

ALTER TABLE public.patient_contacts ENABLE ROW LEVEL SECURITY;

-- Name: patient_contacts tenant_isolation_patient_contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_contacts ON public.patient_contacts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_contacts audit_patient_contacts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_contacts AFTER INSERT OR DELETE OR UPDATE ON public.patient_contacts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

-- Name: patient_contacts trg_patient_contacts_soft_delete_1e0111dd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_contacts_soft_delete_1e0111dd BEFORE DELETE ON public.patient_contacts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_contacts trg_patient_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_contacts_updated_at BEFORE UPDATE ON public.patient_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_tier public.storage_tier DEFAULT 'hot'::public.storage_tier NOT NULL,
    tier_key text,
    last_tier_transition_at timestamp with time zone,
    scheduled_delete_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_documents patient_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_documents_deleted_at_c78ec2d7 ON public.patient_documents USING btree (deleted_at);

CREATE INDEX idx_patient_documents_patient ON public.patient_documents USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_documents_patient_id ON public.patient_documents USING btree (patient_id);

CREATE INDEX idx_patient_documents_tier_sweep ON public.patient_documents USING btree (storage_tier, last_tier_transition_at) WHERE (storage_tier = ANY (ARRAY['hot'::public.storage_tier, 'cold'::public.storage_tier]));

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Name: patient_documents tenant_isolation_patient_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_documents ON public.patient_documents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_documents trg_patient_documents_soft_delete_c78ec2d7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_documents_soft_delete_c78ec2d7 BEFORE DELETE ON public.patient_documents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.patient_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    material_id uuid,
    language text DEFAULT 'en'::text NOT NULL,
    provided_at timestamp with time zone DEFAULT now() NOT NULL,
    provided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_education patient_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_education
    ADD CONSTRAINT patient_education_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_education_deleted_at_860a3608 ON public.patient_education USING btree (deleted_at);

CREATE INDEX idx_patient_education_patient ON public.patient_education USING btree (tenant_id, patient_id, provided_at DESC);

ALTER TABLE ONLY public.patient_education FORCE ROW LEVEL SECURITY;

ALTER TABLE public.patient_education ENABLE ROW LEVEL SECURITY;

-- Name: patient_education tenant_isolation_patient_education; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_education ON public.patient_education USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_education trg_patient_education_soft_delete_860a3608; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_education_soft_delete_860a3608 BEFORE DELETE ON public.patient_education FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_family_links_check CHECK ((patient_id <> related_patient_id))
);

-- Name: patient_family_links patient_family_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_pkey PRIMARY KEY (id);

-- Name: patient_family_links patient_family_links_tenant_id_patient_id_related_patient_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_tenant_id_patient_id_related_patient_i_key UNIQUE (tenant_id, patient_id, related_patient_id);

CREATE INDEX idx_patient_family_links_deleted_at_0dda3f37 ON public.patient_family_links USING btree (deleted_at);

CREATE INDEX idx_patient_family_links_patient ON public.patient_family_links USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_family_links_patient_id ON public.patient_family_links USING btree (patient_id);

CREATE INDEX idx_patient_family_links_related ON public.patient_family_links USING btree (tenant_id, related_patient_id);

ALTER TABLE public.patient_family_links ENABLE ROW LEVEL SECURITY;

-- Name: patient_family_links tenant_isolation_patient_family_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_family_links ON public.patient_family_links USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_family_links trg_patient_family_links_soft_delete_0dda3f37; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_family_links_soft_delete_0dda3f37 BEFORE DELETE ON public.patient_family_links FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_family_links trg_patient_family_links_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_family_links_updated_at BEFORE UPDATE ON public.patient_family_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_feedback_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    CONSTRAINT patient_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT patient_feedback_staff_rating_check CHECK (((staff_rating >= 1) AND (staff_rating <= 5))),
    CONSTRAINT patient_feedback_wait_time_rating_check CHECK (((wait_time_rating >= 1) AND (wait_time_rating <= 5)))
);

-- Name: patient_feedback patient_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_pkey PRIMARY KEY (id);

CREATE INDEX idx_feedback_doctor ON public.patient_feedback USING btree (doctor_id);

CREATE INDEX idx_feedback_encounter ON public.patient_feedback USING btree (encounter_id);

CREATE INDEX idx_feedback_tenant ON public.patient_feedback USING btree (tenant_id);

CREATE INDEX idx_patient_feedback_deleted_at_4b66eb6a ON public.patient_feedback USING btree (deleted_at);

CREATE INDEX idx_patient_feedback_department_id ON public.patient_feedback USING btree (department_id);

CREATE INDEX idx_patient_feedback_patient_id ON public.patient_feedback USING btree (patient_id);

ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;

-- Name: patient_feedback patient_feedback_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_feedback_tenant ON public.patient_feedback USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: patient_feedback trg_patient_feedback_soft_delete_4b66eb6a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_feedback_soft_delete_4b66eb6a BEFORE DELETE ON public.patient_feedback FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_identifiers patient_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_pkey PRIMARY KEY (id);

-- Name: patient_identifiers patient_identifiers_tenant_id_patient_id_id_type_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_tenant_id_patient_id_id_type_id_number_key UNIQUE (tenant_id, patient_id, id_type, id_number);

CREATE INDEX idx_patient_identifiers_deleted_at_449a05aa ON public.patient_identifiers USING btree (deleted_at);

CREATE INDEX idx_patient_identifiers_hash ON public.patient_identifiers USING btree (tenant_id, id_type, id_number_hash);

CREATE INDEX idx_patient_identifiers_number ON public.patient_identifiers USING btree (tenant_id, id_type, id_number);

CREATE INDEX idx_patient_identifiers_patient ON public.patient_identifiers USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_identifiers_patient_id ON public.patient_identifiers USING btree (patient_id);

ALTER TABLE public.patient_identifiers ENABLE ROW LEVEL SECURITY;

-- Name: patient_identifiers tenant_isolation_patient_identifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_identifiers ON public.patient_identifiers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_identifiers trg_patient_identifiers_soft_delete_449a05aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_identifiers_soft_delete_449a05aa BEFORE DELETE ON public.patient_identifiers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_identifiers trg_patient_identifiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_identifiers_updated_at BEFORE UPDATE ON public.patient_identifiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_merge_history patient_merge_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_merge_history_deleted_at_99b25bb1 ON public.patient_merge_history USING btree (deleted_at);

CREATE INDEX idx_patient_merge_history_tenant_id ON public.patient_merge_history USING btree (tenant_id);

ALTER TABLE public.patient_merge_history ENABLE ROW LEVEL SECURITY;

-- Name: patient_merge_history tenant_isolation_patient_merge_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_merge_history ON public.patient_merge_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_merge_history trg_patient_merge_history_soft_delete_99b25bb1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_merge_history_soft_delete_99b25bb1 BEFORE DELETE ON public.patient_merge_history FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_outcome_targets_comparison_check CHECK ((comparison = ANY (ARRAY['<'::text, '<='::text, '='::text, '>='::text, '>'::text])))
);

-- Name: patient_outcome_targets patient_outcome_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_pkey PRIMARY KEY (id);

CREATE INDEX idx_outcome_targets_patient ON public.patient_outcome_targets USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_outcome_targets_deleted_at_9f4d53f9 ON public.patient_outcome_targets USING btree (deleted_at);

CREATE INDEX idx_patient_outcome_targets_patient_id ON public.patient_outcome_targets USING btree (patient_id);

ALTER TABLE public.patient_outcome_targets ENABLE ROW LEVEL SECURITY;

-- Name: patient_outcome_targets tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_outcome_targets USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: patient_outcome_targets trg_patient_outcome_targets_soft_delete_9f4d53f9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_outcome_targets_soft_delete_9f4d53f9 BEFORE DELETE ON public.patient_outcome_targets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_outcome_targets trg_patient_outcome_targets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_outcome_targets_updated_at BEFORE UPDATE ON public.patient_outcome_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: patient_portal_otps
-- Drops: none
-- One-time codes that let a patient into their own record.
-- Deliberately NOT the public_booking_otps table. That code is sent to somebody
-- asking for an appointment slot; this one unlocks a person's bills, results
-- and prescriptions. Sharing one table would mean a code issued for the smaller
-- purpose grants the larger one, which is how a booking form becomes a way into
-- a stranger's chart. Different purpose, different credential.
-- Mirrors the booking-OTP shape otherwise: hashed, single-use, short-lived.
-- The plaintext code is never stored.

CREATE TABLE public.patient_portal_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: patient_portal_otps patient_portal_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_portal_otps
    ADD CONSTRAINT patient_portal_otps_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_portal_otps_live ON public.patient_portal_otps USING btree (tenant_id, phone, expires_at) WHERE (used_at IS NULL);

ALTER TABLE public.patient_portal_otps ENABLE ROW LEVEL SECURITY;

-- Name: patient_portal_otps patient_portal_otps_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_portal_otps_tenant_isolation ON public.patient_portal_otps USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: TABLE patient_portal_otps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.patient_portal_otps IS 'Single-use SMS codes for patient portal sign-in. Separate from public_booking_otps on purpose: a booking code must not unlock a full record.';

-- Migration: 0180_patient_record_access_log.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Read-access logging. The audit_log captures writes; for DPDP/HIPAA a
-- paperless record must also log who *viewed / downloaded* a patient's
-- records. This is the read-access trail, surfaced for transparency and
-- breach investigation.

CREATE TABLE public.patient_record_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    accessed_by uuid NOT NULL,
    access_type text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

-- Name: patient_record_access_log patient_record_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_record_access_log
    ADD CONSTRAINT patient_record_access_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_record_access_log_patient ON public.patient_record_access_log USING btree (tenant_id, patient_id, accessed_at DESC);

ALTER TABLE public.patient_record_access_log ENABLE ROW LEVEL SECURITY;

-- Name: patient_record_access_log tenant_isolation_patient_record_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_record_access_log ON public.patient_record_access_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_reminders_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('normal'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT patient_reminders_reminder_type_check CHECK (((reminder_type)::text = ANY (ARRAY[('follow_up'::character varying)::text, ('lab_review'::character varying)::text, ('medication_review'::character varying)::text, ('vaccination'::character varying)::text, ('screening'::character varying)::text, ('custom'::character varying)::text]))),
    CONSTRAINT patient_reminders_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('sent'::character varying)::text, ('acknowledged'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('overdue'::character varying)::text])))
);

-- Name: patient_reminders patient_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_reminders_deleted_at_85deccde ON public.patient_reminders USING btree (deleted_at);

CREATE INDEX idx_patient_reminders_encounter_id ON public.patient_reminders USING btree (encounter_id);

CREATE INDEX idx_reminders_doctor_date ON public.patient_reminders USING btree (doctor_id, reminder_date);

CREATE INDEX idx_reminders_patient ON public.patient_reminders USING btree (patient_id);

CREATE INDEX idx_reminders_status_date ON public.patient_reminders USING btree (status, reminder_date);

CREATE INDEX idx_reminders_tenant ON public.patient_reminders USING btree (tenant_id);

ALTER TABLE public.patient_reminders ENABLE ROW LEVEL SECURITY;

-- Name: patient_reminders patient_reminders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_reminders_tenant ON public.patient_reminders USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: patient_reminders trg_patient_reminders_soft_delete_85deccde; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_reminders_soft_delete_85deccde BEFORE DELETE ON public.patient_reminders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_transfers patient_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_transfers_deleted_at_3952ae08 ON public.patient_transfers USING btree (deleted_at);

CREATE INDEX idx_patient_transfers_dest ON public.patient_transfers USING btree (dest_tenant_id);

CREATE INDEX idx_patient_transfers_patient ON public.patient_transfers USING btree (patient_id);

CREATE INDEX idx_patient_transfers_source ON public.patient_transfers USING btree (source_tenant_id);

CREATE INDEX idx_patient_transfers_status ON public.patient_transfers USING btree (status);

-- Name: patient_transfers trg_patient_transfers_soft_delete_3952ae08; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_transfers_soft_delete_3952ae08 BEFORE DELETE ON public.patient_transfers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_transfers trg_patient_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_transfers_updated_at BEFORE UPDATE ON public.patient_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    address_line1 text,
    abha_address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);

-- Name: patients patients_tenant_id_uhid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_tenant_id_uhid_key UNIQUE (tenant_id, uhid);

CREATE INDEX idx_patients_abha ON public.patients USING btree (abha_id) WHERE (abha_id IS NOT NULL);

CREATE INDEX idx_patients_camp_external_ref ON public.patients USING btree (tenant_id, (((attributes -> 'registration_context'::text) ->> 'external_ref'::text))) WHERE ((is_active = true) AND (((attributes -> 'registration_context'::text) ->> 'external_ref'::text) IS NOT NULL));

CREATE INDEX idx_patients_created_by ON public.patients USING btree (created_by);

CREATE INDEX idx_patients_deleted_at_3495d5d8 ON public.patients USING btree (deleted_at);

CREATE INDEX idx_patients_dob ON public.patients USING btree (tenant_id, date_of_birth);

CREATE INDEX idx_patients_first_name_trgm ON public.patients USING gin (first_name public.gin_trgm_ops);

CREATE INDEX idx_patients_fulltext ON public.patients USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text)) || ' '::text) || COALESCE(phone, ''::text)) || ' '::text) || COALESCE(uhid, ''::text))));

CREATE INDEX idx_patients_last_name_trgm ON public.patients USING gin (last_name public.gin_trgm_ops);

CREATE INDEX idx_patients_mpi_block ON public.patients USING btree (tenant_id, date_of_birth, "substring"(first_name, 1, 3));

CREATE INDEX idx_patients_phone ON public.patients USING btree (tenant_id, phone);

CREATE INDEX idx_patients_tenant ON public.patients USING btree (tenant_id);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Name: patients tenant_isolation_patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patients ON public.patients USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patients audit_patients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patients AFTER INSERT OR DELETE OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

-- Name: patients trg_patients_soft_delete_3495d5d8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patients_soft_delete_3495d5d8 BEFORE DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patients trg_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.procedure_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    procedure_order_id uuid,
    procedure_name character varying(200) NOT NULL,
    consent_type character varying(30) DEFAULT 'procedure'::character varying NOT NULL,
    risks_explained text,
    alternatives_explained text,
    benefits_explained text,
    patient_questions text,
    consented_by_name character varying(200),
    consented_by_relation character varying(50),
    witness_name character varying(200),
    witness_designation character varying(100),
    doctor_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    signed_at timestamp with time zone,
    refused_at timestamp with time zone,
    refusal_reason text,
    withdrawn_at timestamp with time zone,
    withdrawal_reason text,
    expires_at timestamp with time zone,
    body jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id uuid,
    signature_metadata_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT procedure_consents_consent_type_check CHECK (((consent_type)::text = ANY (ARRAY[('procedure'::character varying)::text, ('anesthesia'::character varying)::text, ('blood_transfusion'::character varying)::text, ('surgery'::character varying)::text, ('investigation'::character varying)::text, ('general'::character varying)::text]))),
    CONSTRAINT procedure_consents_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('signed'::character varying)::text, ('refused'::character varying)::text, ('withdrawn'::character varying)::text, ('expired'::character varying)::text])))
);

-- Name: procedure_consents procedure_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_pkey PRIMARY KEY (id);

CREATE INDEX idx_consents_encounter ON public.procedure_consents USING btree (encounter_id);

CREATE INDEX idx_consents_patient ON public.procedure_consents USING btree (patient_id);

CREATE INDEX idx_consents_procedure_order ON public.procedure_consents USING btree (procedure_order_id);

CREATE INDEX idx_consents_tenant ON public.procedure_consents USING btree (tenant_id);

CREATE INDEX idx_procedure_consents_deleted_at_f120547d ON public.procedure_consents USING btree (deleted_at);

CREATE INDEX idx_procedure_consents_doctor_id ON public.procedure_consents USING btree (doctor_id);

CREATE INDEX idx_procedure_consents_template_id ON public.procedure_consents USING btree (template_id);

ALTER TABLE public.procedure_consents ENABLE ROW LEVEL SECURITY;

-- Name: procedure_consents procedure_consents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_consents_tenant ON public.procedure_consents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: procedure_consents trg_procedure_consents_soft_delete_f120547d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_procedure_consents_soft_delete_f120547d BEFORE DELETE ON public.procedure_consents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: consent_audit_log consent_audit_log_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: consent_records consent_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: patient_abha_links patient_abha_links_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_abha_links
    ADD CONSTRAINT patient_abha_links_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_addresses patient_addresses_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_allergies patient_allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_consents patient_consents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_consents patient_consents_signature_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_signature_metadata_id_fkey FOREIGN KEY (signature_metadata_id) REFERENCES public.consent_signature_metadata(id);

-- Name: patient_consents patient_consents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.consent_templates(id);

-- Name: patient_contacts patient_contacts_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_documents patient_documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_family_links patient_family_links_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_family_links patient_family_links_related_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_family_links
    ADD CONSTRAINT patient_family_links_related_patient_id_fkey FOREIGN KEY (related_patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_feedback patient_feedback_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_feedback
    ADD CONSTRAINT patient_feedback_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: patient_identifiers patient_identifiers_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identifiers
    ADD CONSTRAINT patient_identifiers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Name: patient_merge_history patient_merge_history_merged_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_merged_patient_id_fkey FOREIGN KEY (merged_patient_id) REFERENCES public.patients(id);

-- Name: patient_merge_history patient_merge_history_surviving_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merge_history
    ADD CONSTRAINT patient_merge_history_surviving_patient_id_fkey FOREIGN KEY (surviving_patient_id) REFERENCES public.patients(id);

-- Name: patient_outcome_targets patient_outcome_targets_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_outcome_targets
    ADD CONSTRAINT patient_outcome_targets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: patient_reminders patient_reminders_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT patient_reminders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: patient_transfers patient_transfers_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_transfers
    ADD CONSTRAINT patient_transfers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: patients patients_merged_into_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_merged_into_patient_id_fkey FOREIGN KEY (merged_into_patient_id) REFERENCES public.patients(id);

-- Name: procedure_consents procedure_consents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Name: procedure_consents procedure_consents_signature_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_signature_metadata_id_fkey FOREIGN KEY (signature_metadata_id) REFERENCES public.consent_signature_metadata(id);

-- Name: procedure_consents procedure_consents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.consent_templates(id);
