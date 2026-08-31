-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 55
-- Drops: none
-- clinical — schema.
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



-- Migration: 0251_advance_directives.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Advance directive / DNR management (ticket #2973): a patient's advance directives (living will,
-- DNR, durable power of attorney, MOLST, organ donation) with family-consent tracking and a
-- lifecycle (active -> revoked / superseded). Tenant RLS.

CREATE TABLE public.advance_directives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    directive_type text NOT NULL,
    content text,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    family_consent_obtained boolean DEFAULT false NOT NULL,
    family_member_name text,
    family_relationship text,
    witnessed_by text,
    document_url text,
    recorded_by uuid,
    revoked_at timestamp with time zone,
    revoke_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT advance_directive_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT advance_directive_type_check CHECK ((directive_type = ANY (ARRAY['living_will'::text, 'dnr'::text, 'dpoa'::text, 'molst'::text, 'organ_donation'::text])))
);

-- Name: advance_directives advance_directives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_directives
    ADD CONSTRAINT advance_directives_pkey PRIMARY KEY (id);

CREATE INDEX idx_advance_directives_patient ON public.advance_directives USING btree (tenant_id, patient_id, status);

ALTER TABLE public.advance_directives ENABLE ROW LEVEL SECURITY;

-- Name: advance_directives advance_directives_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY advance_directives_tenant_isolation ON public.advance_directives USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: advance_directives advance_directives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER advance_directives_updated_at BEFORE UPDATE ON public.advance_directives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- Migration: 0216_allergen_catalog.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: allergen_catalog
-- Drops: none
-- ====================================================================
-- Non-drug allergens (food / environmental / latex / contrast / biological
-- / chemical) were typed free-hand, so the same allergen got spelled a
-- dozen ways and the allergy cross-checks (which gate prescribing and
-- dispensing) missed matches. A curated frontend preset covers the common
-- ones; this table lets each hospital's list GROW on the go — every new
-- (category, allergen) a clinician records is remembered and offered as a
-- suggestion next time. Category = allergy_type, item = name.

CREATE TABLE public.allergen_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    allergy_type public.allergy_type NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: allergen_catalog allergen_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergen_catalog
    ADD CONSTRAINT allergen_catalog_pkey PRIMARY KEY (id);

CREATE INDEX idx_allergen_catalog_lookup ON public.allergen_catalog USING btree (tenant_id, allergy_type) WHERE is_active;

CREATE UNIQUE INDEX uq_allergen_catalog_type_name ON public.allergen_catalog USING btree (tenant_id, allergy_type, lower(name));

ALTER TABLE public.allergen_catalog ENABLE ROW LEVEL SECURITY;

-- Name: allergen_catalog allergen_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allergen_catalog_tenant ON public.allergen_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: allergen_catalog set_allergen_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_allergen_catalog_updated_at BEFORE UPDATE ON public.allergen_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.case_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    case_manager_id uuid NOT NULL,
    status public.case_mgmt_status DEFAULT 'assigned'::public.case_mgmt_status NOT NULL,
    priority text DEFAULT 'routine'::text NOT NULL,
    target_discharge_date date,
    actual_discharge_date date,
    discharge_disposition text,
    disposition_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT case_assignments_priority_check CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'complex'::text])))
);

-- Name: case_assignments case_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_pkey PRIMARY KEY (id);

-- Name: case_assignments case_assignments_tenant_id_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_tenant_id_admission_id_key UNIQUE (tenant_id, admission_id);

CREATE INDEX idx_case_assignments_admission_id ON public.case_assignments USING btree (admission_id);

CREATE INDEX idx_case_assignments_deleted_at_2e51772f ON public.case_assignments USING btree (deleted_at);

CREATE INDEX idx_case_assignments_manager ON public.case_assignments USING btree (tenant_id, case_manager_id, status);

CREATE INDEX idx_case_assignments_patient_id ON public.case_assignments USING btree (patient_id);

CREATE INDEX idx_case_assignments_status ON public.case_assignments USING btree (tenant_id, status);

ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;

-- Name: case_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_assignments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: case_assignments set_updated_at_case_assignments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_case_assignments BEFORE UPDATE ON public.case_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: case_assignments trg_case_assignments_soft_delete_2e51772f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_assignments_soft_delete_2e51772f BEFORE DELETE ON public.case_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.case_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    case_assignment_id uuid NOT NULL,
    referral_type text NOT NULL,
    referred_to text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    facility_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    outcome text,
    referred_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT case_referrals_referral_type_check CHECK ((referral_type = ANY (ARRAY['post_acute'::text, 'rehab'::text, 'home_health'::text, 'social_work'::text, 'hospice'::text, 'snf'::text, 'other'::text]))),
    CONSTRAINT case_referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text, 'cancelled'::text])))
);

-- Name: case_referrals case_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_pkey PRIMARY KEY (id);

CREATE INDEX idx_case_referrals_case ON public.case_referrals USING btree (tenant_id, case_assignment_id);

CREATE INDEX idx_case_referrals_deleted_at_7c0d8e4c ON public.case_referrals USING btree (deleted_at);

ALTER TABLE public.case_referrals ENABLE ROW LEVEL SECURITY;

-- Name: case_referrals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_referrals USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: case_referrals set_updated_at_case_referrals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_case_referrals BEFORE UPDATE ON public.case_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: case_referrals trg_case_referrals_soft_delete_7c0d8e4c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_referrals_soft_delete_7c0d8e4c BEFORE DELETE ON public.case_referrals FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Global diagnosis reference (no tenant_id, like icd10_codes) ──

CREATE TABLE public.cds_diagnosis_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icd10_code text NOT NULL,
    name text NOT NULL,
    department text,
    is_notifiable boolean DEFAULT false NOT NULL,
    reporting_body text,
    report_timeframe text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: cds_diagnosis_reference cds_diagnosis_reference_icd10_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_diagnosis_reference
    ADD CONSTRAINT cds_diagnosis_reference_icd10_code_key UNIQUE (icd10_code);

-- Name: cds_diagnosis_reference cds_diagnosis_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_diagnosis_reference
    ADD CONSTRAINT cds_diagnosis_reference_pkey PRIMARY KEY (id);

CREATE INDEX idx_cds_diag_ref_notifiable ON public.cds_diagnosis_reference USING btree (is_notifiable) WHERE is_notifiable;

-- Name: cds_diagnosis_reference trg_cds_diagnosis_reference_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_diagnosis_reference_updated_at BEFORE UPDATE ON public.cds_diagnosis_reference FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0188_cds_ingredients.sql
-- RLS-Posture: catalog
-- Global ingredient model: no tenant_id column, shared across tenants.
-- Global ingredient model for combination-chemistry checks (no tenant_id).
-- generic → active ingredient(s), and known dangerous ingredient pairs.

CREATE TABLE public.cds_drug_ingredient (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generic_name text NOT NULL,
    ingredient text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: cds_drug_ingredient cds_drug_ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_drug_ingredient
    ADD CONSTRAINT cds_drug_ingredient_pkey PRIMARY KEY (id);

-- Name: cds_drug_ingredient uq_cds_drug_ingredient; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_drug_ingredient
    ADD CONSTRAINT uq_cds_drug_ingredient UNIQUE (generic_name, ingredient);

CREATE INDEX idx_cds_drug_ingredient_generic ON public.cds_drug_ingredient USING btree (generic_name);

-- Name: cds_drug_ingredient trg_cds_drug_ingredient_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_drug_ingredient_updated_at BEFORE UPDATE ON public.cds_drug_ingredient FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0186_cds_drug_reference.sql
-- RLS-Posture: catalog
-- Global CDS drug reference: no tenant_id column, shared across tenants.
-- Global CDS drug reference (no tenant_id, like cds_diagnosis_reference).
-- Seeded from the github-tracked drug_formulary.csv. The CDS dose/renal/hepatic
-- checks COALESCE the tenant pharmacy_catalog row with this reference, so the
-- depth-layer fires on real drugs without each tenant re-entering the knowledge.

CREATE TABLE public.cds_drug_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generic_name text NOT NULL,
    inn_name text,
    atc_code text,
    max_dose_per_day text,
    max_single_dose text,
    dose_per_kg text,
    renal_adjust_egfr_threshold numeric(6,2),
    renal_adjust_rule text,
    hepatic_caution text,
    pregnancy_category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brands text,
    is_nlem boolean DEFAULT false NOT NULL
);

-- Name: cds_drug_reference cds_drug_reference_generic_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_drug_reference
    ADD CONSTRAINT cds_drug_reference_generic_name_key UNIQUE (generic_name);

-- Name: cds_drug_reference cds_drug_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_drug_reference
    ADD CONSTRAINT cds_drug_reference_pkey PRIMARY KEY (id);

CREATE INDEX idx_cds_drug_reference_lower_generic ON public.cds_drug_reference USING btree (lower(generic_name));

CREATE INDEX idx_cds_drug_reference_nlem ON public.cds_drug_reference USING btree (generic_name) WHERE is_nlem;

-- Name: cds_drug_reference trg_cds_drug_reference_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_drug_reference_updated_at BEFORE UPDATE ON public.cds_drug_reference FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cds_ingredient_incompatibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ingredient_a text NOT NULL,
    ingredient_b text NOT NULL,
    severity text,
    mechanism text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: cds_ingredient_incompatibility cds_ingredient_incompatibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_ingredient_incompatibility
    ADD CONSTRAINT cds_ingredient_incompatibility_pkey PRIMARY KEY (id);

-- Name: cds_ingredient_incompatibility uq_cds_ingredient_incompat; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_ingredient_incompatibility
    ADD CONSTRAINT uq_cds_ingredient_incompat UNIQUE (ingredient_a, ingredient_b);

-- Name: cds_ingredient_incompatibility trg_cds_ingredient_incompatibility_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_ingredient_incompatibility_updated_at BEFORE UPDATE ON public.cds_ingredient_incompatibility FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0187_cds_lab_reference.sql
-- RLS-Posture: catalog
-- Global CDS lab reference: no tenant_id column, shared across tenants.
-- Global CDS lab reference (no tenant_id). Analyte reference ranges + critical
-- thresholds, seeded from the github-tracked lab_reference.csv. Used to
-- auto-detect critical lab values at result entry when the tenant has no
-- explicit critical_value_rule.

CREATE TABLE public.cds_lab_reference (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test text,
    analyte text NOT NULL,
    unit text,
    normal_low numeric(14,4),
    normal_high numeric(14,4),
    critical_low numeric(14,4),
    critical_high numeric(14,4),
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    neonate_low numeric(14,4),
    neonate_high numeric(14,4),
    infant_low numeric(14,4),
    infant_high numeric(14,4),
    child_low numeric(14,4),
    child_high numeric(14,4),
    adult_m_low numeric(14,4),
    adult_m_high numeric(14,4),
    adult_f_low numeric(14,4),
    adult_f_high numeric(14,4),
    pregnancy_low numeric(14,4),
    pregnancy_high numeric(14,4),
    elderly_low numeric(14,4),
    elderly_high numeric(14,4)
);

-- Name: cds_lab_reference cds_lab_reference_analyte_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_lab_reference
    ADD CONSTRAINT cds_lab_reference_analyte_key UNIQUE (analyte);

-- Name: cds_lab_reference cds_lab_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_lab_reference
    ADD CONSTRAINT cds_lab_reference_pkey PRIMARY KEY (id);

CREATE INDEX idx_cds_lab_reference_lower_analyte ON public.cds_lab_reference USING btree (lower(analyte));

CREATE INDEX idx_cds_lab_reference_lower_test ON public.cds_lab_reference USING btree (lower(test));

-- Name: cds_lab_reference trg_cds_lab_reference_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_lab_reference_updated_at BEFORE UPDATE ON public.cds_lab_reference FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0193_cds_state_formulary.sql
-- RLS-Posture: catalog
-- Global state-formulary reference: no tenant_id column.
-- Per-state government free/subsidised medicine schemes (TNMSC, Rajasthan MNDY,
-- Delhi/Kerala/Maharashtra etc.) mapped to essential generics. Global reference
-- (no tenant_id, like the other cds_* tables), seeded from a github-tracked CSV.
-- Lets a facility surface "free under <state> scheme" against a prescribed drug.

CREATE TABLE public.cds_state_formulary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    state_code text NOT NULL,
    state_name text NOT NULL,
    scheme_name text NOT NULL,
    generic_name text NOT NULL,
    coverage text DEFAULT 'free'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: cds_state_formulary cds_state_formulary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_state_formulary
    ADD CONSTRAINT cds_state_formulary_pkey PRIMARY KEY (id);

-- Name: cds_state_formulary cds_state_formulary_state_code_generic_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cds_state_formulary
    ADD CONSTRAINT cds_state_formulary_state_code_generic_name_key UNIQUE (state_code, generic_name);

CREATE INDEX idx_cds_state_formulary_lower_generic ON public.cds_state_formulary USING btree (lower(generic_name));

CREATE INDEX idx_cds_state_formulary_state ON public.cds_state_formulary USING btree (state_code);

-- Name: cds_state_formulary trg_cds_state_formulary_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cds_state_formulary_updated_at BEFORE UPDATE ON public.cds_state_formulary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.chief_complaint_masters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    synonyms text[] DEFAULT '{}'::text[],
    suggested_icd text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: chief_complaint_masters chief_complaint_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chief_complaint_masters
    ADD CONSTRAINT chief_complaint_masters_pkey PRIMARY KEY (id);

CREATE INDEX idx_cc_search ON public.chief_complaint_masters USING gin (to_tsvector('english'::regconfig, (name)::text));

CREATE INDEX idx_cc_tenant ON public.chief_complaint_masters USING btree (tenant_id);

CREATE INDEX idx_chief_complaint_masters_deleted_at_a5162f58 ON public.chief_complaint_masters USING btree (deleted_at);

ALTER TABLE public.chief_complaint_masters ENABLE ROW LEVEL SECURITY;

-- Name: chief_complaint_masters chief_complaint_masters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chief_complaint_masters_tenant ON public.chief_complaint_masters USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: chief_complaint_masters trg_chief_complaint_masters_soft_delete_a5162f58; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chief_complaint_masters_soft_delete_a5162f58 BEFORE DELETE ON public.chief_complaint_masters FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- RLS-Posture: tenant-scoped
-- Clinical terminology and note-completion corpus.
-- Stores tenant-editable completion entries plus global MedBrains starter phrases.
-- External dictionaries/terminologies must be imported with source and license metadata.

CREATE TABLE public.clinical_corpus_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    entry_key text NOT NULL,
    corpus_type character varying(40) DEFAULT 'medical_term'::character varying NOT NULL,
    section character varying(64),
    term text NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    short_text text,
    insert_text text,
    source_name text DEFAULT 'MedBrains'::text NOT NULL,
    source_url text,
    license_name text,
    license_status character varying(40) DEFAULT 'owned'::character varying NOT NULL,
    source_version text,
    language character varying(16) DEFAULT 'en'::character varying NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT clinical_corpus_entries_corpus_type_check CHECK (((corpus_type)::text = ANY ((ARRAY['soap_phrase'::character varying, 'medical_term'::character varying, 'lay_term'::character varying, 'icd10'::character varying, 'icd11'::character varying, 'snomed'::character varying, 'loinc'::character varying, 'rxnorm'::character varying])::text[]))),
    CONSTRAINT clinical_corpus_entries_license_status_check CHECK (((license_status)::text = ANY ((ARRAY['owned'::character varying, 'open'::character varying, 'licensed'::character varying, 'restricted'::character varying, 'reference_only'::character varying])::text[])))
);

-- Name: clinical_corpus_entries clinical_corpus_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_corpus_entries
    ADD CONSTRAINT clinical_corpus_entries_pkey PRIMARY KEY (id);

CREATE INDEX clinical_corpus_entries_aliases_idx ON public.clinical_corpus_entries USING gin (aliases);

CREATE UNIQUE INDEX clinical_corpus_entries_key_idx ON public.clinical_corpus_entries USING btree (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), entry_key);

CREATE INDEX clinical_corpus_entries_lookup_idx ON public.clinical_corpus_entries USING btree (tenant_id, corpus_type, section, is_active, priority);

CREATE INDEX clinical_corpus_entries_short_text_prefix_idx ON public.clinical_corpus_entries USING btree (lower(COALESCE(short_text, ''::text)) text_pattern_ops);

CREATE INDEX clinical_corpus_entries_term_prefix_idx ON public.clinical_corpus_entries USING btree (lower(term) text_pattern_ops);

CREATE INDEX idx_clinical_corpus_entries_deleted_at_9941924f ON public.clinical_corpus_entries USING btree (deleted_at);

ALTER TABLE public.clinical_corpus_entries ENABLE ROW LEVEL SECURITY;

-- Name: clinical_corpus_entries clinical_corpus_entries_read_tenant_or_global; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clinical_corpus_entries_read_tenant_or_global ON public.clinical_corpus_entries FOR SELECT USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: clinical_corpus_entries clinical_corpus_entries_write_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clinical_corpus_entries_write_tenant ON public.clinical_corpus_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: clinical_corpus_entries trg_clinical_corpus_entries_soft_delete_9941924f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_corpus_entries_soft_delete_9941924f BEFORE DELETE ON public.clinical_corpus_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: clinical_corpus_entries trg_clinical_corpus_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_corpus_entries_updated_at BEFORE UPDATE ON public.clinical_corpus_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.clinical_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    category text NOT NULL,
    description text,
    trigger_conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT clinical_protocols_category_check CHECK ((category = ANY (ARRAY['sepsis'::text, 'dvt_prophylaxis'::text, 'diabetes'::text, 'hypertension'::text, 'cardiac'::text, 'respiratory'::text, 'renal'::text, 'infection'::text, 'surgical'::text, 'other'::text])))
);

-- Name: clinical_protocols clinical_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_pkey PRIMARY KEY (id);

CREATE INDEX idx_clinical_protocols_category ON public.clinical_protocols USING btree (tenant_id, category);

CREATE INDEX idx_clinical_protocols_deleted_at_991eb545 ON public.clinical_protocols USING btree (deleted_at);

CREATE INDEX idx_clinical_protocols_department_id ON public.clinical_protocols USING btree (department_id);

CREATE INDEX idx_clinical_protocols_tenant ON public.clinical_protocols USING btree (tenant_id);

ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;

-- Name: clinical_protocols clinical_protocols_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clinical_protocols_tenant ON public.clinical_protocols USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: clinical_protocols set_updated_at_clinical_protocols; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_clinical_protocols BEFORE UPDATE ON public.clinical_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: clinical_protocols trg_clinical_protocols_soft_delete_991eb545; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinical_protocols_soft_delete_991eb545 BEFORE DELETE ON public.clinical_protocols FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0238_clinical_trials.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Clinical Trials registry (ticket #2983): the trials a hospital's research department runs, with
-- sponsor / phase / indication / PI and a lifecycle status (planned → recruiting → active →
-- completed / terminated / suspended). Tenant RLS.

CREATE TABLE public.clinical_trials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    protocol_number text NOT NULL,
    title text NOT NULL,
    sponsor text,
    phase text,
    status text DEFAULT 'planned'::text NOT NULL,
    indication text,
    principal_investigator text,
    target_enrollment integer,
    start_date date,
    end_date date,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_age integer,
    max_age integer,
    eligibility_sex text,
    diagnosis_codes text[],
    CONSTRAINT clinical_trials_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'recruiting'::text, 'active'::text, 'completed'::text, 'terminated'::text, 'suspended'::text])))
);

-- Name: clinical_trials clinical_trials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_trials
    ADD CONSTRAINT clinical_trials_pkey PRIMARY KEY (id);

-- Name: clinical_trials clinical_trials_protocol_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_trials
    ADD CONSTRAINT clinical_trials_protocol_unique UNIQUE (tenant_id, protocol_number);

CREATE INDEX idx_clinical_trials_status ON public.clinical_trials USING btree (tenant_id, status);

ALTER TABLE public.clinical_trials ENABLE ROW LEVEL SECURITY;

-- Name: clinical_trials clinical_trials_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clinical_trials_tenant_isolation ON public.clinical_trials USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: clinical_trials clinical_trials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clinical_trials_updated_at BEFORE UPDATE ON public.clinical_trials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.co_signature_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    order_type text NOT NULL,
    order_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    approver_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_at timestamp with time zone,
    denied_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT co_signature_requests_order_type_check CHECK ((order_type = ANY (ARRAY['prescription'::text, 'procedure'::text, 'lab_order'::text, 'referral'::text, 'other'::text]))),
    CONSTRAINT co_signature_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])))
);

-- Name: co_signature_requests co_signature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_co_signature_approver ON public.co_signature_requests USING btree (tenant_id, approver_id, status);

CREATE INDEX idx_co_signature_requests_deleted_at_6add7c0b ON public.co_signature_requests USING btree (deleted_at);

CREATE INDEX idx_co_signature_requests_encounter_id ON public.co_signature_requests USING btree (encounter_id);

CREATE INDEX idx_co_signature_tenant ON public.co_signature_requests USING btree (tenant_id);

ALTER TABLE public.co_signature_requests ENABLE ROW LEVEL SECURITY;

-- Name: co_signature_requests co_signature_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY co_signature_requests_tenant ON public.co_signature_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: co_signature_requests set_updated_at_co_signature; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_co_signature BEFORE UPDATE ON public.co_signature_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: co_signature_requests trg_co_signature_requests_soft_delete_6add7c0b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_co_signature_requests_soft_delete_6add7c0b BEFORE DELETE ON public.co_signature_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Goal 7: CPOE/CDS Phase 1.
-- Unsafe medication orders must leave an immutable safety trail whether they
-- are blocked, warned, or overridden by an authorized clinician.

CREATE TABLE public.cpoe_safety_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    source_module text NOT NULL,
    source_record_id uuid,
    order_type text NOT NULL,
    warning_code text NOT NULL,
    severity text NOT NULL,
    action_taken text NOT NULL,
    item_ref jsonb DEFAULT '{}'::jsonb NOT NULL,
    message text NOT NULL,
    override_reason text,
    overridden_by uuid,
    checked_by uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT cpoe_safety_audit_action_taken_check CHECK ((action_taken = ANY (ARRAY['blocked'::text, 'warned'::text, 'overridden'::text]))),
    CONSTRAINT cpoe_safety_audit_order_type_check CHECK ((order_type = ANY (ARRAY['drug'::text, 'lab'::text, 'radiology'::text, 'procedure'::text, 'diet'::text, 'referral'::text]))),
    CONSTRAINT cpoe_safety_audit_override_reason_check CHECK (((action_taken <> 'overridden'::text) OR ((override_reason IS NOT NULL) AND (length(TRIM(BOTH FROM override_reason)) >= 5) AND (overridden_by IS NOT NULL)))),
    CONSTRAINT cpoe_safety_audit_severity_check CHECK ((severity = ANY (ARRAY['warn'::text, 'block'::text]))),
    CONSTRAINT cpoe_safety_audit_source_module_check CHECK ((source_module = ANY (ARRAY['pharmacy'::text, 'order_basket'::text])))
);

-- Name: cpoe_safety_audit cpoe_safety_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpoe_safety_audit
    ADD CONSTRAINT cpoe_safety_audit_pkey PRIMARY KEY (id);

CREATE INDEX idx_cpoe_safety_audit_code ON public.cpoe_safety_audit USING btree (tenant_id, warning_code, checked_at DESC);

CREATE INDEX idx_cpoe_safety_audit_deleted_at_51ed909a ON public.cpoe_safety_audit USING btree (deleted_at);

CREATE INDEX idx_cpoe_safety_audit_patient_checked ON public.cpoe_safety_audit USING btree (tenant_id, patient_id, checked_at DESC);

CREATE INDEX idx_cpoe_safety_audit_patient_id ON public.cpoe_safety_audit USING btree (patient_id);

CREATE INDEX idx_cpoe_safety_audit_source ON public.cpoe_safety_audit USING btree (tenant_id, source_module, source_record_id) WHERE (source_record_id IS NOT NULL);

ALTER TABLE ONLY public.cpoe_safety_audit FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cpoe_safety_audit ENABLE ROW LEVEL SECURITY;

-- Name: cpoe_safety_audit tenant_isolation_cpoe_safety_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_cpoe_safety_audit ON public.cpoe_safety_audit USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cpoe_safety_audit trg_cpoe_safety_audit_soft_delete_51ed909a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cpoe_safety_audit_soft_delete_51ed909a BEFORE DELETE ON public.cpoe_safety_audit FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    icd_code text,
    description text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    severity character varying(20) DEFAULT 'moderate'::character varying,
    certainty character varying(20) DEFAULT 'confirmed'::character varying,
    onset_date date,
    resolved_date date,
    snomed_code character varying(20),
    snomed_display text,
    icd_system character varying(16) DEFAULT 'icd10'::character varying NOT NULL,
    icd_display text,
    icd_source_url text,
    icd_source_version text,
    icd_provider_mode text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT diagnoses_icd_system_check CHECK (((icd_system)::text = ANY ((ARRAY['icd10'::character varying, 'icd11'::character varying, 'snomed'::character varying])::text[])))
);

-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);

CREATE INDEX idx_diagnoses_deleted_at_ec974c66 ON public.diagnoses USING btree (deleted_at);

CREATE INDEX idx_diagnoses_encounter ON public.diagnoses USING btree (encounter_id);

CREATE INDEX idx_diagnoses_tenant ON public.diagnoses USING btree (tenant_id);

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

-- Name: diagnoses tenant_isolation_diagnoses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_diagnoses ON public.diagnoses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: diagnoses audit_diagnoses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_diagnoses AFTER INSERT OR DELETE OR UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');

-- Name: diagnoses trg_diagnoses_soft_delete_ec974c66; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_diagnoses_soft_delete_ec974c66 BEFORE DELETE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_coverage_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    absent_doctor_id uuid NOT NULL,
    covering_doctor_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_coverage_assignments_check CHECK ((end_at > start_at)),
    CONSTRAINT doctor_coverage_assignments_check1 CHECK ((absent_doctor_id <> covering_doctor_id))
);

-- Name: doctor_coverage_assignments doctor_coverage_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_pkey PRIMARY KEY (id);

CREATE INDEX doctor_coverage_assignments_active_idx ON public.doctor_coverage_assignments USING btree (tenant_id, absent_doctor_id, start_at, end_at);

CREATE INDEX doctor_coverage_assignments_covering_idx ON public.doctor_coverage_assignments USING btree (tenant_id, covering_doctor_id, start_at, end_at);

CREATE INDEX idx_doctor_coverage_assignments_deleted_at_cd578a64 ON public.doctor_coverage_assignments USING btree (deleted_at);

ALTER TABLE ONLY public.doctor_coverage_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_coverage_assignments ENABLE ROW LEVEL SECURITY;

-- Name: doctor_coverage_assignments tenant_isolation_doctor_coverage_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_coverage_assignments ON public.doctor_coverage_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_coverage_assignments trg_doctor_coverage_assignments_soft_delete_cd578a64; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_coverage_assignments_soft_delete_cd578a64 BEFORE DELETE ON public.doctor_coverage_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_dockets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    docket_date date NOT NULL,
    total_patients integer DEFAULT 0 NOT NULL,
    new_patients integer DEFAULT 0 NOT NULL,
    follow_ups integer DEFAULT 0 NOT NULL,
    referrals_made integer DEFAULT 0 NOT NULL,
    procedures_done integer DEFAULT 0 NOT NULL,
    notes text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: doctor_dockets doctor_dockets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_pkey PRIMARY KEY (id);

-- Name: doctor_dockets doctor_dockets_tenant_id_doctor_id_docket_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_tenant_id_doctor_id_docket_date_key UNIQUE (tenant_id, doctor_id, docket_date);

CREATE INDEX idx_dockets_doctor_date ON public.doctor_dockets USING btree (doctor_id, docket_date DESC);

CREATE INDEX idx_dockets_tenant ON public.doctor_dockets USING btree (tenant_id);

CREATE INDEX idx_doctor_dockets_deleted_at_b303d47a ON public.doctor_dockets USING btree (deleted_at);

ALTER TABLE public.doctor_dockets ENABLE ROW LEVEL SECURITY;

-- Name: doctor_dockets doctor_dockets_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doctor_dockets_tenant ON public.doctor_dockets USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: doctor_dockets trg_doctor_dockets_soft_delete_b303d47a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_dockets_soft_delete_b303d47a BEFORE DELETE ON public.doctor_dockets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_incentive_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    custom_percentage numeric(7,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: doctor_incentive_assignments doctor_incentive_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_pkey PRIMARY KEY (id);

CREATE INDEX idx_doctor_incentive_assignments_deleted_at_75a437e2 ON public.doctor_incentive_assignments USING btree (deleted_at);

CREATE INDEX idx_doctor_incentive_assignments_doctor_id ON public.doctor_incentive_assignments USING btree (doctor_id);

CREATE INDEX idx_doctor_incentive_doc ON public.doctor_incentive_assignments USING btree (tenant_id, doctor_id);

ALTER TABLE ONLY public.doctor_incentive_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_incentive_assignments ENABLE ROW LEVEL SECURITY;

-- Name: doctor_incentive_assignments tenant_isolation_doctor_incentive_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_incentive_assignments ON public.doctor_incentive_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_incentive_assignments trg_doctor_incentive_assignments_soft_delete_75a437e2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_incentive_assignments_soft_delete_75a437e2 BEFORE DELETE ON public.doctor_incentive_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_package_inclusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    inclusion_type text NOT NULL,
    consultation_specialty_id uuid,
    consultation_doctor_id uuid,
    service_id uuid,
    test_id uuid,
    procedure_id uuid,
    included_quantity integer NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_package_inclusions_included_quantity_check CHECK ((included_quantity > 0)),
    CONSTRAINT doctor_package_inclusions_inclusion_type_check CHECK ((inclusion_type = ANY (ARRAY['consultation'::text, 'lab'::text, 'procedure'::text, 'service'::text])))
);

-- Name: doctor_package_inclusions doctor_package_inclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_pkey PRIMARY KEY (id);

CREATE INDEX doctor_package_inclusions_pkg_idx ON public.doctor_package_inclusions USING btree (tenant_id, package_id, sort_order);

CREATE INDEX idx_doctor_package_inclusions_deleted_at_4ae6e412 ON public.doctor_package_inclusions USING btree (deleted_at);

ALTER TABLE ONLY public.doctor_package_inclusions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_package_inclusions ENABLE ROW LEVEL SECURITY;

-- Name: doctor_package_inclusions tenant_isolation_doctor_package_inclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_package_inclusions ON public.doctor_package_inclusions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_package_inclusions trg_doctor_package_inclusions_soft_delete_4ae6e412; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_package_inclusions_soft_delete_4ae6e412 BEFORE DELETE ON public.doctor_package_inclusions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    total_price numeric(12,2) NOT NULL,
    validity_days integer DEFAULT 365 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_packages_total_price_check CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT doctor_packages_validity_days_check CHECK ((validity_days > 0))
);

-- Name: doctor_packages doctor_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_pkey PRIMARY KEY (id);

-- Name: doctor_packages doctor_packages_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX doctor_packages_active_idx ON public.doctor_packages USING btree (tenant_id, is_active);

CREATE INDEX idx_doctor_packages_deleted_at_b4ad56eb ON public.doctor_packages USING btree (deleted_at);

ALTER TABLE ONLY public.doctor_packages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_packages ENABLE ROW LEVEL SECURITY;

-- Name: doctor_packages tenant_isolation_doctor_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_packages ON public.doctor_packages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_packages doctor_packages_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER doctor_packages_updated BEFORE UPDATE ON public.doctor_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: doctor_packages trg_doctor_packages_soft_delete_b4ad56eb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_packages_soft_delete_b4ad56eb BEFORE DELETE ON public.doctor_packages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prefix text,
    display_name text NOT NULL,
    qualification_string text,
    mci_number text,
    state_council_number text,
    state_council_name text,
    registration_valid_until date,
    specialty_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    subspecialty text,
    years_experience integer,
    is_full_time boolean DEFAULT true NOT NULL,
    is_visiting boolean DEFAULT false NOT NULL,
    parent_employee_id uuid,
    can_prescribe_schedule_x boolean DEFAULT false NOT NULL,
    can_perform_surgery boolean DEFAULT false NOT NULL,
    can_sign_mlc boolean DEFAULT false NOT NULL,
    can_sign_death_certificate boolean DEFAULT false NOT NULL,
    can_sign_fitness_certificate boolean DEFAULT true NOT NULL,
    bio_short text,
    bio_long text,
    photo_url text,
    languages_spoken text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    registration_revoked boolean DEFAULT false NOT NULL,
    CONSTRAINT doctor_profiles_years_experience_check CHECK (((years_experience >= 0) AND (years_experience <= 80)))
);

-- Name: doctor_profiles doctor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_pkey PRIMARY KEY (id);

-- Name: doctor_profiles doctor_profiles_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_tenant_id_user_id_key UNIQUE (tenant_id, user_id);

CREATE INDEX doctor_profiles_active_idx ON public.doctor_profiles USING btree (tenant_id, is_active) WHERE is_active;

CREATE INDEX doctor_profiles_user_idx ON public.doctor_profiles USING btree (tenant_id, user_id);

CREATE INDEX idx_doctor_profiles_deleted_at_19571e12 ON public.doctor_profiles USING btree (deleted_at);

ALTER TABLE ONLY public.doctor_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;

-- Name: doctor_profiles tenant_isolation_doctor_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_profiles ON public.doctor_profiles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_profiles doctor_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER doctor_profiles_updated BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: doctor_profiles trg_doctor_profiles_soft_delete_19571e12; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_profiles_soft_delete_19571e12 BEFORE DELETE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_rotation_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    schedule_date date NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    shift text DEFAULT 'morning'::text,
    start_time time without time zone,
    end_time time without time zone,
    is_locum boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: doctor_rotation_schedules doctor_rotation_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_rotation_schedules
    ADD CONSTRAINT doctor_rotation_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_doctor_rotation_doctor ON public.doctor_rotation_schedules USING btree (doctor_id, schedule_date);

CREATE INDEX idx_doctor_rotation_group ON public.doctor_rotation_schedules USING btree (group_id);

CREATE INDEX idx_doctor_rotation_schedules_deleted_at_066f36a8 ON public.doctor_rotation_schedules USING btree (deleted_at);

CREATE INDEX idx_doctor_rotation_tenant ON public.doctor_rotation_schedules USING btree (tenant_id, schedule_date);

ALTER TABLE public.doctor_rotation_schedules ENABLE ROW LEVEL SECURITY;

-- Name: doctor_rotation_schedules tenant_isolation_doctor_rotation_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_rotation_schedules ON public.doctor_rotation_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_rotation_schedules trg_doctor_rotation_schedules_soft_delete_066f36a8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_rotation_schedules_soft_delete_066f36a8 BEFORE DELETE ON public.doctor_rotation_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: doctor_rotation_schedules trg_doctor_rotation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_rotation_updated_at BEFORE UPDATE ON public.doctor_rotation_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.doctor_schedule_exceptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    exception_date date NOT NULL,
    is_available boolean DEFAULT false NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_pkey PRIMARY KEY (id);

-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key UNIQUE (tenant_id, doctor_id, exception_date);

CREATE INDEX idx_doctor_schedule_exceptions_date ON public.doctor_schedule_exceptions USING btree (tenant_id, doctor_id, exception_date);

CREATE INDEX idx_doctor_schedule_exceptions_deleted_at_16a834df ON public.doctor_schedule_exceptions USING btree (deleted_at);

CREATE INDEX idx_doctor_schedule_exceptions_doctor_id ON public.doctor_schedule_exceptions USING btree (doctor_id);

ALTER TABLE public.doctor_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- Name: doctor_schedule_exceptions tenant_isolation_doctor_schedule_exceptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_schedule_exceptions ON public.doctor_schedule_exceptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_schedule_exceptions trg_doctor_schedule_exceptions_soft_delete_16a834df; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_schedule_exceptions_soft_delete_16a834df BEFORE DELETE ON public.doctor_schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration_mins integer DEFAULT 15 NOT NULL,
    max_patients integer DEFAULT 20 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_schedule_time CHECK ((end_time > start_time)),
    CONSTRAINT doctor_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT doctor_schedules_max_patients_check CHECK ((max_patients > 0)),
    CONSTRAINT doctor_schedules_slot_duration_mins_check CHECK ((slot_duration_mins > 0))
);

-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);

-- Name: doctor_schedules doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key UNIQUE (tenant_id, doctor_id, department_id, day_of_week);

CREATE INDEX idx_doctor_schedules_deleted_at_d620f375 ON public.doctor_schedules USING btree (deleted_at);

CREATE INDEX idx_doctor_schedules_department_id ON public.doctor_schedules USING btree (department_id);

CREATE INDEX idx_doctor_schedules_dept ON public.doctor_schedules USING btree (tenant_id, department_id);

CREATE INDEX idx_doctor_schedules_doctor ON public.doctor_schedules USING btree (tenant_id, doctor_id);

CREATE INDEX idx_doctor_schedules_doctor_id ON public.doctor_schedules USING btree (doctor_id);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

-- Name: doctor_schedules tenant_isolation_doctor_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_schedules ON public.doctor_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_schedules trg_doctor_schedules_soft_delete_d620f375; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_schedules_soft_delete_d620f375 BEFORE DELETE ON public.doctor_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.doctor_signature_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_user_id uuid NOT NULL,
    credential_type text NOT NULL,
    algorithm text DEFAULT 'Ed25519'::text NOT NULL,
    public_key bytea NOT NULL,
    encrypted_private_key bytea,
    display_image_url text,
    display_font text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_reason text,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_signature_credentials_credential_type_check CHECK ((credential_type = ANY (ARRAY['stored_key'::text, 'aadhaar_esign'::text, 'dsc_usb'::text, 'external_pkcs11'::text])))
);

-- Name: doctor_signature_credentials doctor_signature_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_signature_credentials
    ADD CONSTRAINT doctor_signature_credentials_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX doctor_signature_credentials_default_idx ON public.doctor_signature_credentials USING btree (tenant_id, doctor_user_id) WHERE (is_default AND (revoked_at IS NULL));

CREATE INDEX doctor_signature_credentials_doctor_idx ON public.doctor_signature_credentials USING btree (tenant_id, doctor_user_id) WHERE (revoked_at IS NULL);

CREATE INDEX idx_doctor_signature_credentials_deleted_at_76154331 ON public.doctor_signature_credentials USING btree (deleted_at);

ALTER TABLE ONLY public.doctor_signature_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE public.doctor_signature_credentials ENABLE ROW LEVEL SECURITY;

-- Name: doctor_signature_credentials tenant_isolation_doctor_signature_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_signature_credentials ON public.doctor_signature_credentials USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: doctor_signature_credentials trg_doctor_signature_credentials_soft_delete_76154331; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_signature_credentials_soft_delete_76154331 BEFORE DELETE ON public.doctor_signature_credentials FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── ED triage entries ───────────────────────────────────────────────
-- T2 append-only log. Each row is a triage decision (ESI 1..5) on an
-- ER visit. Multiple entries per visit are allowed — later entries
-- supersede earlier ones; the UI surfaces the latest as "current".

CREATE TABLE public.ed_triage_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    author_name text NOT NULL,
    esi_level smallint NOT NULL,
    chief_complaint text NOT NULL,
    observation text DEFAULT ''::text NOT NULL,
    authored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT ed_triage_entries_esi_level_check CHECK (((esi_level >= 1) AND (esi_level <= 5)))
);

-- Name: ed_triage_entries ed_triage_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ed_triage_entries
    ADD CONSTRAINT ed_triage_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_ed_triage_entries_deleted_at_7056d990 ON public.ed_triage_entries USING btree (deleted_at);

CREATE INDEX idx_ed_triage_entries_visit ON public.ed_triage_entries USING btree (tenant_id, er_visit_id, authored_at DESC);

ALTER TABLE public.ed_triage_entries ENABLE ROW LEVEL SECURITY;

-- Name: ed_triage_entries tenant_isolation_ed_triage_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ed_triage_entries ON public.ed_triage_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ed_triage_entries trg_ed_triage_entries_soft_delete_7056d990; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ed_triage_entries_soft_delete_7056d990 BEFORE DELETE ON public.ed_triage_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0276_hypoglycemia_events.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Inpatient hypoglycaemia management (ADA / NABH endocrinology safety). Hypoglycaemia (blood glucose
-- < 70 mg/dL) is the most common serious harm from insulin/sulfonylureas and, untreated, causes
-- seizures, coma and death. The protocol: classify severity, treat (15-20 g oral carbohydrate if
-- conscious; IV dextrose / IM glucagon if severe or unable to swallow), then RECHECK glucose in 15
-- minutes and repeat until recovered. NABH tracks "hypoglycaemia target achieved" (recovery on recheck)
-- but had no capture behind it — this records each event and whether it resolved.

CREATE TABLE public.hypoglycemia_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    glucose_value double precision NOT NULL,
    conscious boolean DEFAULT true NOT NULL,
    severity text NOT NULL,
    treatment text,
    treatment_given_at timestamp with time zone,
    recheck_glucose double precision,
    recheck_at timestamp with time zone,
    resolved boolean DEFAULT false NOT NULL,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hypoglycemia_severity_check CHECK ((severity = ANY (ARRAY['none'::text, 'moderate'::text, 'severe'::text]))),
    CONSTRAINT hypoglycemia_treatment_check CHECK (((treatment IS NULL) OR (treatment = ANY (ARRAY['oral_carbs'::text, 'iv_dextrose'::text, 'im_glucagon'::text, 'none'::text]))))
);

-- Name: hypoglycemia_events hypoglycemia_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hypoglycemia_events
    ADD CONSTRAINT hypoglycemia_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_hypoglycemia_patient ON public.hypoglycemia_events USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.hypoglycemia_events ENABLE ROW LEVEL SECURITY;

-- Name: hypoglycemia_events hypoglycemia_events_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hypoglycemia_events_tenant_isolation ON public.hypoglycemia_events USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

CREATE TABLE public.icd10_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(10) NOT NULL,
    short_desc text NOT NULL,
    long_desc text,
    category character varying(20),
    chapter character varying(10),
    is_billable boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icd10_codes icd10_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_codes
    ADD CONSTRAINT icd10_codes_code_key UNIQUE (code);

-- Name: icd10_codes icd10_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_codes
    ADD CONSTRAINT icd10_codes_pkey PRIMARY KEY (id);

CREATE INDEX idx_icd10_code ON public.icd10_codes USING btree (code);

CREATE INDEX idx_icd10_codes_deleted_at_09e220cd ON public.icd10_codes USING btree (deleted_at);

CREATE INDEX idx_icd10_search ON public.icd10_codes USING gin (to_tsvector('english'::regconfig, short_desc));

-- Name: icd10_codes trg_icd10_codes_soft_delete_09e220cd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icd10_codes_soft_delete_09e220cd BEFORE DELETE ON public.icd10_codes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.incentive_calculations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    gross_revenue numeric(14,2),
    eligible_revenue numeric(14,2),
    incentive_amount numeric(14,2),
    deductions numeric(14,2),
    net_payable numeric(14,2),
    status text,
    approved_by uuid,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    payment_reference text,
    calculation_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: incentive_calculations incentive_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_pkey PRIMARY KEY (id);

CREATE INDEX idx_incentive_calcs_doctor ON public.incentive_calculations USING btree (tenant_id, doctor_id, period_start DESC);

CREATE INDEX idx_incentive_calculations_deleted_at_6edbb255 ON public.incentive_calculations USING btree (deleted_at);

CREATE INDEX idx_incentive_calculations_doctor_id ON public.incentive_calculations USING btree (doctor_id);

ALTER TABLE ONLY public.incentive_calculations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.incentive_calculations ENABLE ROW LEVEL SECURITY;

-- Name: incentive_calculations tenant_isolation_incentive_calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_incentive_calculations ON public.incentive_calculations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: incentive_calculations trg_incentive_calculations_soft_delete_6edbb255; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_incentive_calculations_soft_delete_6edbb255 BEFORE DELETE ON public.incentive_calculations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.incentive_plan_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    rule_name text NOT NULL,
    service_type text,
    department_id uuid,
    min_threshold numeric(14,2),
    max_threshold numeric(14,2),
    percentage numeric(7,2),
    fixed_amount numeric(14,2),
    multiplier numeric(7,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: incentive_plan_rules incentive_plan_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plan_rules
    ADD CONSTRAINT incentive_plan_rules_pkey PRIMARY KEY (id);

CREATE INDEX idx_incentive_plan_rules_deleted_at_309e5d98 ON public.incentive_plan_rules USING btree (deleted_at);

CREATE INDEX idx_incentive_plan_rules_department_id ON public.incentive_plan_rules USING btree (department_id);

CREATE INDEX idx_incentive_rules_plan ON public.incentive_plan_rules USING btree (plan_id);

-- Name: incentive_plan_rules trg_incentive_plan_rules_soft_delete_309e5d98; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_incentive_plan_rules_soft_delete_309e5d98 BEFORE DELETE ON public.incentive_plan_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.incentive_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_name text NOT NULL,
    plan_code text NOT NULL,
    description text,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    calculation_basis text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: incentive_plans incentive_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_pkey PRIMARY KEY (id);

-- Name: incentive_plans incentive_plans_tenant_id_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_tenant_id_plan_code_key UNIQUE (tenant_id, plan_code);

CREATE INDEX idx_incentive_plans_deleted_at_79ac9574 ON public.incentive_plans USING btree (deleted_at);

ALTER TABLE ONLY public.incentive_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.incentive_plans ENABLE ROW LEVEL SECURITY;

-- Name: incentive_plans tenant_isolation_incentive_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_incentive_plans ON public.incentive_plans USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: incentive_plans trg_incentive_plans_soft_delete_79ac9574; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_incentive_plans_soft_delete_79ac9574 BEFORE DELETE ON public.incentive_plans FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0284_indwelling_devices.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Per-patient invasive/indwelling device register with daily necessity review (CDC/NABH
-- CAUTI·CLABSI·VAP prevention bundles). infection_device_days already counts device-days in
-- aggregate for computing HAI RATES, but the actual PREVENTION intervention is per-patient: every
-- indwelling line/catheter/tube must have its ongoing necessity reviewed daily and be removed as soon
-- as it is no longer indicated, because each avoidable device-day carries infection risk. This tracks
-- each device, its indication, the daily review, and removal.

CREATE TABLE public.indwelling_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    device_type text NOT NULL,
    site text,
    indication text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    inserted_by uuid,
    last_reviewed_at timestamp with time zone DEFAULT now() NOT NULL,
    still_indicated boolean DEFAULT true NOT NULL,
    removed_at timestamp with time zone,
    removed_by uuid,
    removal_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indwelling_device_type_check CHECK ((device_type = ANY (ARRAY['central_line'::text, 'urinary_catheter'::text, 'ventilator'::text, 'peripheral_iv'::text, 'other'::text])))
);

-- Name: indwelling_devices indwelling_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indwelling_devices
    ADD CONSTRAINT indwelling_devices_pkey PRIMARY KEY (id);

CREATE INDEX idx_indwelling_devices_patient_active ON public.indwelling_devices USING btree (tenant_id, patient_id) WHERE (removed_at IS NULL);

CREATE INDEX idx_indwelling_devices_review ON public.indwelling_devices USING btree (tenant_id, last_reviewed_at) WHERE (removed_at IS NULL);

ALTER TABLE public.indwelling_devices ENABLE ROW LEVEL SECURITY;

-- Name: indwelling_devices indwelling_devices_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY indwelling_devices_tenant_isolation ON public.indwelling_devices USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0254_long_term_medications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Long-term medication management (ticket #2962): a long-stay resident's chronic medications on an
-- extended (e.g. 90-day) supply cycle with optional auto-refill. Each refill advances the next
-- refill date by the supply period. Tenant RLS.

CREATE TABLE public.long_term_medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    drug_name text NOT NULL,
    dosage text,
    frequency text,
    supply_days integer DEFAULT 90 NOT NULL,
    auto_refill boolean DEFAULT true NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    next_refill_date date,
    last_refilled_at timestamp with time zone,
    refill_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    prescriber uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ltc_med_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'discontinued'::text]))),
    CONSTRAINT ltc_med_supply_check CHECK ((supply_days > 0))
);

-- Name: long_term_medications long_term_medications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.long_term_medications
    ADD CONSTRAINT long_term_medications_pkey PRIMARY KEY (id);

CREATE INDEX idx_ltc_medications_due ON public.long_term_medications USING btree (tenant_id, next_refill_date) WHERE ((status = 'active'::text) AND (auto_refill = true));

CREATE INDEX idx_ltc_medications_patient ON public.long_term_medications USING btree (tenant_id, patient_id, status);

ALTER TABLE public.long_term_medications ENABLE ROW LEVEL SECURITY;

-- Name: long_term_medications long_term_medications_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY long_term_medications_tenant_isolation ON public.long_term_medications USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: long_term_medications long_term_medications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER long_term_medications_updated_at BEFORE UPDATE ON public.long_term_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.medication_reconciliation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reconciliation_id uuid NOT NULL,
    drug_name text NOT NULL,
    dose text,
    frequency text,
    route text,
    source text DEFAULT 'home'::text NOT NULL,
    decision text,
    decision_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT med_recon_item_decision_check CHECK (((decision IS NULL) OR (decision = ANY (ARRAY['continue'::text, 'modify'::text, 'stop'::text, 'hold'::text])))),
    CONSTRAINT med_recon_item_source_check CHECK ((source = ANY (ARRAY['home'::text, 'opd'::text, 'transfer'::text, 'other'::text])))
);

-- Name: medication_reconciliation_items medication_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_reconciliation_items
    ADD CONSTRAINT medication_reconciliation_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_med_recon_item_recon ON public.medication_reconciliation_items USING btree (tenant_id, reconciliation_id);

ALTER TABLE public.medication_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- Name: medication_reconciliation_items medication_reconciliation_items_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medication_reconciliation_items_tenant_isolation ON public.medication_reconciliation_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0272_medication_reconciliation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Medication reconciliation (IPSG.6 / NABH MOM). At every care transition — admission, transfer,
-- discharge — the patient's existing medications must be compared against current orders so nothing is
-- unintentionally omitted, duplicated or continued when it should stop. The safety rule: a
-- reconciliation cannot be marked complete until EVERY listed medication has an explicit decision
-- (continue / modify / stop / hold). Un-reconciled medications are the classic cause of transition-of-
-- care harm, so the completion gate is enforced server-side.

CREATE TABLE public.medication_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    transition_type text NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    notes text,
    reconciled_by uuid,
    reconciled_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT med_recon_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text]))),
    CONSTRAINT med_recon_transition_check CHECK ((transition_type = ANY (ARRAY['admission'::text, 'transfer'::text, 'discharge'::text])))
);

-- Name: medication_reconciliations medication_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_reconciliations
    ADD CONSTRAINT medication_reconciliations_pkey PRIMARY KEY (id);

CREATE INDEX idx_med_recon_patient ON public.medication_reconciliations USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.medication_reconciliations ENABLE ROW LEVEL SECURITY;

-- Name: medication_reconciliations medication_reconciliations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medication_reconciliations_tenant_isolation ON public.medication_reconciliations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

CREATE TABLE public.medication_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid,
    prescription_item_id uuid,
    encounter_id uuid,
    event_type public.medication_event_type NOT NULL,
    drug_name text NOT NULL,
    generic_name text,
    atc_code text,
    catalog_item_id uuid,
    dosage text,
    frequency text,
    route text,
    previous_dosage text,
    previous_frequency text,
    change_reason text,
    switched_from_drug text,
    ordered_by uuid NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    is_auto_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: medication_timeline_events medication_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_med_timeline_drug ON public.medication_timeline_events USING btree (tenant_id, patient_id, drug_name, effective_date);

CREATE INDEX idx_med_timeline_enrollment ON public.medication_timeline_events USING btree (enrollment_id) WHERE (enrollment_id IS NOT NULL);

CREATE INDEX idx_med_timeline_patient_date ON public.medication_timeline_events USING btree (tenant_id, patient_id, effective_date);

CREATE INDEX idx_medication_timeline_events_catalog_item_id ON public.medication_timeline_events USING btree (catalog_item_id);

CREATE INDEX idx_medication_timeline_events_deleted_at_1d28d9e9 ON public.medication_timeline_events USING btree (deleted_at);

CREATE INDEX idx_medication_timeline_events_encounter_id ON public.medication_timeline_events USING btree (encounter_id);

CREATE INDEX idx_medication_timeline_events_patient_id ON public.medication_timeline_events USING btree (patient_id);

ALTER TABLE public.medication_timeline_events ENABLE ROW LEVEL SECURITY;

-- Name: medication_timeline_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.medication_timeline_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: medication_timeline_events trg_medication_timeline_events_soft_delete_1d28d9e9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medication_timeline_events_soft_delete_1d28d9e9 BEFORE DELETE ON public.medication_timeline_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Tenant statutory notifiable-disease report worklist + audit ──

CREATE TABLE public.notifiable_disease_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid,
    encounter_id uuid,
    icd10_code text NOT NULL,
    disease_name text NOT NULL,
    reporting_body text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    detected_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    report_ref text,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifiable_reports_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'exempted'::text])))
);

-- Name: notifiable_disease_reports notifiable_disease_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifiable_disease_reports
    ADD CONSTRAINT notifiable_disease_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_notifiable_reports_pending ON public.notifiable_disease_reports USING btree (tenant_id, status, detected_at DESC);

CREATE UNIQUE INDEX uq_notifiable_reports_enc_code ON public.notifiable_disease_reports USING btree (tenant_id, encounter_id, icd10_code) WHERE (encounter_id IS NOT NULL);

ALTER TABLE public.notifiable_disease_reports ENABLE ROW LEVEL SECURITY;

-- Name: notifiable_disease_reports tenant_isolation_notifiable_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_notifiable_reports ON public.notifiable_disease_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- ── Nurse shift handoff entries ─────────────────────────────────────
-- T2 append-only log. One row per handoff note. The "shift" identity
-- is the caller-supplied shift_id string (a per-day key in the dev
-- helper, a real shift roster id once that ships).

CREATE TABLE public.nurse_shift_handoff_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    shift_id text NOT NULL,
    author_user_id uuid NOT NULL,
    author_name text NOT NULL,
    category text NOT NULL,
    note text NOT NULL,
    authored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nurse_shift_handoff_entries_category_check CHECK ((category = ANY (ARRAY['alert'::text, 'info'::text, 'task'::text])))
);

-- Name: nurse_shift_handoff_entries nurse_shift_handoff_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_handoff_entries
    ADD CONSTRAINT nurse_shift_handoff_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_nurse_handoff_entries_tenant_shift ON public.nurse_shift_handoff_entries USING btree (tenant_id, shift_id, authored_at DESC);

CREATE INDEX idx_nurse_shift_handoff_entries_deleted_at_755163ec ON public.nurse_shift_handoff_entries USING btree (deleted_at);

CREATE INDEX idx_nurse_shift_handoff_entries_department_id ON public.nurse_shift_handoff_entries USING btree (department_id);

ALTER TABLE public.nurse_shift_handoff_entries ENABLE ROW LEVEL SECURITY;

-- Name: nurse_shift_handoff_entries dept_scope_nurse_shift_handoff_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_nurse_shift_handoff_entries ON public.nurse_shift_handoff_entries AS RESTRICTIVE USING (public.check_department_access(department_id)) WITH CHECK (public.check_department_access(department_id));

-- Name: nurse_shift_handoff_entries tenant_isolation_nurse_shift_handoff_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nurse_shift_handoff_entries ON public.nurse_shift_handoff_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nurse_shift_handoff_entries trg_nurse_shift_handoff_entries_soft_delete_755163ec; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nurse_shift_handoff_entries_soft_delete_755163ec BEFORE DELETE ON public.nurse_shift_handoff_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Nursing shift narrative notes ───────────────────────────────────
-- Same shape as patient_clinical_notes but keyed by shift_id (a
-- caller-supplied string).

CREATE TABLE public.nursing_shift_notes (
    tenant_id uuid NOT NULL,
    shift_id text NOT NULL,
    department_id uuid,
    text text DEFAULT ''::text NOT NULL,
    last_author_id uuid,
    last_author_name text,
    last_edited_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nursing_shift_notes nursing_shift_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_shift_notes
    ADD CONSTRAINT nursing_shift_notes_pkey PRIMARY KEY (tenant_id, shift_id);

CREATE INDEX idx_nursing_shift_notes_deleted_at_bd1e6c84 ON public.nursing_shift_notes USING btree (deleted_at);

CREATE INDEX idx_nursing_shift_notes_department_id ON public.nursing_shift_notes USING btree (department_id);

CREATE INDEX idx_nursing_shift_notes_updated ON public.nursing_shift_notes USING btree (tenant_id, updated_at DESC);

ALTER TABLE public.nursing_shift_notes ENABLE ROW LEVEL SECURITY;

-- Name: nursing_shift_notes dept_scope_nursing_shift_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_nursing_shift_notes ON public.nursing_shift_notes AS RESTRICTIVE USING (public.check_department_access(department_id)) WITH CHECK (public.check_department_access(department_id));

-- Name: nursing_shift_notes tenant_isolation_nursing_shift_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nursing_shift_notes ON public.nursing_shift_notes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nursing_shift_notes trg_nursing_shift_notes_soft_delete_bd1e6c84; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nursing_shift_notes_soft_delete_bd1e6c84 BEFORE DELETE ON public.nursing_shift_notes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nursing_shift_notes trg_nursing_shift_notes_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nursing_shift_notes_touch BEFORE UPDATE ON public.nursing_shift_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.order_basket_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    items jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_basket_drafts order_basket_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_pkey PRIMARY KEY (id);

-- Name: order_basket_drafts order_basket_drafts_tenant_id_encounter_id_owner_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_tenant_id_encounter_id_owner_user_id_key UNIQUE (tenant_id, encounter_id, owner_user_id);

CREATE INDEX idx_order_basket_drafts_deleted_at_ec8aecae ON public.order_basket_drafts USING btree (deleted_at);

CREATE INDEX order_basket_drafts_encounter_idx ON public.order_basket_drafts USING btree (tenant_id, encounter_id);

CREATE INDEX order_basket_drafts_owner_idx ON public.order_basket_drafts USING btree (tenant_id, owner_user_id);

ALTER TABLE ONLY public.order_basket_drafts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_basket_drafts ENABLE ROW LEVEL SECURITY;

-- Name: order_basket_drafts tenant_isolation_order_basket_drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_basket_drafts ON public.order_basket_drafts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_basket_drafts order_basket_drafts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_basket_drafts_updated BEFORE UPDATE ON public.order_basket_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: order_basket_drafts trg_order_basket_drafts_soft_delete_ec8aecae; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_basket_drafts_soft_delete_ec8aecae BEFORE DELETE ON public.order_basket_drafts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.order_basket_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    patient_id uuid,
    signed_by uuid NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    items_count integer NOT NULL,
    items_snapshot jsonb NOT NULL,
    warnings_returned jsonb DEFAULT '[]'::jsonb NOT NULL,
    warnings_acknowledged jsonb DEFAULT '[]'::jsonb NOT NULL,
    override_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_order_ids jsonb NOT NULL,
    client_session_id text,
    device_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT order_basket_signatures_items_count_check CHECK ((items_count > 0))
);

-- Name: order_basket_signatures order_basket_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_signatures
    ADD CONSTRAINT order_basket_signatures_pkey PRIMARY KEY (id);

CREATE INDEX idx_order_basket_signatures_deleted_at_9fa5fca1 ON public.order_basket_signatures USING btree (deleted_at);

CREATE INDEX order_basket_signatures_encounter_idx ON public.order_basket_signatures USING btree (tenant_id, encounter_id, signed_at DESC);

CREATE INDEX order_basket_signatures_patient_idx ON public.order_basket_signatures USING btree (tenant_id, patient_id, signed_at DESC) WHERE (patient_id IS NOT NULL);

CREATE INDEX order_basket_signatures_signed_by_idx ON public.order_basket_signatures USING btree (tenant_id, signed_by, signed_at DESC);

ALTER TABLE ONLY public.order_basket_signatures FORCE ROW LEVEL SECURITY;

ALTER TABLE public.order_basket_signatures ENABLE ROW LEVEL SECURITY;

-- Name: order_basket_signatures tenant_isolation_order_basket_signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_basket_signatures ON public.order_basket_signatures USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_basket_signatures trg_order_basket_signatures_soft_delete_9fa5fca1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_basket_signatures_soft_delete_9fa5fca1 BEFORE DELETE ON public.order_basket_signatures FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.order_set_activation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    activation_id uuid NOT NULL,
    template_item_id uuid,
    item_type public.order_set_item_type NOT NULL,
    was_selected boolean DEFAULT true NOT NULL,
    skip_reason text,
    lab_order_id uuid,
    prescription_id uuid,
    nursing_task_id uuid,
    diet_order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_set_activation_items order_set_activation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_order_set_activation_items_activation ON public.order_set_activation_items USING btree (activation_id);

CREATE INDEX idx_order_set_activation_items_deleted_at_5406186f ON public.order_set_activation_items USING btree (deleted_at);

CREATE INDEX idx_order_set_activation_items_tenant_id ON public.order_set_activation_items USING btree (tenant_id);

ALTER TABLE public.order_set_activation_items ENABLE ROW LEVEL SECURITY;

-- Name: order_set_activation_items tenant_isolation_order_set_activation_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_activation_items ON public.order_set_activation_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_set_activation_items trg_order_set_activation_items_soft_delete_5406186f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_activation_items_soft_delete_5406186f BEFORE DELETE ON public.order_set_activation_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.order_set_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    template_version integer NOT NULL,
    encounter_id uuid,
    patient_id uuid NOT NULL,
    admission_id uuid,
    activated_by uuid,
    diagnosis_icd text,
    total_items integer DEFAULT 0 NOT NULL,
    selected_items integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_set_activations order_set_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_pkey PRIMARY KEY (id);

CREATE INDEX idx_order_set_activations_admission_id ON public.order_set_activations USING btree (admission_id);

CREATE INDEX idx_order_set_activations_deleted_at_e8e3bcb3 ON public.order_set_activations USING btree (deleted_at);

CREATE INDEX idx_order_set_activations_encounter ON public.order_set_activations USING btree (encounter_id);

CREATE INDEX idx_order_set_activations_patient ON public.order_set_activations USING btree (patient_id);

CREATE INDEX idx_order_set_activations_template ON public.order_set_activations USING btree (template_id);

CREATE INDEX idx_order_set_activations_tenant_id ON public.order_set_activations USING btree (tenant_id);

ALTER TABLE public.order_set_activations ENABLE ROW LEVEL SECURITY;

-- Name: order_set_activations tenant_isolation_order_set_activations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_activations ON public.order_set_activations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_set_activations trg_order_set_activations_soft_delete_e8e3bcb3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_activations_soft_delete_e8e3bcb3 BEFORE DELETE ON public.order_set_activations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.order_set_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    item_type public.order_set_item_type NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    default_selected boolean DEFAULT true NOT NULL,
    lab_test_id uuid,
    lab_priority text,
    lab_notes text,
    drug_catalog_id uuid,
    drug_name text,
    dosage text,
    frequency text,
    duration text,
    route text,
    med_instructions text,
    task_type text,
    task_description text,
    task_frequency text,
    diet_template_id uuid,
    diet_type text,
    diet_instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_set_template_items order_set_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_order_set_template_items_deleted_at_101411ee ON public.order_set_template_items USING btree (deleted_at);

CREATE INDEX idx_order_set_template_items_template_sort ON public.order_set_template_items USING btree (template_id, sort_order);

CREATE INDEX idx_order_set_template_items_tenant_id ON public.order_set_template_items USING btree (tenant_id);

ALTER TABLE public.order_set_template_items ENABLE ROW LEVEL SECURITY;

-- Name: order_set_template_items tenant_isolation_order_set_template_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_template_items ON public.order_set_template_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_set_template_items trg_order_set_template_items_soft_delete_101411ee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_template_items_soft_delete_101411ee BEFORE DELETE ON public.order_set_template_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.order_set_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    context public.order_set_context DEFAULT 'general'::public.order_set_context NOT NULL,
    department_id uuid,
    trigger_diagnoses text[] DEFAULT '{}'::text[],
    surgery_type text,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    parent_template_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_set_templates order_set_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_pkey PRIMARY KEY (id);

CREATE INDEX idx_order_set_templates_deleted_at_f5012bf1 ON public.order_set_templates USING btree (deleted_at);

CREATE INDEX idx_order_set_templates_department_id ON public.order_set_templates USING btree (department_id);

CREATE INDEX idx_order_set_templates_parent ON public.order_set_templates USING btree (parent_template_id) WHERE (parent_template_id IS NOT NULL);

CREATE INDEX idx_order_set_templates_tenant_context ON public.order_set_templates USING btree (tenant_id, context);

CREATE INDEX idx_order_set_templates_tenant_current_active ON public.order_set_templates USING btree (tenant_id, is_current, is_active);

CREATE INDEX idx_order_set_templates_trigger_diagnoses ON public.order_set_templates USING gin (trigger_diagnoses);

ALTER TABLE public.order_set_templates ENABLE ROW LEVEL SECURITY;

-- Name: order_set_templates tenant_isolation_order_set_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_templates ON public.order_set_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_set_templates trg_order_set_templates_soft_delete_f5012bf1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_templates_soft_delete_f5012bf1 BEFORE DELETE ON public.order_set_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: order_set_templates trg_order_set_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_templates_updated_at BEFORE UPDATE ON public.order_set_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.order_set_usage_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    activation_count integer DEFAULT 0 NOT NULL,
    unique_doctors integer DEFAULT 0 NOT NULL,
    items_ordered integer DEFAULT 0 NOT NULL,
    items_skipped integer DEFAULT 0 NOT NULL,
    completion_rate numeric(5,2) DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: order_set_usage_stats order_set_usage_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_pkey PRIMARY KEY (id);

-- Name: order_set_usage_stats order_set_usage_stats_tenant_id_template_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_tenant_id_template_id_period_start_key UNIQUE (tenant_id, template_id, period_start);

CREATE INDEX idx_order_set_usage_stats_deleted_at_031eed6d ON public.order_set_usage_stats USING btree (deleted_at);

CREATE INDEX idx_order_set_usage_stats_template_id ON public.order_set_usage_stats USING btree (template_id);

ALTER TABLE public.order_set_usage_stats ENABLE ROW LEVEL SECURITY;

-- Name: order_set_usage_stats tenant_isolation_order_set_usage_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_usage_stats ON public.order_set_usage_stats USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: order_set_usage_stats trg_order_set_usage_stats_soft_delete_031eed6d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_usage_stats_soft_delete_031eed6d BEFORE DELETE ON public.order_set_usage_stats FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Patient clinical notes ──────────────────────────────────────────
-- T3 free-form text. One row per patient — the row holds the latest
-- merged text plus authorship metadata. Concurrent edits in REST
-- mode use last-write-wins on `updated_at`; offline tenants get
-- proper CRDT merge via the edge node and reconcile here on sync.

CREATE TABLE public.patient_clinical_notes (
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    last_author_id uuid,
    last_author_name text,
    last_edited_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_clinical_notes patient_clinical_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_clinical_notes
    ADD CONSTRAINT patient_clinical_notes_pkey PRIMARY KEY (tenant_id, patient_id);

CREATE INDEX idx_patient_clinical_notes_deleted_at_8fdac7bc ON public.patient_clinical_notes USING btree (deleted_at);

CREATE INDEX idx_patient_clinical_notes_patient_id ON public.patient_clinical_notes USING btree (patient_id);

CREATE INDEX idx_patient_clinical_notes_updated ON public.patient_clinical_notes USING btree (tenant_id, updated_at DESC);

ALTER TABLE public.patient_clinical_notes ENABLE ROW LEVEL SECURITY;

-- Name: patient_clinical_notes tenant_isolation_patient_clinical_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_clinical_notes ON public.patient_clinical_notes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_clinical_notes trg_patient_clinical_notes_soft_delete_8fdac7bc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_clinical_notes_soft_delete_8fdac7bc BEFORE DELETE ON public.patient_clinical_notes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_clinical_notes trg_patient_clinical_notes_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_clinical_notes_touch BEFORE UPDATE ON public.patient_clinical_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.pg_logbook_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    encounter_id uuid,
    entry_type text NOT NULL,
    title text NOT NULL,
    description text,
    diagnosis_codes text[] DEFAULT '{}'::text[],
    procedure_codes text[] DEFAULT '{}'::text[],
    department_id uuid,
    supervisor_id uuid,
    supervisor_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT pg_logbook_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['case'::text, 'procedure'::text, 'ward_round'::text, 'emergency'::text, 'seminar'::text, 'other'::text])))
);

-- Name: pg_logbook_entries pg_logbook_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_pg_logbook_entries_deleted_at_e55f8f7c ON public.pg_logbook_entries USING btree (deleted_at);

CREATE INDEX idx_pg_logbook_entries_department_id ON public.pg_logbook_entries USING btree (department_id);

CREATE INDEX idx_pg_logbook_entries_encounter_id ON public.pg_logbook_entries USING btree (encounter_id);

CREATE INDEX idx_pg_logbook_supervisor ON public.pg_logbook_entries USING btree (tenant_id, supervisor_id) WHERE (supervisor_id IS NOT NULL);

CREATE INDEX idx_pg_logbook_tenant ON public.pg_logbook_entries USING btree (tenant_id);

CREATE INDEX idx_pg_logbook_user ON public.pg_logbook_entries USING btree (tenant_id, user_id);

ALTER TABLE public.pg_logbook_entries ENABLE ROW LEVEL SECURITY;

-- Name: pg_logbook_entries pg_logbook_entries_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pg_logbook_entries_tenant ON public.pg_logbook_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pg_logbook_entries set_updated_at_pg_logbook; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pg_logbook BEFORE UPDATE ON public.pg_logbook_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: pg_logbook_entries trg_pg_logbook_entries_soft_delete_e55f8f7c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pg_logbook_entries_soft_delete_e55f8f7c BEFORE DELETE ON public.pg_logbook_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.procedure_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    department_id uuid,
    category text,
    base_price numeric(12,2),
    duration_minutes integer,
    requires_consent boolean DEFAULT false NOT NULL,
    requires_anesthesia boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: procedure_catalog procedure_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_pkey PRIMARY KEY (id);

-- Name: procedure_catalog procedure_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_procedure_catalog_active ON public.procedure_catalog USING btree (tenant_id) WHERE (is_active = true);

CREATE INDEX idx_procedure_catalog_deleted_at_0e99cb39 ON public.procedure_catalog USING btree (deleted_at);

CREATE INDEX idx_procedure_catalog_department_id ON public.procedure_catalog USING btree (department_id);

CREATE INDEX idx_procedure_catalog_tenant ON public.procedure_catalog USING btree (tenant_id);

ALTER TABLE public.procedure_catalog ENABLE ROW LEVEL SECURITY;

-- Name: procedure_catalog procedure_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_catalog_tenant ON public.procedure_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: procedure_catalog set_updated_at_procedure_catalog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_procedure_catalog BEFORE UPDATE ON public.procedure_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: procedure_catalog trg_procedure_catalog_soft_delete_0e99cb39; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_procedure_catalog_soft_delete_0e99cb39 BEFORE DELETE ON public.procedure_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.procedure_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    ordered_by uuid NOT NULL,
    performed_by uuid,
    priority text DEFAULT 'routine'::text NOT NULL,
    status text DEFAULT 'ordered'::text NOT NULL,
    scheduled_date date,
    scheduled_time time without time zone,
    notes text,
    findings text,
    complications text,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT procedure_orders_priority_check CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'stat'::text]))),
    CONSTRAINT procedure_orders_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);

-- Name: procedure_orders procedure_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_procedure_orders_deleted_at_47cca694 ON public.procedure_orders USING btree (deleted_at);

CREATE INDEX idx_procedure_orders_encounter ON public.procedure_orders USING btree (encounter_id);

CREATE INDEX idx_procedure_orders_patient ON public.procedure_orders USING btree (tenant_id, patient_id);

CREATE INDEX idx_procedure_orders_patient_id ON public.procedure_orders USING btree (patient_id);

CREATE INDEX idx_procedure_orders_status ON public.procedure_orders USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['ordered'::text, 'scheduled'::text, 'in_progress'::text]));

CREATE INDEX idx_procedure_orders_tenant ON public.procedure_orders USING btree (tenant_id);

ALTER TABLE public.procedure_orders ENABLE ROW LEVEL SECURITY;

-- Name: procedure_orders procedure_orders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_orders_tenant ON public.procedure_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: procedure_orders set_updated_at_procedure_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_procedure_orders BEFORE UPDATE ON public.procedure_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: procedure_orders trg_procedure_orders_soft_delete_47cca694; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_procedure_orders_soft_delete_47cca694 BEFORE DELETE ON public.procedure_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.snomed_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    display_name text NOT NULL,
    semantic_tag character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: snomed_codes snomed_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snomed_codes
    ADD CONSTRAINT snomed_codes_code_key UNIQUE (code);

-- Name: snomed_codes snomed_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snomed_codes
    ADD CONSTRAINT snomed_codes_pkey PRIMARY KEY (id);

CREATE INDEX idx_snomed_codes_code ON public.snomed_codes USING btree (code);

CREATE INDEX idx_snomed_codes_deleted_at_5c573da2 ON public.snomed_codes USING btree (deleted_at);

CREATE INDEX idx_snomed_codes_display_trgm ON public.snomed_codes USING gin (display_name public.gin_trgm_ops);

-- Name: snomed_codes trg_snomed_codes_soft_delete_5c573da2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_snomed_codes_soft_delete_5c573da2 BEFORE DELETE ON public.snomed_codes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.vitals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    temperature numeric(4,1),
    pulse integer,
    systolic_bp integer,
    diastolic_bp integer,
    respiratory_rate integer,
    spo2 integer,
    weight_kg numeric(5,2),
    height_cm numeric(5,1),
    bmi numeric(4,1),
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_retrospective boolean DEFAULT false NOT NULL,
    pulse_rate integer,
    pain_score integer,
    patient_id uuid,
    bp_systolic integer,
    bp_diastolic integer,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: vitals vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_pkey PRIMARY KEY (id);

CREATE INDEX idx_vitals_deleted_at_20d3dfbe ON public.vitals USING btree (deleted_at);

CREATE INDEX idx_vitals_encounter ON public.vitals USING btree (encounter_id);

CREATE INDEX idx_vitals_latest ON public.vitals USING btree (tenant_id, encounter_id, recorded_at DESC);

CREATE INDEX idx_vitals_tenant ON public.vitals USING btree (tenant_id);

ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- Name: vitals tenant_isolation_vitals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vitals ON public.vitals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: vitals audit_vitals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_vitals AFTER INSERT OR DELETE OR UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');

-- Name: vitals trg_vitals_soft_delete_20d3dfbe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vitals_soft_delete_20d3dfbe BEFORE DELETE ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.vitals_capture_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    frequency_minutes integer NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    next_due_at timestamp with time zone NOT NULL,
    last_captured_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT vitals_capture_schedules_frequency_minutes_check CHECK (((frequency_minutes >= 15) AND (frequency_minutes <= 1440)))
);

-- Name: vitals_capture_schedules vitals_capture_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_capture_schedules
    ADD CONSTRAINT vitals_capture_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_vitals_capture_schedules_deleted_at_204b143f ON public.vitals_capture_schedules USING btree (deleted_at);

CREATE INDEX vitals_schedule_due_idx ON public.vitals_capture_schedules USING btree (tenant_id, next_due_at) WHERE (ended_at IS NULL);

ALTER TABLE ONLY public.vitals_capture_schedules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vitals_capture_schedules ENABLE ROW LEVEL SECURITY;

-- Name: vitals_capture_schedules tenant_isolation_vitals_capture_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vitals_capture_schedules ON public.vitals_capture_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: vitals_capture_schedules trg_vitals_capture_schedules_soft_delete_204b143f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vitals_capture_schedules_soft_delete_204b143f BEFORE DELETE ON public.vitals_capture_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: case_referrals case_referrals_case_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_case_assignment_id_fkey FOREIGN KEY (case_assignment_id) REFERENCES public.case_assignments(id) ON DELETE CASCADE;

-- Name: doctor_incentive_assignments doctor_incentive_assignments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id);

-- Name: doctor_package_inclusions doctor_package_inclusions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.doctor_packages(id) ON DELETE CASCADE;

-- Name: incentive_calculations incentive_calculations_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id);

-- Name: incentive_plan_rules incentive_plan_rules_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plan_rules
    ADD CONSTRAINT incentive_plan_rules_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id) ON DELETE CASCADE;

-- Name: medication_reconciliation_items medication_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_reconciliation_items
    ADD CONSTRAINT medication_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.medication_reconciliations(id) ON DELETE CASCADE;

-- Name: order_set_activation_items order_set_activation_items_activation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_activation_id_fkey FOREIGN KEY (activation_id) REFERENCES public.order_set_activations(id) ON DELETE CASCADE;

-- Name: order_set_activation_items order_set_activation_items_template_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_template_item_id_fkey FOREIGN KEY (template_item_id) REFERENCES public.order_set_template_items(id);

-- Name: order_set_activations order_set_activations_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id);

-- Name: order_set_template_items order_set_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id) ON DELETE CASCADE;

-- Name: order_set_templates order_set_templates_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_parent_template_id_fkey FOREIGN KEY (parent_template_id) REFERENCES public.order_set_templates(id);

-- Name: order_set_usage_stats order_set_usage_stats_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id);

-- Name: procedure_orders procedure_orders_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.procedure_catalog(id);
