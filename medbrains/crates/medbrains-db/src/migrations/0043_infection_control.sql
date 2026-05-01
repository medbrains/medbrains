-- ============================================================
-- MedBrains schema — module: infection_control
-- ============================================================

--
-- Name: antibiotic_consumption_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.antibiotic_consumption_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    antibiotic_name text NOT NULL,
    atc_code text,
    record_month date NOT NULL,
    quantity_used numeric NOT NULL,
    ddd numeric,
    patient_days integer DEFAULT 0 NOT NULL,
    ddd_per_1000_patient_days numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: antibiotic_stewardship_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.antibiotic_stewardship_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    antibiotic_name text NOT NULL,
    dose text,
    route text,
    frequency text,
    duration_days integer,
    indication text NOT NULL,
    culture_sent boolean DEFAULT false NOT NULL,
    culture_result text,
    request_status public.antibiotic_request_status DEFAULT 'pending'::public.antibiotic_request_status NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    escalation_reason text,
    auto_stop_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: culture_surveillance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.culture_surveillance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    culture_type text NOT NULL,
    sample_site text NOT NULL,
    location_id uuid,
    department_id uuid,
    collection_date timestamp with time zone NOT NULL,
    result text,
    organism text,
    colony_count integer,
    acceptable boolean,
    action_taken text,
    collected_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: hand_hygiene_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hand_hygiene_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    audit_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid NOT NULL,
    auditor_id uuid NOT NULL,
    observations integer DEFAULT 0 NOT NULL,
    compliant integer DEFAULT 0 NOT NULL,
    non_compliant integer DEFAULT 0 NOT NULL,
    compliance_rate numeric(5,2),
    moment_breakdown jsonb,
    staff_category text,
    findings text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: infection_device_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infection_device_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    department_id uuid,
    record_date date NOT NULL,
    patient_days integer DEFAULT 0 NOT NULL,
    central_line_days integer DEFAULT 0 NOT NULL,
    urinary_catheter_days integer DEFAULT 0 NOT NULL,
    ventilator_days integer DEFAULT 0 NOT NULL,
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: infection_surveillance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.infection_surveillance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    hai_type public.hai_type NOT NULL,
    infection_status public.infection_status DEFAULT 'suspected'::public.infection_status NOT NULL,
    organism text,
    susceptibility_pattern jsonb,
    device_type text,
    insertion_date timestamp with time zone,
    infection_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    nhsn_criteria text,
    contributing_factors jsonb,
    notes text,
    reported_by uuid NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: needle_stick_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.needle_stick_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL,
    staff_id uuid NOT NULL,
    incident_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    device_type text NOT NULL,
    procedure_during text,
    body_part text,
    depth text,
    source_patient_id uuid,
    hiv_status text,
    hbv_status text,
    hcv_status text,
    pep_initiated boolean DEFAULT false NOT NULL,
    pep_details text,
    follow_up_schedule jsonb,
    outcome text,
    reported_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: outbreak_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbreak_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    outbreak_id uuid NOT NULL,
    patient_id uuid,
    staff_id uuid,
    contact_type text NOT NULL,
    exposure_date timestamp with time zone,
    screening_date timestamp with time zone,
    screening_result text,
    quarantine_required boolean DEFAULT false NOT NULL,
    quarantine_start date,
    quarantine_end date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: outbreak_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbreak_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    outbreak_number text NOT NULL,
    organism text NOT NULL,
    outbreak_status public.outbreak_status DEFAULT 'suspected'::public.outbreak_status NOT NULL,
    detected_date timestamp with time zone NOT NULL,
    location_id uuid,
    department_id uuid,
    initial_cases integer DEFAULT 1 NOT NULL,
    total_cases integer DEFAULT 1 NOT NULL,
    description text,
    control_measures jsonb,
    hicc_notified boolean DEFAULT false NOT NULL,
    hicc_notified_at timestamp with time zone,
    containment_date timestamp with time zone,
    closure_date timestamp with time zone,
    root_cause text,
    lessons_learned text,
    reported_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: polypharmacy_interaction_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.polypharmacy_interaction_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid,
    drug_a_name text NOT NULL,
    drug_b_name text NOT NULL,
    interaction_id uuid,
    severity text NOT NULL,
    description text,
    management text,
    status text DEFAULT 'active'::text NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    override_reason text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT polypharmacy_interaction_alerts_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'contraindicated'::text]))),
    CONSTRAINT polypharmacy_interaction_alerts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'overridden'::text, 'resolved'::text])))
);



--
-- Name: antibiotic_consumption_records antibiotic_consumption_record_tenant_id_department_id_antib_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_record_tenant_id_department_id_antib_key UNIQUE (tenant_id, department_id, antibiotic_name, record_month);



--
-- Name: antibiotic_consumption_records antibiotic_consumption_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_consumption_records
    ADD CONSTRAINT antibiotic_consumption_records_pkey PRIMARY KEY (id);



--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_stewardship_requests_pkey PRIMARY KEY (id);



--
-- Name: culture_surveillance culture_surveillance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.culture_surveillance
    ADD CONSTRAINT culture_surveillance_pkey PRIMARY KEY (id);



--
-- Name: hand_hygiene_audits hand_hygiene_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hand_hygiene_audits
    ADD CONSTRAINT hand_hygiene_audits_pkey PRIMARY KEY (id);



--
-- Name: infection_device_days infection_device_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_pkey PRIMARY KEY (id);



--
-- Name: infection_device_days infection_device_days_tenant_id_location_id_record_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_device_days
    ADD CONSTRAINT infection_device_days_tenant_id_location_id_record_date_key UNIQUE (tenant_id, location_id, record_date);



--
-- Name: infection_surveillance_events infection_surveillance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.infection_surveillance_events
    ADD CONSTRAINT infection_surveillance_events_pkey PRIMARY KEY (id);



--
-- Name: needle_stick_incidents needle_stick_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.needle_stick_incidents
    ADD CONSTRAINT needle_stick_incidents_pkey PRIMARY KEY (id);



--
-- Name: outbreak_contacts outbreak_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_pkey PRIMARY KEY (id);



--
-- Name: outbreak_events outbreak_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_events
    ADD CONSTRAINT outbreak_events_pkey PRIMARY KEY (id);



--
-- Name: polypharmacy_interaction_alerts polypharmacy_interaction_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_interaction_alerts
    ADD CONSTRAINT polypharmacy_interaction_alerts_pkey PRIMARY KEY (id);



--
-- Name: idx_abx_consumption_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abx_consumption_dept ON public.antibiotic_consumption_records USING btree (tenant_id, department_id);



--
-- Name: idx_abx_consumption_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abx_consumption_tenant ON public.antibiotic_consumption_records USING btree (tenant_id);



--
-- Name: idx_abx_steward_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abx_steward_patient ON public.antibiotic_stewardship_requests USING btree (tenant_id, patient_id);



--
-- Name: idx_abx_steward_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abx_steward_status ON public.antibiotic_stewardship_requests USING btree (tenant_id, request_status);



--
-- Name: idx_abx_steward_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abx_steward_tenant ON public.antibiotic_stewardship_requests USING btree (tenant_id);



--
-- Name: idx_culture_surv_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_culture_surv_dept ON public.culture_surveillance USING btree (tenant_id, department_id);



--
-- Name: idx_culture_surv_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_culture_surv_tenant ON public.culture_surveillance USING btree (tenant_id);



--
-- Name: idx_hand_hygiene_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hand_hygiene_dept ON public.hand_hygiene_audits USING btree (tenant_id, department_id);



--
-- Name: idx_hand_hygiene_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hand_hygiene_tenant ON public.hand_hygiene_audits USING btree (tenant_id);



--
-- Name: idx_infection_dd_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_dd_date ON public.infection_device_days USING btree (tenant_id, record_date);



--
-- Name: idx_infection_dd_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_dd_dept ON public.infection_device_days USING btree (tenant_id, department_id);



--
-- Name: idx_infection_dd_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_dd_tenant ON public.infection_device_days USING btree (tenant_id);



--
-- Name: idx_infection_surv_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_surv_dept ON public.infection_surveillance_events USING btree (tenant_id, department_id);



--
-- Name: idx_infection_surv_hai_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_surv_hai_type ON public.infection_surveillance_events USING btree (tenant_id, hai_type);



--
-- Name: idx_infection_surv_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_surv_patient ON public.infection_surveillance_events USING btree (tenant_id, patient_id);



--
-- Name: idx_infection_surv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_surv_status ON public.infection_surveillance_events USING btree (tenant_id, infection_status);



--
-- Name: idx_infection_surv_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_infection_surv_tenant ON public.infection_surveillance_events USING btree (tenant_id);



--
-- Name: idx_needle_stick_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_needle_stick_dept ON public.needle_stick_incidents USING btree (tenant_id, department_id);



--
-- Name: idx_needle_stick_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_needle_stick_patient ON public.needle_stick_incidents USING btree (tenant_id, source_patient_id);



--
-- Name: idx_needle_stick_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_needle_stick_tenant ON public.needle_stick_incidents USING btree (tenant_id);



--
-- Name: idx_outbreak_contacts_outbreak; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbreak_contacts_outbreak ON public.outbreak_contacts USING btree (tenant_id, outbreak_id);



--
-- Name: idx_outbreak_contacts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbreak_contacts_tenant ON public.outbreak_contacts USING btree (tenant_id);



--
-- Name: idx_outbreak_events_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbreak_events_dept ON public.outbreak_events USING btree (tenant_id, department_id);



--
-- Name: idx_outbreak_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbreak_events_status ON public.outbreak_events USING btree (tenant_id, outbreak_status);



--
-- Name: idx_outbreak_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbreak_events_tenant ON public.outbreak_events USING btree (tenant_id);



--
-- Name: idx_polypharmacy_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_polypharmacy_alerts_active ON public.polypharmacy_interaction_alerts USING btree (tenant_id, patient_id, status) WHERE (status = 'active'::text);



--
-- Name: antibiotic_consumption_records set_antibiotic_consumption_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_antibiotic_consumption_records_updated_at BEFORE UPDATE ON public.antibiotic_consumption_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: antibiotic_stewardship_requests set_antibiotic_stewardship_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_antibiotic_stewardship_requests_updated_at BEFORE UPDATE ON public.antibiotic_stewardship_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: culture_surveillance set_culture_surveillance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_culture_surveillance_updated_at BEFORE UPDATE ON public.culture_surveillance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: hand_hygiene_audits set_hand_hygiene_audits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_hand_hygiene_audits_updated_at BEFORE UPDATE ON public.hand_hygiene_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: infection_device_days set_infection_device_days_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_infection_device_days_updated_at BEFORE UPDATE ON public.infection_device_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: infection_surveillance_events set_infection_surveillance_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_infection_surveillance_events_updated_at BEFORE UPDATE ON public.infection_surveillance_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: needle_stick_incidents set_needle_stick_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_needle_stick_incidents_updated_at BEFORE UPDATE ON public.needle_stick_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: outbreak_contacts set_outbreak_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_outbreak_contacts_updated_at BEFORE UPDATE ON public.outbreak_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: outbreak_events set_outbreak_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_outbreak_events_updated_at BEFORE UPDATE ON public.outbreak_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: outbreak_contacts outbreak_contacts_outbreak_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbreak_contacts
    ADD CONSTRAINT outbreak_contacts_outbreak_id_fkey FOREIGN KEY (outbreak_id) REFERENCES public.outbreak_events(id) ON DELETE CASCADE;



--
-- Name: antibiotic_consumption_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.antibiotic_consumption_records ENABLE ROW LEVEL SECURITY;


--
-- Name: antibiotic_consumption_records antibiotic_consumption_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY antibiotic_consumption_records_tenant ON public.antibiotic_consumption_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: antibiotic_stewardship_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.antibiotic_stewardship_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: antibiotic_stewardship_requests antibiotic_stewardship_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY antibiotic_stewardship_requests_tenant ON public.antibiotic_stewardship_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: culture_surveillance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.culture_surveillance ENABLE ROW LEVEL SECURITY;


--
-- Name: culture_surveillance culture_surveillance_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY culture_surveillance_tenant ON public.culture_surveillance USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: hand_hygiene_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hand_hygiene_audits ENABLE ROW LEVEL SECURITY;


--
-- Name: hand_hygiene_audits hand_hygiene_audits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hand_hygiene_audits_tenant ON public.hand_hygiene_audits USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: infection_device_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.infection_device_days ENABLE ROW LEVEL SECURITY;


--
-- Name: infection_device_days infection_device_days_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY infection_device_days_tenant ON public.infection_device_days USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: infection_surveillance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.infection_surveillance_events ENABLE ROW LEVEL SECURITY;


--
-- Name: infection_surveillance_events infection_surveillance_events_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY infection_surveillance_events_tenant ON public.infection_surveillance_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: needle_stick_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.needle_stick_incidents ENABLE ROW LEVEL SECURITY;


--
-- Name: needle_stick_incidents needle_stick_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY needle_stick_incidents_tenant ON public.needle_stick_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: outbreak_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbreak_contacts ENABLE ROW LEVEL SECURITY;


--
-- Name: outbreak_contacts outbreak_contacts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbreak_contacts_tenant ON public.outbreak_contacts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: outbreak_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbreak_events ENABLE ROW LEVEL SECURITY;


--
-- Name: outbreak_events outbreak_events_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbreak_events_tenant ON public.outbreak_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: polypharmacy_interaction_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.polypharmacy_interaction_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: polypharmacy_interaction_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.polypharmacy_interaction_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


