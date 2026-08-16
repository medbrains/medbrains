-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 20
-- Drops: none
-- mrd — schema.
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



-- Migration: 0233_case_sheet_scans.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Handwritten case-sheet digitization (RFC-CASE-SHEET-DIGITIZATION). Scanned paper case sheets
-- are uploaded, parsed by an async on-prem MinerU+VLM worker into a structured, per-field draft
-- with confidence, then doctor-reviewed and committed to the EMR. This is the B2 ingestion
-- record; the worker polls status='parsing' and posts results back. Tenant RLS.

CREATE TABLE public.case_sheet_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    scan_image_url text NOT NULL,
    status text DEFAULT 'uploaded'::text NOT NULL,
    extracted_json jsonb,
    overall_confidence numeric(5,2),
    parse_error text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_sheet_scans_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'parsing'::text, 'parsed'::text, 'reviewing'::text, 'committed'::text, 'failed'::text, 'image_only'::text])))
);

-- Name: case_sheet_scans case_sheet_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_sheet_scans
    ADD CONSTRAINT case_sheet_scans_pkey PRIMARY KEY (id);

CREATE INDEX idx_case_sheet_scans_patient ON public.case_sheet_scans USING btree (tenant_id, patient_id);

CREATE INDEX idx_case_sheet_scans_status ON public.case_sheet_scans USING btree (tenant_id, status);

ALTER TABLE public.case_sheet_scans ENABLE ROW LEVEL SECURITY;

-- Name: case_sheet_scans case_sheet_scans_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY case_sheet_scans_tenant_isolation ON public.case_sheet_scans USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: case_sheet_scans case_sheet_scans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER case_sheet_scans_updated_at BEFORE UPDATE ON public.case_sheet_scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: document_form_review_schedule document_form_review_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_pkey PRIMARY KEY (id);

-- Name: document_form_review_schedule document_form_review_schedule_tenant_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_tenant_id_template_id_key UNIQUE (tenant_id, template_id);

CREATE INDEX idx_document_form_review_schedule_deleted_at_7a6f6511 ON public.document_form_review_schedule USING btree (deleted_at);

CREATE INDEX idx_document_form_review_schedule_template_id ON public.document_form_review_schedule USING btree (template_id);

ALTER TABLE public.document_form_review_schedule ENABLE ROW LEVEL SECURITY;

-- Name: document_form_review_schedule document_form_review_schedule_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_form_review_schedule_tenant ON public.document_form_review_schedule USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: document_form_review_schedule trg_document_form_review_schedule_soft_delete_7a6f6511; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_form_review_schedule_soft_delete_7a6f6511 BEFORE DELETE ON public.document_form_review_schedule FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: document_form_review_schedule trg_document_form_review_schedule_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_form_review_schedule_updated_at BEFORE UPDATE ON public.document_form_review_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0181_document_ingestion.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Reverse print / document ingestion. Printing is digital → paper
-- (print_case_sheet_packet). This is the reverse: scanned paper is uploaded,
-- barcode-linked back to its MRD record (or case-sheet packet), optionally
-- OCR'd, and filed — so the record round-trips both ways. Bulk-friendly via
-- batches. The extracted_text column is populated by an OCR worker or manually
-- (the OCR engine itself is a pluggable follow-up).

CREATE TABLE public.document_ingestion_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    label text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_ingestion_batches_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);

-- Name: document_ingestion_batches document_ingestion_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_ingestion_batches
    ADD CONSTRAINT document_ingestion_batches_pkey PRIMARY KEY (id);

ALTER TABLE public.document_ingestion_batches ENABLE ROW LEVEL SECURITY;

-- Name: document_ingestion_batches tenant_isolation_document_ingestion_batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_document_ingestion_batches ON public.document_ingestion_batches USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE TABLE public.document_ingestion_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    file_url text NOT NULL,
    original_filename text NOT NULL,
    mime_type text,
    barcode text,
    linked_medical_record_id uuid,
    linked_packet_id uuid,
    extracted_text text,
    status text DEFAULT 'uploaded'::text NOT NULL,
    notes text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ocr_status text,
    CONSTRAINT document_ingestion_items_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'linked'::text, 'filed'::text])))
);

-- Name: document_ingestion_items document_ingestion_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_ingestion_items
    ADD CONSTRAINT document_ingestion_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_document_ingestion_items_batch ON public.document_ingestion_items USING btree (tenant_id, batch_id, created_at DESC);

ALTER TABLE public.document_ingestion_items ENABLE ROW LEVEL SECURITY;

-- Name: document_ingestion_items tenant_isolation_document_ingestion_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_document_ingestion_items ON public.document_ingestion_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: document_output_signatures document_output_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_pkey PRIMARY KEY (id);

CREATE INDEX idx_doc_output_sigs_doc ON public.document_output_signatures USING btree (document_output_id);

CREATE INDEX idx_document_output_signatures_deleted_at_44d04762 ON public.document_output_signatures USING btree (deleted_at);

CREATE INDEX idx_document_output_signatures_tenant_id ON public.document_output_signatures USING btree (tenant_id);

ALTER TABLE public.document_output_signatures ENABLE ROW LEVEL SECURITY;

-- Name: document_output_signatures document_output_signatures_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_output_signatures_tenant ON public.document_output_signatures USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: document_output_signatures trg_document_output_signatures_soft_delete_44d04762; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_output_signatures_soft_delete_44d04762 BEFORE DELETE ON public.document_output_signatures FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: document_outputs document_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_pkey PRIMARY KEY (id);

CREATE INDEX idx_document_outputs_category ON public.document_outputs USING btree (tenant_id, category);

CREATE INDEX idx_document_outputs_deleted_at_676717e8 ON public.document_outputs USING btree (deleted_at);

CREATE INDEX idx_document_outputs_doc_number ON public.document_outputs USING btree (tenant_id, document_number);

CREATE INDEX idx_document_outputs_module ON public.document_outputs USING btree (tenant_id, module_code);

CREATE INDEX idx_document_outputs_patient ON public.document_outputs USING btree (tenant_id, patient_id) WHERE (patient_id IS NOT NULL);

CREATE INDEX idx_document_outputs_patient_id ON public.document_outputs USING btree (patient_id);

CREATE INDEX idx_document_outputs_source ON public.document_outputs USING btree (tenant_id, source_table, source_id);

CREATE INDEX idx_document_outputs_template_id ON public.document_outputs USING btree (template_id);

ALTER TABLE public.document_outputs ENABLE ROW LEVEL SECURITY;

-- Name: document_outputs document_outputs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_outputs_tenant ON public.document_outputs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: document_outputs trg_document_outputs_soft_delete_676717e8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_outputs_soft_delete_676717e8 BEFORE DELETE ON public.document_outputs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: document_outputs trg_document_outputs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_outputs_updated_at BEFORE UPDATE ON public.document_outputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.document_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    change_summary text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: document_template_versions document_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_pkey PRIMARY KEY (id);

-- Name: document_template_versions document_template_versions_template_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_version_number_key UNIQUE (template_id, version_number);

CREATE INDEX idx_document_template_versions_deleted_at_470bd5d4 ON public.document_template_versions USING btree (deleted_at);

CREATE INDEX idx_document_template_versions_tenant_id ON public.document_template_versions USING btree (tenant_id);

ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;

-- Name: document_template_versions document_template_versions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_template_versions_tenant ON public.document_template_versions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: document_template_versions trg_document_template_versions_soft_delete_470bd5d4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_template_versions_soft_delete_470bd5d4 BEFORE DELETE ON public.document_template_versions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    brand_entity_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);

-- Name: document_templates document_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_document_templates_deleted_at_95345dab ON public.document_templates USING btree (deleted_at);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Name: document_templates document_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_templates_tenant ON public.document_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: document_templates trg_document_templates_soft_delete_95345dab; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_templates_soft_delete_95345dab BEFORE DELETE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: document_templates trg_document_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT medical_certificates_certificate_type_check CHECK ((certificate_type = ANY (ARRAY['medical'::text, 'fitness'::text, 'sick_leave'::text, 'disability'::text, 'death'::text, 'birth'::text, 'custom'::text])))
);

-- Name: medical_certificates medical_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_certificates
    ADD CONSTRAINT medical_certificates_pkey PRIMARY KEY (id);

CREATE INDEX idx_medical_certificates_deleted_at_6168ce0f ON public.medical_certificates USING btree (deleted_at);

CREATE INDEX idx_medical_certificates_doctor_id ON public.medical_certificates USING btree (doctor_id);

CREATE INDEX idx_medical_certificates_encounter ON public.medical_certificates USING btree (encounter_id) WHERE (encounter_id IS NOT NULL);

CREATE INDEX idx_medical_certificates_patient ON public.medical_certificates USING btree (tenant_id, patient_id);

CREATE INDEX idx_medical_certificates_patient_id ON public.medical_certificates USING btree (patient_id);

CREATE INDEX idx_medical_certificates_tenant ON public.medical_certificates USING btree (tenant_id);

ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;

-- Name: medical_certificates medical_certificates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY medical_certificates_tenant ON public.medical_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: medical_certificates set_updated_at_medical_certificates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_medical_certificates BEFORE UPDATE ON public.medical_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: medical_certificates trg_medical_certificates_soft_delete_6168ce0f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_medical_certificates_soft_delete_6168ce0f BEFORE DELETE ON public.medical_certificates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mrd_birth_register mrd_birth_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_pkey PRIMARY KEY (id);

-- Name: mrd_birth_register mrd_birth_register_tenant_id_register_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_birth_register
    ADD CONSTRAINT mrd_birth_register_tenant_id_register_number_key UNIQUE (tenant_id, register_number);

CREATE INDEX idx_mrd_birth_register_admission_id ON public.mrd_birth_register USING btree (admission_id);

CREATE INDEX idx_mrd_birth_register_date ON public.mrd_birth_register USING btree (tenant_id, birth_date);

CREATE INDEX idx_mrd_birth_register_deleted_at_8ba0ff63 ON public.mrd_birth_register USING btree (deleted_at);

CREATE INDEX idx_mrd_birth_register_patient ON public.mrd_birth_register USING btree (patient_id);

CREATE INDEX idx_mrd_birth_register_tenant ON public.mrd_birth_register USING btree (tenant_id);

ALTER TABLE public.mrd_birth_register ENABLE ROW LEVEL SECURITY;

-- Name: mrd_birth_register mrd_birth_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_birth_register_tenant ON public.mrd_birth_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_birth_register trg_mrd_birth_register_soft_delete_8ba0ff63; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_birth_register_soft_delete_8ba0ff63 BEFORE DELETE ON public.mrd_birth_register FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_birth_register trg_mrd_birth_register_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_birth_register_updated BEFORE UPDATE ON public.mrd_birth_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.mrd_case_sheet_packets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    admission_id uuid,
    medical_record_id uuid,
    packet_number text NOT NULL,
    packet_type text NOT NULL,
    status text DEFAULT 'generated'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    page_count integer DEFAULT 0 NOT NULL,
    document_output_id uuid,
    print_job_id uuid,
    storage_location_id uuid,
    shelf_location text,
    source_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    reprint_reason text,
    notes text,
    generated_by uuid,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    printed_by uuid,
    printed_at timestamp with time zone,
    filed_by uuid,
    filed_at timestamp with time zone,
    voided_by uuid,
    voided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT mrd_case_sheet_packets_packet_type_check CHECK ((packet_type = ANY (ARRAY['opd'::text, 'ipd'::text]))),
    CONSTRAINT mrd_case_sheet_packets_page_count_check CHECK ((page_count >= 0)),
    CONSTRAINT mrd_case_sheet_packets_source_check CHECK ((((packet_type = 'opd'::text) AND (encounter_id IS NOT NULL)) OR ((packet_type = 'ipd'::text) AND (admission_id IS NOT NULL)))),
    CONSTRAINT mrd_case_sheet_packets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'generated'::text, 'printed'::text, 'filed'::text, 'issued'::text, 'returned'::text, 'deficient'::text, 'voided'::text]))),
    CONSTRAINT mrd_case_sheet_packets_version_check CHECK ((version > 0))
);

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_pkey PRIMARY KEY (id);

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_tenant_packet_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_tenant_packet_number_key UNIQUE (tenant_id, packet_number);

CREATE INDEX idx_mrd_case_sheet_packets_admission ON public.mrd_case_sheet_packets USING btree (tenant_id, admission_id) WHERE (admission_id IS NOT NULL);

CREATE INDEX idx_mrd_case_sheet_packets_admission_id ON public.mrd_case_sheet_packets USING btree (admission_id);

CREATE INDEX idx_mrd_case_sheet_packets_deleted_at_152ec3b0 ON public.mrd_case_sheet_packets USING btree (deleted_at);

CREATE INDEX idx_mrd_case_sheet_packets_encounter ON public.mrd_case_sheet_packets USING btree (tenant_id, encounter_id) WHERE (encounter_id IS NOT NULL);

CREATE INDEX idx_mrd_case_sheet_packets_encounter_id ON public.mrd_case_sheet_packets USING btree (encounter_id);

CREATE INDEX idx_mrd_case_sheet_packets_patient ON public.mrd_case_sheet_packets USING btree (tenant_id, patient_id, created_at DESC);

CREATE INDEX idx_mrd_case_sheet_packets_patient_id ON public.mrd_case_sheet_packets USING btree (patient_id);

CREATE INDEX idx_mrd_case_sheet_packets_status ON public.mrd_case_sheet_packets USING btree (tenant_id, status, packet_type);

ALTER TABLE public.mrd_case_sheet_packets ENABLE ROW LEVEL SECURITY;

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_case_sheet_packets_tenant ON public.mrd_case_sheet_packets USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_case_sheet_packets trg_mrd_case_sheet_packets_soft_delete_152ec3b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_case_sheet_packets_soft_delete_152ec3b0 BEFORE DELETE ON public.mrd_case_sheet_packets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_case_sheet_packets trg_mrd_case_sheet_packets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_case_sheet_packets_updated_at BEFORE UPDATE ON public.mrd_case_sheet_packets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.mrd_case_sheet_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    packet_id uuid NOT NULL,
    page_code text NOT NULL,
    page_title text NOT NULL,
    page_order integer NOT NULL,
    source_module text,
    source_table text,
    source_id uuid,
    document_output_id uuid,
    is_required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp with time zone,
    printed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    deficiency_reason text,
    marked_deficient_by uuid,
    marked_deficient_at timestamp with time zone,
    CONSTRAINT mrd_case_sheet_pages_page_order_check CHECK ((page_order > 0)),
    CONSTRAINT mrd_case_sheet_pages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'available'::text, 'printed'::text, 'deficient'::text, 'waived'::text])))
);

-- Name: mrd_case_sheet_pages mrd_case_sheet_pages_packet_page_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_packet_page_code_key UNIQUE (packet_id, page_code);

-- Name: mrd_case_sheet_pages mrd_case_sheet_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_pkey PRIMARY KEY (id);

CREATE INDEX idx_mrd_case_sheet_pages_deleted_at_70c0853d ON public.mrd_case_sheet_pages USING btree (deleted_at);

CREATE INDEX idx_mrd_case_sheet_pages_packet ON public.mrd_case_sheet_pages USING btree (packet_id, page_order);

CREATE INDEX idx_mrd_case_sheet_pages_tenant_id ON public.mrd_case_sheet_pages USING btree (tenant_id);

ALTER TABLE public.mrd_case_sheet_pages ENABLE ROW LEVEL SECURITY;

-- Name: mrd_case_sheet_pages mrd_case_sheet_pages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_case_sheet_pages_tenant ON public.mrd_case_sheet_pages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_case_sheet_pages trg_mrd_case_sheet_pages_soft_delete_70c0853d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_case_sheet_pages_soft_delete_70c0853d BEFORE DELETE ON public.mrd_case_sheet_pages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_case_sheet_pages trg_mrd_case_sheet_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_case_sheet_pages_updated_at BEFORE UPDATE ON public.mrd_case_sheet_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mrd_death_register mrd_death_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_pkey PRIMARY KEY (id);

-- Name: mrd_death_register mrd_death_register_tenant_id_register_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_death_register
    ADD CONSTRAINT mrd_death_register_tenant_id_register_number_key UNIQUE (tenant_id, register_number);

CREATE INDEX idx_mrd_death_register_admission_id ON public.mrd_death_register USING btree (admission_id);

CREATE INDEX idx_mrd_death_register_date ON public.mrd_death_register USING btree (tenant_id, death_date);

CREATE INDEX idx_mrd_death_register_deleted_at_b8755adf ON public.mrd_death_register USING btree (deleted_at);

CREATE INDEX idx_mrd_death_register_patient ON public.mrd_death_register USING btree (patient_id);

CREATE INDEX idx_mrd_death_register_tenant ON public.mrd_death_register USING btree (tenant_id);

ALTER TABLE public.mrd_death_register ENABLE ROW LEVEL SECURITY;

-- Name: mrd_death_register mrd_death_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_death_register_tenant ON public.mrd_death_register USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_death_register trg_mrd_death_register_soft_delete_b8755adf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_death_register_soft_delete_b8755adf BEFORE DELETE ON public.mrd_death_register FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_death_register trg_mrd_death_register_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_death_register_updated BEFORE UPDATE ON public.mrd_death_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT mrd_form_records_form_type_check CHECK (((form_type)::text = ANY (ARRAY[('progress_note'::character varying)::text, ('nursing_assessment'::character varying)::text, ('mar'::character varying)::text, ('vitals_chart'::character varying)::text, ('io_chart'::character varying)::text, ('discharge_checklist'::character varying)::text, ('pain_assessment'::character varying)::text, ('fall_risk'::character varying)::text, ('pressure_ulcer_risk'::character varying)::text, ('gcs'::character varying)::text, ('restraint_doc'::character varying)::text, ('preop_checklist'::character varying)::text, ('who_surgical_safety'::character varying)::text, ('anesthesia_record'::character varying)::text, ('operation_notes'::character varying)::text, ('postop_orders'::character varying)::text, ('blood_requisition'::character varying)::text, ('transfusion_monitoring'::character varying)::text, ('wound_assessment'::character varying)::text, ('nutrition_screening'::character varying)::text]))),
    CONSTRAINT mrd_form_records_shift_check CHECK (((shift)::text = ANY (ARRAY[('morning'::character varying)::text, ('afternoon'::character varying)::text, ('night'::character varying)::text])))
);

-- Name: mrd_form_records mrd_form_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_mrd_form_records_admission ON public.mrd_form_records USING btree (admission_id);

CREATE INDEX idx_mrd_form_records_date ON public.mrd_form_records USING btree (admission_id, form_date);

CREATE INDEX idx_mrd_form_records_deleted_at_32a8231d ON public.mrd_form_records USING btree (deleted_at);

CREATE INDEX idx_mrd_form_records_template_id ON public.mrd_form_records USING btree (template_id);

CREATE INDEX idx_mrd_form_records_tenant ON public.mrd_form_records USING btree (tenant_id);

CREATE INDEX idx_mrd_form_records_type ON public.mrd_form_records USING btree (form_type);

ALTER TABLE public.mrd_form_records ENABLE ROW LEVEL SECURITY;

-- Name: mrd_form_records mrd_form_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_form_records_tenant ON public.mrd_form_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_form_records trg_mrd_form_records_soft_delete_32a8231d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_form_records_soft_delete_32a8231d BEFORE DELETE ON public.mrd_form_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_form_records trg_mrd_form_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_form_records_updated_at BEFORE UPDATE ON public.mrd_form_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mrd_medical_records mrd_medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_pkey PRIMARY KEY (id);

-- Name: mrd_medical_records mrd_medical_records_tenant_id_record_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_medical_records
    ADD CONSTRAINT mrd_medical_records_tenant_id_record_number_key UNIQUE (tenant_id, record_number);

CREATE INDEX idx_mrd_medical_records_deleted_at_ada3a6cc ON public.mrd_medical_records USING btree (deleted_at);

CREATE INDEX idx_mrd_medical_records_patient ON public.mrd_medical_records USING btree (patient_id);

CREATE INDEX idx_mrd_medical_records_status ON public.mrd_medical_records USING btree (tenant_id, status);

CREATE INDEX idx_mrd_medical_records_tenant ON public.mrd_medical_records USING btree (tenant_id);

ALTER TABLE public.mrd_medical_records ENABLE ROW LEVEL SECURITY;

-- Name: mrd_medical_records mrd_medical_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_medical_records_tenant ON public.mrd_medical_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_medical_records trg_mrd_medical_records_soft_delete_ada3a6cc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_medical_records_soft_delete_ada3a6cc BEFORE DELETE ON public.mrd_medical_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_medical_records trg_mrd_medical_records_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_medical_records_updated BEFORE UPDATE ON public.mrd_medical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mrd_record_movements mrd_record_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_pkey PRIMARY KEY (id);

CREATE INDEX idx_mrd_record_movements_deleted_at_2a2354f9 ON public.mrd_record_movements USING btree (deleted_at);

CREATE INDEX idx_mrd_record_movements_record ON public.mrd_record_movements USING btree (medical_record_id);

CREATE INDEX idx_mrd_record_movements_status ON public.mrd_record_movements USING btree (tenant_id, status);

CREATE INDEX idx_mrd_record_movements_tenant ON public.mrd_record_movements USING btree (tenant_id);

ALTER TABLE public.mrd_record_movements ENABLE ROW LEVEL SECURITY;

-- Name: mrd_record_movements mrd_record_movements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_record_movements_tenant ON public.mrd_record_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_record_movements trg_mrd_record_movements_soft_delete_2a2354f9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_record_movements_soft_delete_2a2354f9 BEFORE DELETE ON public.mrd_record_movements FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_record_movements trg_mrd_record_movements_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_record_movements_updated BEFORE UPDATE ON public.mrd_record_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: mrd_retention_policies mrd_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_pkey PRIMARY KEY (id);

-- Name: mrd_retention_policies mrd_retention_policies_tenant_id_record_type_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_retention_policies
    ADD CONSTRAINT mrd_retention_policies_tenant_id_record_type_category_key UNIQUE (tenant_id, record_type, category);

CREATE INDEX idx_mrd_retention_policies_deleted_at_fc02c893 ON public.mrd_retention_policies USING btree (deleted_at);

CREATE INDEX idx_mrd_retention_policies_tenant ON public.mrd_retention_policies USING btree (tenant_id);

ALTER TABLE public.mrd_retention_policies ENABLE ROW LEVEL SECURITY;

-- Name: mrd_retention_policies mrd_retention_policies_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_retention_policies_tenant ON public.mrd_retention_policies USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_retention_policies trg_mrd_retention_policies_soft_delete_fc02c893; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_retention_policies_soft_delete_fc02c893 BEFORE DELETE ON public.mrd_retention_policies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_retention_policies trg_mrd_retention_policies_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_retention_policies_updated BEFORE UPDATE ON public.mrd_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS-Posture: tenant-scoped
-- ============================================================
-- MedBrains schema -- MRD case-sheet packet and shelf tracking
-- ============================================================

CREATE TABLE public.mrd_storage_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    building text,
    floor text,
    room text,
    rack text,
    shelf text,
    bin text,
    barcode text,
    capacity integer,
    current_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT mrd_storage_locations_capacity_check CHECK (((capacity IS NULL) OR (capacity >= 0))),
    CONSTRAINT mrd_storage_locations_current_count_check CHECK ((current_count >= 0))
);

-- Name: mrd_storage_locations mrd_storage_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_pkey PRIMARY KEY (id);

-- Name: mrd_storage_locations mrd_storage_locations_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_tenant_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_mrd_storage_locations_deleted_at_fda1f9c6 ON public.mrd_storage_locations USING btree (deleted_at);

CREATE INDEX idx_mrd_storage_locations_tenant_active ON public.mrd_storage_locations USING btree (tenant_id, is_active, code);

ALTER TABLE public.mrd_storage_locations ENABLE ROW LEVEL SECURITY;

-- Name: mrd_storage_locations mrd_storage_locations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mrd_storage_locations_tenant ON public.mrd_storage_locations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: mrd_storage_locations trg_mrd_storage_locations_soft_delete_fda1f9c6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_storage_locations_soft_delete_fda1f9c6 BEFORE DELETE ON public.mrd_storage_locations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: mrd_storage_locations trg_mrd_storage_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrd_storage_locations_updated_at BEFORE UPDATE ON public.mrd_storage_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.roi_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    roi_request_id uuid NOT NULL,
    accessed_by uuid NOT NULL,
    action text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);

-- Name: roi_access_log roi_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roi_access_log
    ADD CONSTRAINT roi_access_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_roi_access_log_request ON public.roi_access_log USING btree (tenant_id, roi_request_id, accessed_at DESC);

ALTER TABLE public.roi_access_log ENABLE ROW LEVEL SECURITY;

-- Name: roi_access_log tenant_isolation_roi_access_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_roi_access_log ON public.roi_access_log USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Migration: 0179_roi.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Release of Information (ROI). External parties (patient, insurer, court,
-- police, employer) request a patient's medical records; the MRD officer
-- reviews and approves/denies; every view/download is access-logged. Core
-- MRD operational + DPDP/HIPAA audit requirement for a paperless record.

CREATE TABLE public.roi_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    requester_type text NOT NULL,
    requester_name text NOT NULL,
    requester_contact text,
    purpose text,
    record_scope text DEFAULT 'full'::text NOT NULL,
    date_from date,
    date_to date,
    scope_notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    authorization_obtained boolean DEFAULT false NOT NULL,
    expiry_date date,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    decision_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roi_requests_requester_check CHECK ((requester_type = ANY (ARRAY['patient'::text, 'insurer'::text, 'court'::text, 'police'::text, 'employer'::text, 'other'::text]))),
    CONSTRAINT roi_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'released'::text, 'expired'::text])))
);

-- Name: roi_requests roi_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roi_requests
    ADD CONSTRAINT roi_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_roi_requests_patient ON public.roi_requests USING btree (tenant_id, patient_id);

CREATE INDEX idx_roi_requests_status ON public.roi_requests USING btree (tenant_id, status, requested_at DESC);

ALTER TABLE public.roi_requests ENABLE ROW LEVEL SECURITY;

-- Name: roi_requests tenant_isolation_roi_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_roi_requests ON public.roi_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: document_form_review_schedule document_form_review_schedule_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_form_review_schedule
    ADD CONSTRAINT document_form_review_schedule_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE;

-- Name: document_output_signatures document_output_signatures_document_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_output_signatures
    ADD CONSTRAINT document_output_signatures_document_output_id_fkey FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id) ON DELETE CASCADE;

-- Name: document_outputs document_outputs_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_outputs
    ADD CONSTRAINT document_outputs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);

-- Name: document_template_versions document_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_template_versions
    ADD CONSTRAINT document_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE CASCADE;

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_document_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_document_output_id_fkey FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id);

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_medical_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES public.mrd_medical_records(id);

-- Name: mrd_case_sheet_packets mrd_case_sheet_packets_storage_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_storage_location_id_fkey FOREIGN KEY (storage_location_id) REFERENCES public.mrd_storage_locations(id);

-- Name: mrd_case_sheet_pages mrd_case_sheet_pages_document_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_document_output_id_fkey FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id);

-- Name: mrd_case_sheet_pages mrd_case_sheet_pages_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.mrd_case_sheet_packets(id) ON DELETE CASCADE;

-- Name: mrd_form_records mrd_form_records_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_form_records
    ADD CONSTRAINT mrd_form_records_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);

-- Name: mrd_record_movements mrd_record_movements_medical_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mrd_record_movements
    ADD CONSTRAINT mrd_record_movements_medical_record_id_fkey FOREIGN KEY (medical_record_id) REFERENCES public.mrd_medical_records(id);
