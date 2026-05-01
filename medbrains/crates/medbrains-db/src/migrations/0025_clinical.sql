-- ============================================================
-- MedBrains schema — module: clinical
-- ============================================================

--
-- Name: chief_complaint_masters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chief_complaint_masters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    synonyms text[] DEFAULT '{}'::text[],
    suggested_icd text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: clinical_protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    category text NOT NULL,
    description text,
    trigger_conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinical_protocols_category_check CHECK ((category = ANY (ARRAY['sepsis'::text, 'dvt_prophylaxis'::text, 'diabetes'::text, 'hypertension'::text, 'cardiac'::text, 'respiratory'::text, 'renal'::text, 'infection'::text, 'surgical'::text, 'other'::text])))
);



--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    icd_code text,
    description text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    severity character varying(20) DEFAULT 'moderate'::character varying,
    certainty character varying(20) DEFAULT 'confirmed'::character varying,
    onset_date date,
    resolved_date date,
    snomed_code character varying(20),
    snomed_display text
);



--
-- Name: icd10_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icd10_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(10) NOT NULL,
    short_desc text NOT NULL,
    long_desc text,
    category character varying(20),
    chapter character varying(10),
    is_billable boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: snomed_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.snomed_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    display_name text NOT NULL,
    semantic_tag character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vitals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    temperature numeric(4,1),
    pulse integer,
    systolic_bp integer,
    diastolic_bp integer,
    respiratory_rate integer,
    spo2 integer,
    weight_kg numeric(5,2),
    height_cm numeric(5,1),
    bmi numeric(4,1),
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_retrospective boolean DEFAULT false NOT NULL
);



--
-- Name: vitals_capture_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vitals_capture_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    frequency_minutes integer NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    next_due_at timestamp with time zone NOT NULL,
    last_captured_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vitals_capture_schedules_frequency_minutes_check CHECK (((frequency_minutes >= 15) AND (frequency_minutes <= 1440)))
);

ALTER TABLE ONLY public.vitals_capture_schedules FORCE ROW LEVEL SECURITY;



--
-- Name: chief_complaint_masters chief_complaint_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chief_complaint_masters
    ADD CONSTRAINT chief_complaint_masters_pkey PRIMARY KEY (id);



--
-- Name: clinical_protocols clinical_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_protocols
    ADD CONSTRAINT clinical_protocols_pkey PRIMARY KEY (id);



--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);



--
-- Name: icd10_codes icd10_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_codes
    ADD CONSTRAINT icd10_codes_code_key UNIQUE (code);



--
-- Name: icd10_codes icd10_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_codes
    ADD CONSTRAINT icd10_codes_pkey PRIMARY KEY (id);



--
-- Name: snomed_codes snomed_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snomed_codes
    ADD CONSTRAINT snomed_codes_code_key UNIQUE (code);



--
-- Name: snomed_codes snomed_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.snomed_codes
    ADD CONSTRAINT snomed_codes_pkey PRIMARY KEY (id);



--
-- Name: vitals_capture_schedules vitals_capture_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_capture_schedules
    ADD CONSTRAINT vitals_capture_schedules_pkey PRIMARY KEY (id);



--
-- Name: vitals vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_pkey PRIMARY KEY (id);



--
-- Name: idx_cc_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cc_search ON public.chief_complaint_masters USING gin (to_tsvector('english'::regconfig, (name)::text));



--
-- Name: idx_cc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cc_tenant ON public.chief_complaint_masters USING btree (tenant_id);



--
-- Name: idx_clinical_protocols_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_protocols_category ON public.clinical_protocols USING btree (tenant_id, category);



--
-- Name: idx_clinical_protocols_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinical_protocols_tenant ON public.clinical_protocols USING btree (tenant_id);



--
-- Name: idx_diagnoses_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diagnoses_encounter ON public.diagnoses USING btree (encounter_id);



--
-- Name: idx_diagnoses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diagnoses_tenant ON public.diagnoses USING btree (tenant_id);



--
-- Name: idx_icd10_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icd10_code ON public.icd10_codes USING btree (code);



--
-- Name: idx_icd10_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icd10_search ON public.icd10_codes USING gin (to_tsvector('english'::regconfig, short_desc));



--
-- Name: idx_snomed_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snomed_codes_code ON public.snomed_codes USING btree (code);



--
-- Name: idx_snomed_codes_display_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_snomed_codes_display_trgm ON public.snomed_codes USING gin (display_name public.gin_trgm_ops);



--
-- Name: idx_vitals_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vitals_encounter ON public.vitals USING btree (encounter_id);



--
-- Name: idx_vitals_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vitals_latest ON public.vitals USING btree (tenant_id, encounter_id, recorded_at DESC);



--
-- Name: idx_vitals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vitals_tenant ON public.vitals USING btree (tenant_id);



--
-- Name: vitals_schedule_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vitals_schedule_due_idx ON public.vitals_capture_schedules USING btree (tenant_id, next_due_at) WHERE (ended_at IS NULL);



--
-- Name: diagnoses audit_diagnoses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_diagnoses AFTER INSERT OR DELETE OR UPDATE ON public.diagnoses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');



--
-- Name: vitals audit_vitals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_vitals AFTER INSERT OR DELETE OR UPDATE ON public.vitals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');



--
-- Name: clinical_protocols set_updated_at_clinical_protocols; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_clinical_protocols BEFORE UPDATE ON public.clinical_protocols FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: chief_complaint_masters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chief_complaint_masters ENABLE ROW LEVEL SECURITY;


--
-- Name: chief_complaint_masters chief_complaint_masters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chief_complaint_masters_tenant ON public.chief_complaint_masters USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: clinical_protocols; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;


--
-- Name: clinical_protocols clinical_protocols_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clinical_protocols_tenant ON public.clinical_protocols USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: diagnoses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;


--
-- Name: diagnoses tenant_isolation_diagnoses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_diagnoses ON public.diagnoses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vitals tenant_isolation_vitals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vitals ON public.vitals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vitals_capture_schedules tenant_isolation_vitals_capture_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vitals_capture_schedules ON public.vitals_capture_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;


--
-- Name: vitals_capture_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vitals_capture_schedules ENABLE ROW LEVEL SECURITY;

