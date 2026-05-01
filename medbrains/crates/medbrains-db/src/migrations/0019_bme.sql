-- ============================================================
-- MedBrains schema — module: bme
-- ============================================================

--
-- Name: bme_breakdowns; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bme_calibrations; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bme_contracts; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bme_equipment; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bme_pm_schedules; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bme_vendor_evaluations; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT bme_vendor_evaluations_professionalism_score_check CHECK (((professionalism_score >= 1) AND (professionalism_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_resolution_quality_score_check CHECK (((resolution_quality_score >= 1) AND (resolution_quality_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_response_time_score_check CHECK (((response_time_score >= 1) AND (response_time_score <= 5))),
    CONSTRAINT bme_vendor_evaluations_spare_parts_availability_score_check CHECK (((spare_parts_availability_score >= 1) AND (spare_parts_availability_score <= 5)))
);



--
-- Name: bme_work_orders; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: calibrations; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.calibrations FORCE ROW LEVEL SECURITY;



--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.equipment FORCE ROW LEVEL SECURITY;



--
-- Name: equipment_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    checklist_template_id uuid,
    checked_by uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    all_passed boolean NOT NULL,
    next_check_due_at timestamp with time zone
);

ALTER TABLE ONLY public.equipment_checks FORCE ROW LEVEL SECURITY;



--
-- Name: bme_breakdowns bme_breakdowns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_pkey PRIMARY KEY (id);



--
-- Name: bme_calibrations bme_calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_pkey PRIMARY KEY (id);



--
-- Name: bme_contracts bme_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_pkey PRIMARY KEY (id);



--
-- Name: bme_contracts bme_contracts_tenant_id_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_tenant_id_contract_number_key UNIQUE (tenant_id, contract_number);



--
-- Name: bme_equipment bme_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_pkey PRIMARY KEY (id);



--
-- Name: bme_equipment bme_equipment_tenant_id_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_equipment
    ADD CONSTRAINT bme_equipment_tenant_id_asset_tag_key UNIQUE (tenant_id, asset_tag);



--
-- Name: bme_pm_schedules bme_pm_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_pkey PRIMARY KEY (id);



--
-- Name: bme_vendor_evaluations bme_vendor_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_pkey PRIMARY KEY (id);



--
-- Name: bme_work_orders bme_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_pkey PRIMARY KEY (id);



--
-- Name: bme_work_orders bme_work_orders_tenant_id_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_tenant_id_work_order_number_key UNIQUE (tenant_id, work_order_number);



--
-- Name: calibrations calibrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_pkey PRIMARY KEY (id);



--
-- Name: equipment_checks equipment_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_checks
    ADD CONSTRAINT equipment_checks_pkey PRIMARY KEY (id);



--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);



--
-- Name: equipment_checks_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX equipment_checks_due_idx ON public.equipment_checks USING btree (tenant_id, next_check_due_at) WHERE (next_check_due_at IS NOT NULL);



--
-- Name: idx_bme_breakdowns_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_breakdowns_equip ON public.bme_breakdowns USING btree (tenant_id, equipment_id);



--
-- Name: idx_bme_breakdowns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_breakdowns_status ON public.bme_breakdowns USING btree (tenant_id, status);



--
-- Name: idx_bme_breakdowns_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_breakdowns_tenant ON public.bme_breakdowns USING btree (tenant_id);



--
-- Name: idx_bme_calibrations_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_calibrations_due ON public.bme_calibrations USING btree (tenant_id, next_due_date);



--
-- Name: idx_bme_calibrations_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_calibrations_equip ON public.bme_calibrations USING btree (tenant_id, equipment_id);



--
-- Name: idx_bme_calibrations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_calibrations_tenant ON public.bme_calibrations USING btree (tenant_id);



--
-- Name: idx_bme_contracts_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_contracts_end ON public.bme_contracts USING btree (tenant_id, end_date);



--
-- Name: idx_bme_contracts_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_contracts_equip ON public.bme_contracts USING btree (tenant_id, equipment_id);



--
-- Name: idx_bme_contracts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_contracts_tenant ON public.bme_contracts USING btree (tenant_id);



--
-- Name: idx_bme_equipment_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_equipment_dept ON public.bme_equipment USING btree (tenant_id, department_id);



--
-- Name: idx_bme_equipment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_equipment_status ON public.bme_equipment USING btree (tenant_id, status);



--
-- Name: idx_bme_equipment_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_equipment_tenant ON public.bme_equipment USING btree (tenant_id);



--
-- Name: idx_bme_pm_schedules_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_pm_schedules_due ON public.bme_pm_schedules USING btree (tenant_id, next_due_date);



--
-- Name: idx_bme_pm_schedules_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_pm_schedules_equip ON public.bme_pm_schedules USING btree (tenant_id, equipment_id);



--
-- Name: idx_bme_pm_schedules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_pm_schedules_tenant ON public.bme_pm_schedules USING btree (tenant_id);



--
-- Name: idx_bme_vendor_evaluations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_vendor_evaluations_tenant ON public.bme_vendor_evaluations USING btree (tenant_id);



--
-- Name: idx_bme_vendor_evaluations_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_vendor_evaluations_vendor ON public.bme_vendor_evaluations USING btree (tenant_id, vendor_id);



--
-- Name: idx_bme_work_orders_equip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_work_orders_equip ON public.bme_work_orders USING btree (tenant_id, equipment_id);



--
-- Name: idx_bme_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_work_orders_status ON public.bme_work_orders USING btree (tenant_id, status);



--
-- Name: idx_bme_work_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bme_work_orders_tenant ON public.bme_work_orders USING btree (tenant_id);



--
-- Name: idx_calibrations_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calibrations_equipment ON public.calibrations USING btree (tenant_id, equipment_id, calibration_date DESC);



--
-- Name: bme_breakdowns trg_bme_breakdowns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_breakdowns_updated_at BEFORE UPDATE ON public.bme_breakdowns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_calibrations trg_bme_calibrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_calibrations_updated_at BEFORE UPDATE ON public.bme_calibrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_contracts trg_bme_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_contracts_updated_at BEFORE UPDATE ON public.bme_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_equipment trg_bme_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_equipment_updated_at BEFORE UPDATE ON public.bme_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_pm_schedules trg_bme_pm_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_pm_schedules_updated_at BEFORE UPDATE ON public.bme_pm_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_vendor_evaluations trg_bme_vendor_evaluations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_vendor_evaluations_updated_at BEFORE UPDATE ON public.bme_vendor_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_work_orders trg_bme_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bme_work_orders_updated_at BEFORE UPDATE ON public.bme_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bme_breakdowns bme_breakdowns_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_breakdowns
    ADD CONSTRAINT bme_breakdowns_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);



--
-- Name: bme_calibrations bme_calibrations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_calibrations
    ADD CONSTRAINT bme_calibrations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);



--
-- Name: bme_contracts bme_contracts_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);



--
-- Name: bme_contracts bme_contracts_renewed_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_contracts
    ADD CONSTRAINT bme_contracts_renewed_contract_id_fkey FOREIGN KEY (renewed_contract_id) REFERENCES public.bme_contracts(id);



--
-- Name: bme_pm_schedules bme_pm_schedules_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_pm_schedules
    ADD CONSTRAINT bme_pm_schedules_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);



--
-- Name: bme_vendor_evaluations bme_vendor_evaluations_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_vendor_evaluations
    ADD CONSTRAINT bme_vendor_evaluations_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.bme_contracts(id);



--
-- Name: bme_work_orders bme_work_orders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.bme_equipment(id);



--
-- Name: bme_work_orders bme_work_orders_pm_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT bme_work_orders_pm_schedule_id_fkey FOREIGN KEY (pm_schedule_id) REFERENCES public.bme_pm_schedules(id);



--
-- Name: calibrations calibrations_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calibrations
    ADD CONSTRAINT calibrations_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE CASCADE;



--
-- Name: bme_work_orders fk_bme_work_orders_breakdown; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bme_work_orders
    ADD CONSTRAINT fk_bme_work_orders_breakdown FOREIGN KEY (breakdown_id) REFERENCES public.bme_breakdowns(id);



--
-- Name: bme_breakdowns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_breakdowns ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_calibrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_calibrations ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_contracts ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_equipment ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_pm_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_pm_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_vendor_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_vendor_evaluations ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bme_work_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: calibrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;


--
-- Name: equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;


--
-- Name: equipment_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;


--
-- Name: bme_breakdowns tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_breakdowns USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_calibrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_calibrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_contracts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_contracts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_equipment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_equipment USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_pm_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_pm_schedules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_vendor_evaluations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_vendor_evaluations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bme_work_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bme_work_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: calibrations tenant_isolation_calibrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_calibrations ON public.calibrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: equipment tenant_isolation_equipment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_equipment ON public.equipment USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: equipment_checks tenant_isolation_equipment_checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_equipment_checks ON public.equipment_checks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


