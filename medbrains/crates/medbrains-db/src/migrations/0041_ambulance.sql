-- ============================================================
-- MedBrains schema — module: ambulance
-- ============================================================

--
-- Name: ambulance_drivers; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ambulance_maintenance; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ambulance_trip_logs; Type: TABLE; Schema: public; Owner: -
--

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
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ambulance_trips; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ambulances; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: transport_requests; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ambulance_drivers ambulance_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_pkey PRIMARY KEY (id);



--
-- Name: ambulance_drivers ambulance_drivers_tenant_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_drivers
    ADD CONSTRAINT ambulance_drivers_tenant_id_employee_id_key UNIQUE (tenant_id, employee_id);



--
-- Name: ambulance_maintenance ambulance_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_pkey PRIMARY KEY (id);



--
-- Name: ambulance_trip_logs ambulance_trip_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_pkey PRIMARY KEY (id);



--
-- Name: ambulance_trips ambulance_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_pkey PRIMARY KEY (id);



--
-- Name: ambulance_trips ambulance_trips_tenant_id_trip_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_tenant_id_trip_code_key UNIQUE (tenant_id, trip_code);



--
-- Name: ambulances ambulances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_pkey PRIMARY KEY (id);



--
-- Name: ambulances ambulances_tenant_id_ambulance_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_tenant_id_ambulance_code_key UNIQUE (tenant_id, ambulance_code);



--
-- Name: ambulances ambulances_tenant_id_vehicle_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulances
    ADD CONSTRAINT ambulances_tenant_id_vehicle_number_key UNIQUE (tenant_id, vehicle_number);



--
-- Name: transport_requests transport_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_requests
    ADD CONSTRAINT transport_requests_pkey PRIMARY KEY (id);



--
-- Name: idx_amb_drivers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_drivers_active ON public.ambulance_drivers USING btree (tenant_id, is_active);



--
-- Name: idx_amb_drivers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_drivers_tenant ON public.ambulance_drivers USING btree (tenant_id);



--
-- Name: idx_amb_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_logs_tenant ON public.ambulance_trip_logs USING btree (tenant_id);



--
-- Name: idx_amb_logs_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_logs_time ON public.ambulance_trip_logs USING btree (tenant_id, recorded_at DESC);



--
-- Name: idx_amb_logs_trip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_logs_trip ON public.ambulance_trip_logs USING btree (tenant_id, trip_id);



--
-- Name: idx_amb_maint_ambulance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_maint_ambulance ON public.ambulance_maintenance USING btree (tenant_id, ambulance_id);



--
-- Name: idx_amb_maint_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_maint_date ON public.ambulance_maintenance USING btree (tenant_id, scheduled_date);



--
-- Name: idx_amb_maint_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_maint_status ON public.ambulance_maintenance USING btree (tenant_id, status);



--
-- Name: idx_amb_maint_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_maint_tenant ON public.ambulance_maintenance USING btree (tenant_id);



--
-- Name: idx_amb_trips_ambulance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_ambulance ON public.ambulance_trips USING btree (tenant_id, ambulance_id);



--
-- Name: idx_amb_trips_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_driver ON public.ambulance_trips USING btree (tenant_id, driver_id);



--
-- Name: idx_amb_trips_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_patient ON public.ambulance_trips USING btree (tenant_id, patient_id);



--
-- Name: idx_amb_trips_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_requested ON public.ambulance_trips USING btree (tenant_id, requested_at DESC);



--
-- Name: idx_amb_trips_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_status ON public.ambulance_trips USING btree (tenant_id, status);



--
-- Name: idx_amb_trips_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_tenant ON public.ambulance_trips USING btree (tenant_id);



--
-- Name: idx_amb_trips_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amb_trips_type ON public.ambulance_trips USING btree (tenant_id, trip_type);



--
-- Name: idx_ambulances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ambulances_status ON public.ambulances USING btree (tenant_id, status);



--
-- Name: idx_ambulances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ambulances_tenant ON public.ambulances USING btree (tenant_id);



--
-- Name: idx_ambulances_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ambulances_type ON public.ambulances USING btree (tenant_id, ambulance_type);



--
-- Name: idx_transport_requests_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transport_requests_assigned ON public.transport_requests USING btree (assigned_to) WHERE (status = ANY (ARRAY['assigned'::public.transport_status, 'in_transit'::public.transport_status]));



--
-- Name: idx_transport_requests_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transport_requests_date ON public.transport_requests USING btree (tenant_id, requested_at DESC);



--
-- Name: idx_transport_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transport_requests_status ON public.transport_requests USING btree (tenant_id, status) WHERE (status <> ALL (ARRAY['completed'::public.transport_status, 'cancelled'::public.transport_status]));



--
-- Name: idx_transport_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transport_requests_tenant ON public.transport_requests USING btree (tenant_id);



--
-- Name: transport_requests set_transport_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_transport_requests_updated_at BEFORE UPDATE ON public.transport_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ambulance_drivers trg_amb_drivers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_drivers_updated_at BEFORE UPDATE ON public.ambulance_drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ambulance_maintenance trg_amb_maint_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_maint_updated_at BEFORE UPDATE ON public.ambulance_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ambulance_trips trg_amb_trips_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_amb_trips_updated_at BEFORE UPDATE ON public.ambulance_trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ambulances trg_ambulances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ambulances_updated_at BEFORE UPDATE ON public.ambulances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ambulance_maintenance ambulance_maintenance_ambulance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_maintenance
    ADD CONSTRAINT ambulance_maintenance_ambulance_id_fkey FOREIGN KEY (ambulance_id) REFERENCES public.ambulances(id);



--
-- Name: ambulance_trip_logs ambulance_trip_logs_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trip_logs
    ADD CONSTRAINT ambulance_trip_logs_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.ambulance_trips(id) ON DELETE CASCADE;



--
-- Name: ambulance_trips ambulance_trips_ambulance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_trips
    ADD CONSTRAINT ambulance_trips_ambulance_id_fkey FOREIGN KEY (ambulance_id) REFERENCES public.ambulances(id);



--
-- Name: ambulance_drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambulance_drivers ENABLE ROW LEVEL SECURITY;


--
-- Name: ambulance_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambulance_maintenance ENABLE ROW LEVEL SECURITY;


--
-- Name: ambulance_trip_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambulance_trip_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: ambulance_trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambulance_trips ENABLE ROW LEVEL SECURITY;


--
-- Name: ambulances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;


--
-- Name: ambulance_drivers tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_drivers USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ambulance_maintenance tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_maintenance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ambulance_trip_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_trip_logs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ambulance_trips tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulance_trips USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ambulances tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ambulances USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: transport_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.transport_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: transport_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;

