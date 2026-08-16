-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 53
-- Drops: none
-- print data — schema.
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



CREATE TABLE public.asset_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text DEFAULT ''::text,
    parent_id uuid,
    asset_domain text DEFAULT 'general'::text NOT NULL,
    description text,
    regulatory_class text,
    default_pm_frequency text,
    default_calibration_frequency text,
    requires_pm boolean DEFAULT false NOT NULL,
    requires_calibration boolean DEFAULT false NOT NULL,
    is_camp_eligible boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT asset_categories_domain_check CHECK ((asset_domain = ANY (ARRAY['biomedical'::text, 'diagnostic_monitoring'::text, 'therapeutic_life_support'::text, 'lab'::text, 'imaging'::text, 'ot_cssd'::text, 'dental_ent_ophthalmology'::text, 'facility_utility'::text, 'fire_safety'::text, 'it_device'::text, 'furniture_fixture'::text, 'mobility_transport'::text, 'housekeeping_laundry'::text, 'kitchen_dietary'::text, 'security_surveillance'::text, 'teaching_simulation'::text, 'camp_mobile'::text, 'general'::text])))
);

-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);

-- Name: asset_categories asset_categories_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_tenant_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_asset_categories_deleted_at_f4aaca0a ON public.asset_categories USING btree (deleted_at);

CREATE INDEX idx_asset_categories_tenant_domain ON public.asset_categories USING btree (tenant_id, asset_domain, is_active);

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

-- Name: asset_categories asset_categories_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_categories_tenant ON public.asset_categories USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));

-- Name: asset_categories trg_asset_categories_soft_delete_f4aaca0a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_categories_soft_delete_f4aaca0a BEFORE DELETE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: asset_categories trg_asset_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_categories_updated_at BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.blood_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    patient_id uuid,
    admission_id uuid,
    request_number text,
    patient_blood_group text,
    patient_rh_type text,
    component_type text,
    blood_group text,
    units_requested integer DEFAULT 0 NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_by uuid,
    processed_by uuid,
    verified_by uuid,
    diagnosis text,
    indication text,
    antibody_screen text,
    special_requirements text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: blood_requests blood_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_requests
    ADD CONSTRAINT blood_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_blood_requests_deleted_at_ead9a7a6 ON public.blood_requests USING btree (deleted_at);

ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

-- Name: blood_requests blood_requests_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blood_requests_tenant_isolation ON public.blood_requests USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: blood_requests trg_blood_requests_soft_delete_ead9a7a6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blood_requests_soft_delete_ead9a7a6 BEFORE DELETE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.blood_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bag_number text DEFAULT ''::text NOT NULL,
    donation_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date DEFAULT CURRENT_DATE NOT NULL,
    blood_group text DEFAULT ''::text NOT NULL,
    component_type text DEFAULT ''::text NOT NULL,
    volume_ml integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: blood_units blood_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_units
    ADD CONSTRAINT blood_units_pkey PRIMARY KEY (id);

CREATE INDEX idx_blood_units_deleted_at_cfcad7c7 ON public.blood_units USING btree (deleted_at);

ALTER TABLE public.blood_units ENABLE ROW LEVEL SECURITY;

-- Name: blood_units blood_units_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blood_units_tenant_isolation ON public.blood_units USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: blood_units trg_blood_units_soft_delete_cfcad7c7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blood_units_soft_delete_cfcad7c7 BEFORE DELETE ON public.blood_units FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.calibration_agencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text DEFAULT ''::text NOT NULL,
    accreditation_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: calibration_agencies calibration_agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibration_agencies
    ADD CONSTRAINT calibration_agencies_pkey PRIMARY KEY (id);

CREATE INDEX idx_calibration_agencies_deleted_at_a708db25 ON public.calibration_agencies USING btree (deleted_at);

ALTER TABLE public.calibration_agencies ENABLE ROW LEVEL SECURITY;

-- Name: calibration_agencies calibration_agencies_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calibration_agencies_tenant_isolation ON public.calibration_agencies USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: calibration_agencies trg_calibration_agencies_soft_delete_a708db25; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calibration_agencies_soft_delete_a708db25 BEFORE DELETE ON public.calibration_agencies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.claim_procedures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    claim_id uuid,
    procedure_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: claim_procedures claim_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_procedures
    ADD CONSTRAINT claim_procedures_pkey PRIMARY KEY (id);

CREATE INDEX idx_claim_procedures_deleted_at_2d163d03 ON public.claim_procedures USING btree (deleted_at);

ALTER TABLE public.claim_procedures ENABLE ROW LEVEL SECURITY;

-- Name: claim_procedures claim_procedures_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY claim_procedures_tenant_isolation ON public.claim_procedures USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: claim_procedures trg_claim_procedures_soft_delete_2d163d03; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_claim_procedures_soft_delete_2d163d03 BEFORE DELETE ON public.claim_procedures FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.crossmatch_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    request_id uuid,
    unit_id uuid,
    result text,
    issue_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: crossmatch_results crossmatch_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_results
    ADD CONSTRAINT crossmatch_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_crossmatch_results_deleted_at_591a841f ON public.crossmatch_results USING btree (deleted_at);

ALTER TABLE public.crossmatch_results ENABLE ROW LEVEL SECURITY;

-- Name: crossmatch_results crossmatch_results_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crossmatch_results_tenant_isolation ON public.crossmatch_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: crossmatch_results trg_crossmatch_results_soft_delete_591a841f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_crossmatch_results_soft_delete_591a841f BEFORE DELETE ON public.crossmatch_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cylinder_storage_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    total_capacity integer DEFAULT 0 NOT NULL,
    oxygen_cylinders integer DEFAULT 0 NOT NULL,
    nitrous_oxide_cylinders integer DEFAULT 0 NOT NULL,
    co2_cylinders integer DEFAULT 0 NOT NULL,
    other_cylinders integer DEFAULT 0 NOT NULL,
    storage_compliant boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cylinder_storage_summary cylinder_storage_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cylinder_storage_summary
    ADD CONSTRAINT cylinder_storage_summary_pkey PRIMARY KEY (id);

CREATE INDEX idx_cylinder_storage_summary_deleted_at_2deae930 ON public.cylinder_storage_summary USING btree (deleted_at);

ALTER TABLE public.cylinder_storage_summary ENABLE ROW LEVEL SECURITY;

-- Name: cylinder_storage_summary cylinder_storage_summary_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cylinder_storage_summary_tenant_isolation ON public.cylinder_storage_summary USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cylinder_storage_summary trg_cylinder_storage_summary_soft_delete_2deae930; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cylinder_storage_summary_soft_delete_2deae930 BEFORE DELETE ON public.cylinder_storage_summary FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.drug_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    brand_name text,
    generic_name text,
    is_controlled boolean DEFAULT false NOT NULL,
    schedule text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: drug_catalog drug_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_catalog
    ADD CONSTRAINT drug_catalog_pkey PRIMARY KEY (id);

CREATE INDEX idx_drug_catalog_deleted_at_defd965b ON public.drug_catalog USING btree (deleted_at);

ALTER TABLE public.drug_catalog ENABLE ROW LEVEL SECURITY;

-- Name: drug_catalog drug_catalog_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drug_catalog_tenant_isolation ON public.drug_catalog USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: drug_catalog trg_drug_catalog_soft_delete_defd965b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_drug_catalog_soft_delete_defd965b BEFORE DELETE ON public.drug_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.education_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: education_materials education_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education_materials
    ADD CONSTRAINT education_materials_pkey PRIMARY KEY (id);

CREATE INDEX idx_education_materials_deleted_at_a7bcbd7c ON public.education_materials USING btree (deleted_at);

ALTER TABLE public.education_materials ENABLE ROW LEVEL SECURITY;

-- Name: education_materials education_materials_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY education_materials_tenant_isolation ON public.education_materials USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: education_materials trg_education_materials_soft_delete_a7bcbd7c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_education_materials_soft_delete_a7bcbd7c BEFORE DELETE ON public.education_materials FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.encounter_diagnoses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    encounter_id uuid,
    icd_code text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: encounter_diagnoses encounter_diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_diagnoses
    ADD CONSTRAINT encounter_diagnoses_pkey PRIMARY KEY (id);

CREATE INDEX idx_encounter_diagnoses_deleted_at_1487dc17 ON public.encounter_diagnoses USING btree (deleted_at);

ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;

-- Name: encounter_diagnoses encounter_diagnoses_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY encounter_diagnoses_tenant_isolation ON public.encounter_diagnoses USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: encounter_diagnoses trg_encounter_diagnoses_soft_delete_1487dc17; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encounter_diagnoses_soft_delete_1487dc17 BEFORE DELETE ON public.encounter_diagnoses FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Final schema alignment discovered by print-data smoke coverage.
-- Keep this separate from 0122 so local databases that already recorded 0122
-- do not hit SQLx migration checksum mismatches.

CREATE TABLE public.fall_risk_interventions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    intervention_text text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fall_risk_interventions fall_risk_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_risk_interventions
    ADD CONSTRAINT fall_risk_interventions_pkey PRIMARY KEY (id);

CREATE INDEX fall_risk_interventions_admission_idx ON public.fall_risk_interventions USING btree (tenant_id, admission_id, created_at);

CREATE INDEX idx_fall_risk_interventions_admission_id ON public.fall_risk_interventions USING btree (admission_id);

CREATE INDEX idx_fall_risk_interventions_deleted_at_6c94f3c9 ON public.fall_risk_interventions USING btree (deleted_at);

ALTER TABLE public.fall_risk_interventions ENABLE ROW LEVEL SECURITY;

-- Name: fall_risk_interventions tenant_isolation_fall_risk_interventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fall_risk_interventions ON public.fall_risk_interventions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: fall_risk_interventions trg_fall_risk_interventions_soft_delete_6c94f3c9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fall_risk_interventions_soft_delete_6c94f3c9 BEFORE DELETE ON public.fall_risk_interventions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.fluid_intake (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    intake_type text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    volume_ml integer DEFAULT 0 NOT NULL,
    route text,
    recorded_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fluid_intake fluid_intake_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fluid_intake
    ADD CONSTRAINT fluid_intake_pkey PRIMARY KEY (id);

CREATE INDEX idx_fluid_intake_deleted_at_445e3221 ON public.fluid_intake USING btree (deleted_at);

ALTER TABLE public.fluid_intake ENABLE ROW LEVEL SECURITY;

-- Name: fluid_intake fluid_intake_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fluid_intake_tenant_isolation ON public.fluid_intake USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: fluid_intake trg_fluid_intake_soft_delete_445e3221; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fluid_intake_soft_delete_445e3221 BEFORE DELETE ON public.fluid_intake FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.fluid_output (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    output_time timestamp with time zone DEFAULT now() NOT NULL,
    route text DEFAULT ''::text NOT NULL,
    quantity_ml integer DEFAULT 0 NOT NULL,
    remarks text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_at timestamp with time zone,
    output_type text,
    description text,
    volume_ml integer,
    characteristics text,
    recorded_by_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fluid_output fluid_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fluid_output
    ADD CONSTRAINT fluid_output_pkey PRIMARY KEY (id);

CREATE INDEX idx_fluid_output_deleted_at_61988c03 ON public.fluid_output USING btree (deleted_at);

ALTER TABLE public.fluid_output ENABLE ROW LEVEL SECURITY;

-- Name: fluid_output fluid_output_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fluid_output_tenant_isolation ON public.fluid_output USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: fluid_output trg_fluid_output_soft_delete_61988c03; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fluid_output_soft_delete_61988c03 BEFORE DELETE ON public.fluid_output FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.gas_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_date date DEFAULT CURRENT_DATE NOT NULL,
    gas_type text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    action_taken text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: gas_incidents gas_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gas_incidents
    ADD CONSTRAINT gas_incidents_pkey PRIMARY KEY (id);

CREATE INDEX idx_gas_incidents_deleted_at_745a0ed8 ON public.gas_incidents USING btree (deleted_at);

ALTER TABLE public.gas_incidents ENABLE ROW LEVEL SECURITY;

-- Name: gas_incidents gas_incidents_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gas_incidents_tenant_isolation ON public.gas_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: gas_incidents trg_gas_incidents_soft_delete_745a0ed8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gas_incidents_soft_delete_745a0ed8 BEFORE DELETE ON public.gas_incidents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.gcs_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    eye_opening integer,
    verbal_response integer,
    motor_response integer,
    total_score integer,
    pupil_left_size text,
    pupil_left_reaction text,
    pupil_right_size text,
    pupil_right_reaction text,
    bp_systolic integer,
    bp_diastolic integer,
    pulse integer,
    spo2 integer,
    temperature numeric,
    assessed_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: gcs_assessments gcs_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gcs_assessments
    ADD CONSTRAINT gcs_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_gcs_assessments_deleted_at_8f40875b ON public.gcs_assessments USING btree (deleted_at);

ALTER TABLE public.gcs_assessments ENABLE ROW LEVEL SECURITY;

-- Name: gcs_assessments gcs_assessments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gcs_assessments_tenant_isolation ON public.gcs_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: gcs_assessments trg_gcs_assessments_soft_delete_8f40875b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gcs_assessments_soft_delete_8f40875b BEFORE DELETE ON public.gcs_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.incident_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number text DEFAULT ''::text NOT NULL,
    incident_date timestamp with time zone DEFAULT now() NOT NULL,
    incident_type text DEFAULT ''::text NOT NULL,
    severity text DEFAULT ''::text NOT NULL,
    department_id uuid,
    description text DEFAULT ''::text NOT NULL,
    immediate_action text,
    reported_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    report_date date,
    report_time time without time zone,
    incident_time time without time zone,
    incident_location text,
    incident_category text,
    severity_level text,
    patient_involved boolean DEFAULT false NOT NULL,
    patient_id uuid,
    patient_harm_level text,
    incident_description text,
    immediate_action_taken text,
    patient_condition_post_incident text,
    root_cause_identified text,
    department_head_notified boolean DEFAULT false NOT NULL,
    quality_dept_notified boolean DEFAULT false NOT NULL,
    risk_management_notified boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: incident_reports incident_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_reports
    ADD CONSTRAINT incident_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_incident_reports_deleted_at_89cefc06 ON public.incident_reports USING btree (deleted_at);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Name: incident_reports incident_reports_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incident_reports_tenant_isolation ON public.incident_reports USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: incident_reports trg_incident_reports_soft_delete_89cefc06; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_incident_reports_soft_delete_89cefc06 BEFORE DELETE ON public.incident_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.insurance_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: insurance_companies insurance_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_companies
    ADD CONSTRAINT insurance_companies_pkey PRIMARY KEY (id);

CREATE INDEX idx_insurance_companies_deleted_at_f878e71c ON public.insurance_companies USING btree (deleted_at);

ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;

-- Name: insurance_companies insurance_companies_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insurance_companies_tenant_isolation ON public.insurance_companies USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: insurance_companies trg_insurance_companies_soft_delete_f878e71c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_insurance_companies_soft_delete_f878e71c BEFORE DELETE ON public.insurance_companies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.intake_output (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    intake_oral integer,
    intake_iv integer,
    intake_ng integer,
    intake_other integer,
    output_urine integer,
    output_vomit integer,
    output_drain integer,
    output_stool integer,
    output_other integer,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: intake_output intake_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_output
    ADD CONSTRAINT intake_output_pkey PRIMARY KEY (id);

CREATE INDEX idx_intake_output_deleted_at_96717081 ON public.intake_output USING btree (deleted_at);

ALTER TABLE public.intake_output ENABLE ROW LEVEL SECURITY;

-- Name: intake_output intake_output_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY intake_output_tenant_isolation ON public.intake_output USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: intake_output trg_intake_output_soft_delete_96717081; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_intake_output_soft_delete_96717081 BEFORE DELETE ON public.intake_output FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.inventory_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    item_code text DEFAULT ''::text NOT NULL,
    item_name text DEFAULT ''::text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: inventory_catalog inventory_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_catalog
    ADD CONSTRAINT inventory_catalog_pkey PRIMARY KEY (id);

CREATE INDEX idx_inventory_catalog_deleted_at_c2da85a8 ON public.inventory_catalog USING btree (deleted_at);

ALTER TABLE public.inventory_catalog ENABLE ROW LEVEL SECURITY;

-- Name: inventory_catalog inventory_catalog_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_catalog_tenant_isolation ON public.inventory_catalog USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: inventory_catalog trg_inventory_catalog_soft_delete_c2da85a8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_catalog_soft_delete_c2da85a8 BEFORE DELETE ON public.inventory_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.ipd_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    order_type text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    drug_name text DEFAULT ''::text NOT NULL,
    dose text DEFAULT ''::text NOT NULL,
    route text,
    frequency text DEFAULT ''::text NOT NULL,
    is_discharge_medication boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_orders ipd_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_orders
    ADD CONSTRAINT ipd_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_orders_deleted_at_9c63183f ON public.ipd_orders USING btree (deleted_at);

ALTER TABLE public.ipd_orders ENABLE ROW LEVEL SECURITY;

-- Name: ipd_orders ipd_orders_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_orders_tenant_isolation ON public.ipd_orders USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: ipd_orders trg_ipd_orders_soft_delete_9c63183f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_orders_soft_delete_9c63183f BEFORE DELETE ON public.ipd_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.iv_fluid_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    admission_id uuid,
    fluid_name text DEFAULT ''::text NOT NULL,
    volume_ml integer DEFAULT 0 NOT NULL,
    rate text,
    additives text[],
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    duration_hours double precision,
    status text DEFAULT 'ordered'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    rate_ml_per_hr numeric(10,2),
    site text,
    pump_serial text,
    ordered_by uuid,
    started_at timestamp with time zone,
    planned_end_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    discontinued_reason text,
    discontinued_by uuid,
    discontinued_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT iv_fluid_orders_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'running'::text, 'paused'::text, 'completed'::text, 'discontinued'::text])))
);

-- Name: iv_fluid_orders iv_fluid_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iv_fluid_orders
    ADD CONSTRAINT iv_fluid_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_iv_fluid_orders_admission ON public.iv_fluid_orders USING btree (tenant_id, admission_id, status);

CREATE INDEX idx_iv_fluid_orders_deleted_at_f67d15b4 ON public.iv_fluid_orders USING btree (deleted_at);

ALTER TABLE public.iv_fluid_orders ENABLE ROW LEVEL SECURITY;

-- Name: iv_fluid_orders iv_fluid_orders_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY iv_fluid_orders_tenant_isolation ON public.iv_fluid_orders USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: iv_fluid_orders trg_iv_fluid_orders_soft_delete_f67d15b4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_iv_fluid_orders_soft_delete_f67d15b4 BEFORE DELETE ON public.iv_fluid_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_critical_value_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_critical_values integer DEFAULT 0 NOT NULL,
    reported_within_target integer DEFAULT 0 NOT NULL,
    average_reporting_time_minutes double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_critical_value_metrics lab_critical_value_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_critical_value_metrics
    ADD CONSTRAINT lab_critical_value_metrics_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_critical_value_metrics_deleted_at_4dbd545c ON public.lab_critical_value_metrics USING btree (deleted_at);

ALTER TABLE public.lab_critical_value_metrics ENABLE ROW LEVEL SECURITY;

-- Name: lab_critical_value_metrics lab_critical_value_metrics_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_critical_value_metrics_tenant_isolation ON public.lab_critical_value_metrics USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_critical_value_metrics trg_lab_critical_value_metrics_soft_delete_4dbd545c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_critical_value_metrics_soft_delete_4dbd545c BEFORE DELETE ON public.lab_critical_value_metrics FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    sample_rejection_rate double precision DEFAULT 0 NOT NULL,
    repeat_rate double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_performance_metrics lab_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_performance_metrics
    ADD CONSTRAINT lab_performance_metrics_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_performance_metrics_deleted_at_796bf9a8 ON public.lab_performance_metrics USING btree (deleted_at);

ALTER TABLE public.lab_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Name: lab_performance_metrics lab_performance_metrics_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_performance_metrics_tenant_isolation ON public.lab_performance_metrics USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_performance_metrics trg_lab_performance_metrics_soft_delete_796bf9a8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_performance_metrics_soft_delete_796bf9a8 BEFORE DELETE ON public.lab_performance_metrics FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_pt_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    program_name text DEFAULT ''::text NOT NULL,
    analyte text DEFAULT ''::text NOT NULL,
    result text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_pt_results lab_pt_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_pt_results
    ADD CONSTRAINT lab_pt_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_pt_results_deleted_at_01a6331f ON public.lab_pt_results USING btree (deleted_at);

ALTER TABLE public.lab_pt_results ENABLE ROW LEVEL SECURITY;

-- Name: lab_pt_results lab_pt_results_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_pt_results_tenant_isolation ON public.lab_pt_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_pt_results trg_lab_pt_results_soft_delete_01a6331f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_pt_results_soft_delete_01a6331f BEFORE DELETE ON public.lab_pt_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lab_tat_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    test_category text DEFAULT ''::text NOT NULL,
    target_tat_hours double precision DEFAULT 0 NOT NULL,
    actual_tat_hours double precision DEFAULT 0 NOT NULL,
    compliance_percentage double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lab_tat_metrics lab_tat_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tat_metrics
    ADD CONSTRAINT lab_tat_metrics_pkey PRIMARY KEY (id);

CREATE INDEX idx_lab_tat_metrics_deleted_at_b6a079f3 ON public.lab_tat_metrics USING btree (deleted_at);

ALTER TABLE public.lab_tat_metrics ENABLE ROW LEVEL SECURITY;

-- Name: lab_tat_metrics lab_tat_metrics_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lab_tat_metrics_tenant_isolation ON public.lab_tat_metrics USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: lab_tat_metrics trg_lab_tat_metrics_soft_delete_b6a079f3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lab_tat_metrics_soft_delete_b6a079f3 BEFORE DELETE ON public.lab_tat_metrics FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text DEFAULT ''::text NOT NULL,
    code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);

CREATE INDEX idx_leave_types_deleted_at_4c23f440 ON public.leave_types USING btree (deleted_at);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- Name: leave_types leave_types_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_types_tenant_isolation ON public.leave_types USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: leave_types trg_leave_types_soft_delete_4c23f440; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_types_soft_delete_4c23f440 BEFORE DELETE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.medical_gas_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    gas_type text DEFAULT ''::text NOT NULL,
    source_type text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    capacity text DEFAULT ''::text NOT NULL,
    last_tested date,
    next_test_due date,
    status text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: medical_gas_systems medical_gas_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_gas_systems
    ADD CONSTRAINT medical_gas_systems_pkey PRIMARY KEY (id);

CREATE INDEX idx_medical_gas_systems_deleted_at_bbcb6343 ON public.medical_gas_systems USING btree (deleted_at);

ALTER TABLE public.medical_gas_systems ENABLE ROW LEVEL SECURITY;

-- Name: medical_gas_systems medical_gas_systems_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medical_gas_systems_tenant_isolation ON public.medical_gas_systems USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: medical_gas_systems trg_medical_gas_systems_soft_delete_bbcb6343; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medical_gas_systems_soft_delete_bbcb6343 BEFORE DELETE ON public.medical_gas_systems FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mlc_injuries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    mlc_case_id uuid,
    injury_number integer DEFAULT 0 NOT NULL,
    injury_type text DEFAULT ''::text NOT NULL,
    location text,
    size_cm text,
    description text,
    probable_age text,
    probable_weapon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mlc_injuries mlc_injuries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_injuries
    ADD CONSTRAINT mlc_injuries_pkey PRIMARY KEY (id);

CREATE INDEX idx_mlc_injuries_deleted_at_bcd0b34c ON public.mlc_injuries USING btree (deleted_at);

ALTER TABLE public.mlc_injuries ENABLE ROW LEVEL SECURITY;

-- Name: mlc_injuries mlc_injuries_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_injuries_tenant_isolation ON public.mlc_injuries USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: mlc_injuries trg_mlc_injuries_soft_delete_bcd0b34c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mlc_injuries_soft_delete_bcd0b34c BEFORE DELETE ON public.mlc_injuries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mlc_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    mlc_case_id uuid,
    sample_description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mlc_samples mlc_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_samples
    ADD CONSTRAINT mlc_samples_pkey PRIMARY KEY (id);

CREATE INDEX idx_mlc_samples_deleted_at_e083d381 ON public.mlc_samples USING btree (deleted_at);

ALTER TABLE public.mlc_samples ENABLE ROW LEVEL SECURITY;

-- Name: mlc_samples mlc_samples_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_samples_tenant_isolation ON public.mlc_samples USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: mlc_samples trg_mlc_samples_soft_delete_e083d381; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mlc_samples_soft_delete_e083d381 BEFORE DELETE ON public.mlc_samples FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.nabl_scope_of_accreditation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_description text DEFAULT ''::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nabl_scope_of_accreditation nabl_scope_of_accreditation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nabl_scope_of_accreditation
    ADD CONSTRAINT nabl_scope_of_accreditation_pkey PRIMARY KEY (id);

CREATE INDEX idx_nabl_scope_of_accreditation_deleted_at_b4a36439 ON public.nabl_scope_of_accreditation USING btree (deleted_at);

ALTER TABLE public.nabl_scope_of_accreditation ENABLE ROW LEVEL SECURITY;

-- Name: nabl_scope_of_accreditation nabl_scope_of_accreditation_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nabl_scope_of_accreditation_tenant_isolation ON public.nabl_scope_of_accreditation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: nabl_scope_of_accreditation trg_nabl_scope_of_accreditation_soft_delete_b4a36439; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nabl_scope_of_accreditation_soft_delete_b4a36439 BEFORE DELETE ON public.nabl_scope_of_accreditation FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.package_additional_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text DEFAULT ''::text NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: package_additional_charges package_additional_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_additional_charges
    ADD CONSTRAINT package_additional_charges_pkey PRIMARY KEY (id);

CREATE INDEX idx_package_additional_charges_deleted_at_db5c1907 ON public.package_additional_charges USING btree (deleted_at);

ALTER TABLE public.package_additional_charges ENABLE ROW LEVEL SECURITY;

-- Name: package_additional_charges package_additional_charges_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY package_additional_charges_tenant_isolation ON public.package_additional_charges USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: package_additional_charges trg_package_additional_charges_soft_delete_db5c1907; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_package_additional_charges_soft_delete_db5c1907 BEFORE DELETE ON public.package_additional_charges FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.package_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bill_number text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_id uuid,
    admission_id uuid,
    package_id uuid,
    package_amount double precision DEFAULT 0 NOT NULL,
    additional_total double precision DEFAULT 0 NOT NULL,
    exclusion_total double precision DEFAULT 0 NOT NULL,
    gross_amount double precision DEFAULT 0 NOT NULL,
    discount_amount double precision DEFAULT 0 NOT NULL,
    tax_amount double precision DEFAULT 0 NOT NULL,
    net_amount double precision DEFAULT 0 NOT NULL,
    advance_paid double precision DEFAULT 0 NOT NULL,
    insurance_amount double precision DEFAULT 0 NOT NULL,
    balance_due double precision DEFAULT 0 NOT NULL,
    doctor_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: package_bills package_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_bills
    ADD CONSTRAINT package_bills_pkey PRIMARY KEY (id);

CREATE INDEX idx_package_bills_deleted_at_9bf16fac ON public.package_bills USING btree (deleted_at);

ALTER TABLE public.package_bills ENABLE ROW LEVEL SECURITY;

-- Name: package_bills package_bills_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY package_bills_tenant_isolation ON public.package_bills USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: package_bills trg_package_bills_soft_delete_9bf16fac; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_package_bills_soft_delete_9bf16fac BEFORE DELETE ON public.package_bills FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.package_exclusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text DEFAULT ''::text NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: package_exclusions package_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_exclusions
    ADD CONSTRAINT package_exclusions_pkey PRIMARY KEY (id);

CREATE INDEX idx_package_exclusions_deleted_at_fc86b54c ON public.package_exclusions USING btree (deleted_at);

ALTER TABLE public.package_exclusions ENABLE ROW LEVEL SECURITY;

-- Name: package_exclusions package_exclusions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY package_exclusions_tenant_isolation ON public.package_exclusions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: package_exclusions trg_package_exclusions_soft_delete_fc86b54c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_package_exclusions_soft_delete_fc86b54c BEFORE DELETE ON public.package_exclusions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.package_exclusions_used (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text DEFAULT ''::text NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: package_exclusions_used package_exclusions_used_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_exclusions_used
    ADD CONSTRAINT package_exclusions_used_pkey PRIMARY KEY (id);

CREATE INDEX idx_package_exclusions_used_deleted_at_69730442 ON public.package_exclusions_used USING btree (deleted_at);

ALTER TABLE public.package_exclusions_used ENABLE ROW LEVEL SECURITY;

-- Name: package_exclusions_used package_exclusions_used_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY package_exclusions_used_tenant_isolation ON public.package_exclusions_used USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: package_exclusions_used trg_package_exclusions_used_soft_delete_69730442; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_package_exclusions_used_soft_delete_69730442 BEFORE DELETE ON public.package_exclusions_used FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.package_inclusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_bill_id uuid,
    description text DEFAULT ''::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: package_inclusions package_inclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_inclusions
    ADD CONSTRAINT package_inclusions_pkey PRIMARY KEY (id);

CREATE INDEX idx_package_inclusions_deleted_at_44464d22 ON public.package_inclusions USING btree (deleted_at);

ALTER TABLE public.package_inclusions ENABLE ROW LEVEL SECURITY;

-- Name: package_inclusions package_inclusions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY package_inclusions_tenant_isolation ON public.package_inclusions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: package_inclusions trg_package_inclusions_soft_delete_44464d22; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_package_inclusions_soft_delete_44464d22 BEFORE DELETE ON public.package_inclusions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text,
    department_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);

CREATE INDEX idx_packages_deleted_at_2fc9e511 ON public.packages USING btree (deleted_at);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Name: packages packages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY packages_tenant_isolation ON public.packages USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: packages trg_packages_soft_delete_2fc9e511; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_packages_soft_delete_2fc9e511 BEFORE DELETE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.patient_insurances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    patient_id uuid,
    payer_name text,
    policy_number text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_insurances patient_insurances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_insurances
    ADD CONSTRAINT patient_insurances_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_insurances_deleted_at_7407faee ON public.patient_insurances USING btree (deleted_at);

ALTER TABLE public.patient_insurances ENABLE ROW LEVEL SECURITY;

-- Name: patient_insurances patient_insurances_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_insurances_tenant_isolation ON public.patient_insurances USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: patient_insurances trg_patient_insurances_soft_delete_7407faee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_insurances_soft_delete_7407faee BEFORE DELETE ON public.patient_insurances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_form_f_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_forms integer DEFAULT 0 NOT NULL,
    complete_forms integer DEFAULT 0 NOT NULL,
    incomplete_forms integer DEFAULT 0 NOT NULL,
    compliance_percentage double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_form_f_compliance pcpndt_form_f_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_form_f_compliance
    ADD CONSTRAINT pcpndt_form_f_compliance_pkey PRIMARY KEY (id);

CREATE INDEX idx_pcpndt_form_f_compliance_deleted_at_634e69d5 ON public.pcpndt_form_f_compliance USING btree (deleted_at);

ALTER TABLE public.pcpndt_form_f_compliance ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_form_f_compliance pcpndt_form_f_compliance_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pcpndt_form_f_compliance_tenant_isolation ON public.pcpndt_form_f_compliance USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: pcpndt_form_f_compliance trg_pcpndt_form_f_compliance_soft_delete_634e69d5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_form_f_compliance_soft_delete_634e69d5 BEFORE DELETE ON public.pcpndt_form_f_compliance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    inspection_date date DEFAULT CURRENT_DATE NOT NULL,
    authority text DEFAULT ''::text NOT NULL,
    findings text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_inspections pcpndt_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_inspections
    ADD CONSTRAINT pcpndt_inspections_pkey PRIMARY KEY (id);

CREATE INDEX idx_pcpndt_inspections_deleted_at_f3dbe1cf ON public.pcpndt_inspections USING btree (deleted_at);

ALTER TABLE public.pcpndt_inspections ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_inspections pcpndt_inspections_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pcpndt_inspections_tenant_isolation ON public.pcpndt_inspections USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: pcpndt_inspections trg_pcpndt_inspections_soft_delete_f3dbe1cf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_inspections_soft_delete_f3dbe1cf BEFORE DELETE ON public.pcpndt_inspections FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_procedure_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    procedure_type text DEFAULT ''::text NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    male_fetus integer DEFAULT 0 NOT NULL,
    female_fetus integer DEFAULT 0 NOT NULL,
    indeterminate integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_procedure_summary pcpndt_procedure_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_procedure_summary
    ADD CONSTRAINT pcpndt_procedure_summary_pkey PRIMARY KEY (id);

CREATE INDEX idx_pcpndt_procedure_summary_deleted_at_75346aa2 ON public.pcpndt_procedure_summary USING btree (deleted_at);

ALTER TABLE public.pcpndt_procedure_summary ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_procedure_summary pcpndt_procedure_summary_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pcpndt_procedure_summary_tenant_isolation ON public.pcpndt_procedure_summary USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: pcpndt_procedure_summary trg_pcpndt_procedure_summary_soft_delete_75346aa2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_procedure_summary_soft_delete_75346aa2 BEFORE DELETE ON public.pcpndt_procedure_summary FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_qualified_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    qualification text DEFAULT ''::text NOT NULL,
    registration_number text DEFAULT ''::text NOT NULL,
    role text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_qualified_personnel pcpndt_qualified_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_qualified_personnel
    ADD CONSTRAINT pcpndt_qualified_personnel_pkey PRIMARY KEY (id);

CREATE INDEX idx_pcpndt_qualified_personnel_deleted_at_5c72bd75 ON public.pcpndt_qualified_personnel USING btree (deleted_at);

ALTER TABLE public.pcpndt_qualified_personnel ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_qualified_personnel pcpndt_qualified_personnel_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pcpndt_qualified_personnel_tenant_isolation ON public.pcpndt_qualified_personnel USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: pcpndt_qualified_personnel trg_pcpndt_qualified_personnel_soft_delete_5c72bd75; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_qualified_personnel_soft_delete_5c72bd75 BEFORE DELETE ON public.pcpndt_qualified_personnel FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.peso_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    inspection_date date DEFAULT CURRENT_DATE NOT NULL,
    inspector text DEFAULT ''::text NOT NULL,
    findings text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: peso_inspections peso_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peso_inspections
    ADD CONSTRAINT peso_inspections_pkey PRIMARY KEY (id);

CREATE INDEX idx_peso_inspections_deleted_at_b449fab3 ON public.peso_inspections USING btree (deleted_at);

ALTER TABLE public.peso_inspections ENABLE ROW LEVEL SECURITY;

-- Name: peso_inspections peso_inspections_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY peso_inspections_tenant_isolation ON public.peso_inspections USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: peso_inspections trg_peso_inspections_soft_delete_b449fab3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_peso_inspections_soft_delete_b449fab3 BEFORE DELETE ON public.peso_inspections FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.prescription_medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    encounter_id uuid,
    drug_catalog_id uuid,
    drug_name text DEFAULT ''::text NOT NULL,
    dose text DEFAULT ''::text NOT NULL,
    route text DEFAULT ''::text NOT NULL,
    frequency text DEFAULT ''::text NOT NULL,
    duration text DEFAULT ''::text NOT NULL,
    quantity integer,
    instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: prescription_medications prescription_medications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_medications
    ADD CONSTRAINT prescription_medications_pkey PRIMARY KEY (id);

CREATE INDEX idx_prescription_medications_deleted_at_53b1f36f ON public.prescription_medications USING btree (deleted_at);

ALTER TABLE public.prescription_medications ENABLE ROW LEVEL SECURITY;

-- Name: prescription_medications prescription_medications_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescription_medications_tenant_isolation ON public.prescription_medications USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: prescription_medications trg_prescription_medications_soft_delete_53b1f36f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prescription_medications_soft_delete_53b1f36f BEFORE DELETE ON public.prescription_medications FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.print_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_output_id uuid NOT NULL,
    printer_id uuid,
    status public.print_job_status DEFAULT 'queued'::public.print_job_status NOT NULL,
    copies integer DEFAULT 1 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    department_id uuid,
    submitted_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_pkey PRIMARY KEY (id);

CREATE INDEX idx_print_jobs_deleted_at_7f683888 ON public.print_jobs USING btree (deleted_at);

CREATE INDEX idx_print_jobs_department_id ON public.print_jobs USING btree (department_id);

CREATE INDEX idx_print_jobs_printer ON public.print_jobs USING btree (printer_id, status);

CREATE INDEX idx_print_jobs_status ON public.print_jobs USING btree (tenant_id, status);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Name: print_jobs print_jobs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_tenant ON public.print_jobs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: print_jobs trg_print_jobs_soft_delete_7f683888; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_soft_delete_7f683888 BEFORE DELETE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: print_jobs trg_print_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_updated_at BEFORE UPDATE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.printer_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    printer_type text DEFAULT 'laser'::text NOT NULL,
    connection_type text DEFAULT 'network'::text,
    connection_string text,
    department_id uuid,
    default_format public.print_format DEFAULT 'a4_portrait'::public.print_format NOT NULL,
    capabilities jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: printer_configs printer_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printer_configs
    ADD CONSTRAINT printer_configs_pkey PRIMARY KEY (id);

CREATE INDEX idx_printer_configs_deleted_at_9b9b7396 ON public.printer_configs USING btree (deleted_at);

CREATE INDEX idx_printer_configs_department_id ON public.printer_configs USING btree (department_id);

CREATE INDEX idx_printer_configs_tenant_id ON public.printer_configs USING btree (tenant_id);

ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

-- Name: printer_configs printer_configs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY printer_configs_tenant ON public.printer_configs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: printer_configs trg_printer_configs_soft_delete_9b9b7396; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_printer_configs_soft_delete_9b9b7396 BEFORE DELETE ON public.printer_configs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: printer_configs trg_printer_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_printer_configs_updated_at BEFORE UPDATE ON public.printer_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.rca_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    incident_id uuid,
    action_description text DEFAULT ''::text NOT NULL,
    responsible_person_id uuid,
    target_date date,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rca_actions rca_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_actions
    ADD CONSTRAINT rca_actions_pkey PRIMARY KEY (id);

CREATE INDEX idx_rca_actions_deleted_at_19a8ef25 ON public.rca_actions USING btree (deleted_at);

ALTER TABLE public.rca_actions ENABLE ROW LEVEL SECURITY;

-- Name: rca_actions rca_actions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rca_actions_tenant_isolation ON public.rca_actions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: rca_actions trg_rca_actions_soft_delete_19a8ef25; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_actions_soft_delete_19a8ef25 BEFORE DELETE ON public.rca_actions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rca_data_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    incident_id uuid,
    source_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rca_data_sources rca_data_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_data_sources
    ADD CONSTRAINT rca_data_sources_pkey PRIMARY KEY (id);

CREATE INDEX idx_rca_data_sources_deleted_at_04468265 ON public.rca_data_sources USING btree (deleted_at);

ALTER TABLE public.rca_data_sources ENABLE ROW LEVEL SECURITY;

-- Name: rca_data_sources rca_data_sources_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rca_data_sources_tenant_isolation ON public.rca_data_sources USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: rca_data_sources trg_rca_data_sources_soft_delete_04468265; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_data_sources_soft_delete_04468265 BEFORE DELETE ON public.rca_data_sources FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rca_root_causes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    incident_id uuid,
    category text,
    cause text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rca_root_causes rca_root_causes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_root_causes
    ADD CONSTRAINT rca_root_causes_pkey PRIMARY KEY (id);

CREATE INDEX idx_rca_root_causes_deleted_at_fdcdc71a ON public.rca_root_causes USING btree (deleted_at);

ALTER TABLE public.rca_root_causes ENABLE ROW LEVEL SECURITY;

-- Name: rca_root_causes rca_root_causes_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rca_root_causes_tenant_isolation ON public.rca_root_causes USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: rca_root_causes trg_rca_root_causes_soft_delete_fdcdc71a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_root_causes_soft_delete_fdcdc71a BEFORE DELETE ON public.rca_root_causes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rca_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    incident_id uuid,
    user_id uuid,
    department_id uuid,
    role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rca_team_members rca_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rca_team_members
    ADD CONSTRAINT rca_team_members_pkey PRIMARY KEY (id);

CREATE INDEX idx_rca_team_members_deleted_at_1efcca09 ON public.rca_team_members USING btree (deleted_at);

ALTER TABLE public.rca_team_members ENABLE ROW LEVEL SECURITY;

-- Name: rca_team_members rca_team_members_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rca_team_members_tenant_isolation ON public.rca_team_members USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: rca_team_members trg_rca_team_members_soft_delete_1efcca09; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rca_team_members_soft_delete_1efcca09 BEFORE DELETE ON public.rca_team_members FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.stat_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    admission_id uuid,
    order_type text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    ordered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stat_orders stat_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stat_orders
    ADD CONSTRAINT stat_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_stat_orders_deleted_at_96f4c9ec ON public.stat_orders USING btree (deleted_at);

ALTER TABLE public.stat_orders ENABLE ROW LEVEL SECURITY;

-- Name: stat_orders stat_orders_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stat_orders_tenant_isolation ON public.stat_orders USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: stat_orders trg_stat_orders_soft_delete_96f4c9ec; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stat_orders_soft_delete_96f4c9ec BEFORE DELETE ON public.stat_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.stock_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    transfer_id uuid,
    item_id uuid,
    batch_number text,
    expiry_date date,
    quantity double precision DEFAULT 0 NOT NULL,
    unit_price double precision DEFAULT 0 NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    line_number integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stock_transfer_items stock_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_stock_transfer_items_deleted_at_7b6576dc ON public.stock_transfer_items USING btree (deleted_at);

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Name: stock_transfer_items stock_transfer_items_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_transfer_items_tenant_isolation ON public.stock_transfer_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: stock_transfer_items trg_stock_transfer_items_soft_delete_7b6576dc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_transfer_items_soft_delete_7b6576dc BEFORE DELETE ON public.stock_transfer_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tpa_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tpa_companies tpa_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpa_companies
    ADD CONSTRAINT tpa_companies_pkey PRIMARY KEY (id);

CREATE INDEX idx_tpa_companies_deleted_at_61a063d1 ON public.tpa_companies USING btree (deleted_at);

ALTER TABLE public.tpa_companies ENABLE ROW LEVEL SECURITY;

-- Name: tpa_companies tpa_companies_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tpa_companies_tenant_isolation ON public.tpa_companies USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: tpa_companies trg_tpa_companies_soft_delete_61a063d1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tpa_companies_soft_delete_61a063d1 BEFORE DELETE ON public.tpa_companies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.trainings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    training_type text,
    training_date date DEFAULT CURRENT_DATE NOT NULL,
    duration_hours double precision,
    trainer_name text,
    trainer_organization text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: trainings trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_pkey PRIMARY KEY (id);

CREATE INDEX idx_trainings_deleted_at_b16be5b0 ON public.trainings USING btree (deleted_at);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

-- Name: trainings trainings_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trainings_tenant_isolation ON public.trainings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: trainings trg_trainings_soft_delete_b16be5b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trainings_soft_delete_b16be5b0 BEFORE DELETE ON public.trainings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: asset_categories asset_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.asset_categories(id);

-- Name: print_jobs print_jobs_printer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_printer_id_fkey FOREIGN KEY (printer_id) REFERENCES public.printer_configs(id);
