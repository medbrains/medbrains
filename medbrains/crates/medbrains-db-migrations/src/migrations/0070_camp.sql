-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 26
-- Drops: none
-- camp — schema.
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



CREATE TABLE public.camp_approval_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    approval_type text NOT NULL,
    linked_entity_type text NOT NULL,
    linked_entity_id uuid,
    requested_by uuid,
    approved_by uuid,
    rejected_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    reason text,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    blocks_activation boolean DEFAULT true NOT NULL,
    blocks_closeout boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_approval_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))),
    CONSTRAINT camp_approval_items_type_check CHECK ((approval_type = ANY (ARRAY['free_medicine'::text, 'partial_free_medicine'::text, 'sponsor_billing'::text, 'budget_overrun'::text, 'asset_issue'::text, 'controlled_medicine'::text, 'camp_activation'::text, 'camp_closure'::text])))
);

-- Name: camp_approval_items camp_approval_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_approval_items
    ADD CONSTRAINT camp_approval_items_pkey PRIMARY KEY (id);

-- Name: camp_approval_items camp_approval_items_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_approval_items
    ADD CONSTRAINT camp_approval_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_approval_items_active ON public.camp_approval_items USING btree (tenant_id, camp_id, status, approval_type) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_approval_items ENABLE ROW LEVEL SECURITY;

-- Name: camp_approval_items camp_approval_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_approval_items_tenant ON public.camp_approval_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_approval_items tenant_isolation_camp_approval_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_approval_items ON public.camp_approval_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_approval_items trg_camp_approval_items_soft_delete_5f818ad6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_approval_items_soft_delete_5f818ad6 BEFORE DELETE ON public.camp_approval_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_approval_items trg_camp_approval_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_approval_items_updated_at BEFORE UPDATE ON public.camp_approval_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_billing_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    service_description text NOT NULL,
    standard_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    charged_amount numeric(12,2) DEFAULT 0 NOT NULL,
    is_free boolean DEFAULT true NOT NULL,
    payment_mode text,
    payment_reference text,
    billed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_covered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    source_module text,
    source_entity_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: camp_billing_records camp_billing_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_bill_reg ON public.camp_billing_records USING btree (tenant_id, registration_id);

CREATE INDEX idx_camp_bill_tenant ON public.camp_billing_records USING btree (tenant_id);

CREATE INDEX idx_camp_billing_records_deleted_at_288d66fc ON public.camp_billing_records USING btree (deleted_at);

CREATE INDEX idx_camp_billing_records_soft_delete ON public.camp_billing_records USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_billing_records_source ON public.camp_billing_records USING btree (tenant_id, source_module, source_entity_id) WHERE ((source_module IS NOT NULL) AND (source_entity_id IS NOT NULL));

ALTER TABLE public.camp_billing_records ENABLE ROW LEVEL SECURITY;

-- Name: camp_billing_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_billing_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_billing_records trg_camp_bill_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_bill_updated_at BEFORE UPDATE ON public.camp_billing_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: camp_billing_records trg_camp_billing_records_soft_delete_288d66fc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_billing_records_soft_delete_288d66fc BEFORE DELETE ON public.camp_billing_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.camp_closure_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    task_type text NOT NULL,
    label text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    owner_id uuid,
    due_date date,
    completed_by uuid,
    completed_at timestamp with time zone,
    evidence_attachment_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_closure_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'waived'::text, 'blocked'::text])))
);

-- Name: camp_closure_tasks camp_closure_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_closure_tasks
    ADD CONSTRAINT camp_closure_tasks_pkey PRIMARY KEY (id);

-- Name: camp_closure_tasks camp_closure_tasks_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_closure_tasks
    ADD CONSTRAINT camp_closure_tasks_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_closure_tasks_active ON public.camp_closure_tasks USING btree (tenant_id, camp_id, status, task_type) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_closure_tasks ENABLE ROW LEVEL SECURITY;

-- Name: camp_closure_tasks camp_closure_tasks_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_closure_tasks_tenant ON public.camp_closure_tasks USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_closure_tasks tenant_isolation_camp_closure_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_closure_tasks ON public.camp_closure_tasks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_closure_tasks trg_camp_closure_tasks_soft_delete_d3243b0f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_closure_tasks_soft_delete_d3243b0f BEFORE DELETE ON public.camp_closure_tasks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_closure_tasks trg_camp_closure_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_closure_tasks_updated_at BEFORE UPDATE ON public.camp_closure_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    counter_type text NOT NULL,
    counter_name text NOT NULL,
    owner_id uuid,
    capacity_per_hour integer DEFAULT 0 NOT NULL,
    start_time text,
    end_time text,
    location_label text,
    required_asset_notes text,
    status text DEFAULT 'planned'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_counters_capacity_check CHECK ((capacity_per_hour >= 0)),
    CONSTRAINT camp_counters_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'active'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: camp_counters camp_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_counters
    ADD CONSTRAINT camp_counters_pkey PRIMARY KEY (id);

-- Name: camp_counters camp_counters_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_counters
    ADD CONSTRAINT camp_counters_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_counters_active ON public.camp_counters USING btree (tenant_id, camp_id, counter_type, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_counters ENABLE ROW LEVEL SECURITY;

-- Name: camp_counters camp_counters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_counters_tenant ON public.camp_counters USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_counters tenant_isolation_camp_counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_counters ON public.camp_counters USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_counters trg_camp_counters_soft_delete_be15122a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_counters_soft_delete_be15122a BEFORE DELETE ON public.camp_counters FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_counters trg_camp_counters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_counters_updated_at BEFORE UPDATE ON public.camp_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_department_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    department_id uuid NOT NULL,
    counter_id uuid,
    service_scope text,
    reporting_owner_id uuid,
    opd_routing_enabled boolean DEFAULT true NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_department_counters_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'active'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: camp_department_counters camp_department_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_department_counters
    ADD CONSTRAINT camp_department_counters_pkey PRIMARY KEY (id);

-- Name: camp_department_counters camp_department_counters_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_department_counters
    ADD CONSTRAINT camp_department_counters_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_department_counters_active ON public.camp_department_counters USING btree (tenant_id, camp_id, department_id, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_camp_department_counters_department_id ON public.camp_department_counters USING btree (department_id);

ALTER TABLE public.camp_department_counters ENABLE ROW LEVEL SECURITY;

-- Name: camp_department_counters camp_department_counters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_department_counters_tenant ON public.camp_department_counters USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_department_counters tenant_isolation_camp_department_counters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_department_counters ON public.camp_department_counters USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_department_counters trg_camp_department_counters_soft_delete_967fd9a1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_department_counters_soft_delete_967fd9a1 BEFORE DELETE ON public.camp_department_counters FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_department_counters trg_camp_department_counters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_department_counters_updated_at BEFORE UPDATE ON public.camp_department_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_doctor_roster (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid,
    duty_start timestamp with time zone,
    duty_end timestamp with time zone,
    expected_consults integer DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free'::text NOT NULL,
    patient_fee numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    honorarium_amount numeric(12,2) DEFAULT 0 NOT NULL,
    backup_doctor_id uuid,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_doctor_roster_charge_mode_check CHECK ((charge_mode = ANY (ARRAY['free'::text, 'paid'::text, 'mixed'::text, 'sponsor_covered'::text]))),
    CONSTRAINT camp_doctor_roster_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'confirmed'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);

-- Name: camp_doctor_roster camp_doctor_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_doctor_roster
    ADD CONSTRAINT camp_doctor_roster_pkey PRIMARY KEY (id);

-- Name: camp_doctor_roster camp_doctor_roster_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_doctor_roster
    ADD CONSTRAINT camp_doctor_roster_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_doctor_roster_active ON public.camp_doctor_roster USING btree (tenant_id, camp_id, doctor_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_doctor_roster ENABLE ROW LEVEL SECURITY;

-- Name: camp_doctor_roster camp_doctor_roster_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_doctor_roster_tenant ON public.camp_doctor_roster USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_doctor_roster tenant_isolation_camp_doctor_roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_doctor_roster ON public.camp_doctor_roster USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_doctor_roster trg_camp_doctor_roster_soft_delete_41cc768d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_doctor_roster_soft_delete_41cc768d BEFORE DELETE ON public.camp_doctor_roster FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_doctor_roster trg_camp_doctor_roster_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_doctor_roster_updated_at BEFORE UPDATE ON public.camp_doctor_roster FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    followup_date date NOT NULL,
    followup_type text NOT NULL,
    status public.camp_followup_status DEFAULT 'scheduled'::public.camp_followup_status NOT NULL,
    notes text,
    outcome text,
    converted_to_patient boolean DEFAULT false NOT NULL,
    converted_patient_id uuid,
    converted_department_id uuid,
    followed_up_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: camp_followups camp_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_followups_deleted_at_4a153e4c ON public.camp_followups USING btree (deleted_at);

CREATE INDEX idx_camp_followups_soft_delete ON public.camp_followups USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_fu_date ON public.camp_followups USING btree (tenant_id, followup_date);

CREATE INDEX idx_camp_fu_reg ON public.camp_followups USING btree (tenant_id, registration_id);

CREATE INDEX idx_camp_fu_tenant ON public.camp_followups USING btree (tenant_id);

ALTER TABLE public.camp_followups ENABLE ROW LEVEL SECURITY;

-- Name: camp_followups tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_followups USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_followups trg_camp_followups_soft_delete_4a153e4c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_followups_soft_delete_4a153e4c BEFORE DELETE ON public.camp_followups FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_followups trg_camp_fu_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_fu_updated_at BEFORE UPDATE ON public.camp_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    registration_id uuid,
    incident_type text NOT NULL,
    severity text DEFAULT 'low'::text NOT NULL,
    description text NOT NULL,
    immediate_action text,
    status text DEFAULT 'open'::text NOT NULL,
    reported_by uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_incidents_incident_type_check CHECK ((incident_type = ANY (ARRAY['patient_safety'::text, 'infection_control'::text, 'biomedical_waste'::text, 'facility_safety'::text, 'staff_safety'::text, 'data_privacy'::text, 'equipment'::text, 'network'::text, 'crowd_control'::text, 'other'::text]))),
    CONSTRAINT camp_incidents_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT camp_incidents_status_check CHECK ((status = ANY (ARRAY['open'::text, 'contained'::text, 'closed'::text])))
);

-- Name: camp_incidents camp_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_incidents
    ADD CONSTRAINT camp_incidents_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_incidents_camp ON public.camp_incidents USING btree (tenant_id, camp_id, status, severity);

CREATE INDEX idx_camp_incidents_deleted_at_96149fdf ON public.camp_incidents USING btree (deleted_at);

CREATE INDEX idx_camp_incidents_registration ON public.camp_incidents USING btree (tenant_id, registration_id) WHERE (registration_id IS NOT NULL);

CREATE INDEX idx_camp_incidents_soft_delete ON public.camp_incidents USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_incidents ENABLE ROW LEVEL SECURITY;

-- Name: camp_incidents tenant_isolation_camp_incidents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_incidents ON public.camp_incidents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_incidents audit_camp_incidents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_incidents AFTER INSERT OR DELETE OR UPDATE ON public.camp_incidents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_incidents trg_camp_incidents_soft_delete_96149fdf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_incidents_soft_delete_96149fdf BEFORE DELETE ON public.camp_incidents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_incidents trg_camp_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_incidents_updated_at BEFORE UPDATE ON public.camp_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_lab_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    sample_type text NOT NULL,
    test_requested text,
    barcode text,
    collected_at timestamp with time zone DEFAULT now(),
    collected_by uuid,
    sent_to_lab boolean DEFAULT false NOT NULL,
    lab_order_id uuid,
    result_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: camp_lab_samples camp_lab_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_lab_reg ON public.camp_lab_samples USING btree (tenant_id, registration_id);

CREATE INDEX idx_camp_lab_samples_deleted_at_a13caa2a ON public.camp_lab_samples USING btree (deleted_at);

CREATE INDEX idx_camp_lab_samples_soft_delete ON public.camp_lab_samples USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_lab_tenant ON public.camp_lab_samples USING btree (tenant_id);

ALTER TABLE public.camp_lab_samples ENABLE ROW LEVEL SECURITY;

-- Name: camp_lab_samples tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_lab_samples USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_lab_samples trg_camp_lab_samples_soft_delete_a13caa2a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_lab_samples_soft_delete_a13caa2a BEFORE DELETE ON public.camp_lab_samples FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_lab_samples trg_camp_lab_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_lab_updated_at BEFORE UPDATE ON public.camp_lab_samples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_medicine_pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    catalog_item_id uuid,
    medicine_name text NOT NULL,
    generic_name text,
    batch_stock_id uuid,
    batch_no text,
    expiry_date date,
    store_location_id uuid,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    reserved_qty numeric(12,2) DEFAULT 0 NOT NULL,
    issued_qty numeric(12,2) DEFAULT 0 NOT NULL,
    free_qty numeric(12,2) DEFAULT 0 NOT NULL,
    paid_qty numeric(12,2) DEFAULT 0 NOT NULL,
    consumed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    returned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    damaged_qty numeric(12,2) DEFAULT 0 NOT NULL,
    patient_unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    camp_unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free'::text NOT NULL,
    is_lasa boolean DEFAULT false NOT NULL,
    is_controlled boolean DEFAULT false NOT NULL,
    drug_schedule text,
    approval_required boolean DEFAULT false NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_medicine_pricing_rules_charge_mode_check CHECK ((charge_mode = ANY (ARRAY['free'::text, 'paid'::text, 'mixed'::text, 'sponsor_covered'::text]))),
    CONSTRAINT camp_medicine_pricing_rules_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'approved'::text, 'reserved'::text, 'issued'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: camp_medicine_pricing_rules camp_medicine_pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_medicine_pricing_rules
    ADD CONSTRAINT camp_medicine_pricing_rules_pkey PRIMARY KEY (id);

-- Name: camp_medicine_pricing_rules camp_medicine_pricing_rules_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_medicine_pricing_rules
    ADD CONSTRAINT camp_medicine_pricing_rules_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_medicine_pricing_rules_active ON public.camp_medicine_pricing_rules USING btree (tenant_id, camp_id, catalog_item_id, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_camp_medicine_pricing_rules_catalog_item_id ON public.camp_medicine_pricing_rules USING btree (catalog_item_id);

ALTER TABLE public.camp_medicine_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Name: camp_medicine_pricing_rules camp_medicine_pricing_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_medicine_pricing_rules_tenant ON public.camp_medicine_pricing_rules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_medicine_pricing_rules tenant_isolation_camp_medicine_pricing_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_medicine_pricing_rules ON public.camp_medicine_pricing_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_medicine_pricing_rules trg_camp_medicine_pricing_rules_soft_delete_78527a79; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_medicine_pricing_rules_soft_delete_78527a79 BEFORE DELETE ON public.camp_medicine_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_medicine_pricing_rules trg_camp_medicine_pricing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_medicine_pricing_rules_updated_at BEFORE UPDATE ON public.camp_medicine_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_print_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    template_type text NOT NULL,
    template_name text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    paper_size text,
    copies integer DEFAULT 1 NOT NULL,
    printer_profile_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_print_plan_items_copies_check CHECK ((copies > 0)),
    CONSTRAINT camp_print_plan_items_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'printed'::text, 'cancelled'::text])))
);

-- Name: camp_print_plan_items camp_print_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_print_plan_items
    ADD CONSTRAINT camp_print_plan_items_pkey PRIMARY KEY (id);

-- Name: camp_print_plan_items camp_print_plan_items_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_print_plan_items
    ADD CONSTRAINT camp_print_plan_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_print_plan_items_active ON public.camp_print_plan_items USING btree (tenant_id, camp_id, template_type, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_print_plan_items ENABLE ROW LEVEL SECURITY;

-- Name: camp_print_plan_items camp_print_plan_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_print_plan_items_tenant ON public.camp_print_plan_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_print_plan_items tenant_isolation_camp_print_plan_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_print_plan_items ON public.camp_print_plan_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_print_plan_items trg_camp_print_plan_items_soft_delete_ccbf7c0d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_print_plan_items_soft_delete_ccbf7c0d BEFORE DELETE ON public.camp_print_plan_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_print_plan_items trg_camp_print_plan_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_print_plan_items_updated_at BEFORE UPDATE ON public.camp_print_plan_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_referral_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    referral_facility text NOT NULL,
    referral_department text,
    emergency_contact text,
    transport_mode text,
    red_flag_protocol text,
    escalation_owner_id uuid,
    status text DEFAULT 'planned'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_referral_plans_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'active'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: camp_referral_plans camp_referral_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referral_plans
    ADD CONSTRAINT camp_referral_plans_pkey PRIMARY KEY (id);

-- Name: camp_referral_plans camp_referral_plans_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referral_plans
    ADD CONSTRAINT camp_referral_plans_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_referral_plans_active ON public.camp_referral_plans USING btree (tenant_id, camp_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_referral_plans ENABLE ROW LEVEL SECURITY;

-- Name: camp_referral_plans camp_referral_plans_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_referral_plans_tenant ON public.camp_referral_plans USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_referral_plans tenant_isolation_camp_referral_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_referral_plans ON public.camp_referral_plans USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_referral_plans trg_camp_referral_plans_soft_delete_b565050b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_referral_plans_soft_delete_b565050b BEFORE DELETE ON public.camp_referral_plans FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_referral_plans trg_camp_referral_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_referral_plans_updated_at BEFORE UPDATE ON public.camp_referral_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    registration_id uuid,
    referred_to_facility text NOT NULL,
    referral_department text,
    urgency text DEFAULT 'routine'::text NOT NULL,
    reason text NOT NULL,
    transport_mode text,
    ambulance_required boolean DEFAULT false NOT NULL,
    attendant_name text,
    attendant_phone text,
    status text DEFAULT 'created'::text NOT NULL,
    referred_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_referrals_status_check CHECK ((status = ANY (ARRAY['created'::text, 'sent'::text, 'accepted'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT camp_referrals_urgency_check CHECK ((urgency = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])))
);

-- Name: camp_referrals camp_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referrals
    ADD CONSTRAINT camp_referrals_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_referrals_camp ON public.camp_referrals USING btree (tenant_id, camp_id, status);

CREATE INDEX idx_camp_referrals_deleted_at_2c33a087 ON public.camp_referrals USING btree (deleted_at);

CREATE INDEX idx_camp_referrals_registration ON public.camp_referrals USING btree (tenant_id, registration_id) WHERE (registration_id IS NOT NULL);

CREATE INDEX idx_camp_referrals_soft_delete ON public.camp_referrals USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_referrals ENABLE ROW LEVEL SECURITY;

-- Name: camp_referrals tenant_isolation_camp_referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_referrals ON public.camp_referrals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_referrals audit_camp_referrals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_referrals AFTER INSERT OR DELETE OR UPDATE ON public.camp_referrals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_referrals trg_camp_referrals_soft_delete_2c33a087; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_referrals_soft_delete_2c33a087 BEFORE DELETE ON public.camp_referrals FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_referrals trg_camp_referrals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_referrals_updated_at BEFORE UPDATE ON public.camp_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    registration_number text NOT NULL,
    person_name text NOT NULL,
    age integer,
    gender text,
    phone text,
    address text,
    id_proof_type text,
    id_proof_number text,
    patient_id uuid,
    status public.camp_registration_status DEFAULT 'registered'::public.camp_registration_status NOT NULL,
    chief_complaint text,
    is_walk_in boolean DEFAULT true NOT NULL,
    registered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    clinical_department_id uuid,
    attending_doctor_id uuid,
    service_line text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    father_spouse_name text,
    marital_status text,
    blood_group text,
    insurance_details text
);

-- Name: camp_registrations camp_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_reg_attending_doctor ON public.camp_registrations USING btree (tenant_id, attending_doctor_id) WHERE (attending_doctor_id IS NOT NULL);

CREATE INDEX idx_camp_reg_camp ON public.camp_registrations USING btree (tenant_id, camp_id);

CREATE INDEX idx_camp_reg_clinical_department ON public.camp_registrations USING btree (tenant_id, clinical_department_id) WHERE (clinical_department_id IS NOT NULL);

CREATE INDEX idx_camp_reg_patient ON public.camp_registrations USING btree (tenant_id, patient_id);

CREATE INDEX idx_camp_reg_tenant ON public.camp_registrations USING btree (tenant_id);

CREATE INDEX idx_camp_registrations_active_camp ON public.camp_registrations USING btree (tenant_id, camp_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_camp_registrations_deleted_at_a710b72e ON public.camp_registrations USING btree (deleted_at);

CREATE INDEX idx_camp_registrations_patient_id ON public.camp_registrations USING btree (patient_id);

CREATE INDEX idx_camp_registrations_soft_delete ON public.camp_registrations USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_registrations ENABLE ROW LEVEL SECURITY;

-- Name: camp_registrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_registrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_registrations trg_camp_reg_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_reg_updated_at BEFORE UPDATE ON public.camp_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: camp_registrations trg_camp_registrations_soft_delete_a710b72e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_registrations_soft_delete_a710b72e BEFORE DELETE ON public.camp_registrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: COLUMN camp_registrations.blood_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.camp_registrations.blood_group IS 'Free text as written on the camp form; not validated against the blood_group enum because a camp records what the patient reports, not a typed sample.';

CREATE TABLE public.camp_remote_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    category text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    nabh_chapter text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    evidence_attachment_id uuid,
    checked_by uuid,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_remote_checklist_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ok'::text, 'issue'::text, 'not_applicable'::text])))
);

-- Name: camp_remote_checklist_items camp_remote_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_checklist_items
    ADD CONSTRAINT camp_remote_checklist_items_pkey PRIMARY KEY (id);

-- Name: camp_remote_checklist_items camp_remote_checklist_tenant_camp_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_checklist_items
    ADD CONSTRAINT camp_remote_checklist_tenant_camp_code_key UNIQUE (tenant_id, camp_id, code);

CREATE INDEX idx_camp_remote_checklist_camp ON public.camp_remote_checklist_items USING btree (tenant_id, camp_id, category);

CREATE INDEX idx_camp_remote_checklist_items_deleted_at_ef75c3ed ON public.camp_remote_checklist_items USING btree (deleted_at);

CREATE INDEX idx_camp_remote_checklist_items_soft_delete ON public.camp_remote_checklist_items USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_remote_checklist_status ON public.camp_remote_checklist_items USING btree (tenant_id, camp_id, status);

ALTER TABLE public.camp_remote_checklist_items ENABLE ROW LEVEL SECURITY;

-- Name: camp_remote_checklist_items tenant_isolation_camp_remote_checklist_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_remote_checklist_items ON public.camp_remote_checklist_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_remote_checklist_items audit_camp_remote_checklist_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_remote_checklist_items AFTER INSERT OR DELETE OR UPDATE ON public.camp_remote_checklist_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_remote_checklist_items trg_camp_remote_checklist_items_soft_delete_ef75c3ed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_remote_checklist_items_soft_delete_ef75c3ed BEFORE DELETE ON public.camp_remote_checklist_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_remote_checklist_items trg_camp_remote_checklist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_remote_checklist_updated_at BEFORE UPDATE ON public.camp_remote_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- Migration: 0117_camp_remote_operations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: camp_remote_setups, camp_remote_checklist_items,
--             camp_supply_items, camp_referrals, camp_incidents,
--             camp_sync_events
-- ====================================================================
-- Remote Camp operations backbone.
-- NABH-facing intent:
--   AAC/COP  - assessment, triage, referral and continuity controls
--   PRE      - patient privacy, rights, education and consent support
--   IPC/HIC  - infection prevention, sharps and biomedical waste controls
--   PSQ      - incident reporting and corrective action evidence
--   ROM/FMS  - site safety, water, power, crowd control and emergency route
--   HRM      - staff roster, role briefing and credential checks
--   IMS      - structured records, offline packet evidence and auditability

CREATE TABLE public.camp_remote_setups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    village_name text,
    block_name text,
    district_name text,
    site_landmark text,
    latitude double precision,
    longitude double precision,
    expected_footfall integer,
    site_contact_name text,
    site_contact_phone text,
    local_authority_name text,
    local_authority_phone text,
    referral_facility_name text,
    referral_facility_phone text,
    ambulance_contact_name text,
    ambulance_contact_phone text,
    emergency_route_notes text,
    network_plan text,
    power_plan text,
    water_sanitation_plan text,
    privacy_plan text,
    crowd_control_plan text,
    bmw_plan text,
    infection_control_plan text,
    status text DEFAULT 'draft'::text NOT NULL,
    readiness_score integer DEFAULT 0 NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_remote_setups_readiness_score_check CHECK (((readiness_score >= 0) AND (readiness_score <= 100))),
    CONSTRAINT camp_remote_setups_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'blocked'::text, 'closed'::text])))
);

-- Name: camp_remote_setups camp_remote_setups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_setups
    ADD CONSTRAINT camp_remote_setups_pkey PRIMARY KEY (id);

-- Name: camp_remote_setups camp_remote_setups_tenant_camp_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_setups
    ADD CONSTRAINT camp_remote_setups_tenant_camp_key UNIQUE (tenant_id, camp_id);

CREATE INDEX idx_camp_remote_setups_camp ON public.camp_remote_setups USING btree (tenant_id, camp_id);

CREATE INDEX idx_camp_remote_setups_deleted_at_d7a1dd70 ON public.camp_remote_setups USING btree (deleted_at);

CREATE INDEX idx_camp_remote_setups_soft_delete ON public.camp_remote_setups USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_remote_setups ENABLE ROW LEVEL SECURITY;

-- Name: camp_remote_setups tenant_isolation_camp_remote_setups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_remote_setups ON public.camp_remote_setups USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_remote_setups audit_camp_remote_setups; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_remote_setups AFTER INSERT OR DELETE OR UPDATE ON public.camp_remote_setups FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_remote_setups trg_camp_remote_setups_soft_delete_d7a1dd70; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_remote_setups_soft_delete_d7a1dd70 BEFORE DELETE ON public.camp_remote_setups FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_remote_setups trg_camp_remote_setups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_remote_setups_updated_at BEFORE UPDATE ON public.camp_remote_setups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_screenings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    bp_systolic integer,
    bp_diastolic integer,
    pulse_rate integer,
    spo2 integer,
    temperature numeric(4,1),
    blood_sugar_random numeric(6,1),
    bmi numeric(5,2),
    height_cm numeric(5,1),
    weight_kg numeric(5,1),
    visual_acuity_left text,
    visual_acuity_right text,
    findings text,
    diagnosis text,
    advice text,
    referred_to_hospital boolean DEFAULT false NOT NULL,
    referral_department text,
    referral_urgency text,
    screened_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    mh_diabetes boolean,
    mh_hypertension boolean,
    mh_asthma boolean,
    mh_heart_disease boolean,
    mh_thyroid_disorder boolean,
    mh_previous_surgeries boolean,
    mh_allergies boolean,
    mh_smoking_history boolean,
    mh_alcohol_use boolean,
    mh_family_history boolean,
    mh_others boolean,
    medical_history_notes text,
    test_hba1c numeric(5,2),
    test_haemoglobin numeric(5,2),
    test_thyroid numeric(8,3),
    test_ecg text,
    test_xray text,
    test_bmd text,
    test_biothesiometry text,
    referral_doctor_name text,
    icd_codes text[]
);

-- Name: camp_screenings camp_screenings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_scr_reg ON public.camp_screenings USING btree (tenant_id, registration_id);

CREATE INDEX idx_camp_scr_tenant ON public.camp_screenings USING btree (tenant_id);

CREATE INDEX idx_camp_screenings_deleted_at_81602d14 ON public.camp_screenings USING btree (deleted_at);

CREATE INDEX idx_camp_screenings_mh_diabetes ON public.camp_screenings USING btree (tenant_id) WHERE mh_diabetes;

CREATE INDEX idx_camp_screenings_mh_hypertension ON public.camp_screenings USING btree (tenant_id) WHERE mh_hypertension;

CREATE INDEX idx_camp_screenings_soft_delete ON public.camp_screenings USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_screenings ENABLE ROW LEVEL SECURITY;

-- Name: camp_screenings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_screenings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_screenings trg_camp_scr_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_scr_updated_at BEFORE UPDATE ON public.camp_screenings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: camp_screenings trg_camp_screenings_soft_delete_81602d14; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_screenings_soft_delete_81602d14 BEFORE DELETE ON public.camp_screenings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: COLUMN camp_screenings.icd_codes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.camp_screenings.icd_codes IS 'ICD-10 codes assigned at the camp. An array because a single screening routinely yields more than one, and 1,075 of 1,125 audited paper records carried at least one.';

CREATE TABLE public.camp_service_pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    service_key text NOT NULL,
    service_name text NOT NULL,
    counter_id uuid,
    department_id uuid,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free'::text NOT NULL,
    standard_rate numeric(12,2) DEFAULT 0 NOT NULL,
    patient_rate numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    camp_cost numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    approval_required boolean DEFAULT false NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_service_pricing_rules_charge_mode_check CHECK ((charge_mode = ANY (ARRAY['free'::text, 'paid'::text, 'mixed'::text, 'sponsor_covered'::text]))),
    CONSTRAINT camp_service_pricing_rules_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'approved'::text, 'active'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: camp_service_pricing_rules camp_service_pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_service_pricing_rules
    ADD CONSTRAINT camp_service_pricing_rules_pkey PRIMARY KEY (id);

-- Name: camp_service_pricing_rules camp_service_pricing_rules_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_service_pricing_rules
    ADD CONSTRAINT camp_service_pricing_rules_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_service_pricing_rules_active ON public.camp_service_pricing_rules USING btree (tenant_id, camp_id, service_key, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_camp_service_pricing_rules_department_id ON public.camp_service_pricing_rules USING btree (department_id);

ALTER TABLE public.camp_service_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Name: camp_service_pricing_rules camp_service_pricing_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_service_pricing_rules_tenant ON public.camp_service_pricing_rules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_service_pricing_rules tenant_isolation_camp_service_pricing_rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_service_pricing_rules ON public.camp_service_pricing_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_service_pricing_rules trg_camp_service_pricing_rules_soft_delete_6193b597; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_service_pricing_rules_soft_delete_6193b597 BEFORE DELETE ON public.camp_service_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_service_pricing_rules trg_camp_service_pricing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_service_pricing_rules_updated_at BEFORE UPDATE ON public.camp_service_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_site_readiness_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    item_type text NOT NULL,
    label text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    owner_id uuid,
    due_date date,
    evidence_attachment_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_site_readiness_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'issue'::text, 'not_applicable'::text, 'closed'::text])))
);

-- Name: camp_site_readiness_items camp_site_readiness_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_site_readiness_items
    ADD CONSTRAINT camp_site_readiness_items_pkey PRIMARY KEY (id);

-- Name: camp_site_readiness_items camp_site_readiness_items_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_site_readiness_items
    ADD CONSTRAINT camp_site_readiness_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_site_readiness_items_active ON public.camp_site_readiness_items USING btree (tenant_id, camp_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_site_readiness_items ENABLE ROW LEVEL SECURITY;

-- Name: camp_site_readiness_items camp_site_readiness_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_site_readiness_items_tenant ON public.camp_site_readiness_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_site_readiness_items tenant_isolation_camp_site_readiness_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_site_readiness_items ON public.camp_site_readiness_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_site_readiness_items trg_camp_site_readiness_items_soft_delete_e745c16b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_site_readiness_items_soft_delete_e745c16b BEFORE DELETE ON public.camp_site_readiness_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_site_readiness_items trg_camp_site_readiness_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_site_readiness_items_updated_at BEFORE UPDATE ON public.camp_site_readiness_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS-Posture: tenant-scoped
-- Structured camp planning backbone.
-- New planning rows are no longer only hidden inside camps.equipment_list.
-- The legacy JSON remains readable, but create/update materializes row-level
-- doctor, staff, service, medicine, sponsor, approval, printable, and closure
-- records that can drive readiness, approvals, billing, pharmacy, assets, MRD,
-- and closeout reporting.

CREATE TABLE public.camp_sponsor_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text DEFAULT 'default'::text NOT NULL,
    sponsor_name text,
    contact_name text,
    contact_phone text,
    mou_reference text,
    covered_services text[] DEFAULT ARRAY[]::text[] NOT NULL,
    covered_medicines text[] DEFAULT ARRAY[]::text[] NOT NULL,
    coverage_cap numeric(12,2) DEFAULT 0 NOT NULL,
    coverage_percent numeric(5,2) DEFAULT 0 NOT NULL,
    invoice_terms text,
    settlement_owner_id uuid,
    receivable_amount numeric(12,2) DEFAULT 0 NOT NULL,
    collected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_sponsor_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'settled'::text, 'cancelled'::text])))
);

-- Name: camp_sponsor_plans camp_sponsor_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sponsor_plans
    ADD CONSTRAINT camp_sponsor_plans_pkey PRIMARY KEY (id);

-- Name: camp_sponsor_plans camp_sponsor_plans_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sponsor_plans
    ADD CONSTRAINT camp_sponsor_plans_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_sponsor_plans_active ON public.camp_sponsor_plans USING btree (tenant_id, camp_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_sponsor_plans ENABLE ROW LEVEL SECURITY;

-- Name: camp_sponsor_plans camp_sponsor_plans_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_sponsor_plans_tenant ON public.camp_sponsor_plans USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_sponsor_plans tenant_isolation_camp_sponsor_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_sponsor_plans ON public.camp_sponsor_plans USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_sponsor_plans trg_camp_sponsor_plans_soft_delete_0c6b8ed6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_sponsor_plans_soft_delete_0c6b8ed6 BEFORE DELETE ON public.camp_sponsor_plans FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_sponsor_plans trg_camp_sponsor_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_sponsor_plans_updated_at BEFORE UPDATE ON public.camp_sponsor_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_staff_roster (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    employee_id uuid NOT NULL,
    role_in_camp text NOT NULL,
    counter_id uuid,
    duty_start timestamp with time zone,
    duty_end timestamp with time zone,
    break_coverage_notes text,
    attendance_link_id uuid,
    backup_employee_id uuid,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_staff_roster_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'confirmed'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);

-- Name: camp_staff_roster camp_staff_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_staff_roster
    ADD CONSTRAINT camp_staff_roster_pkey PRIMARY KEY (id);

-- Name: camp_staff_roster camp_staff_roster_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_staff_roster
    ADD CONSTRAINT camp_staff_roster_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_staff_roster_active ON public.camp_staff_roster USING btree (tenant_id, camp_id, employee_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_staff_roster ENABLE ROW LEVEL SECURITY;

-- Name: camp_staff_roster camp_staff_roster_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_staff_roster_tenant ON public.camp_staff_roster USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_staff_roster tenant_isolation_camp_staff_roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_staff_roster ON public.camp_staff_roster USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_staff_roster trg_camp_staff_roster_soft_delete_eb99311b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_staff_roster_soft_delete_eb99311b BEFORE DELETE ON public.camp_staff_roster FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_staff_roster trg_camp_staff_roster_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_staff_roster_updated_at BEFORE UPDATE ON public.camp_staff_roster FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_supply_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    category text NOT NULL,
    item_name text NOT NULL,
    unit text,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    packed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    consumed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    returned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    batch_no text,
    expiry_date date,
    is_critical boolean DEFAULT false NOT NULL,
    shortage_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    catalog_item_id uuid,
    batch_stock_id uuid,
    store_location_id uuid,
    charge_mode text DEFAULT 'free'::text NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    cost_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_covered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    approval_required boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_supply_items_category_check CHECK ((category = ANY (ARRAY['equipment'::text, 'consumable'::text, 'medicine'::text, 'ppe'::text, 'biomedical_waste'::text, 'document'::text, 'it'::text, 'other'::text]))),
    CONSTRAINT camp_supply_items_charge_mode_check CHECK ((charge_mode = ANY (ARRAY['free'::text, 'paid'::text, 'mixed'::text, 'sponsor_covered'::text])))
);

-- Name: camp_supply_items camp_supply_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_supply_items
    ADD CONSTRAINT camp_supply_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_supply_items_batch ON public.camp_supply_items USING btree (tenant_id, batch_stock_id) WHERE (batch_stock_id IS NOT NULL);

CREATE INDEX idx_camp_supply_items_camp ON public.camp_supply_items USING btree (tenant_id, camp_id, category);

CREATE INDEX idx_camp_supply_items_catalog ON public.camp_supply_items USING btree (tenant_id, camp_id, catalog_item_id) WHERE (catalog_item_id IS NOT NULL);

CREATE INDEX idx_camp_supply_items_catalog_item_id ON public.camp_supply_items USING btree (catalog_item_id);

CREATE INDEX idx_camp_supply_items_deleted_at_91f30b47 ON public.camp_supply_items USING btree (deleted_at);

CREATE INDEX idx_camp_supply_items_soft_delete ON public.camp_supply_items USING btree (tenant_id, deleted_at);

ALTER TABLE public.camp_supply_items ENABLE ROW LEVEL SECURITY;

-- Name: camp_supply_items tenant_isolation_camp_supply_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_supply_items ON public.camp_supply_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_supply_items audit_camp_supply_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_supply_items AFTER INSERT OR DELETE OR UPDATE ON public.camp_supply_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_supply_items trg_camp_supply_items_soft_delete_91f30b47; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_supply_items_soft_delete_91f30b47 BEFORE DELETE ON public.camp_supply_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_supply_items trg_camp_supply_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_supply_items_updated_at BEFORE UPDATE ON public.camp_supply_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_sync_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    device_id text NOT NULL,
    idempotency_key text NOT NULL,
    event_type text NOT NULL,
    client_entity_id uuid,
    payload jsonb NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    server_entity_type text,
    server_entity_id uuid,
    error text,
    occurred_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_sync_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'applied'::text, 'duplicate'::text, 'failed'::text])))
);

-- Name: camp_sync_events camp_sync_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sync_events
    ADD CONSTRAINT camp_sync_events_pkey PRIMARY KEY (id);

-- Name: camp_sync_events camp_sync_events_tenant_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sync_events
    ADD CONSTRAINT camp_sync_events_tenant_key UNIQUE (tenant_id, idempotency_key);

CREATE INDEX idx_camp_sync_events_active_key ON public.camp_sync_events USING btree (tenant_id, idempotency_key) WHERE (deleted_at IS NULL);

CREATE INDEX idx_camp_sync_events_camp ON public.camp_sync_events USING btree (tenant_id, camp_id, received_at DESC);

CREATE INDEX idx_camp_sync_events_deleted_at_d3912e41 ON public.camp_sync_events USING btree (deleted_at);

CREATE INDEX idx_camp_sync_events_device ON public.camp_sync_events USING btree (tenant_id, device_id, received_at DESC);

CREATE INDEX idx_camp_sync_events_soft_delete ON public.camp_sync_events USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_sync_events_status ON public.camp_sync_events USING btree (tenant_id, status, received_at) WHERE (status = ANY (ARRAY['received'::text, 'failed'::text]));

ALTER TABLE public.camp_sync_events ENABLE ROW LEVEL SECURITY;

-- Name: camp_sync_events tenant_isolation_camp_sync_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_sync_events ON public.camp_sync_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_sync_events audit_camp_sync_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_camp_sync_events AFTER INSERT OR DELETE OR UPDATE ON public.camp_sync_events FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

-- Name: camp_sync_events trg_camp_sync_events_soft_delete_d3912e41; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_sync_events_soft_delete_d3912e41 BEFORE DELETE ON public.camp_sync_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.camp_target_populations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    target_name text NOT NULL,
    population_type text,
    age_group text,
    disease_focus text,
    eligibility_rules text,
    expected_patients integer DEFAULT 0 NOT NULL,
    expected_high_risk_groups text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_target_populations_expected_patients_check CHECK ((expected_patients >= 0)),
    CONSTRAINT camp_target_populations_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'cancelled'::text, 'closed'::text])))
);

-- Name: camp_target_populations camp_target_populations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_target_populations
    ADD CONSTRAINT camp_target_populations_pkey PRIMARY KEY (id);

-- Name: camp_target_populations camp_target_populations_tenant_camp_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_target_populations
    ADD CONSTRAINT camp_target_populations_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key);

CREATE INDEX idx_camp_target_populations_active ON public.camp_target_populations USING btree (tenant_id, camp_id, status) WHERE (deleted_at IS NULL);

ALTER TABLE public.camp_target_populations ENABLE ROW LEVEL SECURITY;

-- Name: camp_target_populations camp_target_populations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_target_populations_tenant ON public.camp_target_populations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_target_populations tenant_isolation_camp_target_populations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_camp_target_populations ON public.camp_target_populations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: camp_target_populations trg_camp_target_populations_soft_delete_b9bc0acd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_target_populations_soft_delete_b9bc0acd BEFORE DELETE ON public.camp_target_populations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_target_populations trg_camp_target_populations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_target_populations_updated_at BEFORE UPDATE ON public.camp_target_populations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    role_in_camp text NOT NULL,
    is_confirmed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: camp_team_members camp_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_pkey PRIMARY KEY (id);

-- Name: camp_team_members camp_team_members_tenant_id_camp_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_tenant_id_camp_id_employee_id_key UNIQUE (tenant_id, camp_id, employee_id);

CREATE INDEX idx_camp_team_camp ON public.camp_team_members USING btree (tenant_id, camp_id);

CREATE INDEX idx_camp_team_members_deleted_at_d31b819e ON public.camp_team_members USING btree (deleted_at);

CREATE INDEX idx_camp_team_members_soft_delete ON public.camp_team_members USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_team_tenant ON public.camp_team_members USING btree (tenant_id);

ALTER TABLE public.camp_team_members ENABLE ROW LEVEL SECURITY;

-- Name: camp_team_members tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_team_members USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_team_members trg_camp_team_members_soft_delete_d31b819e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_team_members_soft_delete_d31b819e BEFORE DELETE ON public.camp_team_members FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_team_members trg_camp_team_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_team_updated_at BEFORE UPDATE ON public.camp_team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_code text NOT NULL,
    name text NOT NULL,
    camp_type public.camp_type NOT NULL,
    status public.camp_status DEFAULT 'planned'::public.camp_status NOT NULL,
    organizing_department_id uuid,
    coordinator_id uuid,
    scheduled_date date NOT NULL,
    start_time text,
    end_time text,
    venue_name text,
    venue_address text,
    venue_city text,
    venue_state text,
    venue_pincode text,
    venue_latitude double precision,
    venue_longitude double precision,
    expected_participants integer,
    actual_participants integer,
    budget_allocated numeric(12,2) DEFAULT 0,
    budget_spent numeric(12,2) DEFAULT 0,
    logistics_notes text,
    equipment_list jsonb,
    is_free boolean DEFAULT true NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    approved_by uuid,
    approved_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancellation_reason text,
    summary_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: camps camps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_pkey PRIMARY KEY (id);

-- Name: camps camps_tenant_id_camp_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_tenant_id_camp_code_key UNIQUE (tenant_id, camp_code);

CREATE INDEX idx_camps_date ON public.camps USING btree (tenant_id, scheduled_date DESC);

CREATE INDEX idx_camps_deleted_at_bdab9400 ON public.camps USING btree (deleted_at);

CREATE INDEX idx_camps_soft_delete ON public.camps USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camps_status ON public.camps USING btree (tenant_id, status);

CREATE INDEX idx_camps_tenant ON public.camps USING btree (tenant_id);

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;

-- Name: camps tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camps USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camps trg_camps_soft_delete_bdab9400; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camps_soft_delete_bdab9400 BEFORE DELETE ON public.camps FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camps trg_camps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camps_updated_at BEFORE UPDATE ON public.camps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: camp_approval_items camp_approval_items_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_approval_items
    ADD CONSTRAINT camp_approval_items_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_billing_records camp_billing_records_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_closure_tasks camp_closure_tasks_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_closure_tasks
    ADD CONSTRAINT camp_closure_tasks_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_counters camp_counters_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_counters
    ADD CONSTRAINT camp_counters_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_department_counters camp_department_counters_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_department_counters
    ADD CONSTRAINT camp_department_counters_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_department_counters camp_department_counters_counter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_department_counters
    ADD CONSTRAINT camp_department_counters_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id);

-- Name: camp_doctor_roster camp_doctor_roster_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_doctor_roster
    ADD CONSTRAINT camp_doctor_roster_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_followups camp_followups_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_incidents camp_incidents_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_incidents
    ADD CONSTRAINT camp_incidents_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_incidents camp_incidents_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_incidents
    ADD CONSTRAINT camp_incidents_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_lab_samples camp_lab_samples_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_medicine_pricing_rules camp_medicine_pricing_rules_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_medicine_pricing_rules
    ADD CONSTRAINT camp_medicine_pricing_rules_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_print_plan_items camp_print_plan_items_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_print_plan_items
    ADD CONSTRAINT camp_print_plan_items_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_referral_plans camp_referral_plans_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referral_plans
    ADD CONSTRAINT camp_referral_plans_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_referrals camp_referrals_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referrals
    ADD CONSTRAINT camp_referrals_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_referrals camp_referrals_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_referrals
    ADD CONSTRAINT camp_referrals_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_registrations camp_registrations_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id);

-- Name: camp_remote_checklist_items camp_remote_checklist_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_checklist_items
    ADD CONSTRAINT camp_remote_checklist_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_remote_setups camp_remote_setups_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_remote_setups
    ADD CONSTRAINT camp_remote_setups_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_screenings camp_screenings_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);

-- Name: camp_service_pricing_rules camp_service_pricing_rules_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_service_pricing_rules
    ADD CONSTRAINT camp_service_pricing_rules_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_service_pricing_rules camp_service_pricing_rules_counter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_service_pricing_rules
    ADD CONSTRAINT camp_service_pricing_rules_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id);

-- Name: camp_site_readiness_items camp_site_readiness_items_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_site_readiness_items
    ADD CONSTRAINT camp_site_readiness_items_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_sponsor_plans camp_sponsor_plans_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sponsor_plans
    ADD CONSTRAINT camp_sponsor_plans_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_staff_roster camp_staff_roster_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_staff_roster
    ADD CONSTRAINT camp_staff_roster_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_staff_roster camp_staff_roster_counter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_staff_roster
    ADD CONSTRAINT camp_staff_roster_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id);

-- Name: camp_supply_items camp_supply_items_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_supply_items
    ADD CONSTRAINT camp_supply_items_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_sync_events camp_sync_events_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_sync_events
    ADD CONSTRAINT camp_sync_events_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_target_populations camp_target_populations_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_target_populations
    ADD CONSTRAINT camp_target_populations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;

-- Name: camp_team_members camp_team_members_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT;
