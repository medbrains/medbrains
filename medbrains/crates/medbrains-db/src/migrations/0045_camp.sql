-- ============================================================
-- MedBrains schema — module: camp
-- ============================================================

--
-- Name: camp_billing_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_followups; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_lab_samples; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_registrations; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_screenings; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.camp_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    role_in_camp text NOT NULL,
    is_confirmed boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camps; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: camp_billing_records camp_billing_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_pkey PRIMARY KEY (id);



--
-- Name: camp_followups camp_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_pkey PRIMARY KEY (id);



--
-- Name: camp_lab_samples camp_lab_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_pkey PRIMARY KEY (id);



--
-- Name: camp_registrations camp_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_pkey PRIMARY KEY (id);



--
-- Name: camp_screenings camp_screenings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_pkey PRIMARY KEY (id);



--
-- Name: camp_team_members camp_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_pkey PRIMARY KEY (id);



--
-- Name: camp_team_members camp_team_members_tenant_id_camp_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_tenant_id_camp_id_employee_id_key UNIQUE (tenant_id, camp_id, employee_id);



--
-- Name: camps camps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_pkey PRIMARY KEY (id);



--
-- Name: camps camps_tenant_id_camp_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camps
    ADD CONSTRAINT camps_tenant_id_camp_code_key UNIQUE (tenant_id, camp_code);



--
-- Name: idx_camp_bill_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_bill_reg ON public.camp_billing_records USING btree (tenant_id, registration_id);



--
-- Name: idx_camp_bill_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_bill_tenant ON public.camp_billing_records USING btree (tenant_id);



--
-- Name: idx_camp_fu_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_fu_date ON public.camp_followups USING btree (tenant_id, followup_date);



--
-- Name: idx_camp_fu_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_fu_reg ON public.camp_followups USING btree (tenant_id, registration_id);



--
-- Name: idx_camp_fu_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_fu_tenant ON public.camp_followups USING btree (tenant_id);



--
-- Name: idx_camp_lab_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_lab_reg ON public.camp_lab_samples USING btree (tenant_id, registration_id);



--
-- Name: idx_camp_lab_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_lab_tenant ON public.camp_lab_samples USING btree (tenant_id);



--
-- Name: idx_camp_reg_camp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_reg_camp ON public.camp_registrations USING btree (tenant_id, camp_id);



--
-- Name: idx_camp_reg_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_reg_patient ON public.camp_registrations USING btree (tenant_id, patient_id);



--
-- Name: idx_camp_reg_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_reg_tenant ON public.camp_registrations USING btree (tenant_id);



--
-- Name: idx_camp_scr_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_scr_reg ON public.camp_screenings USING btree (tenant_id, registration_id);



--
-- Name: idx_camp_scr_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_scr_tenant ON public.camp_screenings USING btree (tenant_id);



--
-- Name: idx_camp_team_camp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_team_camp ON public.camp_team_members USING btree (tenant_id, camp_id);



--
-- Name: idx_camp_team_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camp_team_tenant ON public.camp_team_members USING btree (tenant_id);



--
-- Name: idx_camps_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camps_date ON public.camps USING btree (tenant_id, scheduled_date DESC);



--
-- Name: idx_camps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camps_status ON public.camps USING btree (tenant_id, status);



--
-- Name: idx_camps_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_camps_tenant ON public.camps USING btree (tenant_id);



--
-- Name: camp_billing_records trg_camp_bill_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_bill_updated_at BEFORE UPDATE ON public.camp_billing_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_followups trg_camp_fu_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_fu_updated_at BEFORE UPDATE ON public.camp_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_lab_samples trg_camp_lab_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_lab_updated_at BEFORE UPDATE ON public.camp_lab_samples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_registrations trg_camp_reg_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_reg_updated_at BEFORE UPDATE ON public.camp_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_screenings trg_camp_scr_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_scr_updated_at BEFORE UPDATE ON public.camp_screenings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_team_members trg_camp_team_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_team_updated_at BEFORE UPDATE ON public.camp_team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camps trg_camps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camps_updated_at BEFORE UPDATE ON public.camps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: camp_billing_records camp_billing_records_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_billing_records
    ADD CONSTRAINT camp_billing_records_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);



--
-- Name: camp_followups camp_followups_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_followups
    ADD CONSTRAINT camp_followups_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);



--
-- Name: camp_lab_samples camp_lab_samples_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_lab_samples
    ADD CONSTRAINT camp_lab_samples_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);



--
-- Name: camp_registrations camp_registrations_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_registrations
    ADD CONSTRAINT camp_registrations_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id);



--
-- Name: camp_screenings camp_screenings_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_screenings
    ADD CONSTRAINT camp_screenings_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id);



--
-- Name: camp_team_members camp_team_members_camp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_team_members
    ADD CONSTRAINT camp_team_members_camp_id_fkey FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE;



--
-- Name: camp_billing_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_billing_records ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_followups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_followups ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_lab_samples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_lab_samples ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_registrations ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_screenings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_screenings ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camp_team_members ENABLE ROW LEVEL SECURITY;


--
-- Name: camps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;


--
-- Name: camp_billing_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_billing_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camp_followups tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_followups USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camp_lab_samples tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_lab_samples USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camp_registrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_registrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camp_screenings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_screenings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camp_team_members tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camp_team_members USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: camps tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.camps USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


