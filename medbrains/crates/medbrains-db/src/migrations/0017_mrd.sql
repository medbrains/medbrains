-- ============================================================
-- MedBrains schema — module: mrd
-- ============================================================

--
-- Name: mrd_birth_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_birth_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    register_number text NOT NULL,
    birth_date date NOT NULL,
    birth_time time without time zone,
    baby_gender text NOT NULL,
    baby_weight_grams integer,
    birth_type text DEFAULT 'normal'::text NOT NULL,
    apgar_1min smallint,
    apgar_5min smallint,
    complications text,
    attending_doctor_id uuid,
    certificate_number text,
    certificate_issued boolean DEFAULT false NOT NULL,
    father_name text,
    mother_age integer,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mrd_death_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_death_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    er_visit_id uuid,
    mlc_case_id uuid,
    register_number text NOT NULL,
    death_date date NOT NULL,
    death_time time without time zone,
    cause_of_death text,
    immediate_cause text,
    antecedent_cause text,
    underlying_cause text,
    manner_of_death text DEFAULT 'natural'::text NOT NULL,
    is_medico_legal boolean DEFAULT false NOT NULL,
    is_brought_dead boolean DEFAULT false NOT NULL,
    certifying_doctor_id uuid,
    certificate_number text,
    certificate_issued boolean DEFAULT false NOT NULL,
    reported_to_municipality boolean DEFAULT false NOT NULL,
    municipality_report_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mrd_form_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_form_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    form_type character varying(50) NOT NULL,
    template_id uuid,
    form_date date DEFAULT CURRENT_DATE NOT NULL,
    form_time time without time zone,
    shift character varying(20),
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    verified_by uuid,
    verified_at timestamp with time zone,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mrd_form_records_form_type_check CHECK (((form_type)::text = ANY ((ARRAY['progress_note'::character varying, 'nursing_assessment'::character varying, 'mar'::character varying, 'vitals_chart'::character varying, 'io_chart'::character varying, 'discharge_checklist'::character varying, 'pain_assessment'::character varying, 'fall_risk'::character varying, 'pressure_ulcer_risk'::character varying, 'gcs'::character varying, 'restraint_doc'::character varying, 'preop_checklist'::character varying, 'who_surgical_safety'::character varying, 'anesthesia_record'::character varying, 'operation_notes'::character varying, 'postop_orders'::character varying, 'blood_requisition'::character varying, 'transfusion_monitoring'::character varying, 'wound_assessment'::character varying, 'nutrition_screening'::character varying])::text[]))),
    CONSTRAINT mrd_form_records_shift_check CHECK (((shift)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'night'::character varying])::text[])))
);



--
-- Name: mrd_medical_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_medical_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    record_number text NOT NULL,
    record_type text DEFAULT 'opd'::text NOT NULL,
    volume_number integer DEFAULT 1 NOT NULL,
    total_pages integer,
    shelf_location text,
    status public.mrd_record_status DEFAULT 'active'::public.mrd_record_status NOT NULL,
    last_accessed_at timestamp with time zone,
    retention_years integer DEFAULT 5 NOT NULL,
    destruction_due_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mrd_record_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_record_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    medical_record_id uuid NOT NULL,
    issued_to_user_id uuid,
    issued_to_department_id uuid,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    returned_at timestamp with time zone,
    status public.mrd_movement_status DEFAULT 'issued'::public.mrd_movement_status NOT NULL,
    purpose text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mrd_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mrd_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    record_type text NOT NULL,
    category text NOT NULL,
    retention_years integer DEFAULT 5 NOT NULL,
    legal_reference text,
    destruction_method text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: mrd_birth_register mrd_birth_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_pkey PRIMARY KEY (id);



--
-- Name: mrd_birth_register mrd_birth_register_tenant_id_register_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_tenant_id_register_number_key UNIQUE (tenant_id, register_number);



--
-- Name: mrd_death_register mrd_death_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_pkey PRIMARY KEY (id);



--
-- Name: mrd_death_register mrd_death_register_tenant_id_register_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_tenant_id_register_number_key UNIQUE (tenant_id, register_number);



--
-- Name: mrd_form_records mrd_form_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_pkey PRIMARY KEY (id);



--
-- Name: mrd_medical_records mrd_medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_pkey PRIMARY KEY (id);



--
-- Name: mrd_medical_records mrd_medical_records_tenant_id_record_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_tenant_id_record_number_key UNIQUE (tenant_id, record_number);



--
-- Name: mrd_record_movements mrd_record_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_pkey PRIMARY KEY (id);



--
-- Name: mrd_retention_policies mrd_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_pkey PRIMARY KEY (id);



--
-- Name: mrd_retention_policies mrd_retention_policies_tenant_id_record_type_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_tenant_id_record_type_category_key UNIQUE (tenant_id, record_type, category);



--
-- Name: idx_mrd_birth_register_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_birth_register_date ON public.mrd_birth_register USING btree (tenant_id, birth_date);



--
-- Name: idx_mrd_birth_register_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_birth_register_patient ON public.mrd_birth_register USING btree (patient_id);



--
-- Name: idx_mrd_birth_register_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_birth_register_tenant ON public.mrd_birth_register USING btree (tenant_id);



--
-- Name: idx_mrd_death_register_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_death_register_date ON public.mrd_death_register USING btree (tenant_id, death_date);



--
-- Name: idx_mrd_death_register_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_death_register_patient ON public.mrd_death_register USING btree (patient_id);



--
-- Name: idx_mrd_death_register_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_death_register_tenant ON public.mrd_death_register USING btree (tenant_id);



--
-- Name: idx_mrd_form_records_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_form_records_admission ON public.mrd_form_records USING btree (admission_id);



--
-- Name: idx_mrd_form_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_form_records_date ON public.mrd_form_records USING btree (admission_id, form_date);



--
-- Name: idx_mrd_form_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_form_records_tenant ON public.mrd_form_records USING btree (tenant_id);



--
-- Name: idx_mrd_form_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_form_records_type ON public.mrd_form_records USING btree (form_type);



--
-- Name: idx_mrd_medical_records_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_medical_records_patient ON public.mrd_medical_records USING btree (patient_id);



--
-- Name: idx_mrd_medical_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_medical_records_status ON public.mrd_medical_records USING btree (tenant_id, status);



--
-- Name: idx_mrd_medical_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_medical_records_tenant ON public.mrd_medical_records USING btree (tenant_id);



--
-- Name: idx_mrd_record_movements_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_record_movements_record ON public.mrd_record_movements USING btree (medical_record_id);



--
-- Name: idx_mrd_record_movements_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_record_movements_status ON public.mrd_record_movements USING btree (tenant_id, status);



--
-- Name: idx_mrd_record_movements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_record_movements_tenant ON public.mrd_record_movements USING btree (tenant_id);



--
-- Name: idx_mrd_retention_policies_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrd_retention_policies_tenant ON public.mrd_retention_policies USING btree (tenant_id);



--
-- Name: mrd_birth_register trg_mrd_birth_register_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_birth_register_updated BEFORE UPDATE ON public.mrd_birth_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_death_register trg_mrd_death_register_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_death_register_updated BEFORE UPDATE ON public.mrd_death_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_form_records trg_mrd_form_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_form_records_updated_at BEFORE UPDATE ON public.mrd_form_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_medical_records trg_mrd_medical_records_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_medical_records_updated BEFORE UPDATE ON public.mrd_medical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_record_movements trg_mrd_record_movements_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_record_movements_updated BEFORE UPDATE ON public.mrd_record_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_retention_policies trg_mrd_retention_policies_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_retention_policies_updated BEFORE UPDATE ON public.mrd_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: mrd_record_movements mrd_record_movements_medical_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES public.mrd_medical_records(id);



--
-- Name: mrd_birth_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_birth_register ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_birth_register mrd_birth_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_birth_register_tenant ON public.mrd_birth_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mrd_death_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_death_register ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_death_register mrd_death_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_death_register_tenant ON public.mrd_death_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mrd_form_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_form_records ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_form_records mrd_form_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_form_records_tenant ON public.mrd_form_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mrd_medical_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_medical_records ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_medical_records mrd_medical_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_medical_records_tenant ON public.mrd_medical_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mrd_record_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_record_movements ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_record_movements mrd_record_movements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_record_movements_tenant ON public.mrd_record_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: mrd_retention_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mrd_retention_policies ENABLE ROW LEVEL SECURITY;


--
-- Name: mrd_retention_policies mrd_retention_policies_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_retention_policies_tenant ON public.mrd_retention_policies USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


