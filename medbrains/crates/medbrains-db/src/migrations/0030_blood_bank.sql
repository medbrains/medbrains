-- ============================================================
-- MedBrains schema — module: blood_bank
-- ============================================================

--
-- Name: bb_billing_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_billing_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    component_id uuid,
    patient_id uuid,
    billing_code text NOT NULL,
    component_type public.blood_component_type,
    blood_group text,
    processing_fee numeric(12,2) DEFAULT 0,
    component_cost numeric(12,2) DEFAULT 0,
    cross_match_fee numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    status public.bb_billing_status DEFAULT 'pending'::public.bb_billing_status NOT NULL,
    invoice_id uuid,
    waiver_reason text,
    billed_by uuid,
    billed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_blood_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_blood_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    component_id uuid NOT NULL,
    return_code text NOT NULL,
    returned_by uuid,
    return_reason text,
    temperature_at_return numeric(5,1),
    temperature_acceptable boolean,
    time_out_minutes integer,
    status public.bb_return_status DEFAULT 'requested'::public.bb_return_status NOT NULL,
    inspection_notes text,
    inspected_by uuid,
    inspected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_cold_chain_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_cold_chain_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_name text NOT NULL,
    device_serial text,
    location text,
    equipment_type text NOT NULL,
    min_temp numeric(5,1),
    max_temp numeric(5,1),
    alert_threshold_minutes integer DEFAULT 30,
    is_active boolean DEFAULT true NOT NULL,
    last_reading_at timestamp with time zone,
    last_temp numeric(5,1),
    alert_level public.bb_cold_chain_alert_level DEFAULT 'normal'::public.bb_cold_chain_alert_level,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_cold_chain_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_cold_chain_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_id uuid NOT NULL,
    temperature numeric(5,1) NOT NULL,
    humidity numeric(5,1),
    alert_level public.bb_cold_chain_alert_level DEFAULT 'normal'::public.bb_cold_chain_alert_level,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_lookback_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_lookback_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_code text NOT NULL,
    donation_id uuid,
    donor_id uuid,
    infection_type text NOT NULL,
    detection_date date NOT NULL,
    status public.bb_lookback_status DEFAULT 'detected'::public.bb_lookback_status NOT NULL,
    affected_components jsonb,
    recipients_notified integer DEFAULT 0,
    investigation_notes text,
    reported_to text,
    reported_at timestamp with time zone,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_msbos_guidelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_msbos_guidelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    procedure_name text NOT NULL,
    procedure_code text NOT NULL,
    blood_group text,
    component_type public.blood_component_type NOT NULL,
    max_units integer NOT NULL,
    crossmatch_to_transfusion_ratio numeric(4,2),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bb_recruitment_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bb_recruitment_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    campaign_name text NOT NULL,
    campaign_type text NOT NULL,
    target_blood_groups jsonb,
    target_count integer,
    actual_count integer DEFAULT 0,
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'planned'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: blood_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blood_components (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    donation_id uuid NOT NULL,
    component_type public.blood_component_type NOT NULL,
    bag_number character varying(50) NOT NULL,
    blood_group public.blood_group NOT NULL,
    volume_ml integer NOT NULL,
    status public.blood_bag_status DEFAULT 'collected'::public.blood_bag_status NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    expiry_at timestamp with time zone NOT NULL,
    storage_location character varying(100),
    storage_temperature character varying(50),
    tti_status character varying(20) DEFAULT 'pending'::character varying,
    tti_tested_at timestamp with time zone,
    issued_to_patient uuid,
    issued_at timestamp with time zone,
    issued_by uuid,
    discarded_at timestamp with time zone,
    discard_reason character varying(500),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: blood_donations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blood_donations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    donor_id uuid NOT NULL,
    bag_number character varying(50) NOT NULL,
    donation_type public.donation_type DEFAULT 'whole_blood'::public.donation_type NOT NULL,
    volume_ml integer NOT NULL,
    donated_at timestamp with time zone DEFAULT now() NOT NULL,
    collected_by uuid,
    camp_name character varying(200),
    adverse_reaction text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    medical_officer_id uuid
);



--
-- Name: blood_donors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blood_donors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    donor_number character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date,
    gender character varying(20),
    blood_group public.blood_group NOT NULL,
    phone character varying(20),
    email character varying(200),
    address text,
    id_type character varying(50),
    id_number character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    is_deferred boolean DEFAULT false NOT NULL,
    deferral_reason text,
    deferral_until date,
    last_donation timestamp with time zone,
    total_donations integer DEFAULT 0 NOT NULL,
    medical_history jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    eligibility_next_date date,
    recruitment_status text,
    preferred_contact text
);



--
-- Name: component_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    blood_bag_unit_id uuid,
    special_instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.component_issues FORCE ROW LEVEL SECURITY;



--
-- Name: crossmatch_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crossmatch_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    component_id uuid,
    requested_by uuid NOT NULL,
    blood_group public.blood_group NOT NULL,
    component_type public.blood_component_type DEFAULT 'prbc'::public.blood_component_type NOT NULL,
    units_requested integer DEFAULT 1 NOT NULL,
    clinical_indication text,
    status public.crossmatch_status DEFAULT 'requested'::public.crossmatch_status NOT NULL,
    result character varying(50),
    tested_by uuid,
    tested_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    msbos_limit integer,
    msbos_procedure text
);



--
-- Name: transfusion_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfusion_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    component_id uuid NOT NULL,
    crossmatch_id uuid,
    administered_by uuid NOT NULL,
    verified_by uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    volume_transfused_ml integer,
    has_reaction boolean DEFAULT false NOT NULL,
    reaction_type character varying(200),
    reaction_severity public.transfusion_reaction_severity,
    reaction_details text,
    reaction_reported_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: transfusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    transfusion_date date,
    product_type text,
    bag_number text,
    blood_group text,
    rh_factor text,
    volume_ml integer,
    expiry_date date,
    crossmatch_compatible boolean,
    patient_verified_by_id uuid,
    product_verified_by_id uuid,
    consent_on_file boolean,
    transfusion_start_time timestamp with time zone,
    started_by_id uuid,
    transfusion_end_time timestamp with time zone,
    total_volume_infused_ml integer,
    adverse_reaction boolean DEFAULT false NOT NULL,
    reaction_type text,
    reaction_time timestamp with time zone,
    action_taken text,
    completed_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.transfusions FORCE ROW LEVEL SECURITY;



--
-- Name: bb_billing_items bb_billing_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_pkey PRIMARY KEY (id);



--
-- Name: bb_billing_items bb_billing_items_tenant_id_billing_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_tenant_id_billing_code_key UNIQUE (tenant_id, billing_code);



--
-- Name: bb_blood_returns bb_blood_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_pkey PRIMARY KEY (id);



--
-- Name: bb_blood_returns bb_blood_returns_tenant_id_return_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_tenant_id_return_code_key UNIQUE (tenant_id, return_code);



--
-- Name: bb_cold_chain_devices bb_cold_chain_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_cold_chain_devices
    ADD CONSTRAINT bb_cold_chain_devices_pkey PRIMARY KEY (id);



--
-- Name: bb_cold_chain_readings bb_cold_chain_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_cold_chain_readings
    ADD CONSTRAINT bb_cold_chain_readings_pkey PRIMARY KEY (id);



--
-- Name: bb_lookback_events bb_lookback_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_pkey PRIMARY KEY (id);



--
-- Name: bb_lookback_events bb_lookback_events_tenant_id_event_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_tenant_id_event_code_key UNIQUE (tenant_id, event_code);



--
-- Name: bb_msbos_guidelines bb_msbos_guidelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_msbos_guidelines
    ADD CONSTRAINT bb_msbos_guidelines_pkey PRIMARY KEY (id);



--
-- Name: bb_msbos_guidelines bb_msbos_guidelines_tenant_id_procedure_code_component_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_msbos_guidelines
    ADD CONSTRAINT bb_msbos_guidelines_tenant_id_procedure_code_component_type_key UNIQUE (tenant_id, procedure_code, component_type);



--
-- Name: bb_recruitment_campaigns bb_recruitment_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_recruitment_campaigns
    ADD CONSTRAINT bb_recruitment_campaigns_pkey PRIMARY KEY (id);



--
-- Name: blood_components blood_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_pkey PRIMARY KEY (id);



--
-- Name: blood_components blood_components_tenant_id_bag_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_tenant_id_bag_number_key UNIQUE (tenant_id, bag_number);



--
-- Name: blood_donations blood_donations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donations
    ADD CONSTRAINT blood_donations_pkey PRIMARY KEY (id);



--
-- Name: blood_donations blood_donations_tenant_id_bag_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donations
    ADD CONSTRAINT blood_donations_tenant_id_bag_number_key UNIQUE (tenant_id, bag_number);



--
-- Name: blood_donors blood_donors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donors
    ADD CONSTRAINT blood_donors_pkey PRIMARY KEY (id);



--
-- Name: blood_donors blood_donors_tenant_id_donor_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donors
    ADD CONSTRAINT blood_donors_tenant_id_donor_number_key UNIQUE (tenant_id, donor_number);



--
-- Name: component_issues component_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_issues
    ADD CONSTRAINT component_issues_pkey PRIMARY KEY (id);



--
-- Name: crossmatch_requests crossmatch_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_pkey PRIMARY KEY (id);



--
-- Name: transfusion_records transfusion_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_pkey PRIMARY KEY (id);



--
-- Name: transfusions transfusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusions
    ADD CONSTRAINT transfusions_pkey PRIMARY KEY (id);



--
-- Name: idx_bb_bill_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_bill_patient ON public.bb_billing_items USING btree (tenant_id, patient_id);



--
-- Name: idx_bb_bill_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_bill_status ON public.bb_billing_items USING btree (tenant_id, status);



--
-- Name: idx_bb_bill_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_bill_tenant ON public.bb_billing_items USING btree (tenant_id);



--
-- Name: idx_bb_cc_dev_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_cc_dev_tenant ON public.bb_cold_chain_devices USING btree (tenant_id);



--
-- Name: idx_bb_cc_read_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_cc_read_device ON public.bb_cold_chain_readings USING btree (tenant_id, device_id);



--
-- Name: idx_bb_cc_read_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_cc_read_tenant ON public.bb_cold_chain_readings USING btree (tenant_id);



--
-- Name: idx_bb_cc_read_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_cc_read_time ON public.bb_cold_chain_readings USING btree (tenant_id, recorded_at DESC);



--
-- Name: idx_bb_lookback_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_lookback_status ON public.bb_lookback_events USING btree (tenant_id, status);



--
-- Name: idx_bb_lookback_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_lookback_tenant ON public.bb_lookback_events USING btree (tenant_id);



--
-- Name: idx_bb_msbos_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_msbos_tenant ON public.bb_msbos_guidelines USING btree (tenant_id);



--
-- Name: idx_bb_recruit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_recruit_status ON public.bb_recruitment_campaigns USING btree (tenant_id, status);



--
-- Name: idx_bb_recruit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_recruit_tenant ON public.bb_recruitment_campaigns USING btree (tenant_id);



--
-- Name: idx_bb_ret_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_ret_status ON public.bb_blood_returns USING btree (tenant_id, status);



--
-- Name: idx_bb_ret_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bb_ret_tenant ON public.bb_blood_returns USING btree (tenant_id);



--
-- Name: idx_blood_components_blood_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_components_blood_group ON public.blood_components USING btree (blood_group);



--
-- Name: idx_blood_components_donation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_components_donation ON public.blood_components USING btree (donation_id);



--
-- Name: idx_blood_components_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_components_expiry ON public.blood_components USING btree (expiry_at);



--
-- Name: idx_blood_components_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_components_status ON public.blood_components USING btree (status);



--
-- Name: idx_blood_components_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_components_tenant ON public.blood_components USING btree (tenant_id);



--
-- Name: idx_blood_donations_donor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_donations_donor ON public.blood_donations USING btree (donor_id);



--
-- Name: idx_blood_donations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_donations_tenant ON public.blood_donations USING btree (tenant_id);



--
-- Name: idx_blood_donors_blood_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_donors_blood_group ON public.blood_donors USING btree (blood_group);



--
-- Name: idx_blood_donors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blood_donors_tenant ON public.blood_donors USING btree (tenant_id);



--
-- Name: idx_crossmatch_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossmatch_patient ON public.crossmatch_requests USING btree (patient_id);



--
-- Name: idx_crossmatch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossmatch_status ON public.crossmatch_requests USING btree (status);



--
-- Name: idx_crossmatch_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crossmatch_tenant ON public.crossmatch_requests USING btree (tenant_id);



--
-- Name: idx_transfusion_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfusion_component ON public.transfusion_records USING btree (component_id);



--
-- Name: idx_transfusion_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfusion_patient ON public.transfusion_records USING btree (patient_id);



--
-- Name: idx_transfusion_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfusion_tenant ON public.transfusion_records USING btree (tenant_id);



--
-- Name: idx_transfusions_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfusions_admission ON public.transfusions USING btree (tenant_id, admission_id, transfusion_date DESC);



--
-- Name: blood_donations audit_blood_donations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_blood_donations AFTER INSERT OR DELETE OR UPDATE ON public.blood_donations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('blood_bank');



--
-- Name: blood_components set_updated_at_blood_components; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_blood_components BEFORE UPDATE ON public.blood_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: blood_donors set_updated_at_blood_donors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_blood_donors BEFORE UPDATE ON public.blood_donors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: crossmatch_requests set_updated_at_crossmatch_requests; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_crossmatch_requests BEFORE UPDATE ON public.crossmatch_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: transfusion_records set_updated_at_transfusion_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_transfusion_records BEFORE UPDATE ON public.transfusion_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_billing_items trg_bb_bill_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_bill_updated_at BEFORE UPDATE ON public.bb_billing_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_cold_chain_devices trg_bb_cc_dev_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_cc_dev_updated_at BEFORE UPDATE ON public.bb_cold_chain_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_lookback_events trg_bb_lookback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_lookback_updated_at BEFORE UPDATE ON public.bb_lookback_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_msbos_guidelines trg_bb_msbos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_msbos_updated_at BEFORE UPDATE ON public.bb_msbos_guidelines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_recruitment_campaigns trg_bb_recruit_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_recruit_updated_at BEFORE UPDATE ON public.bb_recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_blood_returns trg_bb_ret_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bb_ret_updated_at BEFORE UPDATE ON public.bb_blood_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bb_billing_items bb_billing_items_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_billing_items
    ADD CONSTRAINT bb_billing_items_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.blood_components(id);



--
-- Name: bb_blood_returns bb_blood_returns_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_blood_returns
    ADD CONSTRAINT bb_blood_returns_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.blood_components(id);



--
-- Name: bb_cold_chain_readings bb_cold_chain_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_cold_chain_readings
    ADD CONSTRAINT bb_cold_chain_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.bb_cold_chain_devices(id);



--
-- Name: bb_lookback_events bb_lookback_events_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.blood_donations(id);



--
-- Name: bb_lookback_events bb_lookback_events_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bb_lookback_events
    ADD CONSTRAINT bb_lookback_events_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.blood_donors(id);



--
-- Name: blood_components blood_components_donation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_components
    ADD CONSTRAINT blood_components_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES public.blood_donations(id);



--
-- Name: blood_donations blood_donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blood_donations
    ADD CONSTRAINT blood_donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.blood_donors(id);



--
-- Name: crossmatch_requests crossmatch_requests_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crossmatch_requests
    ADD CONSTRAINT crossmatch_requests_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.blood_components(id);



--
-- Name: transfusion_records transfusion_records_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.blood_components(id);



--
-- Name: transfusion_records transfusion_records_crossmatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfusion_records
    ADD CONSTRAINT transfusion_records_crossmatch_id_fkey FOREIGN KEY (crossmatch_id) REFERENCES public.crossmatch_requests(id);



--
-- Name: bb_billing_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_billing_items ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_blood_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_blood_returns ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_cold_chain_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_cold_chain_devices ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_cold_chain_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_cold_chain_readings ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_lookback_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_lookback_events ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_msbos_guidelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_msbos_guidelines ENABLE ROW LEVEL SECURITY;


--
-- Name: bb_recruitment_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bb_recruitment_campaigns ENABLE ROW LEVEL SECURITY;


--
-- Name: blood_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blood_components ENABLE ROW LEVEL SECURITY;


--
-- Name: blood_components blood_components_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blood_components_tenant ON public.blood_components USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: blood_donations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blood_donations ENABLE ROW LEVEL SECURITY;


--
-- Name: blood_donations blood_donations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blood_donations_tenant ON public.blood_donations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: blood_donors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blood_donors ENABLE ROW LEVEL SECURITY;


--
-- Name: blood_donors blood_donors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blood_donors_tenant ON public.blood_donors USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: component_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.component_issues ENABLE ROW LEVEL SECURITY;


--
-- Name: crossmatch_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crossmatch_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: crossmatch_requests crossmatch_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crossmatch_requests_tenant ON public.crossmatch_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: bb_billing_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_billing_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_blood_returns tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_blood_returns USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_cold_chain_devices tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_cold_chain_devices USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_cold_chain_readings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_cold_chain_readings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_lookback_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_lookback_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_msbos_guidelines tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_msbos_guidelines USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bb_recruitment_campaigns tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bb_recruitment_campaigns USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: component_issues tenant_isolation_component_issues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_component_issues ON public.component_issues USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: transfusions tenant_isolation_transfusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_transfusions ON public.transfusions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: transfusion_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transfusion_records ENABLE ROW LEVEL SECURITY;


--
-- Name: transfusion_records transfusion_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfusion_records_tenant ON public.transfusion_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: transfusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transfusions ENABLE ROW LEVEL SECURITY;

