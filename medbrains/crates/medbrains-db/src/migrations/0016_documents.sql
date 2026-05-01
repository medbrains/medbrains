-- ============================================================
-- MedBrains schema — module: documents
-- ============================================================

--
-- Name: document_form_review_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_form_review_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    review_cycle_months integer DEFAULT 12 NOT NULL,
    last_reviewed_at timestamp with time zone,
    last_reviewed_by uuid,
    next_review_due date,
    review_status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: document_output_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_output_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_output_id uuid NOT NULL,
    signer_role text NOT NULL,
    signer_name text,
    designation text,
    registration_number text,
    signature_type public.signature_type DEFAULT 'pen_on_paper'::public.signature_type NOT NULL,
    signature_image_url text,
    biometric_hash text,
    aadhaar_ref text,
    thumb_impression boolean DEFAULT false NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    captured_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: document_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid,
    template_version integer,
    module_code text,
    source_table text,
    source_id uuid,
    patient_id uuid,
    visit_id uuid,
    admission_id uuid,
    document_number text NOT NULL,
    title text NOT NULL,
    category public.document_template_category DEFAULT 'custom'::public.document_template_category NOT NULL,
    status public.document_output_status DEFAULT 'generated'::public.document_output_status NOT NULL,
    file_url text,
    file_size_bytes bigint,
    mime_type text DEFAULT 'text/html'::text,
    page_count integer,
    print_count integer DEFAULT 0 NOT NULL,
    first_printed_at timestamp with time zone,
    last_printed_at timestamp with time zone,
    watermark public.watermark_type DEFAULT 'none'::public.watermark_type NOT NULL,
    language_code text DEFAULT 'en'::text,
    context_snapshot jsonb,
    qr_code_data text,
    document_hash text,
    generated_by uuid,
    voided_by uuid,
    voided_at timestamp with time zone,
    voided_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: document_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category public.document_template_category DEFAULT 'custom'::public.document_template_category NOT NULL,
    module_code text,
    description text,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    print_format public.print_format DEFAULT 'a4_portrait'::public.print_format NOT NULL,
    header_layout jsonb,
    body_layout jsonb,
    footer_layout jsonb,
    show_logo boolean DEFAULT true NOT NULL,
    logo_position text DEFAULT 'left'::text,
    show_hospital_name boolean DEFAULT true NOT NULL,
    show_hospital_address boolean DEFAULT true NOT NULL,
    show_hospital_phone boolean DEFAULT true NOT NULL,
    show_registration_no boolean DEFAULT false NOT NULL,
    show_accreditation boolean DEFAULT false NOT NULL,
    font_family text DEFAULT 'Arial'::text,
    font_size_pt integer DEFAULT 10,
    margin_top_mm integer DEFAULT 15,
    margin_bottom_mm integer DEFAULT 15,
    margin_left_mm integer DEFAULT 15,
    margin_right_mm integer DEFAULT 15,
    show_page_numbers boolean DEFAULT true NOT NULL,
    show_print_metadata boolean DEFAULT true NOT NULL,
    show_qr_code boolean DEFAULT false NOT NULL,
    default_watermark public.watermark_type DEFAULT 'none'::public.watermark_type NOT NULL,
    signature_blocks jsonb,
    required_context text[],
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_entity_id uuid
);



--
-- Name: medical_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    doctor_id uuid NOT NULL,
    certificate_type text NOT NULL,
    certificate_number text,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    valid_from date,
    valid_to date,
    diagnosis text,
    remarks text,
    body jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_void boolean DEFAULT false NOT NULL,
    voided_by uuid,
    voided_at timestamp with time zone,
    void_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medical_certificates_certificate_type_check CHECK ((certificate_type = ANY (ARRAY['medical'::text, 'fitness'::text, 'sick_leave'::text, 'disability'::text, 'death'::text, 'birth'::text, 'custom'::text])))
);



--
-- Name: document_form_review_schedule document_form_review_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_pkey PRIMARY KEY (id);



--
-- Name: document_form_review_schedule document_form_review_schedule_tenant_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_tenant_id_template_id_key UNIQUE (tenant_id, template_id);



--
-- Name: document_output_signatures document_output_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_pkey PRIMARY KEY (id);



--
-- Name: document_outputs document_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_pkey PRIMARY KEY (id);



--
-- Name: document_template_versions document_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_pkey PRIMARY KEY (id);



--
-- Name: document_template_versions document_template_versions_template_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_version_number_key UNIQUE (template_id, version_number);



--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);



--
-- Name: document_templates document_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: medical_certificates medical_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_pkey PRIMARY KEY (id);



--
-- Name: idx_doc_output_sigs_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_output_sigs_doc ON public.document_output_signatures USING btree (document_output_id);



--
-- Name: idx_document_outputs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_outputs_category ON public.document_outputs USING btree (tenant_id, category);



--
-- Name: idx_document_outputs_doc_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_outputs_doc_number ON public.document_outputs USING btree (tenant_id, document_number);



--
-- Name: idx_document_outputs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_outputs_module ON public.document_outputs USING btree (tenant_id, module_code);



--
-- Name: idx_document_outputs_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_outputs_patient ON public.document_outputs USING btree (tenant_id, patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_document_outputs_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_outputs_source ON public.document_outputs USING btree (tenant_id, source_table, source_id);



--
-- Name: idx_medical_certificates_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_certificates_encounter ON public.medical_certificates USING btree (encounter_id) WHERE (encounter_id IS NOT NULL);



--
-- Name: idx_medical_certificates_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_certificates_patient ON public.medical_certificates USING btree (tenant_id, patient_id);



--
-- Name: idx_medical_certificates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medical_certificates_tenant ON public.medical_certificates USING btree (tenant_id);



--
-- Name: medical_certificates set_updated_at_medical_certificates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_medical_certificates BEFORE UPDATE ON public.medical_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: document_form_review_schedule trg_document_form_review_schedule_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_form_review_schedule_updated_at BEFORE UPDATE ON public.document_form_review_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: document_outputs trg_document_outputs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_outputs_updated_at BEFORE UPDATE ON public.document_outputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: document_templates trg_document_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: document_form_review_schedule document_form_review_schedule_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE;



--
-- Name: document_output_signatures document_output_signatures_document_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_document_output_id_fkey FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id) ON DELETE CASCADE;



--
-- Name: document_outputs document_outputs_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);



--
-- Name: document_template_versions document_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE;



--
-- Name: document_form_review_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_form_review_schedule ENABLE ROW LEVEL SECURITY;


--
-- Name: document_form_review_schedule document_form_review_schedule_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_form_review_schedule_tenant ON public.document_form_review_schedule USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: document_output_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_output_signatures ENABLE ROW LEVEL SECURITY;


--
-- Name: document_output_signatures document_output_signatures_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_output_signatures_tenant ON public.document_output_signatures USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: document_outputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_outputs ENABLE ROW LEVEL SECURITY;


--
-- Name: document_outputs document_outputs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_outputs_tenant ON public.document_outputs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: document_template_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;


--
-- Name: document_template_versions document_template_versions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_template_versions_tenant ON public.document_template_versions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: document_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: document_templates document_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_templates_tenant ON public.document_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: medical_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;


--
-- Name: medical_certificates medical_certificates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medical_certificates_tenant ON public.medical_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


