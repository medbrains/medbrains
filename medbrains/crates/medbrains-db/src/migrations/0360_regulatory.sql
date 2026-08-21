-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 9
-- Drops: none
-- regulatory — schema.
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



CREATE TABLE public.adr_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    report_number text NOT NULL,
    patient_id uuid,
    reporter_id uuid NOT NULL,
    reporter_type text DEFAULT 'doctor'::text NOT NULL,
    drug_name text NOT NULL,
    drug_generic_name text,
    drug_batch_number text,
    manufacturer text,
    reaction_description text NOT NULL,
    onset_date date,
    reaction_date date NOT NULL,
    severity public.adverse_event_severity NOT NULL,
    outcome text,
    causality_assessment text,
    status public.adverse_event_status DEFAULT 'draft'::public.adverse_event_status NOT NULL,
    seriousness_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    dechallenge text,
    rechallenge text,
    concomitant_drugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    relevant_history text,
    submitted_to_pvpi boolean DEFAULT false NOT NULL,
    pvpi_reference text,
    submitted_at timestamp with time zone,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reporter_department_id uuid,
    report_date date,
    report_type text,
    patient_initials text,
    patient_weight_kg numeric,
    patient_height_cm numeric,
    reaction_start_date date,
    reaction_end_date date,
    reaction_outcome text,
    seriousness text,
    allergies text,
    dechallenge_done boolean DEFAULT false NOT NULL,
    dechallenge_result text,
    rechallenge_done boolean DEFAULT false NOT NULL,
    rechallenge_result text,
    who_umc_category text,
    naranjo_score integer,
    reporter_contact text,
    pvpi_id text,
    vigiflow_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: adr_reports adr_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_pkey PRIMARY KEY (id);

-- Name: adr_reports adr_reports_tenant_id_report_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adr_reports
    ADD CONSTRAINT adr_reports_tenant_id_report_number_key UNIQUE (tenant_id, report_number);

CREATE INDEX idx_adr_reports_deleted_at_c9817d85 ON public.adr_reports USING btree (deleted_at);

CREATE INDEX idx_adr_reports_patient ON public.adr_reports USING btree (tenant_id, patient_id);

CREATE INDEX idx_adr_reports_patient_id ON public.adr_reports USING btree (patient_id);

CREATE INDEX idx_adr_reports_severity ON public.adr_reports USING btree (tenant_id, severity);

CREATE INDEX idx_adr_reports_status ON public.adr_reports USING btree (tenant_id, status);

CREATE INDEX idx_adr_reports_tenant ON public.adr_reports USING btree (tenant_id);

ALTER TABLE public.adr_reports ENABLE ROW LEVEL SECURITY;

-- Name: adr_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.adr_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: adr_reports set_updated_at_adr_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_adr_reports BEFORE UPDATE ON public.adr_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: adr_reports trg_adr_reports_soft_delete_c9817d85; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_adr_reports_soft_delete_c9817d85 BEFORE DELETE ON public.adr_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.compliance_calendar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    regulatory_body_id uuid,
    event_type text DEFAULT 'custom'::text NOT NULL,
    due_date date NOT NULL,
    reminder_days integer[] DEFAULT '{30,7,1}'::integer[] NOT NULL,
    department_id uuid,
    assigned_to uuid,
    status text DEFAULT 'upcoming'::text NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    recurrence text DEFAULT 'once'::text NOT NULL,
    source_table text,
    source_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: compliance_calendar compliance_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_calendar
    ADD CONSTRAINT compliance_calendar_pkey PRIMARY KEY (id);

CREATE INDEX idx_compliance_calendar_deleted_at_489d0ee5 ON public.compliance_calendar USING btree (deleted_at);

CREATE INDEX idx_compliance_calendar_department_id ON public.compliance_calendar USING btree (department_id);

CREATE INDEX idx_compliance_calendar_dept ON public.compliance_calendar USING btree (tenant_id, department_id);

CREATE INDEX idx_compliance_calendar_due ON public.compliance_calendar USING btree (tenant_id, due_date);

CREATE INDEX idx_compliance_calendar_status ON public.compliance_calendar USING btree (tenant_id, status);

CREATE INDEX idx_compliance_calendar_tenant ON public.compliance_calendar USING btree (tenant_id);

ALTER TABLE public.compliance_calendar ENABLE ROW LEVEL SECURITY;

-- Name: compliance_calendar tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.compliance_calendar USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: compliance_calendar set_updated_at_compliance_calendar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_compliance_calendar BEFORE UPDATE ON public.compliance_calendar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: compliance_calendar trg_compliance_calendar_soft_delete_489d0ee5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_calendar_soft_delete_489d0ee5 BEFORE DELETE ON public.compliance_calendar FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.compliance_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    item_number integer NOT NULL,
    criterion text NOT NULL,
    status public.compliance_checklist_status DEFAULT 'not_started'::public.compliance_checklist_status NOT NULL,
    evidence_summary text,
    evidence_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    gap_description text,
    corrective_action text,
    target_date date,
    responsible_user_id uuid,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: compliance_checklist_items compliance_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_checklist_items_checklist ON public.compliance_checklist_items USING btree (checklist_id);

CREATE INDEX idx_checklist_items_status ON public.compliance_checklist_items USING btree (tenant_id, status);

CREATE INDEX idx_compliance_checklist_items_deleted_at_1073a633 ON public.compliance_checklist_items USING btree (deleted_at);

ALTER TABLE public.compliance_checklist_items ENABLE ROW LEVEL SECURITY;

-- Name: compliance_checklist_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.compliance_checklist_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: compliance_checklist_items set_updated_at_compliance_checklist_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_compliance_checklist_items BEFORE UPDATE ON public.compliance_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: compliance_checklist_items trg_compliance_checklist_items_soft_delete_1073a633; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_checklist_items_soft_delete_1073a633 BEFORE DELETE ON public.compliance_checklist_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.compliance_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    accreditation_body public.accreditation_body NOT NULL,
    standard_code text NOT NULL,
    name text NOT NULL,
    description text,
    assessment_period_start date NOT NULL,
    assessment_period_end date NOT NULL,
    overall_status public.compliance_checklist_status DEFAULT 'not_started'::public.compliance_checklist_status NOT NULL,
    compliance_score numeric(5,2),
    total_items integer DEFAULT 0 NOT NULL,
    compliant_items integer DEFAULT 0 NOT NULL,
    non_compliant_items integer DEFAULT 0 NOT NULL,
    assessed_by uuid,
    assessed_at timestamp with time zone,
    next_review_date date,
    notes text,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: compliance_checklists compliance_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_pkey PRIMARY KEY (id);

-- Name: compliance_checklists compliance_checklists_tenant_id_department_id_accreditation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklists
    ADD CONSTRAINT compliance_checklists_tenant_id_department_id_accreditation_key UNIQUE (tenant_id, department_id, accreditation_body, standard_code, assessment_period_start);

CREATE INDEX idx_compliance_checklists_body ON public.compliance_checklists USING btree (tenant_id, accreditation_body);

CREATE INDEX idx_compliance_checklists_deleted_at_e62fbe92 ON public.compliance_checklists USING btree (deleted_at);

CREATE INDEX idx_compliance_checklists_department_id ON public.compliance_checklists USING btree (department_id);

CREATE INDEX idx_compliance_checklists_dept ON public.compliance_checklists USING btree (tenant_id, department_id);

CREATE INDEX idx_compliance_checklists_status ON public.compliance_checklists USING btree (tenant_id, overall_status);

CREATE INDEX idx_compliance_checklists_tenant ON public.compliance_checklists USING btree (tenant_id);

ALTER TABLE public.compliance_checklists ENABLE ROW LEVEL SECURITY;

-- Name: compliance_checklists tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.compliance_checklists USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: compliance_checklists set_updated_at_compliance_checklists; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_compliance_checklists BEFORE UPDATE ON public.compliance_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: compliance_checklists trg_compliance_checklists_soft_delete_e62fbe92; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_checklists_soft_delete_e62fbe92 BEFORE DELETE ON public.compliance_checklists FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.compliance_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    framework text NOT NULL,
    requirement_code text NOT NULL,
    requirement_title text NOT NULL,
    requirement_description text,
    category text,
    is_mandatory boolean DEFAULT true NOT NULL,
    compliance_status text,
    evidence_links text[],
    last_assessed_at timestamp with time zone,
    assessed_by uuid,
    next_review_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: compliance_requirements compliance_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_pkey PRIMARY KEY (id);

-- Name: compliance_requirements compliance_requirements_tenant_id_framework_requirement_cod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_requirements
    ADD CONSTRAINT compliance_requirements_tenant_id_framework_requirement_cod_key UNIQUE (tenant_id, framework, requirement_code);

CREATE INDEX idx_compliance_requirements_deleted_at_91a10e1d ON public.compliance_requirements USING btree (deleted_at);

ALTER TABLE ONLY public.compliance_requirements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

-- Name: compliance_requirements tenant_isolation_compliance_requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_compliance_requirements ON public.compliance_requirements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: compliance_requirements trg_compliance_requirements_soft_delete_91a10e1d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_compliance_requirements_soft_delete_91a10e1d BEFORE DELETE ON public.compliance_requirements FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.facility_regulatory_compliance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    regulatory_body_id uuid NOT NULL,
    license_number text,
    valid_from date,
    valid_until date,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: facility_regulatory_compliance facility_regulatory_complianc_tenant_id_facility_id_regulat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_regulatory_compliance
    ADD CONSTRAINT facility_regulatory_complianc_tenant_id_facility_id_regulat_key UNIQUE (tenant_id, facility_id, regulatory_body_id);

-- Name: facility_regulatory_compliance facility_regulatory_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_regulatory_compliance
    ADD CONSTRAINT facility_regulatory_compliance_pkey PRIMARY KEY (id);

CREATE INDEX idx_facility_regulatory_compliance_deleted_at_deb29100 ON public.facility_regulatory_compliance USING btree (deleted_at);

CREATE INDEX idx_frc_facility ON public.facility_regulatory_compliance USING btree (facility_id);

CREATE INDEX idx_frc_tenant ON public.facility_regulatory_compliance USING btree (tenant_id);

ALTER TABLE public.facility_regulatory_compliance ENABLE ROW LEVEL SECURITY;

-- Name: facility_regulatory_compliance tenant_isolation_frc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_frc ON public.facility_regulatory_compliance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: facility_regulatory_compliance trg_facility_regulatory_compliance_soft_delete_deb29100; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_facility_regulatory_compliance_soft_delete_deb29100 BEFORE DELETE ON public.facility_regulatory_compliance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: facility_regulatory_compliance trg_frc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_frc_updated_at BEFORE UPDATE ON public.facility_regulatory_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.materiovigilance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    report_number text NOT NULL,
    patient_id uuid,
    reporter_id uuid NOT NULL,
    device_name text NOT NULL,
    device_manufacturer text,
    device_model text,
    device_batch text,
    event_description text NOT NULL,
    event_date date NOT NULL,
    severity public.adverse_event_severity NOT NULL,
    patient_outcome text,
    device_action text DEFAULT 'none'::text,
    status public.adverse_event_status DEFAULT 'draft'::public.adverse_event_status NOT NULL,
    submitted_to_cdsco boolean DEFAULT false NOT NULL,
    cdsco_reference text,
    submitted_at timestamp with time zone,
    investigation_findings text,
    corrective_action text,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: materiovigilance_reports materiovigilance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_pkey PRIMARY KEY (id);

-- Name: materiovigilance_reports materiovigilance_reports_tenant_id_report_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materiovigilance_reports
    ADD CONSTRAINT materiovigilance_reports_tenant_id_report_number_key UNIQUE (tenant_id, report_number);

CREATE INDEX idx_materiovigilance_reports_deleted_at_9ec2c70f ON public.materiovigilance_reports USING btree (deleted_at);

CREATE INDEX idx_materiovigilance_reports_patient_id ON public.materiovigilance_reports USING btree (patient_id);

CREATE INDEX idx_mv_reports_patient ON public.materiovigilance_reports USING btree (tenant_id, patient_id);

CREATE INDEX idx_mv_reports_status ON public.materiovigilance_reports USING btree (tenant_id, status);

CREATE INDEX idx_mv_reports_tenant ON public.materiovigilance_reports USING btree (tenant_id);

ALTER TABLE public.materiovigilance_reports ENABLE ROW LEVEL SECURITY;

-- Name: materiovigilance_reports tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.materiovigilance_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: materiovigilance_reports set_updated_at_materiovigilance_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_materiovigilance_reports BEFORE UPDATE ON public.materiovigilance_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: materiovigilance_reports trg_materiovigilance_reports_soft_delete_9ec2c70f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_materiovigilance_reports_soft_delete_9ec2c70f BEFORE DELETE ON public.materiovigilance_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_name text NOT NULL,
    registration_number text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_equipment pcpndt_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_equipment
    ADD CONSTRAINT pcpndt_equipment_pkey PRIMARY KEY (id);

CREATE INDEX idx_pcpndt_equipment_deleted_at_26d3faa4 ON public.pcpndt_equipment USING btree (deleted_at);

CREATE INDEX idx_pcpndt_equipment_tenant_id ON public.pcpndt_equipment USING btree (tenant_id);

ALTER TABLE ONLY public.pcpndt_equipment FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pcpndt_equipment ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_equipment tenant_isolation_pcpndt_equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pcpndt_equipment ON public.pcpndt_equipment USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pcpndt_equipment trg_pcpndt_equipment_soft_delete_26d3faa4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_equipment_soft_delete_26d3faa4 BEFORE DELETE ON public.pcpndt_equipment FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pcpndt_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    form_number text NOT NULL,
    patient_id uuid NOT NULL,
    referral_doctor_id uuid,
    performing_doctor_id uuid NOT NULL,
    procedure_type text NOT NULL,
    indication text NOT NULL,
    gestational_age_weeks integer,
    lmp_date date,
    declaration_text text,
    status public.pcpndt_form_status DEFAULT 'draft'::public.pcpndt_form_status NOT NULL,
    form_signed_at timestamp with time zone,
    patient_consent_id uuid,
    registered_with text,
    registration_date date,
    quarterly_report_included boolean DEFAULT false NOT NULL,
    gender_disclosure_blocked boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pcpndt_forms pcpndt_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_pkey PRIMARY KEY (id);

-- Name: pcpndt_forms pcpndt_forms_tenant_id_form_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pcpndt_forms
    ADD CONSTRAINT pcpndt_forms_tenant_id_form_number_key UNIQUE (tenant_id, form_number);

CREATE INDEX idx_pcpndt_forms_deleted_at_cc18ba74 ON public.pcpndt_forms USING btree (deleted_at);

CREATE INDEX idx_pcpndt_forms_patient ON public.pcpndt_forms USING btree (tenant_id, patient_id);

CREATE INDEX idx_pcpndt_forms_patient_id ON public.pcpndt_forms USING btree (patient_id);

CREATE INDEX idx_pcpndt_forms_status ON public.pcpndt_forms USING btree (tenant_id, status);

CREATE INDEX idx_pcpndt_forms_tenant ON public.pcpndt_forms USING btree (tenant_id);

ALTER TABLE public.pcpndt_forms ENABLE ROW LEVEL SECURITY;

-- Name: pcpndt_forms tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pcpndt_forms USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pcpndt_forms set_updated_at_pcpndt_forms; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pcpndt_forms BEFORE UPDATE ON public.pcpndt_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: pcpndt_forms trg_pcpndt_forms_soft_delete_cc18ba74; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pcpndt_forms_soft_delete_cc18ba74 BEFORE DELETE ON public.pcpndt_forms FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: compliance_checklist_items compliance_checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_items
    ADD CONSTRAINT compliance_checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.compliance_checklists(id) ON DELETE CASCADE;
