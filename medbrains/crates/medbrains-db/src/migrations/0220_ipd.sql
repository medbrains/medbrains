-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 53
-- Drops: none
-- ipd — schema.
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: admission_attenders admission_attenders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_attenders
    ADD CONSTRAINT admission_attenders_pkey PRIMARY KEY (id);

CREATE INDEX idx_admission_attenders_admission ON public.admission_attenders USING btree (admission_id);

CREATE INDEX idx_admission_attenders_deleted_at_979c39db ON public.admission_attenders USING btree (deleted_at);

CREATE INDEX idx_admission_attenders_tenant_id ON public.admission_attenders USING btree (tenant_id);

ALTER TABLE public.admission_attenders ENABLE ROW LEVEL SECURITY;

-- Name: admission_attenders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.admission_attenders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: admission_attenders trg_admission_attenders_soft_delete_979c39db; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admission_attenders_soft_delete_979c39db BEFORE DELETE ON public.admission_attenders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: admission_checklists admission_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_pkey PRIMARY KEY (id);

CREATE INDEX idx_admission_checklists_admission ON public.admission_checklists USING btree (admission_id);

CREATE INDEX idx_admission_checklists_deleted_at_243e25b3 ON public.admission_checklists USING btree (deleted_at);

CREATE INDEX idx_admission_checklists_tenant_id ON public.admission_checklists USING btree (tenant_id);

ALTER TABLE public.admission_checklists ENABLE ROW LEVEL SECURITY;

-- Name: admission_checklists tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.admission_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: admission_checklists set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.admission_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: admission_checklists trg_admission_checklists_soft_delete_243e25b3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admission_checklists_soft_delete_243e25b3 BEFORE DELETE ON public.admission_checklists FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    primary_nurse_id uuid,
    attending_doctor_id uuid,
    department_id uuid,
    primary_diagnosis text,
    final_diagnosis text,
    er_visit_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    is_dummy boolean DEFAULT false NOT NULL
);

-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (id);

CREATE INDEX idx_admissions_bed ON public.admissions USING btree (bed_id);

CREATE INDEX idx_admissions_created_by ON public.admissions USING btree (created_by);

CREATE INDEX idx_admissions_deleted_at_36041e3e ON public.admissions USING btree (deleted_at);

CREATE INDEX idx_admissions_encounter_id ON public.admissions USING btree (encounter_id);

CREATE INDEX idx_admissions_er_visit ON public.admissions USING btree (tenant_id, er_visit_id) WHERE (er_visit_id IS NOT NULL);

CREATE INDEX idx_admissions_live ON public.admissions USING btree (tenant_id, patient_id) WHERE (is_dummy = false);

CREATE INDEX idx_admissions_patient ON public.admissions USING btree (patient_id);

CREATE INDEX idx_admissions_primary_nurse ON public.admissions USING btree (tenant_id, primary_nurse_id) WHERE ((status = 'admitted'::public.admission_status) AND (primary_nurse_id IS NOT NULL));

CREATE INDEX idx_admissions_status ON public.admissions USING btree (tenant_id, status);

CREATE INDEX idx_admissions_tenant ON public.admissions USING btree (tenant_id);

CREATE INDEX idx_admissions_ward ON public.admissions USING btree (ward_id);

ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

-- Name: admissions tenant_isolation_admissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_admissions ON public.admissions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: admissions audit_admissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_admissions AFTER INSERT OR DELETE OR UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('ipd');

-- Name: admissions trg_admissions_soft_delete_36041e3e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admissions_soft_delete_36041e3e BEFORE DELETE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: admissions trg_admissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admissions_updated_at BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bed_reservations bed_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_reservations
    ADD CONSTRAINT bed_reservations_pkey PRIMARY KEY (id);

CREATE INDEX idx_bed_reservations_bed ON public.bed_reservations USING btree (bed_id, status);

CREATE INDEX idx_bed_reservations_deleted_at_30ad50f9 ON public.bed_reservations USING btree (deleted_at);

CREATE INDEX idx_bed_reservations_patient ON public.bed_reservations USING btree (patient_id);

CREATE INDEX idx_bed_reservations_tenant_id ON public.bed_reservations USING btree (tenant_id);

ALTER TABLE public.bed_reservations ENABLE ROW LEVEL SECURITY;

-- Name: bed_reservations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bed_reservations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bed_reservations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bed_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: bed_reservations trg_bed_reservations_soft_delete_30ad50f9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_reservations_soft_delete_30ad50f9 BEFORE DELETE ON public.bed_reservations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bed_turnaround_log bed_turnaround_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_bed_turnaround_bed ON public.bed_turnaround_log USING btree (bed_id);

CREATE INDEX idx_bed_turnaround_log_admission_id ON public.bed_turnaround_log USING btree (admission_id);

CREATE INDEX idx_bed_turnaround_log_deleted_at_c25cefb9 ON public.bed_turnaround_log USING btree (deleted_at);

CREATE INDEX idx_bed_turnaround_log_tenant_id ON public.bed_turnaround_log USING btree (tenant_id);

ALTER TABLE public.bed_turnaround_log ENABLE ROW LEVEL SECURITY;

-- Name: bed_turnaround_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bed_turnaround_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bed_turnaround_log trg_bed_turnaround_log_soft_delete_c25cefb9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_turnaround_log_soft_delete_c25cefb9 BEFORE DELETE ON public.bed_turnaround_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bed_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    daily_rate numeric(10,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bed_types bed_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_types
    ADD CONSTRAINT bed_types_pkey PRIMARY KEY (id);

-- Name: bed_types bed_types_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_types
    ADD CONSTRAINT bed_types_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_bed_types_deleted_at_7eb4407e ON public.bed_types USING btree (deleted_at);

CREATE INDEX idx_bed_types_tenant ON public.bed_types USING btree (tenant_id);

ALTER TABLE public.bed_types ENABLE ROW LEVEL SECURITY;

-- Name: bed_types bed_types_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bed_types_tenant_isolation ON public.bed_types USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: bed_types trg_bed_types_soft_delete_7eb4407e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_types_soft_delete_7eb4407e BEFORE DELETE ON public.bed_types FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bed_types trg_bed_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_types_updated_at BEFORE UPDATE ON public.bed_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.beds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bed_number text,
    ward_id uuid,
    is_occupied boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (id);

CREATE INDEX idx_beds_deleted_at_ded15c53 ON public.beds USING btree (deleted_at);

CREATE INDEX idx_beds_ward ON public.beds USING btree (tenant_id, ward_id);

ALTER TABLE ONLY public.beds FORCE ROW LEVEL SECURITY;

ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

-- Name: beds tenant_isolation_beds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_beds ON public.beds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: beds trg_beds_soft_delete_ded15c53; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_beds_soft_delete_ded15c53 BEFORE DELETE ON public.beds FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: discharge_barriers discharge_barriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_barriers
    ADD CONSTRAINT discharge_barriers_pkey PRIMARY KEY (id);

CREATE INDEX idx_discharge_barriers_case ON public.discharge_barriers USING btree (tenant_id, case_assignment_id, is_resolved);

CREATE INDEX idx_discharge_barriers_deleted_at_23f9f558 ON public.discharge_barriers USING btree (deleted_at);

ALTER TABLE public.discharge_barriers ENABLE ROW LEVEL SECURITY;

-- Name: discharge_barriers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discharge_barriers USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: discharge_barriers set_updated_at_discharge_barriers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_discharge_barriers BEFORE UPDATE ON public.discharge_barriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: discharge_barriers trg_discharge_barriers_soft_delete_23f9f558; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_discharge_barriers_soft_delete_23f9f558 BEFORE DELETE ON public.discharge_barriers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.discharge_summary_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: discharge_summary_templates discharge_summary_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summary_templates
    ADD CONSTRAINT discharge_summary_templates_pkey PRIMARY KEY (id);

-- Name: discharge_summary_templates discharge_summary_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summary_templates
    ADD CONSTRAINT discharge_summary_templates_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_discharge_summary_templates_deleted_at_cd6ca64d ON public.discharge_summary_templates USING btree (deleted_at);

ALTER TABLE public.discharge_summary_templates ENABLE ROW LEVEL SECURITY;

-- Name: discharge_summary_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discharge_summary_templates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: discharge_summary_templates set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.discharge_summary_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: discharge_summary_templates trg_discharge_summary_templates_soft_delete_cd6ca64d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_discharge_summary_templates_soft_delete_cd6ca64d BEFORE DELETE ON public.discharge_summary_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: dnr_orders dnr_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dnr_orders
    ADD CONSTRAINT dnr_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_dnr_orders_active ON public.dnr_orders USING btree (tenant_id, status) WHERE (status = 'active'::public.dnr_status);

CREATE INDEX idx_dnr_orders_deleted_at_53b52b95 ON public.dnr_orders USING btree (deleted_at);

CREATE INDEX idx_dnr_orders_patient ON public.dnr_orders USING btree (tenant_id, patient_id);

CREATE INDEX idx_dnr_orders_patient_id ON public.dnr_orders USING btree (patient_id);

CREATE INDEX idx_dnr_orders_tenant ON public.dnr_orders USING btree (tenant_id);

ALTER TABLE public.dnr_orders ENABLE ROW LEVEL SECURITY;

-- Name: dnr_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.dnr_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: dnr_orders trg_dnr_orders_soft_delete_53b52b95; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dnr_orders_soft_delete_53b52b95 BEFORE DELETE ON public.dnr_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: dnr_orders trg_dnr_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dnr_orders_updated_at BEFORE UPDATE ON public.dnr_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    assessed_by_id uuid,
    history_of_falling integer DEFAULT 0 NOT NULL,
    secondary_diagnosis integer DEFAULT 0 NOT NULL,
    ambulatory_aid integer DEFAULT 0 NOT NULL,
    iv_heparin_lock integer DEFAULT 0 NOT NULL,
    iv_therapy integer DEFAULT 0 NOT NULL,
    gait_transferring integer DEFAULT 0 NOT NULL,
    gait integer DEFAULT 0 NOT NULL,
    mental_status integer DEFAULT 0 NOT NULL,
    total_score integer DEFAULT 0 NOT NULL,
    fall_precautions_implemented boolean DEFAULT false NOT NULL,
    bed_alarm_on boolean DEFAULT false NOT NULL,
    side_rails_up boolean DEFAULT false NOT NULL,
    call_bell_within_reach boolean DEFAULT false NOT NULL,
    non_slip_footwear boolean DEFAULT false NOT NULL,
    next_reassessment_date timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT fall_risk_assessments_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT fall_risk_assessments_scale_check CHECK ((scale = ANY (ARRAY['morse'::text, 'hendrich'::text, 'stratify'::text]))),
    CONSTRAINT fall_risk_assessments_score_check CHECK ((score >= 0))
);

-- Name: fall_risk_assessments fall_risk_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fall_risk_assessments
    ADD CONSTRAINT fall_risk_assessments_pkey PRIMARY KEY (id);

CREATE INDEX fall_risk_encounter_idx ON public.fall_risk_assessments USING btree (tenant_id, encounter_id, recorded_at DESC);

CREATE INDEX idx_fall_risk_assessments_deleted_at_f800a0aa ON public.fall_risk_assessments USING btree (deleted_at);

ALTER TABLE ONLY public.fall_risk_assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fall_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Name: fall_risk_assessments tenant_isolation_fall_risk_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fall_risk_assessments ON public.fall_risk_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: fall_risk_assessments trg_fall_risk_assessments_soft_delete_f800a0aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fall_risk_assessments_soft_delete_f800a0aa BEFORE DELETE ON public.fall_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_bundle_checks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    device_id uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_by uuid NOT NULL,
    is_compliant boolean NOT NULL,
    still_needed boolean DEFAULT true NOT NULL,
    checklist jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_bundle_checks icu_bundle_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_bundle_checks_deleted_at_7df69e30 ON public.icu_bundle_checks USING btree (deleted_at);

CREATE INDEX idx_icu_bundle_device ON public.icu_bundle_checks USING btree (device_id);

CREATE INDEX idx_icu_bundle_tenant ON public.icu_bundle_checks USING btree (tenant_id);

ALTER TABLE public.icu_bundle_checks ENABLE ROW LEVEL SECURITY;

-- Name: icu_bundle_checks icu_bundle_checks_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_bundle_checks_tenant ON public.icu_bundle_checks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_bundle_checks trg_icu_bundle_checks_soft_delete_7df69e30; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_bundle_checks_soft_delete_7df69e30 BEFORE DELETE ON public.icu_bundle_checks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    device_type public.device_type NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    inserted_by uuid,
    removed_at timestamp with time zone,
    removed_by uuid,
    site character varying(200),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_devices icu_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_devices_active ON public.icu_devices USING btree (is_active);

CREATE INDEX idx_icu_devices_admission ON public.icu_devices USING btree (admission_id);

CREATE INDEX idx_icu_devices_deleted_at_5e841b80 ON public.icu_devices USING btree (deleted_at);

CREATE INDEX idx_icu_devices_tenant ON public.icu_devices USING btree (tenant_id);

ALTER TABLE public.icu_devices ENABLE ROW LEVEL SECURITY;

-- Name: icu_devices icu_devices_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_devices_tenant ON public.icu_devices USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_devices set_updated_at_icu_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_icu_devices BEFORE UPDATE ON public.icu_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: icu_devices trg_icu_devices_soft_delete_5e841b80; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_devices_soft_delete_5e841b80 BEFORE DELETE ON public.icu_devices FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_flowsheets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    heart_rate integer,
    systolic_bp integer,
    diastolic_bp integer,
    mean_arterial_bp integer,
    respiratory_rate integer,
    spo2 numeric(5,2),
    temperature numeric(5,2),
    cvp numeric(5,2),
    intake_ml integer,
    output_ml integer,
    urine_ml integer,
    drain_ml integer,
    infusions jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_flowsheets icu_flowsheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_flowsheets_admission ON public.icu_flowsheets USING btree (admission_id);

CREATE INDEX idx_icu_flowsheets_deleted_at_146e0c18 ON public.icu_flowsheets USING btree (deleted_at);

CREATE INDEX idx_icu_flowsheets_tenant ON public.icu_flowsheets USING btree (tenant_id);

CREATE INDEX idx_icu_flowsheets_time ON public.icu_flowsheets USING btree (recorded_at);

ALTER TABLE public.icu_flowsheets ENABLE ROW LEVEL SECURITY;

-- Name: icu_flowsheets icu_flowsheets_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_flowsheets_tenant ON public.icu_flowsheets USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_flowsheets trg_icu_flowsheets_soft_delete_146e0c18; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_flowsheets_soft_delete_146e0c18 BEFORE DELETE ON public.icu_flowsheets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_neonatal_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    gestational_age_weeks integer,
    birth_weight_gm integer,
    current_weight_gm integer,
    bilirubin_total numeric(6,2),
    bilirubin_direct numeric(6,2),
    phototherapy_active boolean DEFAULT false NOT NULL,
    phototherapy_hours numeric(6,2),
    breast_milk_type character varying(50),
    breast_milk_volume_ml numeric(6,2),
    hearing_screen_result character varying(50),
    sepsis_screen_result character varying(100),
    mother_patient_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_neonatal_records icu_neonatal_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_neonatal_admission ON public.icu_neonatal_records USING btree (admission_id);

CREATE INDEX idx_icu_neonatal_records_deleted_at_b8bd0d50 ON public.icu_neonatal_records USING btree (deleted_at);

CREATE INDEX idx_icu_neonatal_tenant ON public.icu_neonatal_records USING btree (tenant_id);

ALTER TABLE public.icu_neonatal_records ENABLE ROW LEVEL SECURITY;

-- Name: icu_neonatal_records icu_neonatal_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_neonatal_records_tenant ON public.icu_neonatal_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_neonatal_records trg_icu_neonatal_records_soft_delete_b8bd0d50; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_neonatal_records_soft_delete_b8bd0d50 BEFORE DELETE ON public.icu_neonatal_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_nutrition (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    route public.nutrition_route NOT NULL,
    formula_name character varying(200),
    rate_ml_hr numeric(6,2),
    calories_kcal numeric(8,2),
    protein_gm numeric(6,2),
    volume_ml integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_nutrition icu_nutrition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_nutrition_admission ON public.icu_nutrition USING btree (admission_id);

CREATE INDEX idx_icu_nutrition_deleted_at_8248df2b ON public.icu_nutrition USING btree (deleted_at);

CREATE INDEX idx_icu_nutrition_tenant ON public.icu_nutrition USING btree (tenant_id);

ALTER TABLE public.icu_nutrition ENABLE ROW LEVEL SECURITY;

-- Name: icu_nutrition icu_nutrition_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_nutrition_tenant ON public.icu_nutrition USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_nutrition trg_icu_nutrition_soft_delete_8248df2b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_nutrition_soft_delete_8248df2b BEFORE DELETE ON public.icu_nutrition FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    score_type public.icu_score_type NOT NULL,
    score_value integer NOT NULL,
    score_details jsonb DEFAULT '{}'::jsonb,
    predicted_mortality numeric(5,2),
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    scored_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_scores icu_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_scores_admission ON public.icu_scores USING btree (admission_id);

CREATE INDEX idx_icu_scores_deleted_at_658e47b1 ON public.icu_scores USING btree (deleted_at);

CREATE INDEX idx_icu_scores_tenant ON public.icu_scores USING btree (tenant_id);

CREATE INDEX idx_icu_scores_type ON public.icu_scores USING btree (score_type);

ALTER TABLE public.icu_scores ENABLE ROW LEVEL SECURITY;

-- Name: icu_scores icu_scores_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_scores_tenant ON public.icu_scores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_scores trg_icu_scores_soft_delete_658e47b1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_scores_soft_delete_658e47b1 BEFORE DELETE ON public.icu_scores FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.icu_ventilator_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    mode public.ventilator_mode NOT NULL,
    fio2 numeric(5,2),
    peep numeric(5,2),
    tidal_volume integer,
    respiratory_rate integer,
    pip numeric(5,2),
    plateau_pressure numeric(5,2),
    ph numeric(5,3),
    pao2 numeric(6,2),
    paco2 numeric(6,2),
    hco3 numeric(5,2),
    sao2 numeric(5,2),
    lactate numeric(5,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: icu_ventilator_records icu_ventilator_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_icu_ventilator_admission ON public.icu_ventilator_records USING btree (admission_id);

CREATE INDEX idx_icu_ventilator_records_deleted_at_c88c2a87 ON public.icu_ventilator_records USING btree (deleted_at);

CREATE INDEX idx_icu_ventilator_tenant ON public.icu_ventilator_records USING btree (tenant_id);

ALTER TABLE public.icu_ventilator_records ENABLE ROW LEVEL SECURITY;

-- Name: icu_ventilator_records icu_ventilator_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_ventilator_records_tenant ON public.icu_ventilator_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: icu_ventilator_records trg_icu_ventilator_records_soft_delete_c88c2a87; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_icu_ventilator_records_soft_delete_c88c2a87 BEFORE DELETE ON public.icu_ventilator_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT intake_output_entries_category_check CHECK ((category = ANY (ARRAY['oral'::text, 'iv'::text, 'tube'::text, 'blood'::text, 'tpn'::text, 'urine'::text, 'stool'::text, 'emesis'::text, 'drain'::text, 'other'::text]))),
    CONSTRAINT intake_output_entries_direction_check CHECK ((direction = ANY (ARRAY['intake'::text, 'output'::text]))),
    CONSTRAINT intake_output_entries_volume_ml_check CHECK ((volume_ml > 0))
);

-- Name: intake_output_entries intake_output_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intake_output_entries
    ADD CONSTRAINT intake_output_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_intake_output_entries_deleted_at_29231829 ON public.intake_output_entries USING btree (deleted_at);

CREATE INDEX io_entries_encounter_idx ON public.intake_output_entries USING btree (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE ONLY public.intake_output_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.intake_output_entries ENABLE ROW LEVEL SECURITY;

-- Name: intake_output_entries tenant_isolation_intake_output_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_intake_output_entries ON public.intake_output_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: intake_output_entries trg_intake_output_entries_soft_delete_29231829; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_intake_output_entries_soft_delete_29231829 BEFORE DELETE ON public.intake_output_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    auto_billing_enabled boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ip_type_configurations ip_type_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_type_configurations
    ADD CONSTRAINT ip_type_configurations_pkey PRIMARY KEY (id);

-- Name: ip_type_configurations ip_type_configurations_tenant_id_ip_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_type_configurations
    ADD CONSTRAINT ip_type_configurations_tenant_id_ip_type_key UNIQUE (tenant_id, ip_type);

CREATE INDEX idx_ip_type_configurations_deleted_at_9b925af2 ON public.ip_type_configurations USING btree (deleted_at);

ALTER TABLE public.ip_type_configurations ENABLE ROW LEVEL SECURITY;

-- Name: ip_type_configurations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ip_type_configurations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ip_type_configurations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ip_type_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ip_type_configurations trg_ip_type_configurations_soft_delete_9b925af2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ip_type_configurations_soft_delete_9b925af2 BEFORE DELETE ON public.ip_type_configurations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_birth_records ipd_birth_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_birth_records_admission ON public.ipd_birth_records USING btree (admission_id);

CREATE INDEX idx_ipd_birth_records_deleted_at_65247839 ON public.ipd_birth_records USING btree (deleted_at);

CREATE INDEX idx_ipd_birth_records_tenant_id ON public.ipd_birth_records USING btree (tenant_id);

ALTER TABLE public.ipd_birth_records ENABLE ROW LEVEL SECURITY;

-- Name: ipd_birth_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_birth_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_birth_records set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_birth_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_birth_records trg_ipd_birth_records_soft_delete_65247839; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_birth_records_soft_delete_65247839 BEFORE DELETE ON public.ipd_birth_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_care_plans ipd_care_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_care_plans_admission ON public.ipd_care_plans USING btree (admission_id);

CREATE INDEX idx_ipd_care_plans_deleted_at_e1c32e9e ON public.ipd_care_plans USING btree (deleted_at);

CREATE INDEX idx_ipd_care_plans_status ON public.ipd_care_plans USING btree (admission_id, status);

CREATE INDEX idx_ipd_care_plans_tenant ON public.ipd_care_plans USING btree (tenant_id);

ALTER TABLE public.ipd_care_plans ENABLE ROW LEVEL SECURITY;

-- Name: ipd_care_plans tenant_isolation_ipd_care_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_care_plans ON public.ipd_care_plans USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_care_plans trg_ipd_care_plans_soft_delete_e1c32e9e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_care_plans_soft_delete_e1c32e9e BEFORE DELETE ON public.ipd_care_plans FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_care_plans trg_ipd_care_plans_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_care_plans_updated BEFORE UPDATE ON public.ipd_care_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_clinical_assessments ipd_clinical_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_clinical_assessments_admission ON public.ipd_clinical_assessments USING btree (admission_id);

CREATE INDEX idx_ipd_clinical_assessments_deleted_at_ed5fe652 ON public.ipd_clinical_assessments USING btree (deleted_at);

CREATE INDEX idx_ipd_clinical_assessments_tenant ON public.ipd_clinical_assessments USING btree (tenant_id);

CREATE INDEX idx_ipd_clinical_assessments_type ON public.ipd_clinical_assessments USING btree (admission_id, assessment_type);

ALTER TABLE public.ipd_clinical_assessments ENABLE ROW LEVEL SECURITY;

-- Name: ipd_clinical_assessments tenant_isolation_ipd_clinical_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_clinical_assessments ON public.ipd_clinical_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_clinical_assessments trg_ipd_clinical_assessments_soft_delete_ed5fe652; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_clinical_assessments_soft_delete_ed5fe652 BEFORE DELETE ON public.ipd_clinical_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_clinical_assessments trg_ipd_clinical_assessments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_clinical_assessments_updated BEFORE UPDATE ON public.ipd_clinical_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_clinical_documentations ipd_clinical_documentations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_clinical_docs_admission ON public.ipd_clinical_documentations USING btree (admission_id);

CREATE INDEX idx_ipd_clinical_docs_type ON public.ipd_clinical_documentations USING btree (admission_id, doc_type);

CREATE INDEX idx_ipd_clinical_documentations_deleted_at_99e8d319 ON public.ipd_clinical_documentations USING btree (deleted_at);

CREATE INDEX idx_ipd_clinical_documentations_patient_id ON public.ipd_clinical_documentations USING btree (patient_id);

CREATE INDEX idx_ipd_clinical_documentations_tenant_id ON public.ipd_clinical_documentations USING btree (tenant_id);

ALTER TABLE public.ipd_clinical_documentations ENABLE ROW LEVEL SECURITY;

-- Name: ipd_clinical_documentations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_clinical_documentations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_clinical_documentations set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_clinical_documentations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_clinical_documentations trg_ipd_clinical_documentations_soft_delete_99e8d319; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_clinical_documentations_soft_delete_99e8d319 BEFORE DELETE ON public.ipd_clinical_documentations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── DAMA / LAMA records (Discharge / Leave Against Medical Advice) ──

CREATE TABLE public.ipd_dama_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    record_type text NOT NULL,
    declared_at timestamp with time zone DEFAULT now() NOT NULL,
    declared_by uuid,
    patient_signed boolean DEFAULT false,
    patient_signature_url text,
    relative_name text,
    relative_relation text,
    relative_signed boolean DEFAULT false,
    relative_signature_url text,
    witness_name text,
    witness_signed boolean DEFAULT false,
    witness_signature_url text,
    risks_explained text,
    reason_for_leaving text,
    is_mlc_case boolean DEFAULT false,
    mlc_notification_sent_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT ipd_dama_records_record_type_check CHECK ((record_type = ANY (ARRAY['dama'::text, 'lama'::text])))
);

-- Name: ipd_dama_records ipd_dama_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_dama_records
    ADD CONSTRAINT ipd_dama_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_dama_admission ON public.ipd_dama_records USING btree (admission_id);

CREATE INDEX idx_ipd_dama_records_deleted_at_9691a4fd ON public.ipd_dama_records USING btree (deleted_at);

CREATE INDEX idx_ipd_dama_records_tenant_id ON public.ipd_dama_records USING btree (tenant_id);

ALTER TABLE public.ipd_dama_records ENABLE ROW LEVEL SECURITY;

-- Name: ipd_dama_records ipd_dama_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_dama_records_tenant ON public.ipd_dama_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ipd_dama_records trg_ipd_dama_records_soft_delete_9691a4fd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_dama_records_soft_delete_9691a4fd BEFORE DELETE ON public.ipd_dama_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_dama_records trg_ipd_dama_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_dama_updated_at BEFORE UPDATE ON public.ipd_dama_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_death_summaries ipd_death_summaries_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_admission_id_key UNIQUE (admission_id);

-- Name: ipd_death_summaries ipd_death_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_death_summaries_admission ON public.ipd_death_summaries USING btree (admission_id);

CREATE INDEX idx_ipd_death_summaries_deleted_at_e3c5b81b ON public.ipd_death_summaries USING btree (deleted_at);

CREATE INDEX idx_ipd_death_summaries_patient_id ON public.ipd_death_summaries USING btree (patient_id);

CREATE INDEX idx_ipd_death_summaries_tenant_id ON public.ipd_death_summaries USING btree (tenant_id);

ALTER TABLE public.ipd_death_summaries ENABLE ROW LEVEL SECURITY;

-- Name: ipd_death_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_death_summaries USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_death_summaries set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_death_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_death_summaries trg_ipd_death_summaries_soft_delete_e3c5b81b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_death_summaries_soft_delete_e3c5b81b BEFORE DELETE ON public.ipd_death_summaries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_discharge_checklists ipd_discharge_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_pkey PRIMARY KEY (id);

-- Name: ipd_discharge_checklists ipd_discharge_checklists_tenant_id_admission_id_item_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_tenant_id_admission_id_item_code_key UNIQUE (tenant_id, admission_id, item_code);

CREATE INDEX idx_ipd_discharge_checklists_deleted_at_12b32326 ON public.ipd_discharge_checklists USING btree (deleted_at);

CREATE INDEX idx_ipd_discharge_cl_admission ON public.ipd_discharge_checklists USING btree (admission_id);

CREATE INDEX idx_ipd_discharge_cl_tenant ON public.ipd_discharge_checklists USING btree (tenant_id);

ALTER TABLE public.ipd_discharge_checklists ENABLE ROW LEVEL SECURITY;

-- Name: ipd_discharge_checklists tenant_isolation_ipd_discharge_cl; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_discharge_cl ON public.ipd_discharge_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_discharge_checklists trg_ipd_discharge_checklists_soft_delete_12b32326; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_checklists_soft_delete_12b32326 BEFORE DELETE ON public.ipd_discharge_checklists FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_discharge_checklists trg_ipd_discharge_cl_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_cl_updated BEFORE UPDATE ON public.ipd_discharge_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    signed_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_discharge_summaries ipd_discharge_summaries_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_admission_id_key UNIQUE (admission_id);

-- Name: ipd_discharge_summaries ipd_discharge_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_discharge_summaries_admission ON public.ipd_discharge_summaries USING btree (admission_id);

CREATE INDEX idx_ipd_discharge_summaries_deleted_at_809a20aa ON public.ipd_discharge_summaries USING btree (deleted_at);

CREATE INDEX idx_ipd_discharge_summaries_template_id ON public.ipd_discharge_summaries USING btree (template_id);

CREATE INDEX idx_ipd_discharge_summaries_unsigned ON public.ipd_discharge_summaries USING btree (tenant_id, prepared_by) WHERE (is_signed = false);

ALTER TABLE public.ipd_discharge_summaries ENABLE ROW LEVEL SECURITY;

-- Name: ipd_discharge_summaries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_discharge_summaries USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_discharge_summaries set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_discharge_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_discharge_summaries trg_ipd_discharge_summaries_soft_delete_809a20aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_summaries_soft_delete_809a20aa BEFORE DELETE ON public.ipd_discharge_summaries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_admission_id_key UNIQUE (admission_id);

-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_discharge_tat_admission ON public.ipd_discharge_tat_log USING btree (admission_id);

CREATE INDEX idx_ipd_discharge_tat_log_deleted_at_443ef87c ON public.ipd_discharge_tat_log USING btree (deleted_at);

CREATE INDEX idx_ipd_discharge_tat_log_tenant_id ON public.ipd_discharge_tat_log USING btree (tenant_id);

ALTER TABLE public.ipd_discharge_tat_log ENABLE ROW LEVEL SECURITY;

-- Name: ipd_discharge_tat_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_discharge_tat_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_discharge_tat_log set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ipd_discharge_tat_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_discharge_tat_log trg_ipd_discharge_tat_log_soft_delete_443ef87c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_tat_log_soft_delete_443ef87c BEFORE DELETE ON public.ipd_discharge_tat_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

--  0107_ipd_discharge_tat_logs.sql — discharge TAT tracking
-- The `care_view.rs` route LEFT JOINs `ipd_discharge_tat_logs` to
-- show discharge-process timing per admission. The table was
-- referenced in code but never created — runtime threw
-- `relation "ipd_discharge_tat_logs" does not exist`.
-- Captures NABH indicator 65 (Average Discharge Time) data:
--   discharge_ordered_at → discharge_initiated_at → patient_released_at
-- One row per admission, written when discharge begins.

CREATE TABLE public.ipd_discharge_tat_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    discharge_ordered_at timestamp with time zone,
    discharge_initiated_at timestamp with time zone,
    bill_finalized_at timestamp with time zone,
    pharmacy_cleared_at timestamp with time zone,
    discharge_summary_signed_at timestamp with time zone,
    patient_released_at timestamp with time zone,
    total_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_discharge_tat_logs ipd_discharge_tat_logs_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_logs
    ADD CONSTRAINT ipd_discharge_tat_logs_admission_id_key UNIQUE (admission_id);

-- Name: ipd_discharge_tat_logs ipd_discharge_tat_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_logs
    ADD CONSTRAINT ipd_discharge_tat_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_discharge_tat_initiated ON public.ipd_discharge_tat_logs USING btree (discharge_initiated_at) WHERE (discharge_initiated_at IS NOT NULL);

CREATE INDEX idx_ipd_discharge_tat_logs_deleted_at_859b1a43 ON public.ipd_discharge_tat_logs USING btree (deleted_at);

CREATE INDEX idx_ipd_discharge_tat_logs_tenant_id ON public.ipd_discharge_tat_logs USING btree (tenant_id);

ALTER TABLE public.ipd_discharge_tat_logs ENABLE ROW LEVEL SECURITY;

-- Name: ipd_discharge_tat_logs ipd_discharge_tat_logs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_discharge_tat_logs_tenant ON public.ipd_discharge_tat_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ipd_discharge_tat_logs trg_ipd_discharge_tat_logs_soft_delete_859b1a43; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_tat_logs_soft_delete_859b1a43 BEFORE DELETE ON public.ipd_discharge_tat_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_discharge_tat_logs trg_ipd_discharge_tat_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_tat_updated_at BEFORE UPDATE ON public.ipd_discharge_tat_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Discharge workflow checklist ────────────────────────────────

CREATE TABLE public.ipd_discharge_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    discharge_ordered_at timestamp with time zone,
    bill_closed_at timestamp with time zone,
    bill_closed_by uuid,
    rx_dispensed_at timestamp with time zone,
    rx_dispensed_by uuid,
    counseling_done_at timestamp with time zone,
    counseling_done_by uuid,
    counseling_topics text[],
    card_printed_at timestamp with time zone,
    card_printed_by uuid,
    bed_released_at timestamp with time zone,
    bed_released_by uuid,
    transport_arranged boolean DEFAULT false,
    transport_notes text,
    follow_up_appt_id uuid,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_discharge_workflows ipd_discharge_workflows_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_workflows
    ADD CONSTRAINT ipd_discharge_workflows_admission_id_key UNIQUE (admission_id);

-- Name: ipd_discharge_workflows ipd_discharge_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_workflows
    ADD CONSTRAINT ipd_discharge_workflows_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_discharge_workflows_admission ON public.ipd_discharge_workflows USING btree (admission_id);

CREATE INDEX idx_ipd_discharge_workflows_deleted_at_7886d804 ON public.ipd_discharge_workflows USING btree (deleted_at);

CREATE INDEX idx_ipd_discharge_workflows_open ON public.ipd_discharge_workflows USING btree (tenant_id, discharge_ordered_at) WHERE (completed_at IS NULL);

ALTER TABLE public.ipd_discharge_workflows ENABLE ROW LEVEL SECURITY;

-- Name: ipd_discharge_workflows ipd_discharge_workflows_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_discharge_workflows_tenant ON public.ipd_discharge_workflows USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ipd_discharge_workflows trg_ipd_discharge_workflows_soft_delete_7886d804; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_workflows_soft_delete_7886d804 BEFORE DELETE ON public.ipd_discharge_workflows FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_discharge_workflows trg_ipd_discharge_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_discharge_workflows_updated_at BEFORE UPDATE ON public.ipd_discharge_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_handover_reports ipd_handover_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_handover_admission ON public.ipd_handover_reports USING btree (admission_id);

CREATE INDEX idx_ipd_handover_date ON public.ipd_handover_reports USING btree (admission_id, handover_date DESC);

CREATE INDEX idx_ipd_handover_reports_deleted_at_eed4d390 ON public.ipd_handover_reports USING btree (deleted_at);

CREATE INDEX idx_ipd_handover_tenant ON public.ipd_handover_reports USING btree (tenant_id);

ALTER TABLE public.ipd_handover_reports ENABLE ROW LEVEL SECURITY;

-- Name: ipd_handover_reports tenant_isolation_ipd_handover; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_handover ON public.ipd_handover_reports USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_handover_reports trg_ipd_handover_reports_soft_delete_eed4d390; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_handover_reports_soft_delete_eed4d390 BEFORE DELETE ON public.ipd_handover_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_handover_reports trg_ipd_handover_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_handover_updated BEFORE UPDATE ON public.ipd_handover_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_intake_output ipd_intake_output_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_intake_output_deleted_at_8865003e ON public.ipd_intake_output USING btree (deleted_at);

CREATE INDEX idx_ipd_io_admission ON public.ipd_intake_output USING btree (admission_id);

CREATE INDEX idx_ipd_io_recorded ON public.ipd_intake_output USING btree (admission_id, recorded_at);

CREATE INDEX idx_ipd_io_shift ON public.ipd_intake_output USING btree (admission_id, shift);

CREATE INDEX idx_ipd_io_tenant ON public.ipd_intake_output USING btree (tenant_id);

ALTER TABLE public.ipd_intake_output ENABLE ROW LEVEL SECURITY;

-- Name: ipd_intake_output tenant_isolation_ipd_io; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_io ON public.ipd_intake_output USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_intake_output trg_ipd_intake_output_soft_delete_8865003e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_intake_output_soft_delete_8865003e BEFORE DELETE ON public.ipd_intake_output FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    double_checked_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    batch_stock_id uuid,
    batch_number text,
    batch_expiry date
);

-- Name: ipd_medication_administration ipd_medication_administration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_mar_admission ON public.ipd_medication_administration USING btree (admission_id);

CREATE INDEX idx_ipd_mar_scheduled ON public.ipd_medication_administration USING btree (admission_id, scheduled_at);

CREATE INDEX idx_ipd_mar_status ON public.ipd_medication_administration USING btree (admission_id, status);

CREATE INDEX idx_ipd_mar_tenant ON public.ipd_medication_administration USING btree (tenant_id);

CREATE INDEX idx_ipd_medication_administration_deleted_at_1c73d13d ON public.ipd_medication_administration USING btree (deleted_at);

CREATE INDEX idx_mar_pending ON public.ipd_medication_administration USING btree (tenant_id, admission_id, scheduled_at) WHERE (status = 'scheduled'::public.mar_status);

ALTER TABLE public.ipd_medication_administration ENABLE ROW LEVEL SECURITY;

-- Name: ipd_medication_administration tenant_isolation_ipd_mar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_mar ON public.ipd_medication_administration USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_medication_administration trg_ipd_mar_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_mar_updated BEFORE UPDATE ON public.ipd_medication_administration FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_medication_administration trg_ipd_medication_administration_soft_delete_1c73d13d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_medication_administration_soft_delete_1c73d13d BEFORE DELETE ON public.ipd_medication_administration FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Mortality / M&M review queue ────────────────────────────────

CREATE TABLE public.ipd_mortality_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    death_at timestamp with time zone NOT NULL,
    cause_of_death text,
    primary_dx text,
    is_mlc_case boolean DEFAULT false,
    autopsy_required boolean DEFAULT false,
    autopsy_done_at timestamp with time zone,
    review_due_at timestamp with time zone NOT NULL,
    reviewed_at timestamp with time zone,
    reviewer_id uuid,
    review_findings text,
    avoidable boolean,
    contributory_factors text[],
    action_items text,
    death_summary_signed_at timestamp with time zone,
    civil_form_filed_at timestamp with time zone,
    body_released_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_mortality_reviews ipd_mortality_reviews_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_mortality_reviews
    ADD CONSTRAINT ipd_mortality_reviews_admission_id_key UNIQUE (admission_id);

-- Name: ipd_mortality_reviews ipd_mortality_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_mortality_reviews
    ADD CONSTRAINT ipd_mortality_reviews_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_mortality_admission ON public.ipd_mortality_reviews USING btree (admission_id);

CREATE INDEX idx_ipd_mortality_review_due ON public.ipd_mortality_reviews USING btree (review_due_at) WHERE (reviewed_at IS NULL);

CREATE INDEX idx_ipd_mortality_reviews_deleted_at_9b6ff5e9 ON public.ipd_mortality_reviews USING btree (deleted_at);

CREATE INDEX idx_ipd_mortality_reviews_tenant_id ON public.ipd_mortality_reviews USING btree (tenant_id);

ALTER TABLE public.ipd_mortality_reviews ENABLE ROW LEVEL SECURITY;

-- Name: ipd_mortality_reviews ipd_mortality_reviews_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_mortality_reviews_tenant ON public.ipd_mortality_reviews USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ipd_mortality_reviews trg_ipd_mortality_reviews_soft_delete_9b6ff5e9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_mortality_reviews_soft_delete_9b6ff5e9 BEFORE DELETE ON public.ipd_mortality_reviews FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_mortality_reviews trg_ipd_mortality_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_mortality_updated_at BEFORE UPDATE ON public.ipd_mortality_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- Migration: 0208_ipd_no_dues_certificate.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ipd_no_dues_certificates
-- Drops: none
-- ====================================================================
-- A No-Dues (financial clearance) certificate is the gate a real
-- hospital uses before a patient physically leaves the ward: billing
-- has reconciled every charge for the admission and the balance is
-- settled (or formally credited). It is issued once per admission,
-- records who cleared it and the billed/paid snapshot, and is printed
-- and handed to the patient/attender. Issuing is blocked while a
-- balance remains (mirrors billing.block_discharge_unsettled).

CREATE TABLE public.ipd_no_dues_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    total_billed numeric(12,2) DEFAULT 0 NOT NULL,
    total_paid numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    issued_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ipd_no_dues_certificates ipd_no_dues_certificates_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_no_dues_certificates
    ADD CONSTRAINT ipd_no_dues_certificates_admission_id_key UNIQUE (admission_id);

-- Name: ipd_no_dues_certificates ipd_no_dues_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_no_dues_certificates
    ADD CONSTRAINT ipd_no_dues_certificates_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_no_dues_certificates_admission ON public.ipd_no_dues_certificates USING btree (admission_id);

ALTER TABLE public.ipd_no_dues_certificates ENABLE ROW LEVEL SECURITY;

-- Name: ipd_no_dues_certificates ipd_no_dues_certificates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_no_dues_certificates_tenant ON public.ipd_no_dues_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_nursing_assessments ipd_nursing_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_nursing_assess_admission ON public.ipd_nursing_assessments USING btree (admission_id);

CREATE INDEX idx_ipd_nursing_assess_tenant ON public.ipd_nursing_assessments USING btree (tenant_id);

CREATE INDEX idx_ipd_nursing_assessments_deleted_at_945517be ON public.ipd_nursing_assessments USING btree (deleted_at);

ALTER TABLE public.ipd_nursing_assessments ENABLE ROW LEVEL SECURITY;

-- Name: ipd_nursing_assessments tenant_isolation_ipd_nursing_assess; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_nursing_assess ON public.ipd_nursing_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_nursing_assessments trg_ipd_nursing_assess_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_nursing_assess_updated BEFORE UPDATE ON public.ipd_nursing_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ipd_nursing_assessments trg_ipd_nursing_assessments_soft_delete_945517be; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_nursing_assessments_soft_delete_945517be BEFORE DELETE ON public.ipd_nursing_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Post-discharge follow-up tracking ───────────────────────────

CREATE TABLE public.ipd_post_discharge_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    survey_sent_at timestamp with time zone,
    survey_sent_via text,
    survey_responded_at timestamp with time zone,
    survey_score integer,
    survey_comments text,
    followup_appt_id uuid,
    followup_due_date date,
    followup_attended boolean,
    readmitted_within_30d boolean DEFAULT false,
    readmission_admission_id uuid,
    readmission_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_post_discharge_followups ipd_post_discharge_followups_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_post_discharge_followups
    ADD CONSTRAINT ipd_post_discharge_followups_admission_id_key UNIQUE (admission_id);

-- Name: ipd_post_discharge_followups ipd_post_discharge_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_post_discharge_followups
    ADD CONSTRAINT ipd_post_discharge_followups_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_post_discharge_due ON public.ipd_post_discharge_followups USING btree (followup_due_date) WHERE ((followup_due_date IS NOT NULL) AND (followup_attended IS NULL));

CREATE INDEX idx_ipd_post_discharge_followups_deleted_at_b3911652 ON public.ipd_post_discharge_followups USING btree (deleted_at);

CREATE INDEX idx_ipd_post_discharge_followups_tenant_id ON public.ipd_post_discharge_followups USING btree (tenant_id);

CREATE INDEX idx_ipd_post_discharge_patient ON public.ipd_post_discharge_followups USING btree (patient_id);

ALTER TABLE public.ipd_post_discharge_followups ENABLE ROW LEVEL SECURITY;

-- Name: ipd_post_discharge_followups ipd_post_discharge_followups_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ipd_post_discharge_followups_tenant ON public.ipd_post_discharge_followups USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ipd_post_discharge_followups trg_ipd_post_discharge_followups_soft_delete_b3911652; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_post_discharge_followups_soft_delete_b3911652 BEFORE DELETE ON public.ipd_post_discharge_followups FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_post_discharge_followups trg_ipd_post_discharge_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_post_discharge_updated_at BEFORE UPDATE ON public.ipd_post_discharge_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_progress_notes ipd_progress_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_progress_notes_admission ON public.ipd_progress_notes USING btree (admission_id);

CREATE INDEX idx_ipd_progress_notes_date ON public.ipd_progress_notes USING btree (admission_id, note_date DESC);

CREATE INDEX idx_ipd_progress_notes_deleted_at_468a40e5 ON public.ipd_progress_notes USING btree (deleted_at);

CREATE INDEX idx_ipd_progress_notes_encounter_id ON public.ipd_progress_notes USING btree (encounter_id);

CREATE INDEX idx_ipd_progress_notes_tenant ON public.ipd_progress_notes USING btree (tenant_id);

ALTER TABLE public.ipd_progress_notes ENABLE ROW LEVEL SECURITY;

-- Name: ipd_progress_notes tenant_isolation_ipd_progress_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ipd_progress_notes ON public.ipd_progress_notes USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_progress_notes trg_ipd_progress_notes_soft_delete_468a40e5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_progress_notes_soft_delete_468a40e5 BEFORE DELETE ON public.ipd_progress_notes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ipd_progress_notes trg_ipd_progress_notes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_progress_notes_updated BEFORE UPDATE ON public.ipd_progress_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ipd_transfer_logs ipd_transfer_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_ipd_transfer_logs_deleted_at_3230c6ab ON public.ipd_transfer_logs USING btree (deleted_at);

CREATE INDEX idx_ipd_transfer_logs_tenant_id ON public.ipd_transfer_logs USING btree (tenant_id);

CREATE INDEX idx_ipd_transfers_admission ON public.ipd_transfer_logs USING btree (admission_id);

ALTER TABLE public.ipd_transfer_logs ENABLE ROW LEVEL SECURITY;

-- Name: ipd_transfer_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ipd_transfer_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ipd_transfer_logs trg_ipd_transfer_logs_soft_delete_3230c6ab; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ipd_transfer_logs_soft_delete_3230c6ab BEFORE DELETE ON public.ipd_transfer_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0253_mds_assessments.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Long-Term Care: Minimum Data Set (MDS) assessment (ticket #2961). The standardized comprehensive
-- assessment for a long-stay resident — cognition, mood, function (ADLs), continence, nutrition —
-- done at admission and then quarterly / annually / on significant change. Summary domains are
-- columns; the full item set lives in `sections` jsonb. Tenant RLS.

CREATE TABLE public.mds_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    assessment_type text DEFAULT 'admission'::text NOT NULL,
    assessment_date date DEFAULT CURRENT_DATE NOT NULL,
    cognitive_status text,
    mood_score integer,
    adl_dependency_score integer,
    continence_status text,
    nutrition_notes text,
    sections jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    assessed_by uuid,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mds_assessment_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text]))),
    CONSTRAINT mds_assessment_type_check CHECK ((assessment_type = ANY (ARRAY['admission'::text, 'quarterly'::text, 'annual'::text, 'significant_change'::text, 'discharge'::text])))
);

-- Name: mds_assessments mds_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mds_assessments
    ADD CONSTRAINT mds_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_mds_assessments_patient ON public.mds_assessments USING btree (tenant_id, patient_id, assessment_date DESC);

ALTER TABLE public.mds_assessments ENABLE ROW LEVEL SECURITY;

-- Name: mds_assessments mds_assessments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mds_assessments_tenant_isolation ON public.mds_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: mds_assessments mds_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mds_assessments_updated_at BEFORE UPDATE ON public.mds_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    mother_id uuid,
    baby_id text,
    date_of_birth date,
    time_of_birth time without time zone,
    birth_weight_grams integer,
    delivery_type text,
    mother_admission_id uuid,
    attending_doctor_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    id_band_number text
);

-- Name: newborn_records newborn_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newborn_records
    ADD CONSTRAINT newborn_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_newborn_records_deleted_at_8d10098b ON public.newborn_records USING btree (deleted_at);

CREATE INDEX idx_newborn_records_labor ON public.newborn_records USING btree (labor_id);

CREATE INDEX idx_newborn_records_tenant ON public.newborn_records USING btree (tenant_id);

ALTER TABLE public.newborn_records ENABLE ROW LEVEL SECURITY;

-- Name: newborn_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.newborn_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: newborn_records trg_newborn_records_soft_delete_8d10098b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_newborn_records_soft_delete_8d10098b BEFORE DELETE ON public.newborn_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: newborn_records trg_newborn_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_newborn_records_updated_at BEFORE UPDATE ON public.newborn_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pain_assessments pain_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_assessments
    ADD CONSTRAINT pain_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_pain_assessments_deleted_at_a0470ae4 ON public.pain_assessments USING btree (deleted_at);

CREATE INDEX idx_pain_assessments_patient ON public.pain_assessments USING btree (tenant_id, patient_id);

CREATE INDEX idx_pain_assessments_patient_id ON public.pain_assessments USING btree (patient_id);

CREATE INDEX idx_pain_assessments_tenant ON public.pain_assessments USING btree (tenant_id);

ALTER TABLE public.pain_assessments ENABLE ROW LEVEL SECURITY;

-- Name: pain_assessments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pain_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: pain_assessments trg_pain_assessments_soft_delete_a0470ae4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pain_assessments_soft_delete_a0470ae4 BEFORE DELETE ON public.pain_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: pain_assessments trg_pain_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pain_assessments_updated_at BEFORE UPDATE ON public.pain_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT pain_score_entries_scale_check CHECK ((scale = ANY (ARRAY['numeric'::text, 'wong_baker'::text, 'flacc'::text, 'bps'::text, 'cpot'::text, 'comfort'::text]))),
    CONSTRAINT pain_score_entries_score_check CHECK (((score >= 0) AND (score <= 30)))
);

-- Name: pain_score_entries pain_score_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pain_score_entries
    ADD CONSTRAINT pain_score_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_pain_score_entries_deleted_at_cbfb036d ON public.pain_score_entries USING btree (deleted_at);

CREATE INDEX pain_score_encounter_idx ON public.pain_score_entries USING btree (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE ONLY public.pain_score_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pain_score_entries ENABLE ROW LEVEL SECURITY;

-- Name: pain_score_entries tenant_isolation_pain_score_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pain_score_entries ON public.pain_score_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pain_score_entries trg_pain_score_entries_soft_delete_cbfb036d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pain_score_entries_soft_delete_cbfb036d BEFORE DELETE ON public.pain_score_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_end_datetime timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: restraint_documentation restraint_documentation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_documentation
    ADD CONSTRAINT restraint_documentation_pkey PRIMARY KEY (id);

CREATE INDEX idx_restraint_doc_patient ON public.restraint_documentation USING btree (tenant_id, patient_id, start_datetime DESC);

CREATE INDEX idx_restraint_documentation_deleted_at_4c576e40 ON public.restraint_documentation USING btree (deleted_at);

ALTER TABLE ONLY public.restraint_documentation FORCE ROW LEVEL SECURITY;

ALTER TABLE public.restraint_documentation ENABLE ROW LEVEL SECURITY;

-- Name: restraint_documentation tenant_isolation_restraint_documentation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_restraint_documentation ON public.restraint_documentation USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: restraint_documentation trg_restraint_documentation_soft_delete_4c576e40; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_restraint_documentation_soft_delete_4c576e40 BEFORE DELETE ON public.restraint_documentation FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: restraint_monitoring_events restraint_monitoring_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_events
    ADD CONSTRAINT restraint_monitoring_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_restraint_monitoring_events_deleted_at_b77abaf6 ON public.restraint_monitoring_events USING btree (deleted_at);

CREATE INDEX restraint_monitoring_idx ON public.restraint_monitoring_events USING btree (tenant_id, restraint_order_id, monitored_at DESC);

ALTER TABLE ONLY public.restraint_monitoring_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.restraint_monitoring_events ENABLE ROW LEVEL SECURITY;

-- Name: restraint_monitoring_events tenant_isolation_restraint_monitoring_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_restraint_monitoring_events ON public.restraint_monitoring_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: restraint_monitoring_events trg_restraint_monitoring_events_soft_delete_b77abaf6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_restraint_monitoring_events_soft_delete_b77abaf6 BEFORE DELETE ON public.restraint_monitoring_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: restraint_monitoring_logs restraint_monitoring_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_restraint_logs_doc ON public.restraint_monitoring_logs USING btree (clinical_doc_id);

CREATE INDEX idx_restraint_monitoring_logs_admission_id ON public.restraint_monitoring_logs USING btree (admission_id);

CREATE INDEX idx_restraint_monitoring_logs_deleted_at_a355a8d1 ON public.restraint_monitoring_logs USING btree (deleted_at);

CREATE INDEX idx_restraint_monitoring_logs_tenant_id ON public.restraint_monitoring_logs USING btree (tenant_id);

ALTER TABLE public.restraint_monitoring_logs ENABLE ROW LEVEL SECURITY;

-- Name: restraint_monitoring_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.restraint_monitoring_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: restraint_monitoring_logs trg_restraint_monitoring_logs_soft_delete_a355a8d1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_restraint_monitoring_logs_soft_delete_a355a8d1 BEFORE DELETE ON public.restraint_monitoring_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: room_turnarounds room_turnarounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_turnarounds
    ADD CONSTRAINT room_turnarounds_pkey PRIMARY KEY (id);

CREATE INDEX idx_room_turnarounds_deleted_at_33c1101a ON public.room_turnarounds USING btree (deleted_at);

CREATE INDEX idx_room_turnarounds_location_id ON public.room_turnarounds USING btree (location_id);

CREATE INDEX idx_room_turnarounds_patient_id ON public.room_turnarounds USING btree (patient_id);

CREATE INDEX idx_room_turnarounds_tenant ON public.room_turnarounds USING btree (tenant_id);

ALTER TABLE public.room_turnarounds ENABLE ROW LEVEL SECURITY;

-- Name: room_turnarounds tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.room_turnarounds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: room_turnarounds set_room_turnarounds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_room_turnarounds_updated_at BEFORE UPDATE ON public.room_turnarounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: room_turnarounds trg_room_turnarounds_soft_delete_33c1101a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_room_turnarounds_soft_delete_33c1101a BEFORE DELETE ON public.room_turnarounds FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0271_sepsis_hour1_bundle.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Surviving Sepsis Campaign "Hour-1 bundle" tracker. Sepsis is a time-critical emergency: the five
-- bundle elements must be delivered within one hour of sepsis recognition, and every hour of delay in
-- antibiotics raises mortality. NABH tracks Hour-1-bundle compliance (KPI NABH_DEPT_10) but there was
-- no capture behind it — this records each element's completion time and whether it was on-time, so the
-- compliance percentage is real. Recognition-to-element timing is computed server-side.

CREATE TABLE public.sepsis_hour1_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    recognised_at timestamp with time zone NOT NULL,
    fluids_indicated boolean DEFAULT false NOT NULL,
    initial_lactate double precision,
    lactate_measured_at timestamp with time zone,
    blood_cultures_at timestamp with time zone,
    antibiotics_at timestamp with time zone,
    fluids_started_at timestamp with time zone,
    vasopressors_at timestamp with time zone,
    bundle_compliant boolean DEFAULT false NOT NULL,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: sepsis_hour1_bundles sepsis_hour1_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sepsis_hour1_bundles
    ADD CONSTRAINT sepsis_hour1_bundles_pkey PRIMARY KEY (id);

CREATE INDEX idx_sepsis_bundle_patient ON public.sepsis_hour1_bundles USING btree (tenant_id, patient_id, recognised_at DESC);

ALTER TABLE public.sepsis_hour1_bundles ENABLE ROW LEVEL SECURITY;

-- Name: sepsis_hour1_bundles sepsis_hour1_bundles_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepsis_hour1_bundles_tenant_isolation ON public.sepsis_hour1_bundles USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0262_snf_admissions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Skilled Nursing Facility (SNF) admission from discharge (ticket #2960): admits a patient to the
-- SNF — most often on hospital discharge — carrying over the care plan and level of care. Tenant RLS.

CREATE TABLE public.snf_admissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_date date DEFAULT CURRENT_DATE NOT NULL,
    source text DEFAULT 'hospital_discharge'::text NOT NULL,
    level_of_care text DEFAULT 'skilled_nursing'::text NOT NULL,
    primary_diagnosis text,
    care_plan text,
    expected_los_days integer,
    status text DEFAULT 'admitted'::text NOT NULL,
    discharge_date date,
    admitted_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT snf_level_check CHECK ((level_of_care = ANY (ARRAY['skilled_nursing'::text, 'rehab'::text, 'long_term'::text]))),
    CONSTRAINT snf_source_check CHECK ((source = ANY (ARRAY['hospital_discharge'::text, 'direct'::text, 'transfer'::text]))),
    CONSTRAINT snf_status_check CHECK ((status = ANY (ARRAY['admitted'::text, 'discharged'::text, 'transferred'::text])))
);

-- Name: snf_admissions snf_admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snf_admissions
    ADD CONSTRAINT snf_admissions_pkey PRIMARY KEY (id);

CREATE INDEX idx_snf_admissions_patient ON public.snf_admissions USING btree (tenant_id, patient_id, status);

ALTER TABLE public.snf_admissions ENABLE ROW LEVEL SECURITY;

-- Name: snf_admissions snf_admissions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY snf_admissions_tenant_isolation ON public.snf_admissions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: snf_admissions snf_admissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER snf_admissions_updated_at BEFORE UPDATE ON public.snf_admissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ward_bed_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ward_id uuid NOT NULL,
    bed_location_id uuid NOT NULL,
    bed_type_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ward_bed_mappings ward_bed_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_pkey PRIMARY KEY (id);

-- Name: ward_bed_mappings ward_bed_mappings_tenant_id_bed_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_tenant_id_bed_location_id_key UNIQUE (tenant_id, bed_location_id);

CREATE INDEX idx_ward_bed_mappings_deleted_at_f050a029 ON public.ward_bed_mappings USING btree (deleted_at);

CREATE INDEX idx_ward_bed_mappings_ward ON public.ward_bed_mappings USING btree (ward_id);

ALTER TABLE public.ward_bed_mappings ENABLE ROW LEVEL SECURITY;

-- Name: ward_bed_mappings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ward_bed_mappings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ward_bed_mappings trg_ward_bed_mappings_soft_delete_f050a029; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ward_bed_mappings_soft_delete_f050a029 BEFORE DELETE ON public.ward_bed_mappings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: wards wards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_pkey PRIMARY KEY (id);

-- Name: wards wards_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_wards_deleted_at_90fafe3a ON public.wards USING btree (deleted_at);

CREATE INDEX idx_wards_department_id ON public.wards USING btree (department_id);

ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;

-- Name: wards tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.wards USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: wards set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.wards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: wards trg_wards_soft_delete_90fafe3a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wards_soft_delete_90fafe3a BEFORE DELETE ON public.wards FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: wound_assessments wound_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wound_assessments
    ADD CONSTRAINT wound_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_wound_assessments_deleted_at_b97d2e25 ON public.wound_assessments USING btree (deleted_at);

CREATE INDEX wound_assessments_encounter_idx ON public.wound_assessments USING btree (tenant_id, encounter_id, recorded_at DESC);

ALTER TABLE ONLY public.wound_assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wound_assessments ENABLE ROW LEVEL SECURITY;

-- Name: wound_assessments tenant_isolation_wound_assessments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_wound_assessments ON public.wound_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: wound_assessments trg_wound_assessments_soft_delete_b97d2e25; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wound_assessments_soft_delete_b97d2e25 BEFORE DELETE ON public.wound_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: admission_attenders admission_attenders_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_attenders
    ADD CONSTRAINT admission_attenders_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: admission_checklists admission_checklists_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_checklists
    ADD CONSTRAINT admission_checklists_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: admissions admissions_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id);

-- Name: bed_turnaround_log bed_turnaround_log_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_turnaround_log
    ADD CONSTRAINT bed_turnaround_log_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_bundle_checks icu_bundle_checks_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.icu_devices(id);

-- Name: icu_devices icu_devices_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_flowsheets icu_flowsheets_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_neonatal_records icu_neonatal_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_nutrition icu_nutrition_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_scores icu_scores_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: icu_ventilator_records icu_ventilator_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_birth_records ipd_birth_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_birth_records
    ADD CONSTRAINT ipd_birth_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_care_plans ipd_care_plans_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_care_plans
    ADD CONSTRAINT ipd_care_plans_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_clinical_assessments ipd_clinical_assessments_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_assessments
    ADD CONSTRAINT ipd_clinical_assessments_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_clinical_documentations ipd_clinical_documentations_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_clinical_documentations
    ADD CONSTRAINT ipd_clinical_documentations_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_dama_records ipd_dama_records_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_dama_records
    ADD CONSTRAINT ipd_dama_records_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_death_summaries ipd_death_summaries_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_death_summaries
    ADD CONSTRAINT ipd_death_summaries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_discharge_checklists ipd_discharge_checklists_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_checklists
    ADD CONSTRAINT ipd_discharge_checklists_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_discharge_summaries ipd_discharge_summaries_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_discharge_summaries ipd_discharge_summaries_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_summaries
    ADD CONSTRAINT ipd_discharge_summaries_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.discharge_summary_templates(id);

-- Name: ipd_discharge_tat_log ipd_discharge_tat_log_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_log
    ADD CONSTRAINT ipd_discharge_tat_log_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_discharge_tat_logs ipd_discharge_tat_logs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_tat_logs
    ADD CONSTRAINT ipd_discharge_tat_logs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_discharge_workflows ipd_discharge_workflows_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_discharge_workflows
    ADD CONSTRAINT ipd_discharge_workflows_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_handover_reports ipd_handover_reports_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_handover_reports
    ADD CONSTRAINT ipd_handover_reports_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_intake_output ipd_intake_output_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_intake_output
    ADD CONSTRAINT ipd_intake_output_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_medication_administration ipd_medication_administration_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_medication_administration
    ADD CONSTRAINT ipd_medication_administration_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_mortality_reviews ipd_mortality_reviews_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_mortality_reviews
    ADD CONSTRAINT ipd_mortality_reviews_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_no_dues_certificates ipd_no_dues_certificates_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_no_dues_certificates
    ADD CONSTRAINT ipd_no_dues_certificates_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_nursing_assessments ipd_nursing_assessments_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_nursing_assessments
    ADD CONSTRAINT ipd_nursing_assessments_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_post_discharge_followups ipd_post_discharge_followups_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_post_discharge_followups
    ADD CONSTRAINT ipd_post_discharge_followups_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;

-- Name: ipd_post_discharge_followups ipd_post_discharge_followups_readmission_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_post_discharge_followups
    ADD CONSTRAINT ipd_post_discharge_followups_readmission_admission_id_fkey FOREIGN KEY (readmission_admission_id) REFERENCES public.admissions(id);

-- Name: ipd_progress_notes ipd_progress_notes_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_progress_notes ipd_progress_notes_parent_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_progress_notes
    ADD CONSTRAINT ipd_progress_notes_parent_note_id_fkey FOREIGN KEY (parent_note_id) REFERENCES public.ipd_progress_notes(id);

-- Name: ipd_transfer_logs ipd_transfer_logs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: ipd_transfer_logs ipd_transfer_logs_from_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_from_ward_id_fkey FOREIGN KEY (from_ward_id) REFERENCES public.wards(id);

-- Name: ipd_transfer_logs ipd_transfer_logs_to_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ipd_transfer_logs
    ADD CONSTRAINT ipd_transfer_logs_to_ward_id_fkey FOREIGN KEY (to_ward_id) REFERENCES public.wards(id);

-- Name: restraint_monitoring_logs restraint_monitoring_logs_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

-- Name: restraint_monitoring_logs restraint_monitoring_logs_clinical_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restraint_monitoring_logs
    ADD CONSTRAINT restraint_monitoring_logs_clinical_doc_id_fkey FOREIGN KEY (clinical_doc_id) REFERENCES public.ipd_clinical_documentations(id);

-- Name: ward_bed_mappings ward_bed_mappings_bed_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_bed_type_id_fkey FOREIGN KEY (bed_type_id) REFERENCES public.bed_types(id);

-- Name: ward_bed_mappings ward_bed_mappings_ward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_bed_mappings
    ADD CONSTRAINT ward_bed_mappings_ward_id_fkey FOREIGN KEY (ward_id) REFERENCES public.wards(id) ON DELETE CASCADE;
