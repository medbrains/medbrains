-- ============================================================
-- MedBrains schema — module: emergency
-- ============================================================

--
-- Name: death_other_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.death_other_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    death_record_id uuid NOT NULL,
    condition_description text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.death_other_conditions FORCE ROW LEVEL SECURITY;



--
-- Name: death_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.death_records FORCE ROW LEVEL SECURITY;



--
-- Name: er_code_activations; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: er_resuscitation_logs; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: er_triage_assessments; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: er_visits; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mass_casualty_events; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mlc_cases; Type: TABLE; Schema: public; Owner: -
--

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
    examining_doctor_id uuid
);



--
-- Name: mlc_documents; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mlc_police_intimations; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mortuary_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: death_other_conditions death_other_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_other_conditions
    ADD CONSTRAINT death_other_conditions_pkey PRIMARY KEY (id);



--
-- Name: death_records death_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_records
    ADD CONSTRAINT death_records_pkey PRIMARY KEY (id);



--
-- Name: er_code_activations er_code_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_pkey PRIMARY KEY (id);



--
-- Name: er_resuscitation_logs er_resuscitation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_pkey PRIMARY KEY (id);



--
-- Name: er_triage_assessments er_triage_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_pkey PRIMARY KEY (id);



--
-- Name: er_visits er_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT er_visits_pkey PRIMARY KEY (id);



--
-- Name: mass_casualty_events mass_casualty_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mass_casualty_events
    ADD CONSTRAINT mass_casualty_events_pkey PRIMARY KEY (id);



--
-- Name: mlc_cases mlc_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_pkey PRIMARY KEY (id);



--
-- Name: mlc_documents mlc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_pkey PRIMARY KEY (id);



--
-- Name: mlc_police_intimations mlc_police_intimations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_pkey PRIMARY KEY (id);



--
-- Name: mortuary_records mortuary_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_pkey PRIMARY KEY (id);



--
-- Name: mortuary_records mortuary_records_tenant_id_body_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mortuary_records
    ADD CONSTRAINT mortuary_records_tenant_id_body_receipt_number_key UNIQUE (tenant_id, body_receipt_number);



--
-- Name: idx_death_conditions_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_death_conditions_record ON public.death_other_conditions USING btree (death_record_id, display_order);



--
-- Name: idx_death_records_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_death_records_patient ON public.death_records USING btree (tenant_id, patient_id, created_at DESC);



--
-- Name: idx_er_codes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_codes_tenant ON public.er_code_activations USING btree (tenant_id);



--
-- Name: idx_er_codes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_codes_type ON public.er_code_activations USING btree (tenant_id, code_type);



--
-- Name: idx_er_resus_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_resus_tenant ON public.er_resuscitation_logs USING btree (tenant_id);



--
-- Name: idx_er_resus_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_resus_visit ON public.er_resuscitation_logs USING btree (er_visit_id);



--
-- Name: idx_er_triage_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_triage_tenant ON public.er_triage_assessments USING btree (tenant_id);



--
-- Name: idx_er_triage_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_triage_visit ON public.er_triage_assessments USING btree (er_visit_id);



--
-- Name: idx_er_visits_arrival; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_visits_arrival ON public.er_visits USING btree (tenant_id, arrival_time);



--
-- Name: idx_er_visits_mlc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_visits_mlc ON public.er_visits USING btree (tenant_id, is_mlc) WHERE (is_mlc = true);



--
-- Name: idx_er_visits_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_visits_patient ON public.er_visits USING btree (tenant_id, patient_id);



--
-- Name: idx_er_visits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_visits_status ON public.er_visits USING btree (tenant_id, status);



--
-- Name: idx_er_visits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_er_visits_tenant ON public.er_visits USING btree (tenant_id);



--
-- Name: idx_mass_casualty_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mass_casualty_status ON public.mass_casualty_events USING btree (tenant_id, status);



--
-- Name: idx_mass_casualty_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mass_casualty_tenant ON public.mass_casualty_events USING btree (tenant_id);



--
-- Name: idx_mlc_docs_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_docs_case ON public.mlc_documents USING btree (mlc_case_id);



--
-- Name: idx_mlc_docs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_docs_tenant ON public.mlc_documents USING btree (tenant_id);



--
-- Name: idx_mlc_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mlc_number ON public.mlc_cases USING btree (tenant_id, mlc_number);



--
-- Name: idx_mlc_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_patient ON public.mlc_cases USING btree (tenant_id, patient_id);



--
-- Name: idx_mlc_police_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_police_case ON public.mlc_police_intimations USING btree (mlc_case_id);



--
-- Name: idx_mlc_police_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_police_tenant ON public.mlc_police_intimations USING btree (tenant_id);



--
-- Name: idx_mlc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_status ON public.mlc_cases USING btree (tenant_id, status);



--
-- Name: idx_mlc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mlc_tenant ON public.mlc_cases USING btree (tenant_id);



--
-- Name: idx_mortuary_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mortuary_records_status ON public.mortuary_records USING btree (tenant_id, status);



--
-- Name: idx_mortuary_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mortuary_records_tenant ON public.mortuary_records USING btree (tenant_id);



--
-- Name: er_visits audit_er_visits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_er_visits AFTER INSERT OR DELETE OR UPDATE ON public.er_visits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('emergency');



--
-- Name: er_code_activations set_er_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_codes_updated_at BEFORE UPDATE ON public.er_code_activations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: er_resuscitation_logs set_er_resus_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_resus_updated_at BEFORE UPDATE ON public.er_resuscitation_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: er_triage_assessments set_er_triage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_triage_updated_at BEFORE UPDATE ON public.er_triage_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: er_visits set_er_visits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_er_visits_updated_at BEFORE UPDATE ON public.er_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mass_casualty_events set_mass_casualty_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mass_casualty_updated_at BEFORE UPDATE ON public.mass_casualty_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mlc_cases set_mlc_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_cases_updated_at BEFORE UPDATE ON public.mlc_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mlc_documents set_mlc_docs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_docs_updated_at BEFORE UPDATE ON public.mlc_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mlc_police_intimations set_mlc_police_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_mlc_police_updated_at BEFORE UPDATE ON public.mlc_police_intimations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mortuary_records trg_mortuary_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mortuary_records_updated_at BEFORE UPDATE ON public.mortuary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: death_other_conditions death_other_conditions_death_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.death_other_conditions
    ADD CONSTRAINT death_other_conditions_death_record_id_fkey FOREIGN KEY (death_record_id) REFERENCES public.death_records(id) ON DELETE CASCADE;



--
-- Name: er_code_activations er_code_activations_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_code_activations
    ADD CONSTRAINT er_code_activations_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);



--
-- Name: er_resuscitation_logs er_resuscitation_logs_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_resuscitation_logs
    ADD CONSTRAINT er_resuscitation_logs_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);



--
-- Name: er_triage_assessments er_triage_assessments_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_triage_assessments
    ADD CONSTRAINT er_triage_assessments_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);



--
-- Name: er_visits fk_er_visits_mass_casualty; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.er_visits
    ADD CONSTRAINT fk_er_visits_mass_casualty FOREIGN KEY (mass_casualty_event_id) REFERENCES public.mass_casualty_events(id);



--
-- Name: mlc_cases mlc_cases_er_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_cases
    ADD CONSTRAINT mlc_cases_er_visit_id_fkey FOREIGN KEY (er_visit_id) REFERENCES public.er_visits(id);



--
-- Name: mlc_documents mlc_documents_mlc_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_documents
    ADD CONSTRAINT mlc_documents_mlc_case_id_fkey FOREIGN KEY (mlc_case_id) REFERENCES public.mlc_cases(id);



--
-- Name: mlc_police_intimations mlc_police_intimations_mlc_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mlc_police_intimations
    ADD CONSTRAINT mlc_police_intimations_mlc_case_id_fkey FOREIGN KEY (mlc_case_id) REFERENCES public.mlc_cases(id);



--
-- Name: death_other_conditions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.death_other_conditions ENABLE ROW LEVEL SECURITY;


--
-- Name: death_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.death_records ENABLE ROW LEVEL SECURITY;


--
-- Name: er_code_activations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.er_code_activations ENABLE ROW LEVEL SECURITY;


--
-- Name: er_code_activations er_codes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_codes_tenant ON public.er_code_activations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: er_resuscitation_logs er_resus_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_resus_tenant ON public.er_resuscitation_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: er_resuscitation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.er_resuscitation_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: er_triage_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.er_triage_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: er_triage_assessments er_triage_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_triage_tenant ON public.er_triage_assessments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: er_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.er_visits ENABLE ROW LEVEL SECURITY;


--
-- Name: er_visits er_visits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY er_visits_tenant ON public.er_visits USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mass_casualty_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mass_casualty_events ENABLE ROW LEVEL SECURITY;


--
-- Name: mass_casualty_events mass_casualty_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mass_casualty_tenant ON public.mass_casualty_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mlc_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mlc_cases ENABLE ROW LEVEL SECURITY;


--
-- Name: mlc_documents mlc_docs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_docs_tenant ON public.mlc_documents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mlc_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mlc_documents ENABLE ROW LEVEL SECURITY;


--
-- Name: mlc_police_intimations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mlc_police_intimations ENABLE ROW LEVEL SECURITY;


--
-- Name: mlc_police_intimations mlc_police_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_police_tenant ON public.mlc_police_intimations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mlc_cases mlc_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mlc_tenant ON public.mlc_cases USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mortuary_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mortuary_records ENABLE ROW LEVEL SECURITY;


--
-- Name: mortuary_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.mortuary_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: death_other_conditions tenant_isolation_death_other_conditions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_death_other_conditions ON public.death_other_conditions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: death_records tenant_isolation_death_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_death_records ON public.death_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


