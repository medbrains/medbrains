-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 20
-- Drops: none
-- emergency — schema.
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



CREATE TABLE public.ambulance_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    license_number text NOT NULL,
    license_type text NOT NULL,
    license_expiry date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    bls_certified boolean DEFAULT false NOT NULL,
    bls_expiry date,
    defensive_driving boolean DEFAULT false NOT NULL,
    shift_pattern text,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ambulance_drivers ambulance_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_pkey PRIMARY KEY (id);

-- Name: ambulance_drivers ambulance_drivers_tenant_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_tenant_id_employee_id_key UNIQUE (tenant_id, employee_id);

CREATE INDEX idx_amb_drivers_active ON public.ambulance_drivers USING btree (tenant_id, is_active);

CREATE INDEX idx_amb_drivers_tenant ON public.ambulance_drivers USING btree (tenant_id);

CREATE INDEX idx_ambulance_drivers_deleted_at_713aae0b ON public.ambulance_drivers USING btree (deleted_at);

ALTER TABLE public.ambulance_drivers ENABLE ROW LEVEL SECURITY;

-- Name: ambulance_drivers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_drivers USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ambulance_drivers trg_amb_drivers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_drivers_updated_at BEFORE UPDATE ON public.ambulance_drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ambulance_drivers trg_ambulance_drivers_soft_delete_713aae0b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulance_drivers_soft_delete_713aae0b BEFORE DELETE ON public.ambulance_drivers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.ambulance_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ambulance_id uuid NOT NULL,
    maintenance_type text NOT NULL,
    status public.ambulance_maintenance_status DEFAULT 'scheduled'::public.ambulance_maintenance_status NOT NULL,
    scheduled_date date NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    description text,
    vendor_name text,
    cost numeric(12,2) DEFAULT 0,
    odometer_at_service integer,
    next_service_km integer,
    next_service_date date,
    findings text,
    parts_replaced jsonb,
    performed_by text,
    approved_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ambulance_maintenance ambulance_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_pkey PRIMARY KEY (id);

CREATE INDEX idx_amb_maint_ambulance ON public.ambulance_maintenance USING btree (tenant_id, ambulance_id);

CREATE INDEX idx_amb_maint_date ON public.ambulance_maintenance USING btree (tenant_id, scheduled_date);

CREATE INDEX idx_amb_maint_status ON public.ambulance_maintenance USING btree (tenant_id, status);

CREATE INDEX idx_amb_maint_tenant ON public.ambulance_maintenance USING btree (tenant_id);

CREATE INDEX idx_ambulance_maintenance_deleted_at_42029805 ON public.ambulance_maintenance USING btree (deleted_at);

ALTER TABLE public.ambulance_maintenance ENABLE ROW LEVEL SECURITY;

-- Name: ambulance_maintenance tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_maintenance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ambulance_maintenance trg_amb_maint_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_maint_updated_at BEFORE UPDATE ON public.ambulance_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ambulance_maintenance trg_ambulance_maintenance_soft_delete_42029805; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulance_maintenance_soft_delete_42029805 BEFORE DELETE ON public.ambulance_maintenance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.ambulance_trip_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trip_id uuid NOT NULL,
    event_type text NOT NULL,
    latitude double precision,
    longitude double precision,
    speed_kmh numeric(6,1),
    heading numeric(5,1),
    event_data jsonb,
    recorded_by uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ambulance_trip_logs ambulance_trip_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_amb_logs_tenant ON public.ambulance_trip_logs USING btree (tenant_id);

CREATE INDEX idx_amb_logs_time ON public.ambulance_trip_logs USING btree (tenant_id, recorded_at DESC);

CREATE INDEX idx_amb_logs_trip ON public.ambulance_trip_logs USING btree (tenant_id, trip_id);

CREATE INDEX idx_ambulance_trip_logs_deleted_at_4001ac86 ON public.ambulance_trip_logs USING btree (deleted_at);

ALTER TABLE public.ambulance_trip_logs ENABLE ROW LEVEL SECURITY;

-- Name: ambulance_trip_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_trip_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ambulance_trip_logs trg_ambulance_trip_logs_soft_delete_4001ac86; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulance_trip_logs_soft_delete_4001ac86 BEFORE DELETE ON public.ambulance_trip_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.ambulance_trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trip_code text NOT NULL,
    ambulance_id uuid,
    driver_id uuid,
    trip_type public.ambulance_trip_type NOT NULL,
    status public.ambulance_trip_status DEFAULT 'requested'::public.ambulance_trip_status NOT NULL,
    priority public.ambulance_trip_priority DEFAULT 'routine'::public.ambulance_trip_priority NOT NULL,
    patient_id uuid,
    patient_name text,
    patient_phone text,
    pickup_address text NOT NULL,
    pickup_latitude double precision,
    pickup_longitude double precision,
    pickup_landmark text,
    drop_address text,
    drop_latitude double precision,
    drop_longitude double precision,
    drop_landmark text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone,
    pickup_arrived_at timestamp with time zone,
    patient_loaded_at timestamp with time zone,
    drop_arrived_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    vitals_at_pickup jsonb,
    vitals_at_drop jsonb,
    clinical_notes text,
    oxygen_administered boolean DEFAULT false,
    iv_started boolean DEFAULT false,
    odometer_start integer,
    odometer_end integer,
    distance_km numeric(8,2),
    cancellation_reason text,
    is_billable boolean DEFAULT true NOT NULL,
    base_charge numeric(12,2) DEFAULT 0,
    per_km_charge numeric(8,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    billing_invoice_id uuid,
    er_visit_id uuid,
    transport_request_id uuid,
    requested_by uuid,
    dispatched_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ambulance_trips ambulance_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_pkey PRIMARY KEY (id);

-- Name: ambulance_trips ambulance_trips_tenant_id_trip_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_tenant_id_trip_code_key UNIQUE (tenant_id, trip_code);

CREATE INDEX idx_amb_trips_ambulance ON public.ambulance_trips USING btree (tenant_id, ambulance_id);

CREATE INDEX idx_amb_trips_driver ON public.ambulance_trips USING btree (tenant_id, driver_id);

CREATE INDEX idx_amb_trips_patient ON public.ambulance_trips USING btree (tenant_id, patient_id);

CREATE INDEX idx_amb_trips_requested ON public.ambulance_trips USING btree (tenant_id, requested_at DESC);

CREATE INDEX idx_amb_trips_status ON public.ambulance_trips USING btree (tenant_id, status);

CREATE INDEX idx_amb_trips_tenant ON public.ambulance_trips USING btree (tenant_id);

CREATE INDEX idx_amb_trips_type ON public.ambulance_trips USING btree (tenant_id, trip_type);

CREATE INDEX idx_ambulance_trips_deleted_at_f86b73e3 ON public.ambulance_trips USING btree (deleted_at);

CREATE INDEX idx_ambulance_trips_patient_id ON public.ambulance_trips USING btree (patient_id);

ALTER TABLE public.ambulance_trips ENABLE ROW LEVEL SECURITY;

-- Name: ambulance_trips tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_trips USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ambulance_trips trg_amb_trips_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_trips_updated_at BEFORE UPDATE ON public.ambulance_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ambulance_trips trg_ambulance_trips_soft_delete_f86b73e3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulance_trips_soft_delete_f86b73e3 BEFORE DELETE ON public.ambulance_trips FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.ambulances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    vehicle_number text NOT NULL,
    ambulance_code text NOT NULL,
    ambulance_type public.ambulance_type NOT NULL,
    status public.ambulance_status DEFAULT 'available'::public.ambulance_status NOT NULL,
    make text,
    model text,
    year_of_manufacture integer,
    chassis_number text,
    engine_number text,
    fitness_certificate_expiry date,
    insurance_expiry date,
    pollution_certificate_expiry date,
    permit_expiry date,
    equipment_checklist jsonb,
    has_ventilator boolean DEFAULT false NOT NULL,
    has_defibrillator boolean DEFAULT false NOT NULL,
    has_oxygen boolean DEFAULT true NOT NULL,
    seating_capacity integer DEFAULT 1,
    gps_device_id text,
    last_latitude double precision,
    last_longitude double precision,
    last_location_at timestamp with time zone,
    default_driver_id uuid,
    current_driver_id uuid,
    odometer_km integer DEFAULT 0,
    fuel_type text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ambulances ambulances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_pkey PRIMARY KEY (id);

-- Name: ambulances ambulances_tenant_id_ambulance_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_tenant_id_ambulance_code_key UNIQUE (tenant_id, ambulance_code);

-- Name: ambulances ambulances_tenant_id_vehicle_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_tenant_id_vehicle_number_key UNIQUE (tenant_id, vehicle_number);

CREATE INDEX idx_ambulances_deleted_at_27ff531e ON public.ambulances USING btree (deleted_at);

CREATE INDEX idx_ambulances_status ON public.ambulances USING btree (tenant_id, status);

CREATE INDEX idx_ambulances_tenant ON public.ambulances USING btree (tenant_id);

CREATE INDEX idx_ambulances_type ON public.ambulances USING btree (tenant_id, ambulance_type);

ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;

-- Name: ambulances tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulances USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ambulances trg_ambulances_soft_delete_27ff531e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulances_soft_delete_27ff531e BEFORE DELETE ON public.ambulances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ambulances trg_ambulances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulances_updated_at BEFORE UPDATE ON public.ambulances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.death_other_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    death_record_id uuid NOT NULL,
    condition_description text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: death_other_conditions death_other_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_other_conditions
    ADD CONSTRAINT death_other_conditions_pkey PRIMARY KEY (id);

CREATE INDEX idx_death_conditions_record ON public.death_other_conditions USING btree (death_record_id, display_order);

CREATE INDEX idx_death_other_conditions_deleted_at_8cc1cf94 ON public.death_other_conditions USING btree (deleted_at);

CREATE INDEX idx_death_other_conditions_tenant_id ON public.death_other_conditions USING btree (tenant_id);

ALTER TABLE ONLY public.death_other_conditions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.death_other_conditions ENABLE ROW LEVEL SECURITY;

-- Name: death_other_conditions tenant_isolation_death_other_conditions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_death_other_conditions ON public.death_other_conditions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: death_other_conditions trg_death_other_conditions_soft_delete_8cc1cf94; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_death_other_conditions_soft_delete_8cc1cf94 BEFORE DELETE ON public.death_other_conditions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.death_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    certificate_number text,
    registration_number text,
    registration_date date,
    place_of_death text,
    date_of_death date,
    time_of_death time without time zone,
    manner_of_death text,
    cause_immediate text,
    cause_antecedent text,
    cause_underlying text,
    duration_of_illness text,
    icd_code_immediate text,
    icd_code_underlying text,
    attended_by_doctor boolean,
    attending_doctor_id uuid,
    pregnancy_status text,
    pregnancy_contributed boolean,
    mlc_case boolean DEFAULT false NOT NULL,
    mlc_number text,
    autopsy_performed boolean DEFAULT false NOT NULL,
    autopsy_findings text,
    informant_name text,
    informant_relationship text,
    informant_address text,
    certified_by_id uuid,
    certification_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deceased_name text,
    age_at_death text,
    gender text,
    address text,
    certifying_doctor text,
    period text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: death_records death_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_records
    ADD CONSTRAINT death_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_death_records_deleted_at_907dba46 ON public.death_records USING btree (deleted_at);

CREATE INDEX idx_death_records_patient ON public.death_records USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE ONLY public.death_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.death_records ENABLE ROW LEVEL SECURITY;

-- Name: death_records tenant_isolation_death_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_death_records ON public.death_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: death_records trg_death_records_soft_delete_907dba46; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_death_records_soft_delete_907dba46 BEFORE DELETE ON public.death_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ====================================================================
-- Migration: 0212_er_bays.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: er_bays
-- Drops: none
-- ====================================================================
-- ER bays were a free-text `er_visits.bay_number` string — no per-hospital
-- configuration and no bay board, so a charge nurse couldn't see which
-- bays are occupied or filter/KPI by bay. Add a configurable ER bay master
-- (name, code, type, active). Visits reference a bay by its code; the
-- occupancy board is computed from active visits. Free-text stays valid
-- for legacy rows.

CREATE TABLE public.er_bays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    bay_type text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: er_bays er_bays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_bays
    ADD CONSTRAINT er_bays_pkey PRIMARY KEY (id);

-- Name: er_bays er_bays_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_bays
    ADD CONSTRAINT er_bays_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_er_bays_tenant ON public.er_bays USING btree (tenant_id);

ALTER TABLE public.er_bays ENABLE ROW LEVEL SECURITY;

-- Name: er_bays er_bays_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_bays_tenant ON public.er_bays USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_bays set_er_bays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_bays_updated_at BEFORE UPDATE ON public.er_bays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.er_code_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid,
    code_type text NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    location text,
    response_team jsonb,
    crash_cart_checklist jsonb,
    outcome text,
    notes text,
    activated_by uuid,
    deactivated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: er_code_activations er_code_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_code_activations_deleted_at_f2240f0f ON public.er_code_activations USING btree (deleted_at);

CREATE INDEX idx_er_codes_tenant ON public.er_code_activations USING btree (tenant_id);

CREATE INDEX idx_er_codes_type ON public.er_code_activations USING btree (tenant_id, code_type);

ALTER TABLE public.er_code_activations ENABLE ROW LEVEL SECURITY;

-- Name: er_code_activations er_codes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_codes_tenant ON public.er_code_activations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_code_activations set_er_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_codes_updated_at BEFORE UPDATE ON public.er_code_activations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: er_code_activations trg_er_code_activations_soft_delete_f2240f0f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_er_code_activations_soft_delete_f2240f0f BEFORE DELETE ON public.er_code_activations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ====================================================================
-- Migration: 0209_er_discharge_summary.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: er_discharge_summaries
-- Drops: none
-- ====================================================================
-- ER patients were discharged by setting er_visits.disposition +
-- disposition_notes (free text) — no structured discharge summary and
-- nothing printable to hand the patient. NABH/JCI require a structured
-- discharge: diagnosis, course, treatment, take-home meds, follow-up and
-- red-flag warning signs. This adds an ER discharge summary (one per
-- visit, draft → finalized) mirroring the IPD model, reusing the shared
-- discharge_summary_status enum. v1 fields are free text (ER is acute and
-- not encounter/diagnosis-backed); the printable is wired separately.

CREATE TABLE public.er_discharge_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid NOT NULL,
    status public.discharge_summary_status DEFAULT 'draft'::public.discharge_summary_status NOT NULL,
    final_diagnosis text,
    condition_at_discharge text,
    clinical_course text,
    treatment_given text,
    medications_on_discharge text,
    follow_up_instructions text,
    follow_up_date date,
    warning_signs text,
    prepared_by uuid,
    verified_by uuid,
    finalized_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: er_discharge_summaries er_discharge_summaries_er_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_discharge_summaries
    ADD CONSTRAINT er_discharge_summaries_er_visit_id_key UNIQUE (er_visit_id);

-- Name: er_discharge_summaries er_discharge_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_discharge_summaries
    ADD CONSTRAINT er_discharge_summaries_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_discharge_summaries_visit ON public.er_discharge_summaries USING btree (tenant_id, er_visit_id);

ALTER TABLE public.er_discharge_summaries ENABLE ROW LEVEL SECURITY;

-- Name: er_discharge_summaries er_discharge_summaries_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_discharge_summaries_tenant ON public.er_discharge_summaries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_discharge_summaries set_er_discharge_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_discharge_summaries_updated_at BEFORE UPDATE ON public.er_discharge_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ====================================================================
-- Migration: 0211_er_observation_notes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: er_observation_notes
-- Drops: none
-- ====================================================================
-- ER visits could be set to status 'observation' but there was no way to
-- chart the observation period — no serial vitals/notes while the patient
-- is held for monitoring before discharge or admission. This adds an ER
-- observation chart: timestamped entries (vitals + note) per visit, the
-- nursing record that justifies the eventual disposition. Append-only in
-- spirit (like resuscitation logs); the disposition decision reuses the
-- existing discharge-summary / admit_from_er flows.

CREATE TABLE public.er_observation_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid NOT NULL,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    pulse integer,
    bp_systolic integer,
    bp_diastolic integer,
    resp_rate integer,
    spo2 integer,
    temperature double precision,
    gcs integer,
    pain_score integer,
    note text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: er_observation_notes er_observation_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_observation_notes
    ADD CONSTRAINT er_observation_notes_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_observation_notes_visit ON public.er_observation_notes USING btree (tenant_id, er_visit_id);

ALTER TABLE public.er_observation_notes ENABLE ROW LEVEL SECURITY;

-- Name: er_observation_notes er_observation_notes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_observation_notes_tenant ON public.er_observation_notes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_observation_notes set_er_observation_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_observation_notes_updated_at BEFORE UPDATE ON public.er_observation_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.er_resuscitation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid NOT NULL,
    log_type text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    medication_name text,
    dose text,
    route text,
    fluid_name text,
    fluid_volume_ml integer,
    procedure_name text,
    procedure_notes text,
    vitals_snapshot jsonb,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: er_resuscitation_logs er_resuscitation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_resus_tenant ON public.er_resuscitation_logs USING btree (tenant_id);

CREATE INDEX idx_er_resus_visit ON public.er_resuscitation_logs USING btree (er_visit_id);

CREATE INDEX idx_er_resuscitation_logs_deleted_at_605d4ba0 ON public.er_resuscitation_logs USING btree (deleted_at);

ALTER TABLE public.er_resuscitation_logs ENABLE ROW LEVEL SECURITY;

-- Name: er_resuscitation_logs er_resus_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_resus_tenant ON public.er_resuscitation_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_resuscitation_logs set_er_resus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_resus_updated_at BEFORE UPDATE ON public.er_resuscitation_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: er_resuscitation_logs trg_er_resuscitation_logs_soft_delete_605d4ba0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_er_resuscitation_logs_soft_delete_605d4ba0 BEFORE DELETE ON public.er_resuscitation_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.er_triage_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid NOT NULL,
    triage_level public.triage_level NOT NULL,
    triage_system text DEFAULT 'ESI'::text NOT NULL,
    score integer,
    respiratory_rate integer,
    pulse_rate integer,
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    spo2 integer,
    gcs_score integer,
    gcs_eye integer,
    gcs_verbal integer,
    gcs_motor integer,
    pain_score integer,
    chief_complaint text,
    presenting_symptoms jsonb,
    allergies jsonb,
    is_pregnant boolean DEFAULT false,
    disability_assessment text,
    notes text,
    assessed_by uuid,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: er_triage_assessments er_triage_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_triage_assessments_deleted_at_6b2ea6fd ON public.er_triage_assessments USING btree (deleted_at);

CREATE INDEX idx_er_triage_tenant ON public.er_triage_assessments USING btree (tenant_id);

CREATE INDEX idx_er_triage_visit ON public.er_triage_assessments USING btree (er_visit_id);

ALTER TABLE public.er_triage_assessments ENABLE ROW LEVEL SECURITY;

-- Name: er_triage_assessments er_triage_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_triage_tenant ON public.er_triage_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_triage_assessments set_er_triage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_triage_updated_at BEFORE UPDATE ON public.er_triage_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: er_triage_assessments trg_er_triage_assessments_soft_delete_6b2ea6fd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_er_triage_assessments_soft_delete_6b2ea6fd BEFORE DELETE ON public.er_triage_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.er_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    visit_number text NOT NULL,
    status public.er_visit_status DEFAULT 'registered'::public.er_visit_status NOT NULL,
    arrival_mode text,
    arrival_time timestamp with time zone DEFAULT now() NOT NULL,
    chief_complaint text,
    is_mlc boolean DEFAULT false NOT NULL,
    is_brought_dead boolean DEFAULT false NOT NULL,
    triage_level public.triage_level DEFAULT 'unassigned'::public.triage_level,
    attending_doctor_id uuid,
    bay_number text,
    disposition text,
    disposition_time timestamp with time zone,
    disposition_notes text,
    admitted_to text,
    admission_id uuid,
    door_to_doctor_mins integer,
    door_to_disposition_mins integer,
    vitals jsonb,
    notes text,
    mass_casualty_event_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    is_dummy boolean DEFAULT false NOT NULL,
    encounter_id uuid
);

-- Name: er_visits er_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_pkey PRIMARY KEY (id);

CREATE INDEX idx_er_visits_arrival ON public.er_visits USING btree (tenant_id, arrival_time);

CREATE INDEX idx_er_visits_deleted_at_11e9059b ON public.er_visits USING btree (deleted_at);

CREATE INDEX idx_er_visits_encounter ON public.er_visits USING btree (tenant_id, encounter_id);

CREATE INDEX idx_er_visits_live ON public.er_visits USING btree (tenant_id, patient_id) WHERE (is_dummy = false);

CREATE INDEX idx_er_visits_mlc ON public.er_visits USING btree (tenant_id, is_mlc) WHERE (is_mlc = true);

CREATE INDEX idx_er_visits_patient ON public.er_visits USING btree (tenant_id, patient_id);

CREATE INDEX idx_er_visits_patient_id ON public.er_visits USING btree (patient_id);

CREATE INDEX idx_er_visits_status ON public.er_visits USING btree (tenant_id, status);

CREATE INDEX idx_er_visits_tenant ON public.er_visits USING btree (tenant_id);

ALTER TABLE public.er_visits ENABLE ROW LEVEL SECURITY;

-- Name: er_visits er_visits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_visits_tenant ON public.er_visits USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: er_visits audit_er_visits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_er_visits AFTER INSERT OR DELETE OR UPDATE ON public.er_visits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('emergency');

-- Name: er_visits set_er_visits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_visits_updated_at BEFORE UPDATE ON public.er_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: er_visits trg_er_visits_soft_delete_11e9059b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_er_visits_soft_delete_11e9059b BEFORE DELETE ON public.er_visits FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mass_casualty_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_name text NOT NULL,
    event_type text,
    status public.mass_casualty_status DEFAULT 'activated'::public.mass_casualty_status NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    location text,
    estimated_casualties integer,
    actual_casualties integer,
    triage_summary jsonb,
    resources_deployed jsonb,
    notifications_sent jsonb,
    notes text,
    activated_by uuid,
    deactivated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mass_casualty_events mass_casualty_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_casualty_events
    ADD CONSTRAINT mass_casualty_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_mass_casualty_events_deleted_at_34eb84da ON public.mass_casualty_events USING btree (deleted_at);

CREATE INDEX idx_mass_casualty_status ON public.mass_casualty_events USING btree (tenant_id, status);

CREATE INDEX idx_mass_casualty_tenant ON public.mass_casualty_events USING btree (tenant_id);

ALTER TABLE public.mass_casualty_events ENABLE ROW LEVEL SECURITY;

-- Name: mass_casualty_events mass_casualty_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mass_casualty_tenant ON public.mass_casualty_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mass_casualty_events set_mass_casualty_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mass_casualty_updated_at BEFORE UPDATE ON public.mass_casualty_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: mass_casualty_events trg_mass_casualty_events_soft_delete_34eb84da; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mass_casualty_events_soft_delete_34eb84da BEFORE DELETE ON public.mass_casualty_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mlc_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    er_visit_id uuid,
    patient_id uuid NOT NULL,
    mlc_number text NOT NULL,
    status public.mlc_status DEFAULT 'registered'::public.mlc_status NOT NULL,
    case_type text,
    fir_number text,
    police_station text,
    brought_by text,
    informant_name text,
    informant_relation text,
    informant_contact text,
    history_of_incident text,
    examination_findings text,
    medical_opinion text,
    is_pocso boolean DEFAULT false NOT NULL,
    is_death_case boolean DEFAULT false NOT NULL,
    cause_of_death text,
    registered_by uuid,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admission_id uuid,
    examining_doctor_id uuid,
    registration_date date,
    registration_time time without time zone,
    police_officer_name text,
    police_officer_rank text,
    police_dd_number text,
    nature_of_case text,
    alleged_history text,
    date_time_of_incident timestamp with time zone,
    place_of_incident text,
    weapon_used text,
    condition_on_arrival text,
    treatment_given text,
    samples_handed_to text,
    opinion text,
    patient_condition_at_discharge text,
    examined_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mlc_cases mlc_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_pkey PRIMARY KEY (id);

CREATE INDEX idx_mlc_cases_deleted_at_a9d9d0f1 ON public.mlc_cases USING btree (deleted_at);

CREATE INDEX idx_mlc_cases_patient_id ON public.mlc_cases USING btree (patient_id);

CREATE UNIQUE INDEX idx_mlc_number ON public.mlc_cases USING btree (tenant_id, mlc_number);

CREATE INDEX idx_mlc_patient ON public.mlc_cases USING btree (tenant_id, patient_id);

CREATE INDEX idx_mlc_status ON public.mlc_cases USING btree (tenant_id, status);

CREATE INDEX idx_mlc_tenant ON public.mlc_cases USING btree (tenant_id);

ALTER TABLE public.mlc_cases ENABLE ROW LEVEL SECURITY;

-- Name: mlc_cases mlc_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_tenant ON public.mlc_cases USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mlc_cases set_mlc_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_cases_updated_at BEFORE UPDATE ON public.mlc_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: mlc_cases trg_mlc_cases_soft_delete_a9d9d0f1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mlc_cases_soft_delete_a9d9d0f1 BEFORE DELETE ON public.mlc_cases FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mlc_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    mlc_case_id uuid NOT NULL,
    document_type text NOT NULL,
    title text NOT NULL,
    body_diagram jsonb,
    content jsonb NOT NULL,
    generated_by uuid,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mlc_documents mlc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_pkey PRIMARY KEY (id);

CREATE INDEX idx_mlc_docs_case ON public.mlc_documents USING btree (mlc_case_id);

CREATE INDEX idx_mlc_docs_tenant ON public.mlc_documents USING btree (tenant_id);

CREATE INDEX idx_mlc_documents_deleted_at_a6e7eed7 ON public.mlc_documents USING btree (deleted_at);

ALTER TABLE public.mlc_documents ENABLE ROW LEVEL SECURITY;

-- Name: mlc_documents mlc_docs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_docs_tenant ON public.mlc_documents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mlc_documents set_mlc_docs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_docs_updated_at BEFORE UPDATE ON public.mlc_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: mlc_documents trg_mlc_documents_soft_delete_a6e7eed7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mlc_documents_soft_delete_a6e7eed7 BEFORE DELETE ON public.mlc_documents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mlc_police_intimations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    mlc_case_id uuid NOT NULL,
    intimation_number text NOT NULL,
    police_station text NOT NULL,
    officer_name text,
    officer_designation text,
    officer_contact text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_via text,
    receipt_confirmed boolean DEFAULT false NOT NULL,
    receipt_confirmed_at timestamp with time zone,
    receipt_number text,
    notes text,
    sent_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mlc_police_intimations mlc_police_intimations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_pkey PRIMARY KEY (id);

CREATE INDEX idx_mlc_police_case ON public.mlc_police_intimations USING btree (mlc_case_id);

CREATE INDEX idx_mlc_police_intimations_deleted_at_6daf7072 ON public.mlc_police_intimations USING btree (deleted_at);

CREATE INDEX idx_mlc_police_tenant ON public.mlc_police_intimations USING btree (tenant_id);

ALTER TABLE public.mlc_police_intimations ENABLE ROW LEVEL SECURITY;

-- Name: mlc_police_intimations mlc_police_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_police_tenant ON public.mlc_police_intimations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mlc_police_intimations set_mlc_police_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_police_updated_at BEFORE UPDATE ON public.mlc_police_intimations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: mlc_police_intimations trg_mlc_police_intimations_soft_delete_6daf7072; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mlc_police_intimations_soft_delete_6daf7072 BEFORE DELETE ON public.mlc_police_intimations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.mortuary_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    body_receipt_number text NOT NULL,
    deceased_name text NOT NULL,
    deceased_age integer,
    deceased_gender text,
    date_of_death timestamp with time zone,
    cause_of_death text,
    is_mlc boolean DEFAULT false NOT NULL,
    mlc_case_id uuid,
    cold_storage_slot text,
    temperature_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public.body_status DEFAULT 'received'::public.body_status NOT NULL,
    pm_requested boolean DEFAULT false NOT NULL,
    pm_performed_by text,
    pm_date timestamp with time zone,
    pm_findings text,
    viscera_preserved boolean DEFAULT false NOT NULL,
    viscera_chain_of_custody jsonb DEFAULT '[]'::jsonb NOT NULL,
    organ_donation_status text,
    released_to text,
    released_at timestamp with time zone,
    released_by uuid,
    identification_marks text,
    unclaimed_notice_date date,
    unclaimed_disposal_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mortuary_records mortuary_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_pkey PRIMARY KEY (id);

-- Name: mortuary_records mortuary_records_tenant_id_body_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_tenant_id_body_receipt_number_key UNIQUE (tenant_id, body_receipt_number);

CREATE INDEX idx_mortuary_records_deleted_at_1fab29f3 ON public.mortuary_records USING btree (deleted_at);

CREATE INDEX idx_mortuary_records_status ON public.mortuary_records USING btree (tenant_id, status);

CREATE INDEX idx_mortuary_records_tenant ON public.mortuary_records USING btree (tenant_id);

ALTER TABLE public.mortuary_records ENABLE ROW LEVEL SECURITY;

-- Name: mortuary_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.mortuary_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: mortuary_records trg_mortuary_records_soft_delete_1fab29f3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mortuary_records_soft_delete_1fab29f3 BEFORE DELETE ON public.mortuary_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mortuary_records trg_mortuary_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mortuary_records_updated_at BEFORE UPDATE ON public.mortuary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.transport_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid,
    admission_id uuid,
    from_location_id uuid,
    to_location_id uuid,
    transport_mode public.transport_mode NOT NULL,
    status public.transport_status DEFAULT 'requested'::public.transport_status NOT NULL,
    priority character varying(20) DEFAULT 'routine'::character varying NOT NULL,
    requested_by uuid NOT NULL,
    assigned_to uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_at timestamp with time zone,
    picked_up_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: transport_requests transport_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_transport_requests_admission_id ON public.transport_requests USING btree (admission_id);

CREATE INDEX idx_transport_requests_assigned ON public.transport_requests USING btree (assigned_to) WHERE (status = ANY (ARRAY['assigned'::public.transport_status, 'in_transit'::public.transport_status]));

CREATE INDEX idx_transport_requests_date ON public.transport_requests USING btree (tenant_id, requested_at DESC);

CREATE INDEX idx_transport_requests_deleted_at_27861a39 ON public.transport_requests USING btree (deleted_at);

CREATE INDEX idx_transport_requests_patient_id ON public.transport_requests USING btree (patient_id);

CREATE INDEX idx_transport_requests_status ON public.transport_requests USING btree (tenant_id, status) WHERE (status <> ALL (ARRAY['completed'::public.transport_status, 'cancelled'::public.transport_status]));

CREATE INDEX idx_transport_requests_tenant ON public.transport_requests USING btree (tenant_id);

ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

-- Name: transport_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.transport_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: transport_requests set_transport_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_transport_requests_updated_at BEFORE UPDATE ON public.transport_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: transport_requests trg_transport_requests_soft_delete_27861a39; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transport_requests_soft_delete_27861a39 BEFORE DELETE ON public.transport_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: ambulance_maintenance ambulance_maintenance_ambulance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_ambulance_id_fkey FOREIGN KEY (ambulance_id) REFERENCES public.ambulances(id);

-- Name: ambulance_trip_logs ambulance_trip_logs_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.ambulance_trips(id) ON DELETE CASCADE;

-- Name: ambulance_trips ambulance_trips_ambulance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_ambulance_id_fkey FOREIGN KEY (ambulance_id) REFERENCES public.ambulances(id);

-- Name: death_other_conditions death_other_conditions_death_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_other_conditions
    ADD CONSTRAINT death_other_conditions_death_record_id_fkey FOREIGN KEY (death_record_id) REFERENCES public.death_records(id) ON DELETE CASCADE;

-- Name: er_code_activations er_code_activations_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);

-- Name: er_discharge_summaries er_discharge_summaries_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_discharge_summaries
    ADD CONSTRAINT er_discharge_summaries_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id) ON DELETE CASCADE;

-- Name: er_observation_notes er_observation_notes_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_observation_notes
    ADD CONSTRAINT er_observation_notes_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id) ON DELETE CASCADE;

-- Name: er_resuscitation_logs er_resuscitation_logs_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);

-- Name: er_triage_assessments er_triage_assessments_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);

-- Name: er_visits fk_er_visits_mass_casualty; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT fk_er_visits_mass_casualty FOREIGN KEY (mass_casualty_event_id) REFERENCES public.mass_casualty_events(id);

-- Name: mlc_cases mlc_cases_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);

-- Name: mlc_documents mlc_documents_mlc_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_mlc_case_id_fkey FOREIGN KEY (mlc_case_id) REFERENCES public.mlc_cases(id);

-- Name: mlc_police_intimations mlc_police_intimations_mlc_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_mlc_case_id_fkey FOREIGN KEY (mlc_case_id) REFERENCES public.mlc_cases(id);
