-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 41
-- Drops: none
-- facilities — schema.
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



-- ====================================================================
-- Migration: 0215_asset_movements.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: asset_movements
-- Drops: none
-- ====================================================================
-- The asset register (bme_equipment + equipment, unified) was read-only:
-- an asset's department/location could only be changed by editing the
-- source row directly, with no record of who moved what, when, or why, and
-- no way for one department to request an asset from another and have the
-- custodian satisfy/complete that request. This adds an asset-movement
-- ledger that doubles as an inter-department request workflow:
--   requested -> completed (custodian relocates the asset) | rejected.
-- On completion the asset's source row is repointed to the destination
-- department (and location, for bme_equipment which carries free text).

CREATE TABLE public.asset_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    movement_type text DEFAULT 'transfer'::text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    from_department_id uuid,
    to_department_id uuid,
    from_location text,
    to_location text,
    reason text,
    requested_by uuid,
    completed_by uuid,
    completed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['transfer'::text, 'issue'::text, 'return'::text, 'repair'::text, 'disposal'::text]))),
    CONSTRAINT asset_movements_source_type_check CHECK ((source_type = ANY (ARRAY['bme_equipment'::text, 'equipment'::text]))),
    CONSTRAINT asset_movements_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'completed'::text, 'rejected'::text, 'cancelled'::text])))
);

-- Name: asset_movements asset_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_pkey PRIMARY KEY (id);

CREATE INDEX idx_asset_movements_asset ON public.asset_movements USING btree (tenant_id, source_type, source_id, created_at DESC);

CREATE INDEX idx_asset_movements_open ON public.asset_movements USING btree (tenant_id, status) WHERE (status = 'requested'::text);

ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;

-- Name: asset_movements asset_movements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_movements_tenant ON public.asset_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: asset_movements set_asset_movements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_asset_movements_updated_at BEFORE UPDATE ON public.asset_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.biowaste_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    waste_category public.waste_category NOT NULL,
    weight_kg numeric(10,3) NOT NULL,
    record_date date NOT NULL,
    container_count integer DEFAULT 1 NOT NULL,
    disposal_vendor text,
    manifest_number text,
    notes text,
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: biowaste_records biowaste_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biowaste_records
    ADD CONSTRAINT biowaste_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_biowaste_date ON public.biowaste_records USING btree (tenant_id, record_date);

CREATE INDEX idx_biowaste_dept ON public.biowaste_records USING btree (tenant_id, department_id);

CREATE INDEX idx_biowaste_records_deleted_at_5164b920 ON public.biowaste_records USING btree (deleted_at);

CREATE INDEX idx_biowaste_records_department_id ON public.biowaste_records USING btree (department_id);

CREATE INDEX idx_biowaste_tenant ON public.biowaste_records USING btree (tenant_id);

ALTER TABLE public.biowaste_records ENABLE ROW LEVEL SECURITY;

-- Name: biowaste_records biowaste_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY biowaste_records_tenant ON public.biowaste_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: biowaste_records set_biowaste_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_biowaste_records_updated_at BEFORE UPDATE ON public.biowaste_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: biowaste_records trg_biowaste_records_soft_delete_5164b920; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_biowaste_records_soft_delete_5164b920 BEFORE DELETE ON public.biowaste_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bme_breakdowns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    priority public.bme_breakdown_priority DEFAULT 'medium'::public.bme_breakdown_priority NOT NULL,
    status public.bme_breakdown_status DEFAULT 'reported'::public.bme_breakdown_status NOT NULL,
    description text NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolution_started_at timestamp with time zone,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_notes text,
    downtime_start timestamp with time zone,
    downtime_end timestamp with time zone,
    downtime_minutes integer,
    spare_parts_used text,
    spare_parts_cost numeric(12,2),
    vendor_visit_required boolean DEFAULT false NOT NULL,
    vendor_visit_date date,
    vendor_cost numeric(12,2),
    total_repair_cost numeric(12,2),
    vendor_id uuid,
    vendor_response_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_breakdowns bme_breakdowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_pkey PRIMARY KEY (id);

CREATE INDEX idx_bme_breakdowns_deleted_at_fbefe090 ON public.bme_breakdowns USING btree (deleted_at);

CREATE INDEX idx_bme_breakdowns_department_id ON public.bme_breakdowns USING btree (department_id);

CREATE INDEX idx_bme_breakdowns_equip ON public.bme_breakdowns USING btree (tenant_id, equipment_id);

CREATE INDEX idx_bme_breakdowns_status ON public.bme_breakdowns USING btree (tenant_id, status);

CREATE INDEX idx_bme_breakdowns_tenant ON public.bme_breakdowns USING btree (tenant_id);

ALTER TABLE public.bme_breakdowns ENABLE ROW LEVEL SECURITY;

-- Name: bme_breakdowns tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_breakdowns USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_breakdowns trg_bme_breakdowns_soft_delete_fbefe090; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_breakdowns_soft_delete_fbefe090 BEFORE DELETE ON public.bme_breakdowns FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_breakdowns trg_bme_breakdowns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_breakdowns_updated_at BEFORE UPDATE ON public.bme_breakdowns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_calibrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    calibration_status public.bme_calibration_status DEFAULT 'due'::public.bme_calibration_status NOT NULL,
    frequency public.bme_pm_frequency DEFAULT 'annual'::public.bme_pm_frequency NOT NULL,
    last_calibrated_date date,
    next_due_date date,
    calibrated_by text,
    calibration_vendor_id uuid,
    certificate_number text,
    certificate_url text,
    is_in_tolerance boolean,
    deviation_notes text,
    reference_standard text,
    is_locked boolean DEFAULT false NOT NULL,
    locked_at timestamp with time zone,
    locked_reason text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_calibrations bme_calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_bme_calibrations_deleted_at_613a073c ON public.bme_calibrations USING btree (deleted_at);

CREATE INDEX idx_bme_calibrations_due ON public.bme_calibrations USING btree (tenant_id, next_due_date);

CREATE INDEX idx_bme_calibrations_equip ON public.bme_calibrations USING btree (tenant_id, equipment_id);

CREATE INDEX idx_bme_calibrations_tenant ON public.bme_calibrations USING btree (tenant_id);

ALTER TABLE public.bme_calibrations ENABLE ROW LEVEL SECURITY;

-- Name: bme_calibrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_calibrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_calibrations trg_bme_calibrations_soft_delete_613a073c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_calibrations_soft_delete_613a073c BEFORE DELETE ON public.bme_calibrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_calibrations trg_bme_calibrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_calibrations_updated_at BEFORE UPDATE ON public.bme_calibrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_number text NOT NULL,
    equipment_id uuid NOT NULL,
    contract_type public.bme_contract_type NOT NULL,
    vendor_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    contract_value numeric(14,2),
    payment_terms text,
    coverage_details text,
    exclusions text,
    sla_response_hours integer,
    sla_resolution_hours integer,
    renewal_alert_days integer DEFAULT 60 NOT NULL,
    is_renewed boolean DEFAULT false NOT NULL,
    renewed_contract_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_contracts bme_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_pkey PRIMARY KEY (id);

-- Name: bme_contracts bme_contracts_tenant_id_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_tenant_id_contract_number_key UNIQUE (tenant_id, contract_number);

CREATE INDEX idx_bme_contracts_deleted_at_30dbd0b5 ON public.bme_contracts USING btree (deleted_at);

CREATE INDEX idx_bme_contracts_end ON public.bme_contracts USING btree (tenant_id, end_date);

CREATE INDEX idx_bme_contracts_equip ON public.bme_contracts USING btree (tenant_id, equipment_id);

CREATE INDEX idx_bme_contracts_tenant ON public.bme_contracts USING btree (tenant_id);

ALTER TABLE public.bme_contracts ENABLE ROW LEVEL SECURITY;

-- Name: bme_contracts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_contracts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_contracts trg_bme_contracts_soft_delete_30dbd0b5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_contracts_soft_delete_30dbd0b5 BEFORE DELETE ON public.bme_contracts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_contracts trg_bme_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_contracts_updated_at BEFORE UPDATE ON public.bme_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    make text,
    model text,
    serial_number text,
    asset_tag text,
    barcode_value text,
    category text,
    sub_category text,
    risk_category public.bme_risk_category DEFAULT 'medium'::public.bme_risk_category NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    department_id uuid,
    location_description text,
    facility_id uuid,
    status public.bme_equipment_status DEFAULT 'active'::public.bme_equipment_status NOT NULL,
    purchase_date date,
    purchase_cost numeric(14,2),
    installation_date date,
    commissioned_date date,
    installed_by text,
    commissioning_notes text,
    expected_life_years integer,
    condemned_date date,
    disposal_date date,
    disposal_method text,
    warranty_start_date date,
    warranty_end_date date,
    warranty_terms text,
    vendor_id uuid,
    manufacturer_contact text,
    specifications jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_equipment bme_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_pkey PRIMARY KEY (id);

-- Name: bme_equipment bme_equipment_tenant_id_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_tenant_id_asset_tag_key UNIQUE (tenant_id, asset_tag);

CREATE INDEX idx_bme_equipment_deleted_at_5567b3ef ON public.bme_equipment USING btree (deleted_at);

CREATE INDEX idx_bme_equipment_department_id ON public.bme_equipment USING btree (department_id);

CREATE INDEX idx_bme_equipment_dept ON public.bme_equipment USING btree (tenant_id, department_id);

CREATE INDEX idx_bme_equipment_status ON public.bme_equipment USING btree (tenant_id, status);

CREATE INDEX idx_bme_equipment_tenant ON public.bme_equipment USING btree (tenant_id);

ALTER TABLE public.bme_equipment ENABLE ROW LEVEL SECURITY;

-- Name: bme_equipment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_equipment USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_equipment trg_bme_equipment_soft_delete_5567b3ef; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_equipment_soft_delete_5567b3ef BEFORE DELETE ON public.bme_equipment FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_equipment trg_bme_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_equipment_updated_at BEFORE UPDATE ON public.bme_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_pm_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    frequency public.bme_pm_frequency NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb,
    next_due_date date,
    last_completed_date date,
    assigned_to uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_pm_schedules bme_pm_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_bme_pm_schedules_deleted_at_8709454c ON public.bme_pm_schedules USING btree (deleted_at);

CREATE INDEX idx_bme_pm_schedules_due ON public.bme_pm_schedules USING btree (tenant_id, next_due_date);

CREATE INDEX idx_bme_pm_schedules_equip ON public.bme_pm_schedules USING btree (tenant_id, equipment_id);

CREATE INDEX idx_bme_pm_schedules_tenant ON public.bme_pm_schedules USING btree (tenant_id);

ALTER TABLE public.bme_pm_schedules ENABLE ROW LEVEL SECURITY;

-- Name: bme_pm_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_pm_schedules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_pm_schedules trg_bme_pm_schedules_soft_delete_8709454c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_pm_schedules_soft_delete_8709454c BEFORE DELETE ON public.bme_pm_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_pm_schedules trg_bme_pm_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_pm_schedules_updated_at BEFORE UPDATE ON public.bme_pm_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_vendor_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    contract_id uuid,
    evaluation_date date NOT NULL,
    period_from date,
    period_to date,
    response_time_score integer,
    resolution_quality_score integer,
    spare_parts_availability_score integer,
    professionalism_score integer,
    overall_score numeric(3,1),
    total_calls integer,
    calls_within_sla integer,
    comments text,
    evaluated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT bme_vendor_evaluations_professionalism_score_check CHECK (((professionalism_score >= 1) AND (professionalism_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_resolution_quality_score_check CHECK (((resolution_quality_score >= 1) AND (resolution_quality_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_response_time_score_check CHECK (((response_time_score >= 1) AND (response_time_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_spare_parts_availability_score_check CHECK (((spare_parts_availability_score >= 1) AND (spare_parts_availability_score <= 5)))
);

-- Name: bme_vendor_evaluations bme_vendor_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_pkey PRIMARY KEY (id);

CREATE INDEX idx_bme_vendor_evaluations_deleted_at_95de9e8b ON public.bme_vendor_evaluations USING btree (deleted_at);

CREATE INDEX idx_bme_vendor_evaluations_tenant ON public.bme_vendor_evaluations USING btree (tenant_id);

CREATE INDEX idx_bme_vendor_evaluations_vendor ON public.bme_vendor_evaluations USING btree (tenant_id, vendor_id);

ALTER TABLE public.bme_vendor_evaluations ENABLE ROW LEVEL SECURITY;

-- Name: bme_vendor_evaluations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_vendor_evaluations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_vendor_evaluations trg_bme_vendor_evaluations_soft_delete_95de9e8b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_vendor_evaluations_soft_delete_95de9e8b BEFORE DELETE ON public.bme_vendor_evaluations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_vendor_evaluations trg_bme_vendor_evaluations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_vendor_evaluations_updated_at BEFORE UPDATE ON public.bme_vendor_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bme_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    work_order_number text NOT NULL,
    equipment_id uuid NOT NULL,
    order_type public.bme_work_order_type NOT NULL,
    status public.bme_work_order_status DEFAULT 'open'::public.bme_work_order_status NOT NULL,
    priority public.bme_breakdown_priority DEFAULT 'medium'::public.bme_breakdown_priority NOT NULL,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    scheduled_date date,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    description text,
    findings text,
    actions_taken text,
    checklist_results jsonb DEFAULT '[]'::jsonb,
    labor_cost numeric(12,2),
    parts_cost numeric(12,2),
    vendor_cost numeric(12,2),
    total_cost numeric(12,2),
    technician_sign_off_by uuid,
    technician_sign_off_at timestamp with time zone,
    supervisor_sign_off_by uuid,
    supervisor_sign_off_at timestamp with time zone,
    pm_schedule_id uuid,
    breakdown_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bme_work_orders bme_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_pkey PRIMARY KEY (id);

-- Name: bme_work_orders bme_work_orders_tenant_id_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_tenant_id_work_order_number_key UNIQUE (tenant_id, work_order_number);

CREATE INDEX idx_bme_work_orders_deleted_at_ce862e07 ON public.bme_work_orders USING btree (deleted_at);

CREATE INDEX idx_bme_work_orders_equip ON public.bme_work_orders USING btree (tenant_id, equipment_id);

CREATE INDEX idx_bme_work_orders_status ON public.bme_work_orders USING btree (tenant_id, status);

CREATE INDEX idx_bme_work_orders_tenant ON public.bme_work_orders USING btree (tenant_id);

ALTER TABLE public.bme_work_orders ENABLE ROW LEVEL SECURITY;

-- Name: bme_work_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_work_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bme_work_orders trg_bme_work_orders_soft_delete_ce862e07; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_work_orders_soft_delete_ce862e07 BEFORE DELETE ON public.bme_work_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bme_work_orders trg_bme_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_work_orders_updated_at BEFORE UPDATE ON public.bme_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.calibrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid,
    calibration_date date NOT NULL,
    next_due_date date,
    performed_by uuid,
    vendor text,
    certificate_number text,
    result text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agency_id uuid,
    calibration_standard text,
    calibrated_by uuid,
    approved_by uuid,
    remarks text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: calibrations calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_calibrations_deleted_at_77135794 ON public.calibrations USING btree (deleted_at);

CREATE INDEX idx_calibrations_equipment ON public.calibrations USING btree (tenant_id, equipment_id, calibration_date DESC);

ALTER TABLE ONLY public.calibrations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;

-- Name: calibrations tenant_isolation_calibrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_calibrations ON public.calibrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: calibrations trg_calibrations_soft_delete_77135794; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calibrations_soft_delete_77135794 BEFORE DELETE ON public.calibrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cleaning_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    area_type public.cleaning_area_type NOT NULL,
    location_id uuid,
    department_id uuid,
    frequency_hours integer DEFAULT 24 NOT NULL,
    checklist_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cleaning_schedules cleaning_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_cleaning_schedules_deleted_at_87f37bbb ON public.cleaning_schedules USING btree (deleted_at);

CREATE INDEX idx_cleaning_schedules_department_id ON public.cleaning_schedules USING btree (department_id);

CREATE INDEX idx_cleaning_schedules_location_id ON public.cleaning_schedules USING btree (location_id);

CREATE INDEX idx_cleaning_schedules_tenant ON public.cleaning_schedules USING btree (tenant_id);

ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;

-- Name: cleaning_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cleaning_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cleaning_schedules set_cleaning_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cleaning_schedules_updated_at BEFORE UPDATE ON public.cleaning_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: cleaning_schedules trg_cleaning_schedules_soft_delete_87f37bbb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cleaning_schedules_soft_delete_87f37bbb BEFORE DELETE ON public.cleaning_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cleaning_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_id uuid,
    location_id uuid,
    department_id uuid,
    area_type public.cleaning_area_type NOT NULL,
    task_date date DEFAULT CURRENT_DATE NOT NULL,
    assigned_to text,
    status public.cleaning_task_status DEFAULT 'pending'::public.cleaning_task_status NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    verified_by uuid,
    verified_at timestamp with time zone,
    checklist_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cleaning_tasks cleaning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pkey PRIMARY KEY (id);

CREATE INDEX idx_cleaning_tasks_date ON public.cleaning_tasks USING btree (tenant_id, task_date);

CREATE INDEX idx_cleaning_tasks_deleted_at_2865ea9c ON public.cleaning_tasks USING btree (deleted_at);

CREATE INDEX idx_cleaning_tasks_department_id ON public.cleaning_tasks USING btree (department_id);

CREATE INDEX idx_cleaning_tasks_location_id ON public.cleaning_tasks USING btree (location_id);

CREATE INDEX idx_cleaning_tasks_status ON public.cleaning_tasks USING btree (tenant_id, status);

CREATE INDEX idx_cleaning_tasks_tenant ON public.cleaning_tasks USING btree (tenant_id);

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;

-- Name: cleaning_tasks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cleaning_tasks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: cleaning_tasks set_cleaning_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cleaning_tasks_updated_at BEFORE UPDATE ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: cleaning_tasks trg_cleaning_tasks_soft_delete_2865ea9c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cleaning_tasks_soft_delete_2865ea9c BEFORE DELETE ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    asset_tag text,
    name text NOT NULL,
    category text,
    manufacturer text,
    model text,
    serial_number text,
    department_id uuid,
    location_id uuid,
    status text,
    purchase_date date,
    warranty_until date,
    cost numeric(14,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    equipment_code text,
    installation_date date,
    warranty_expiry date,
    purchase_cost double precision,
    category_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);

CREATE INDEX idx_equipment_deleted_at_d3346167 ON public.equipment USING btree (deleted_at);

CREATE INDEX idx_equipment_department_id ON public.equipment USING btree (department_id);

CREATE INDEX idx_equipment_location_id ON public.equipment USING btree (location_id);

CREATE INDEX idx_equipment_tenant_id ON public.equipment USING btree (tenant_id);

ALTER TABLE ONLY public.equipment FORCE ROW LEVEL SECURITY;

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Name: equipment tenant_isolation_equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_equipment ON public.equipment USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: equipment trg_equipment_soft_delete_d3346167; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_soft_delete_d3346167 BEFORE DELETE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.equipment_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    checklist_template_id uuid,
    checked_by uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    all_passed boolean NOT NULL,
    next_check_due_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: equipment_checks equipment_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_pkey PRIMARY KEY (id);

CREATE INDEX equipment_checks_due_idx ON public.equipment_checks USING btree (tenant_id, next_check_due_at) WHERE (next_check_due_at IS NOT NULL);

CREATE INDEX idx_equipment_checks_deleted_at_770c257c ON public.equipment_checks USING btree (deleted_at);

ALTER TABLE ONLY public.equipment_checks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;

-- Name: equipment_checks tenant_isolation_equipment_checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_equipment_checks ON public.equipment_checks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: equipment_checks trg_equipment_checks_soft_delete_770c257c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_checks_soft_delete_770c257c BEFORE DELETE ON public.equipment_checks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.facilities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    facility_type public.facility_type NOT NULL,
    status public.facility_status DEFAULT 'active'::public.facility_status NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    pincode text,
    phone text,
    email text,
    country_id uuid,
    state_id uuid,
    district_id uuid,
    latitude numeric(10,7),
    longitude numeric(10,7),
    bed_count integer DEFAULT 0 NOT NULL,
    shared_billing boolean DEFAULT true NOT NULL,
    shared_pharmacy boolean DEFAULT true NOT NULL,
    shared_lab boolean DEFAULT true NOT NULL,
    shared_hr boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_facilities_bed_count_positive CHECK ((bed_count >= 0)),
    CONSTRAINT chk_facilities_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_facilities_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_facilities_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);

-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);

-- Name: facilities facilities_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_facilities_deleted_at_6e5f1255 ON public.facilities USING btree (deleted_at);

CREATE INDEX idx_facilities_parent ON public.facilities USING btree (parent_id);

CREATE INDEX idx_facilities_tenant ON public.facilities USING btree (tenant_id);

CREATE INDEX idx_facilities_type ON public.facilities USING btree (tenant_id, facility_type);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Name: facilities tenant_isolation_facilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_facilities ON public.facilities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: facilities trg_facilities_soft_delete_6e5f1255; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_facilities_soft_delete_6e5f1255 BEFORE DELETE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: facilities trg_facilities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_energy_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type public.fms_energy_source_type NOT NULL,
    location_id uuid,
    equipment_name text,
    reading_at timestamp with time zone DEFAULT now() NOT NULL,
    voltage numeric(8,2),
    current_amps numeric(8,2),
    power_kw numeric(10,2),
    power_factor numeric(4,3),
    frequency_hz numeric(6,2),
    fuel_level_percent numeric(5,2),
    runtime_hours numeric(10,2),
    load_percent numeric(5,2),
    battery_voltage numeric(6,2),
    battery_health_percent numeric(5,2),
    backup_minutes integer,
    switchover_time_seconds numeric(6,2),
    is_alarm boolean DEFAULT false NOT NULL,
    alarm_reason text,
    recorded_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_energy_readings fms_energy_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_energy_readings
    ADD CONSTRAINT fms_energy_readings_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_energy_readings_at ON public.fms_energy_readings USING btree (tenant_id, reading_at DESC);

CREATE INDEX idx_fms_energy_readings_deleted_at_34ce68f6 ON public.fms_energy_readings USING btree (deleted_at);

CREATE INDEX idx_fms_energy_readings_location_id ON public.fms_energy_readings USING btree (location_id);

CREATE INDEX idx_fms_energy_readings_source ON public.fms_energy_readings USING btree (tenant_id, source_type);

CREATE INDEX idx_fms_energy_readings_tenant ON public.fms_energy_readings USING btree (tenant_id);

ALTER TABLE public.fms_energy_readings ENABLE ROW LEVEL SECURITY;

-- Name: fms_energy_readings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_energy_readings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_energy_readings trg_fms_energy_readings_soft_delete_34ce68f6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_energy_readings_soft_delete_34ce68f6 BEFORE DELETE ON public.fms_energy_readings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_energy_readings trg_fms_energy_readings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_energy_readings_updated_at BEFORE UPDATE ON public.fms_energy_readings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_fire_drills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    drill_type public.fms_drill_type NOT NULL,
    facility_id uuid,
    drill_date date NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes integer,
    zones_covered text[],
    participants_count integer,
    scenario_description text,
    evacuation_time_seconds integer,
    response_time_seconds integer,
    findings text,
    improvement_actions text,
    drill_report_url text,
    conducted_by uuid,
    approved_by uuid,
    next_drill_due date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_fire_drills fms_fire_drills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_fire_drills_date ON public.fms_fire_drills USING btree (tenant_id, drill_date DESC);

CREATE INDEX idx_fms_fire_drills_deleted_at_2e28e46c ON public.fms_fire_drills USING btree (deleted_at);

CREATE INDEX idx_fms_fire_drills_tenant ON public.fms_fire_drills USING btree (tenant_id);

ALTER TABLE public.fms_fire_drills ENABLE ROW LEVEL SECURITY;

-- Name: fms_fire_drills tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_drills USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_fire_drills trg_fms_fire_drills_soft_delete_2e28e46c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_drills_soft_delete_2e28e46c BEFORE DELETE ON public.fms_fire_drills FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_fire_drills trg_fms_fire_drills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_drills_updated_at BEFORE UPDATE ON public.fms_fire_drills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_fire_equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    equipment_type public.fms_fire_equipment_type NOT NULL,
    location_id uuid,
    department_id uuid,
    serial_number text,
    make text,
    capacity text,
    installation_date date,
    expiry_date date,
    last_refill_date date,
    next_refill_date date,
    barcode_value text,
    qr_code_value text,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_fire_equipment fms_fire_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_equipment
    ADD CONSTRAINT fms_fire_equipment_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_fire_equipment_deleted_at_93f53722 ON public.fms_fire_equipment USING btree (deleted_at);

CREATE INDEX idx_fms_fire_equipment_department_id ON public.fms_fire_equipment USING btree (department_id);

CREATE INDEX idx_fms_fire_equipment_location_id ON public.fms_fire_equipment USING btree (location_id);

CREATE INDEX idx_fms_fire_equipment_tenant ON public.fms_fire_equipment USING btree (tenant_id);

CREATE INDEX idx_fms_fire_equipment_type ON public.fms_fire_equipment USING btree (tenant_id, equipment_type);

ALTER TABLE public.fms_fire_equipment ENABLE ROW LEVEL SECURITY;

-- Name: fms_fire_equipment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_equipment USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_fire_equipment trg_fms_fire_equipment_soft_delete_93f53722; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_equipment_soft_delete_93f53722 BEFORE DELETE ON public.fms_fire_equipment FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_fire_equipment trg_fms_fire_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_equipment_updated_at BEFORE UPDATE ON public.fms_fire_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_fire_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    equipment_id uuid NOT NULL,
    inspection_date date NOT NULL,
    is_functional boolean DEFAULT true NOT NULL,
    findings text,
    corrective_action text,
    inspected_by uuid,
    next_inspection_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_fire_inspections fms_fire_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_fire_inspections_deleted_at_04186253 ON public.fms_fire_inspections USING btree (deleted_at);

CREATE INDEX idx_fms_fire_inspections_equipment ON public.fms_fire_inspections USING btree (tenant_id, equipment_id);

CREATE INDEX idx_fms_fire_inspections_tenant ON public.fms_fire_inspections USING btree (tenant_id);

ALTER TABLE public.fms_fire_inspections ENABLE ROW LEVEL SECURITY;

-- Name: fms_fire_inspections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_inspections USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_fire_inspections trg_fms_fire_inspections_soft_delete_04186253; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_inspections_soft_delete_04186253 BEFORE DELETE ON public.fms_fire_inspections FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_fire_inspections trg_fms_fire_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_inspections_updated_at BEFORE UPDATE ON public.fms_fire_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_fire_noc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    facility_id uuid,
    noc_number text NOT NULL,
    issuing_authority text,
    issue_date date,
    valid_from date,
    valid_to date,
    renewal_alert_days integer DEFAULT 90 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    document_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_fire_noc fms_fire_noc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_pkey PRIMARY KEY (id);

-- Name: fms_fire_noc fms_fire_noc_tenant_id_facility_id_noc_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_tenant_id_facility_id_noc_number_key UNIQUE (tenant_id, facility_id, noc_number);

CREATE INDEX idx_fms_fire_noc_deleted_at_02b546dc ON public.fms_fire_noc USING btree (deleted_at);

CREATE INDEX idx_fms_fire_noc_tenant ON public.fms_fire_noc USING btree (tenant_id);

ALTER TABLE public.fms_fire_noc ENABLE ROW LEVEL SECURITY;

-- Name: fms_fire_noc tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_noc USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_fire_noc trg_fms_fire_noc_soft_delete_02b546dc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_noc_soft_delete_02b546dc BEFORE DELETE ON public.fms_fire_noc FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_fire_noc trg_fms_fire_noc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_noc_updated_at BEFORE UPDATE ON public.fms_fire_noc FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_gas_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    facility_id uuid,
    gas_type public.fms_gas_type NOT NULL,
    peso_license_number text,
    peso_valid_from date,
    peso_valid_to date,
    drug_license_number text,
    drug_license_valid_to date,
    last_inspection_date date,
    next_inspection_date date,
    inspector_name text,
    compliance_status text DEFAULT 'compliant'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_gas_compliance fms_gas_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_pkey PRIMARY KEY (id);

-- Name: fms_gas_compliance fms_gas_compliance_tenant_id_facility_id_gas_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_tenant_id_facility_id_gas_type_key UNIQUE (tenant_id, facility_id, gas_type);

CREATE INDEX idx_fms_gas_compliance_deleted_at_35bc7ccf ON public.fms_gas_compliance USING btree (deleted_at);

CREATE INDEX idx_fms_gas_compliance_tenant ON public.fms_gas_compliance USING btree (tenant_id);

ALTER TABLE public.fms_gas_compliance ENABLE ROW LEVEL SECURITY;

-- Name: fms_gas_compliance tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_gas_compliance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_gas_compliance trg_fms_gas_compliance_soft_delete_35bc7ccf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_compliance_soft_delete_35bc7ccf BEFORE DELETE ON public.fms_gas_compliance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_gas_compliance trg_fms_gas_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_compliance_updated_at BEFORE UPDATE ON public.fms_gas_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_gas_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    gas_type public.fms_gas_type NOT NULL,
    source_type public.fms_gas_source_type NOT NULL,
    location_id uuid,
    department_id uuid,
    purity_percent numeric(5,2),
    pressure_bar numeric(8,2),
    flow_lpm numeric(8,2),
    temperature_c numeric(5,1),
    tank_level_percent numeric(5,2),
    cylinder_count integer,
    manifold_side text,
    is_alarm boolean DEFAULT false NOT NULL,
    alarm_reason text,
    reading_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_gas_readings fms_gas_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_gas_readings_deleted_at_7fdea08e ON public.fms_gas_readings USING btree (deleted_at);

CREATE INDEX idx_fms_gas_readings_department_id ON public.fms_gas_readings USING btree (department_id);

CREATE INDEX idx_fms_gas_readings_gas_type ON public.fms_gas_readings USING btree (tenant_id, gas_type);

CREATE INDEX idx_fms_gas_readings_location_id ON public.fms_gas_readings USING btree (location_id);

CREATE INDEX idx_fms_gas_readings_reading_at ON public.fms_gas_readings USING btree (tenant_id, reading_at DESC);

CREATE INDEX idx_fms_gas_readings_tenant ON public.fms_gas_readings USING btree (tenant_id);

ALTER TABLE public.fms_gas_readings ENABLE ROW LEVEL SECURITY;

-- Name: fms_gas_readings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_gas_readings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_gas_readings trg_fms_gas_readings_soft_delete_7fdea08e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_readings_soft_delete_7fdea08e BEFORE DELETE ON public.fms_gas_readings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_gas_readings trg_fms_gas_readings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_readings_updated_at BEFORE UPDATE ON public.fms_gas_readings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_water_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    schedule_type text NOT NULL,
    frequency text NOT NULL,
    last_completed_date date,
    next_due_date date,
    assigned_to uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_water_schedules fms_water_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_schedules
    ADD CONSTRAINT fms_water_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_water_schedules_deleted_at_7a1e1dd6 ON public.fms_water_schedules USING btree (deleted_at);

CREATE INDEX idx_fms_water_schedules_location_id ON public.fms_water_schedules USING btree (location_id);

CREATE INDEX idx_fms_water_schedules_tenant ON public.fms_water_schedules USING btree (tenant_id);

ALTER TABLE public.fms_water_schedules ENABLE ROW LEVEL SECURITY;

-- Name: fms_water_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_water_schedules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_water_schedules trg_fms_water_schedules_soft_delete_7a1e1dd6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_schedules_soft_delete_7a1e1dd6 BEFORE DELETE ON public.fms_water_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_water_schedules trg_fms_water_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_schedules_updated_at BEFORE UPDATE ON public.fms_water_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_water_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type public.fms_water_source_type NOT NULL,
    test_type public.fms_water_test_type NOT NULL,
    location_id uuid,
    sample_date date NOT NULL,
    result_date date,
    parameter_name text NOT NULL,
    result_value numeric(12,4),
    unit text,
    acceptable_min numeric(12,4),
    acceptable_max numeric(12,4),
    is_within_limits boolean,
    corrective_action text,
    tested_by text,
    lab_name text,
    certificate_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_water_tests fms_water_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_tests
    ADD CONSTRAINT fms_water_tests_pkey PRIMARY KEY (id);

CREATE INDEX idx_fms_water_tests_date ON public.fms_water_tests USING btree (tenant_id, sample_date DESC);

CREATE INDEX idx_fms_water_tests_deleted_at_d85ba468 ON public.fms_water_tests USING btree (deleted_at);

CREATE INDEX idx_fms_water_tests_location_id ON public.fms_water_tests USING btree (location_id);

CREATE INDEX idx_fms_water_tests_source ON public.fms_water_tests USING btree (tenant_id, source_type);

CREATE INDEX idx_fms_water_tests_tenant ON public.fms_water_tests USING btree (tenant_id);

ALTER TABLE public.fms_water_tests ENABLE ROW LEVEL SECURITY;

-- Name: fms_water_tests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_water_tests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_water_tests trg_fms_water_tests_soft_delete_d85ba468; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_tests_soft_delete_d85ba468 BEFORE DELETE ON public.fms_water_tests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_water_tests trg_fms_water_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_tests_updated_at BEFORE UPDATE ON public.fms_water_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fms_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    work_order_number text NOT NULL,
    category text,
    location_id uuid,
    department_id uuid,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    status public.fms_work_order_status DEFAULT 'open'::public.fms_work_order_status NOT NULL,
    description text NOT NULL,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    findings text,
    actions_taken text,
    vendor_id uuid,
    vendor_report text,
    vendor_cost numeric(14,2),
    material_cost numeric(14,2),
    labor_cost numeric(14,2),
    total_cost numeric(14,2),
    completed_by uuid,
    sign_off_by uuid,
    sign_off_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: fms_work_orders fms_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_pkey PRIMARY KEY (id);

-- Name: fms_work_orders fms_work_orders_tenant_id_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_tenant_id_work_order_number_key UNIQUE (tenant_id, work_order_number);

CREATE INDEX idx_fms_work_orders_deleted_at_bb4e6e00 ON public.fms_work_orders USING btree (deleted_at);

CREATE INDEX idx_fms_work_orders_department_id ON public.fms_work_orders USING btree (department_id);

CREATE INDEX idx_fms_work_orders_location_id ON public.fms_work_orders USING btree (location_id);

CREATE INDEX idx_fms_work_orders_priority ON public.fms_work_orders USING btree (tenant_id, priority);

CREATE INDEX idx_fms_work_orders_status ON public.fms_work_orders USING btree (tenant_id, status);

CREATE INDEX idx_fms_work_orders_tenant ON public.fms_work_orders USING btree (tenant_id);

ALTER TABLE public.fms_work_orders ENABLE ROW LEVEL SECURITY;

-- Name: fms_work_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_work_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: fms_work_orders trg_fms_work_orders_soft_delete_bb4e6e00; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_work_orders_soft_delete_bb4e6e00 BEFORE DELETE ON public.fms_work_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: fms_work_orders trg_fms_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_work_orders_updated_at BEFORE UPDATE ON public.fms_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.laundry_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    batch_number text NOT NULL,
    items_count integer DEFAULT 0 NOT NULL,
    total_weight numeric(8,2),
    contamination_type public.linen_contamination_type DEFAULT 'regular'::public.linen_contamination_type NOT NULL,
    wash_formula text,
    wash_temperature integer,
    cycle_minutes integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    operator_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: laundry_batches laundry_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laundry_batches
    ADD CONSTRAINT laundry_batches_pkey PRIMARY KEY (id);

CREATE INDEX idx_laundry_batches_deleted_at_136e4b31 ON public.laundry_batches USING btree (deleted_at);

CREATE INDEX idx_laundry_batches_tenant ON public.laundry_batches USING btree (tenant_id);

ALTER TABLE public.laundry_batches ENABLE ROW LEVEL SECURITY;

-- Name: laundry_batches tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.laundry_batches USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: laundry_batches set_laundry_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_laundry_batches_updated_at BEFORE UPDATE ON public.laundry_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: laundry_batches trg_laundry_batches_soft_delete_136e4b31; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_laundry_batches_soft_delete_136e4b31 BEFORE DELETE ON public.laundry_batches FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.linen_condemnations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    linen_item_id uuid,
    reason text NOT NULL,
    wash_count_at_condemn integer,
    condemned_by uuid,
    condemned_date date DEFAULT CURRENT_DATE NOT NULL,
    replacement_requested boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: linen_condemnations linen_condemnations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_pkey PRIMARY KEY (id);

CREATE INDEX idx_linen_condemnations_deleted_at_3b3009cb ON public.linen_condemnations USING btree (deleted_at);

CREATE INDEX idx_linen_condemnations_tenant ON public.linen_condemnations USING btree (tenant_id);

ALTER TABLE public.linen_condemnations ENABLE ROW LEVEL SECURITY;

-- Name: linen_condemnations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_condemnations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: linen_condemnations set_linen_condemnations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_condemnations_updated_at BEFORE UPDATE ON public.linen_condemnations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: linen_condemnations trg_linen_condemnations_soft_delete_3b3009cb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_linen_condemnations_soft_delete_3b3009cb BEFORE DELETE ON public.linen_condemnations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.linen_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    barcode text,
    item_type text NOT NULL,
    current_status public.linen_status DEFAULT 'clean'::public.linen_status NOT NULL,
    ward_id uuid,
    wash_count integer DEFAULT 0 NOT NULL,
    max_washes integer DEFAULT 150 NOT NULL,
    commissioned_date date,
    condemned_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: linen_items linen_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT linen_items_pkey PRIMARY KEY (id);

-- Name: linen_items uq_linen_barcode; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT uq_linen_barcode UNIQUE (tenant_id, barcode);

CREATE INDEX idx_linen_items_deleted_at_2783cc7c ON public.linen_items USING btree (deleted_at);

CREATE INDEX idx_linen_items_status ON public.linen_items USING btree (tenant_id, current_status);

CREATE INDEX idx_linen_items_tenant ON public.linen_items USING btree (tenant_id);

CREATE INDEX idx_linen_items_ward_id ON public.linen_items USING btree (ward_id);

ALTER TABLE public.linen_items ENABLE ROW LEVEL SECURITY;

-- Name: linen_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: linen_items set_linen_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_items_updated_at BEFORE UPDATE ON public.linen_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: linen_items trg_linen_items_soft_delete_2783cc7c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_linen_items_soft_delete_2783cc7c BEFORE DELETE ON public.linen_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.linen_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    linen_item_id uuid,
    movement_type text NOT NULL,
    from_ward uuid,
    to_ward uuid,
    quantity integer DEFAULT 1 NOT NULL,
    weight_kg numeric(8,2),
    contamination_type public.linen_contamination_type DEFAULT 'regular'::public.linen_contamination_type NOT NULL,
    batch_id uuid,
    recorded_by text,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: linen_movements linen_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_pkey PRIMARY KEY (id);

CREATE INDEX idx_linen_movements_deleted_at_0e6711aa ON public.linen_movements USING btree (deleted_at);

CREATE INDEX idx_linen_movements_tenant ON public.linen_movements USING btree (tenant_id);

ALTER TABLE public.linen_movements ENABLE ROW LEVEL SECURITY;

-- Name: linen_movements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: linen_movements set_linen_movements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_movements_updated_at BEFORE UPDATE ON public.linen_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: linen_movements trg_linen_movements_soft_delete_0e6711aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_linen_movements_soft_delete_0e6711aa BEFORE DELETE ON public.linen_movements FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.linen_par_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ward_id uuid,
    item_type text NOT NULL,
    par_level integer DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: linen_par_levels linen_par_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT linen_par_levels_pkey PRIMARY KEY (id);

-- Name: linen_par_levels uq_linen_par; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT uq_linen_par UNIQUE (tenant_id, ward_id, item_type);

CREATE INDEX idx_linen_par_levels_deleted_at_a5a3bd81 ON public.linen_par_levels USING btree (deleted_at);

CREATE INDEX idx_linen_par_levels_tenant ON public.linen_par_levels USING btree (tenant_id);

CREATE INDEX idx_linen_par_levels_ward_id ON public.linen_par_levels USING btree (ward_id);

ALTER TABLE public.linen_par_levels ENABLE ROW LEVEL SECURITY;

-- Name: linen_par_levels tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_par_levels USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: linen_par_levels set_linen_par_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_par_levels_updated_at BEFORE UPDATE ON public.linen_par_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: linen_par_levels trg_linen_par_levels_soft_delete_a5a3bd81; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_linen_par_levels_soft_delete_a5a3bd81 BEFORE DELETE ON public.linen_par_levels FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pest_control_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_id uuid,
    treatment_date date NOT NULL,
    treatment_type text NOT NULL,
    chemicals_used text,
    areas_treated jsonb DEFAULT '[]'::jsonb NOT NULL,
    vendor_name text,
    certificate_no text,
    next_due date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pest_control_logs pest_control_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_logs
    ADD CONSTRAINT pest_control_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_pest_control_logs_deleted_at_68247c12 ON public.pest_control_logs USING btree (deleted_at);

CREATE INDEX idx_pest_control_logs_tenant ON public.pest_control_logs USING btree (tenant_id);

ALTER TABLE public.pest_control_logs ENABLE ROW LEVEL SECURITY;

-- Name: pest_control_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pest_control_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pest_control_logs set_pest_control_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_pest_control_logs_updated_at BEFORE UPDATE ON public.pest_control_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: pest_control_logs trg_pest_control_logs_soft_delete_68247c12; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pest_control_logs_soft_delete_68247c12 BEFORE DELETE ON public.pest_control_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.pest_control_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    department_id uuid,
    pest_type text NOT NULL,
    frequency_months integer DEFAULT 3 NOT NULL,
    last_done date,
    next_due date,
    vendor_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: pest_control_schedules pest_control_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_schedules
    ADD CONSTRAINT pest_control_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_pest_control_schedules_deleted_at_5b383919 ON public.pest_control_schedules USING btree (deleted_at);

CREATE INDEX idx_pest_control_schedules_department_id ON public.pest_control_schedules USING btree (department_id);

CREATE INDEX idx_pest_control_schedules_location_id ON public.pest_control_schedules USING btree (location_id);

CREATE INDEX idx_pest_control_schedules_tenant ON public.pest_control_schedules USING btree (tenant_id);

ALTER TABLE public.pest_control_schedules ENABLE ROW LEVEL SECURITY;

-- Name: pest_control_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pest_control_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: pest_control_schedules set_pest_control_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_pest_control_schedules_updated_at BEFORE UPDATE ON public.pest_control_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: pest_control_schedules trg_pest_control_schedules_soft_delete_5b383919; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pest_control_schedules_soft_delete_5b383919 BEFORE DELETE ON public.pest_control_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.security_access_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    card_number text NOT NULL,
    card_type text DEFAULT 'standard'::text,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    allowed_zones jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    deactivated_at timestamp with time zone,
    deactivation_reason text,
    issued_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_access_cards security_access_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_pkey PRIMARY KEY (id);

-- Name: security_access_cards security_access_cards_tenant_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_tenant_id_card_number_key UNIQUE (tenant_id, card_number);

CREATE INDEX idx_security_access_cards_deleted_at_c1d02e78 ON public.security_access_cards USING btree (deleted_at);

CREATE INDEX idx_security_access_cards_employee ON public.security_access_cards USING btree (employee_id);

CREATE INDEX idx_security_access_cards_tenant ON public.security_access_cards USING btree (tenant_id);

ALTER TABLE public.security_access_cards ENABLE ROW LEVEL SECURITY;

-- Name: security_access_cards security_access_cards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_access_cards_tenant ON public.security_access_cards USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_access_cards trg_security_access_cards_soft_delete_c1d02e78; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_cards_soft_delete_c1d02e78 BEFORE DELETE ON public.security_access_cards FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_access_cards trg_security_access_cards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_cards_updated_at BEFORE UPDATE ON public.security_access_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    employee_id uuid,
    person_name text,
    access_method public.sec_access_method DEFAULT 'manual'::public.sec_access_method NOT NULL,
    card_number text,
    direction text DEFAULT 'entry'::text NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    denied_reason text,
    is_after_hours boolean DEFAULT false NOT NULL,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    device_id text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_access_logs security_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_security_access_logs_accessed ON public.security_access_logs USING btree (accessed_at DESC);

CREATE INDEX idx_security_access_logs_deleted_at_fe0d1acb ON public.security_access_logs USING btree (deleted_at);

CREATE INDEX idx_security_access_logs_employee ON public.security_access_logs USING btree (employee_id);

CREATE INDEX idx_security_access_logs_tenant ON public.security_access_logs USING btree (tenant_id);

CREATE INDEX idx_security_access_logs_zone ON public.security_access_logs USING btree (zone_id);

ALTER TABLE public.security_access_logs ENABLE ROW LEVEL SECURITY;

-- Name: security_access_logs security_access_logs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_access_logs_tenant ON public.security_access_logs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_access_logs trg_security_access_logs_soft_delete_fe0d1acb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_logs_soft_delete_fe0d1acb BEFORE DELETE ON public.security_access_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_access_logs trg_security_access_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_logs_updated_at BEFORE UPDATE ON public.security_access_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_cameras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    camera_id text,
    zone_id uuid,
    location_description text,
    camera_type text DEFAULT 'dome'::text,
    resolution text,
    is_recording boolean DEFAULT true NOT NULL,
    retention_days integer DEFAULT 30 NOT NULL,
    ip_address text,
    is_active boolean DEFAULT true NOT NULL,
    last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_cameras security_cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_cameras
    ADD CONSTRAINT security_cameras_pkey PRIMARY KEY (id);

CREATE INDEX idx_security_cameras_deleted_at_dfda3b64 ON public.security_cameras USING btree (deleted_at);

CREATE INDEX idx_security_cameras_tenant ON public.security_cameras USING btree (tenant_id);

CREATE INDEX idx_security_cameras_zone ON public.security_cameras USING btree (zone_id);

ALTER TABLE public.security_cameras ENABLE ROW LEVEL SECURITY;

-- Name: security_cameras security_cameras_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_cameras_tenant ON public.security_cameras USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_cameras trg_security_cameras_soft_delete_dfda3b64; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_cameras_soft_delete_dfda3b64 BEFORE DELETE ON public.security_cameras FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_cameras trg_security_cameras_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_cameras_updated_at BEFORE UPDATE ON public.security_cameras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_code_debriefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code_activation_id uuid NOT NULL,
    debrief_date date DEFAULT CURRENT_DATE NOT NULL,
    facilitator_id uuid,
    attendees jsonb DEFAULT '[]'::jsonb,
    response_time_seconds integer,
    total_duration_minutes integer,
    what_went_well text,
    what_went_wrong text,
    root_cause text,
    lessons_learned text,
    action_items jsonb DEFAULT '[]'::jsonb,
    equipment_issues text,
    training_gaps text,
    protocol_changes_recommended text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_code_debriefs security_code_debriefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_code_debriefs
    ADD CONSTRAINT security_code_debriefs_pkey PRIMARY KEY (id);

CREATE INDEX idx_security_code_debriefs_code ON public.security_code_debriefs USING btree (code_activation_id);

CREATE INDEX idx_security_code_debriefs_deleted_at_11051007 ON public.security_code_debriefs USING btree (deleted_at);

CREATE INDEX idx_security_code_debriefs_tenant ON public.security_code_debriefs USING btree (tenant_id);

ALTER TABLE public.security_code_debriefs ENABLE ROW LEVEL SECURITY;

-- Name: security_code_debriefs security_code_debriefs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_code_debriefs_tenant ON public.security_code_debriefs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_code_debriefs trg_security_code_debriefs_soft_delete_11051007; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_code_debriefs_soft_delete_11051007 BEFORE DELETE ON public.security_code_debriefs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_code_debriefs trg_security_code_debriefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_code_debriefs_updated_at BEFORE UPDATE ON public.security_code_debriefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL,
    severity public.sec_incident_severity DEFAULT 'medium'::public.sec_incident_severity NOT NULL,
    status public.sec_incident_status DEFAULT 'reported'::public.sec_incident_status NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    zone_id uuid,
    location_description text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    description text NOT NULL,
    persons_involved jsonb DEFAULT '[]'::jsonb,
    witnesses jsonb DEFAULT '[]'::jsonb,
    camera_ids jsonb DEFAULT '[]'::jsonb,
    video_timestamp_start text,
    video_timestamp_end text,
    police_notified boolean DEFAULT false NOT NULL,
    police_report_number text,
    investigation_notes text,
    resolution text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    reported_by uuid,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cert_in_reported boolean DEFAULT false NOT NULL,
    cert_in_report_date timestamp with time zone,
    cert_in_reference text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);

-- Name: security_incidents security_incidents_tenant_id_incident_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_tenant_id_incident_number_key UNIQUE (tenant_id, incident_number);

CREATE INDEX idx_security_incidents_deleted_at_6e1f5b0d ON public.security_incidents USING btree (deleted_at);

CREATE INDEX idx_security_incidents_occurred ON public.security_incidents USING btree (occurred_at DESC);

CREATE INDEX idx_security_incidents_severity ON public.security_incidents USING btree (severity);

CREATE INDEX idx_security_incidents_status ON public.security_incidents USING btree (status);

CREATE INDEX idx_security_incidents_tenant ON public.security_incidents USING btree (tenant_id);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Name: security_incidents security_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_incidents_tenant ON public.security_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_incidents trg_security_incidents_soft_delete_6e1f5b0d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_incidents_soft_delete_6e1f5b0d BEFORE DELETE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_incidents trg_security_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_incidents_updated_at BEFORE UPDATE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_patient_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    tag_type public.sec_patient_tag_type NOT NULL,
    tag_identifier text,
    allowed_zone_id uuid,
    alert_status public.sec_tag_alert_status DEFAULT 'active'::public.sec_tag_alert_status NOT NULL,
    mother_id uuid,
    admission_id uuid,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    activated_by uuid,
    deactivated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_patient_tags security_patient_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_pkey PRIMARY KEY (id);

CREATE INDEX idx_security_patient_tags_deleted_at_ccdd0e71 ON public.security_patient_tags USING btree (deleted_at);

CREATE INDEX idx_security_patient_tags_patient ON public.security_patient_tags USING btree (patient_id);

CREATE INDEX idx_security_patient_tags_status ON public.security_patient_tags USING btree (alert_status);

CREATE INDEX idx_security_patient_tags_tenant ON public.security_patient_tags USING btree (tenant_id);

ALTER TABLE public.security_patient_tags ENABLE ROW LEVEL SECURITY;

-- Name: security_patient_tags security_patient_tags_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_patient_tags_tenant ON public.security_patient_tags USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_patient_tags trg_security_patient_tags_soft_delete_ccdd0e71; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_patient_tags_soft_delete_ccdd0e71 BEFORE DELETE ON public.security_patient_tags FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_patient_tags trg_security_patient_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_patient_tags_updated_at BEFORE UPDATE ON public.security_patient_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_tag_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    alert_type text DEFAULT 'zone_breach'::text NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid,
    location_description text,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    was_false_alarm boolean DEFAULT false NOT NULL,
    resolution_notes text,
    code_activation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_tag_alerts security_tag_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_security_tag_alerts_deleted_at_8a4b80ab ON public.security_tag_alerts USING btree (deleted_at);

CREATE INDEX idx_security_tag_alerts_resolved ON public.security_tag_alerts USING btree (is_resolved);

CREATE INDEX idx_security_tag_alerts_tag ON public.security_tag_alerts USING btree (tag_id);

CREATE INDEX idx_security_tag_alerts_tenant ON public.security_tag_alerts USING btree (tenant_id);

ALTER TABLE public.security_tag_alerts ENABLE ROW LEVEL SECURITY;

-- Name: security_tag_alerts security_tag_alerts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_tag_alerts_tenant ON public.security_tag_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_tag_alerts trg_security_tag_alerts_soft_delete_8a4b80ab; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_tag_alerts_soft_delete_8a4b80ab BEFORE DELETE ON public.security_tag_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_tag_alerts trg_security_tag_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_tag_alerts_updated_at BEFORE UPDATE ON public.security_tag_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.security_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    zone_code text NOT NULL,
    level public.sec_zone_level DEFAULT 'general'::public.sec_zone_level NOT NULL,
    department_id uuid,
    description text,
    allowed_methods jsonb DEFAULT '["card", "biometric", "pin", "manual"]'::jsonb,
    after_hours_restricted boolean DEFAULT false NOT NULL,
    after_hours_start text,
    after_hours_end text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: security_zones security_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_pkey PRIMARY KEY (id);

-- Name: security_zones security_zones_tenant_id_zone_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_tenant_id_zone_code_key UNIQUE (tenant_id, zone_code);

CREATE INDEX idx_security_zones_deleted_at_f20cc2ea ON public.security_zones USING btree (deleted_at);

CREATE INDEX idx_security_zones_department_id ON public.security_zones USING btree (department_id);

CREATE INDEX idx_security_zones_tenant ON public.security_zones USING btree (tenant_id);

ALTER TABLE public.security_zones ENABLE ROW LEVEL SECURITY;

-- Name: security_zones security_zones_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_zones_tenant ON public.security_zones USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: security_zones trg_security_zones_soft_delete_f20cc2ea; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_zones_soft_delete_f20cc2ea BEFORE DELETE ON public.security_zones FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: security_zones trg_security_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_zones_updated_at BEFORE UPDATE ON public.security_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    work_order_number text,
    equipment_id uuid,
    category text,
    priority text,
    status text DEFAULT 'open'::text NOT NULL,
    description text NOT NULL,
    requested_by uuid,
    assigned_to uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cost numeric(14,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    location_id uuid,
    work_order_date date,
    work_type text,
    estimated_hours double precision,
    estimated_cost double precision,
    materials_required jsonb,
    assigned_team text,
    scheduled_date date,
    completion_date date,
    actual_hours double precision,
    actual_cost double precision,
    work_done text,
    verified_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_work_orders_deleted_at_1f5eeb6c ON public.work_orders USING btree (deleted_at);

CREATE INDEX idx_work_orders_status ON public.work_orders USING btree (tenant_id, status);

ALTER TABLE ONLY public.work_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- Name: work_orders tenant_isolation_work_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_work_orders ON public.work_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: work_orders trg_work_orders_soft_delete_1f5eeb6c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_work_orders_soft_delete_1f5eeb6c BEFORE DELETE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: bme_breakdowns bme_breakdowns_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);

-- Name: bme_calibrations bme_calibrations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);

-- Name: bme_contracts bme_contracts_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);

-- Name: bme_contracts bme_contracts_renewed_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_renewed_contract_id_fkey FOREIGN KEY (renewed_contract_id) REFERENCES public.bme_contracts(id);

-- Name: bme_equipment bme_equipment_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);

-- Name: bme_pm_schedules bme_pm_schedules_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);

-- Name: bme_vendor_evaluations bme_vendor_evaluations_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.bme_contracts(id);

-- Name: bme_work_orders bme_work_orders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);

-- Name: bme_work_orders bme_work_orders_pm_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_pm_schedule_id_fkey FOREIGN KEY (pm_schedule_id) REFERENCES public.bme_pm_schedules(id);

-- Name: calibrations calibrations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;

-- Name: cleaning_tasks cleaning_tasks_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.cleaning_schedules(id);

-- Name: facilities facilities_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.facilities(id);

-- Name: bme_work_orders fk_bme_work_orders_breakdown; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT fk_bme_work_orders_breakdown FOREIGN KEY (breakdown_id) REFERENCES public.bme_breakdowns(id);

-- Name: fms_fire_drills fms_fire_drills_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);

-- Name: fms_fire_inspections fms_fire_inspections_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.fms_fire_equipment(id);

-- Name: fms_fire_noc fms_fire_noc_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);

-- Name: fms_gas_compliance fms_gas_compliance_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);

-- Name: linen_condemnations linen_condemnations_linen_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_linen_item_id_fkey FOREIGN KEY (linen_item_id) REFERENCES public.linen_items(id);

-- Name: linen_movements linen_movements_linen_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_linen_item_id_fkey FOREIGN KEY (linen_item_id) REFERENCES public.linen_items(id);

-- Name: pest_control_logs pest_control_logs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_logs
    ADD CONSTRAINT pest_control_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.pest_control_schedules(id);

-- Name: security_access_logs security_access_logs_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);

-- Name: security_cameras security_cameras_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_cameras
    ADD CONSTRAINT security_cameras_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);

-- Name: security_incidents security_incidents_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);

-- Name: security_patient_tags security_patient_tags_allowed_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_allowed_zone_id_fkey FOREIGN KEY (allowed_zone_id) REFERENCES public.security_zones(id);

-- Name: security_tag_alerts security_tag_alerts_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.security_patient_tags(id);

-- Name: security_tag_alerts security_tag_alerts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);

-- Name: work_orders work_orders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);
