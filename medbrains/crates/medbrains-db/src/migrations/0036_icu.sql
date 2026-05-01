-- ============================================================
-- MedBrains schema — module: icu
-- ============================================================

--
-- Name: icu_bundle_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_bundle_checks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    device_id uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_by uuid NOT NULL,
    is_compliant boolean NOT NULL,
    still_needed boolean DEFAULT true NOT NULL,
    checklist jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    device_type public.device_type NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL,
    inserted_by uuid,
    removed_at timestamp with time zone,
    removed_by uuid,
    site character varying(200),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_flowsheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_flowsheets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    heart_rate integer,
    systolic_bp integer,
    diastolic_bp integer,
    mean_arterial_bp integer,
    respiratory_rate integer,
    spo2 numeric(5,2),
    temperature numeric(5,2),
    cvp numeric(5,2),
    intake_ml integer,
    output_ml integer,
    urine_ml integer,
    drain_ml integer,
    infusions jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_neonatal_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_neonatal_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    gestational_age_weeks integer,
    birth_weight_gm integer,
    current_weight_gm integer,
    bilirubin_total numeric(6,2),
    bilirubin_direct numeric(6,2),
    phototherapy_active boolean DEFAULT false NOT NULL,
    phototherapy_hours numeric(6,2),
    breast_milk_type character varying(50),
    breast_milk_volume_ml numeric(6,2),
    hearing_screen_result character varying(50),
    sepsis_screen_result character varying(100),
    mother_patient_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_nutrition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_nutrition (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    route public.nutrition_route NOT NULL,
    formula_name character varying(200),
    rate_ml_hr numeric(6,2),
    calories_kcal numeric(8,2),
    protein_gm numeric(6,2),
    volume_ml integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    score_type public.icu_score_type NOT NULL,
    score_value integer NOT NULL,
    score_details jsonb DEFAULT '{}'::jsonb,
    predicted_mortality numeric(5,2),
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    scored_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_ventilator_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icu_ventilator_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    mode public.ventilator_mode NOT NULL,
    fio2 numeric(5,2),
    peep numeric(5,2),
    tidal_volume integer,
    respiratory_rate integer,
    pip numeric(5,2),
    plateau_pressure numeric(5,2),
    ph numeric(5,3),
    pao2 numeric(6,2),
    paco2 numeric(6,2),
    hco3 numeric(5,2),
    sao2 numeric(5,2),
    lactate numeric(5,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: icu_bundle_checks icu_bundle_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_pkey PRIMARY KEY (id);



--
-- Name: icu_devices icu_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_devices
    ADD CONSTRAINT icu_devices_pkey PRIMARY KEY (id);



--
-- Name: icu_flowsheets icu_flowsheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_flowsheets
    ADD CONSTRAINT icu_flowsheets_pkey PRIMARY KEY (id);



--
-- Name: icu_neonatal_records icu_neonatal_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_neonatal_records
    ADD CONSTRAINT icu_neonatal_records_pkey PRIMARY KEY (id);



--
-- Name: icu_nutrition icu_nutrition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_nutrition
    ADD CONSTRAINT icu_nutrition_pkey PRIMARY KEY (id);



--
-- Name: icu_scores icu_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_scores
    ADD CONSTRAINT icu_scores_pkey PRIMARY KEY (id);



--
-- Name: icu_ventilator_records icu_ventilator_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_ventilator_records
    ADD CONSTRAINT icu_ventilator_records_pkey PRIMARY KEY (id);



--
-- Name: idx_icu_bundle_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_bundle_device ON public.icu_bundle_checks USING btree (device_id);



--
-- Name: idx_icu_bundle_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_bundle_tenant ON public.icu_bundle_checks USING btree (tenant_id);



--
-- Name: idx_icu_devices_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_devices_active ON public.icu_devices USING btree (is_active);



--
-- Name: idx_icu_devices_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_devices_admission ON public.icu_devices USING btree (admission_id);



--
-- Name: idx_icu_devices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_devices_tenant ON public.icu_devices USING btree (tenant_id);



--
-- Name: idx_icu_flowsheets_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_flowsheets_admission ON public.icu_flowsheets USING btree (admission_id);



--
-- Name: idx_icu_flowsheets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_flowsheets_tenant ON public.icu_flowsheets USING btree (tenant_id);



--
-- Name: idx_icu_flowsheets_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_flowsheets_time ON public.icu_flowsheets USING btree (recorded_at);



--
-- Name: idx_icu_neonatal_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_neonatal_admission ON public.icu_neonatal_records USING btree (admission_id);



--
-- Name: idx_icu_neonatal_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_neonatal_tenant ON public.icu_neonatal_records USING btree (tenant_id);



--
-- Name: idx_icu_nutrition_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_nutrition_admission ON public.icu_nutrition USING btree (admission_id);



--
-- Name: idx_icu_nutrition_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_nutrition_tenant ON public.icu_nutrition USING btree (tenant_id);



--
-- Name: idx_icu_scores_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_scores_admission ON public.icu_scores USING btree (admission_id);



--
-- Name: idx_icu_scores_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_scores_tenant ON public.icu_scores USING btree (tenant_id);



--
-- Name: idx_icu_scores_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_scores_type ON public.icu_scores USING btree (score_type);



--
-- Name: idx_icu_ventilator_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_ventilator_admission ON public.icu_ventilator_records USING btree (admission_id);



--
-- Name: idx_icu_ventilator_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icu_ventilator_tenant ON public.icu_ventilator_records USING btree (tenant_id);



--
-- Name: icu_devices set_updated_at_icu_devices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_icu_devices BEFORE UPDATE ON public.icu_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: icu_bundle_checks icu_bundle_checks_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icu_bundle_checks
    ADD CONSTRAINT icu_bundle_checks_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.icu_devices(id);



--
-- Name: icu_bundle_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_bundle_checks ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_bundle_checks icu_bundle_checks_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_bundle_checks_tenant ON public.icu_bundle_checks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_devices ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_devices icu_devices_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_devices_tenant ON public.icu_devices USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_flowsheets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_flowsheets ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_flowsheets icu_flowsheets_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_flowsheets_tenant ON public.icu_flowsheets USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_neonatal_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_neonatal_records ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_neonatal_records icu_neonatal_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_neonatal_records_tenant ON public.icu_neonatal_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_nutrition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_nutrition ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_nutrition icu_nutrition_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_nutrition_tenant ON public.icu_nutrition USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_scores ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_scores icu_scores_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_scores_tenant ON public.icu_scores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: icu_ventilator_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.icu_ventilator_records ENABLE ROW LEVEL SECURITY;


--
-- Name: icu_ventilator_records icu_ventilator_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY icu_ventilator_records_tenant ON public.icu_ventilator_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


