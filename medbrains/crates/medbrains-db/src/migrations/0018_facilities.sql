-- ============================================================
-- MedBrains schema — module: facilities
-- ============================================================

--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT chk_facilities_bed_count_positive CHECK ((bed_count >= 0)),
    CONSTRAINT chk_facilities_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_facilities_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_facilities_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);



--
-- Name: fms_energy_readings; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_fire_drills; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_fire_equipment; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_fire_inspections; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_fire_noc; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_gas_compliance; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_gas_readings; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_water_schedules; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_water_tests; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: fms_work_orders; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.work_orders FORCE ROW LEVEL SECURITY;



--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);



--
-- Name: facilities facilities_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: fms_energy_readings fms_energy_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_energy_readings
    ADD CONSTRAINT fms_energy_readings_pkey PRIMARY KEY (id);



--
-- Name: fms_fire_drills fms_fire_drills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_pkey PRIMARY KEY (id);



--
-- Name: fms_fire_equipment fms_fire_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_equipment
    ADD CONSTRAINT fms_fire_equipment_pkey PRIMARY KEY (id);



--
-- Name: fms_fire_inspections fms_fire_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_pkey PRIMARY KEY (id);



--
-- Name: fms_fire_noc fms_fire_noc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_pkey PRIMARY KEY (id);



--
-- Name: fms_fire_noc fms_fire_noc_tenant_id_facility_id_noc_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_tenant_id_facility_id_noc_number_key UNIQUE (tenant_id, facility_id, noc_number);



--
-- Name: fms_gas_compliance fms_gas_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_pkey PRIMARY KEY (id);



--
-- Name: fms_gas_compliance fms_gas_compliance_tenant_id_facility_id_gas_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_tenant_id_facility_id_gas_type_key UNIQUE (tenant_id, facility_id, gas_type);



--
-- Name: fms_gas_readings fms_gas_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_readings
    ADD CONSTRAINT fms_gas_readings_pkey PRIMARY KEY (id);



--
-- Name: fms_water_schedules fms_water_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_schedules
    ADD CONSTRAINT fms_water_schedules_pkey PRIMARY KEY (id);



--
-- Name: fms_water_tests fms_water_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_water_tests
    ADD CONSTRAINT fms_water_tests_pkey PRIMARY KEY (id);



--
-- Name: fms_work_orders fms_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_pkey PRIMARY KEY (id);



--
-- Name: fms_work_orders fms_work_orders_tenant_id_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_work_orders
    ADD CONSTRAINT fms_work_orders_tenant_id_work_order_number_key UNIQUE (tenant_id, work_order_number);



--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);



--
-- Name: idx_facilities_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilities_parent ON public.facilities USING btree (parent_id);



--
-- Name: idx_facilities_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilities_tenant ON public.facilities USING btree (tenant_id);



--
-- Name: idx_facilities_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facilities_type ON public.facilities USING btree (tenant_id, facility_type);



--
-- Name: idx_fms_energy_readings_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_energy_readings_at ON public.fms_energy_readings USING btree (tenant_id, reading_at DESC);



--
-- Name: idx_fms_energy_readings_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_energy_readings_source ON public.fms_energy_readings USING btree (tenant_id, source_type);



--
-- Name: idx_fms_energy_readings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_energy_readings_tenant ON public.fms_energy_readings USING btree (tenant_id);



--
-- Name: idx_fms_fire_drills_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_drills_date ON public.fms_fire_drills USING btree (tenant_id, drill_date DESC);



--
-- Name: idx_fms_fire_drills_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_drills_tenant ON public.fms_fire_drills USING btree (tenant_id);



--
-- Name: idx_fms_fire_equipment_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_equipment_tenant ON public.fms_fire_equipment USING btree (tenant_id);



--
-- Name: idx_fms_fire_equipment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_equipment_type ON public.fms_fire_equipment USING btree (tenant_id, equipment_type);



--
-- Name: idx_fms_fire_inspections_equipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_inspections_equipment ON public.fms_fire_inspections USING btree (tenant_id, equipment_id);



--
-- Name: idx_fms_fire_inspections_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_inspections_tenant ON public.fms_fire_inspections USING btree (tenant_id);



--
-- Name: idx_fms_fire_noc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_fire_noc_tenant ON public.fms_fire_noc USING btree (tenant_id);



--
-- Name: idx_fms_gas_compliance_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_gas_compliance_tenant ON public.fms_gas_compliance USING btree (tenant_id);



--
-- Name: idx_fms_gas_readings_gas_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_gas_readings_gas_type ON public.fms_gas_readings USING btree (tenant_id, gas_type);



--
-- Name: idx_fms_gas_readings_reading_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_gas_readings_reading_at ON public.fms_gas_readings USING btree (tenant_id, reading_at DESC);



--
-- Name: idx_fms_gas_readings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_gas_readings_tenant ON public.fms_gas_readings USING btree (tenant_id);



--
-- Name: idx_fms_water_schedules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_water_schedules_tenant ON public.fms_water_schedules USING btree (tenant_id);



--
-- Name: idx_fms_water_tests_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_water_tests_date ON public.fms_water_tests USING btree (tenant_id, sample_date DESC);



--
-- Name: idx_fms_water_tests_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_water_tests_source ON public.fms_water_tests USING btree (tenant_id, source_type);



--
-- Name: idx_fms_water_tests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_water_tests_tenant ON public.fms_water_tests USING btree (tenant_id);



--
-- Name: idx_fms_work_orders_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_work_orders_priority ON public.fms_work_orders USING btree (tenant_id, priority);



--
-- Name: idx_fms_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_work_orders_status ON public.fms_work_orders USING btree (tenant_id, status);



--
-- Name: idx_fms_work_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fms_work_orders_tenant ON public.fms_work_orders USING btree (tenant_id);



--
-- Name: idx_work_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_orders_status ON public.work_orders USING btree (tenant_id, status);



--
-- Name: facilities trg_facilities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_energy_readings trg_fms_energy_readings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_energy_readings_updated_at BEFORE UPDATE ON public.fms_energy_readings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_fire_drills trg_fms_fire_drills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_drills_updated_at BEFORE UPDATE ON public.fms_fire_drills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_fire_equipment trg_fms_fire_equipment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_equipment_updated_at BEFORE UPDATE ON public.fms_fire_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_fire_inspections trg_fms_fire_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_inspections_updated_at BEFORE UPDATE ON public.fms_fire_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_fire_noc trg_fms_fire_noc_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_fire_noc_updated_at BEFORE UPDATE ON public.fms_fire_noc FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_gas_compliance trg_fms_gas_compliance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_compliance_updated_at BEFORE UPDATE ON public.fms_gas_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_gas_readings trg_fms_gas_readings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_gas_readings_updated_at BEFORE UPDATE ON public.fms_gas_readings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_water_schedules trg_fms_water_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_schedules_updated_at BEFORE UPDATE ON public.fms_water_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_water_tests trg_fms_water_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_water_tests_updated_at BEFORE UPDATE ON public.fms_water_tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: fms_work_orders trg_fms_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fms_work_orders_updated_at BEFORE UPDATE ON public.fms_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: facilities facilities_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.facilities(id);



--
-- Name: fms_fire_drills fms_fire_drills_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_drills
    ADD CONSTRAINT fms_fire_drills_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);



--
-- Name: fms_fire_inspections fms_fire_inspections_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_inspections
    ADD CONSTRAINT fms_fire_inspections_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.fms_fire_equipment(id);



--
-- Name: fms_fire_noc fms_fire_noc_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_fire_noc
    ADD CONSTRAINT fms_fire_noc_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);



--
-- Name: fms_gas_compliance fms_gas_compliance_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fms_gas_compliance
    ADD CONSTRAINT fms_gas_compliance_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);



--
-- Name: facilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_energy_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_energy_readings ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_fire_drills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_fire_drills ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_fire_equipment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_fire_equipment ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_fire_inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_fire_inspections ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_fire_noc; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_fire_noc ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_gas_compliance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_gas_compliance ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_gas_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_gas_readings ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_water_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_water_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_water_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_water_tests ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fms_work_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: fms_energy_readings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_energy_readings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_fire_drills tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_drills USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_fire_equipment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_equipment USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_fire_inspections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_inspections USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_fire_noc tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_fire_noc USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_gas_compliance tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_gas_compliance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_gas_readings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_gas_readings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_water_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_water_schedules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_water_tests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_water_tests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: fms_work_orders tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fms_work_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: facilities tenant_isolation_facilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_facilities ON public.facilities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: work_orders tenant_isolation_work_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_work_orders ON public.work_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

