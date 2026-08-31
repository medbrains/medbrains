-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 10
-- Drops: none
-- radiology — schema.
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



CREATE TABLE public.nuclear_med_administrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    dose_mci numeric(10,4) NOT NULL,
    route text NOT NULL,
    indication text NOT NULL,
    administered_by uuid NOT NULL,
    administered_at timestamp with time zone DEFAULT now() NOT NULL,
    waste_disposed boolean DEFAULT false NOT NULL,
    waste_disposal_date timestamp with time zone,
    isolation_required boolean DEFAULT false NOT NULL,
    isolation_end timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nuclear_med_administrations nuclear_med_administrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_administrations
    ADD CONSTRAINT nuclear_med_administrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_nuclear_med_admin_patient ON public.nuclear_med_administrations USING btree (tenant_id, patient_id);

CREATE INDEX idx_nuclear_med_admin_source ON public.nuclear_med_administrations USING btree (source_id);

CREATE INDEX idx_nuclear_med_admin_tenant ON public.nuclear_med_administrations USING btree (tenant_id);

CREATE INDEX idx_nuclear_med_administrations_deleted_at_a9966e10 ON public.nuclear_med_administrations USING btree (deleted_at);

CREATE INDEX idx_nuclear_med_administrations_patient_id ON public.nuclear_med_administrations USING btree (patient_id);

ALTER TABLE public.nuclear_med_administrations ENABLE ROW LEVEL SECURITY;

-- Name: nuclear_med_administrations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.nuclear_med_administrations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: nuclear_med_administrations trg_nuclear_med_administrations_soft_delete_a9966e10; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nuclear_med_administrations_soft_delete_a9966e10 BEFORE DELETE ON public.nuclear_med_administrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nuclear_med_administrations trg_nuclear_med_administrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nuclear_med_administrations_updated_at BEFORE UPDATE ON public.nuclear_med_administrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.nuclear_med_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    isotope text NOT NULL,
    activity_mci numeric(10,4) NOT NULL,
    half_life_hours numeric(10,4) NOT NULL,
    source_type public.radiopharmaceutical_type NOT NULL,
    aerb_license_number text,
    batch_number text,
    calibration_date timestamp with time zone,
    expiry_date timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nuclear_med_sources nuclear_med_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_sources
    ADD CONSTRAINT nuclear_med_sources_pkey PRIMARY KEY (id);

CREATE INDEX idx_nuclear_med_sources_active ON public.nuclear_med_sources USING btree (tenant_id, is_active) WHERE (is_active = true);

CREATE INDEX idx_nuclear_med_sources_deleted_at_3f05208b ON public.nuclear_med_sources USING btree (deleted_at);

CREATE INDEX idx_nuclear_med_sources_tenant ON public.nuclear_med_sources USING btree (tenant_id);

ALTER TABLE public.nuclear_med_sources ENABLE ROW LEVEL SECURITY;

-- Name: nuclear_med_sources tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.nuclear_med_sources USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: nuclear_med_sources trg_nuclear_med_sources_soft_delete_3f05208b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nuclear_med_sources_soft_delete_3f05208b BEFORE DELETE ON public.nuclear_med_sources FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nuclear_med_sources trg_nuclear_med_sources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nuclear_med_sources_updated_at BEFORE UPDATE ON public.nuclear_med_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.radiation_dose_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    modality_code character varying(20) NOT NULL,
    body_part character varying(200),
    dose_value numeric(12,4),
    dose_unit character varying(20) DEFAULT 'mGy'::character varying NOT NULL,
    dlp numeric(12,4),
    ctdi_vol numeric(12,4),
    dap numeric(12,4),
    fluoroscopy_time_seconds integer,
    recorded_by uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiation_dose_records radiation_dose_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiation_dose_records
    ADD CONSTRAINT radiation_dose_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_radiation_dose_order ON public.radiation_dose_records USING btree (order_id);

CREATE INDEX idx_radiation_dose_patient ON public.radiation_dose_records USING btree (patient_id);

CREATE INDEX idx_radiation_dose_records_deleted_at_cd6e21fd ON public.radiation_dose_records USING btree (deleted_at);

CREATE INDEX idx_radiation_dose_tenant ON public.radiation_dose_records USING btree (tenant_id);

ALTER TABLE public.radiation_dose_records ENABLE ROW LEVEL SECURITY;

-- Name: radiation_dose_records radiation_dose_records_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiation_dose_records_tenant_isolation ON public.radiation_dose_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiation_dose_records trg_radiation_dose_records_soft_delete_cd6e21fd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiation_dose_records_soft_delete_cd6e21fd BEFORE DELETE ON public.radiation_dose_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ====================================================================
-- Migration: 0213_radiology_critical_alerts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_critical_alerts
-- Drops: none
-- ====================================================================
-- A critical imaging finding (e.g. pneumothorax, intracranial bleed) must
-- be actively communicated to the treating physician and acknowledged —
-- NABH critical-results reporting, same as critical lab values. Labs had
-- this loop (lab_critical_alerts); radiology did not — a critical report
-- only emitted an event and otherwise sat in the chart. This adds the
-- radiology critical-alert record so the report can notify the ordering /
-- encounter doctor and capture their acknowledgement.

CREATE TABLE public.radiology_critical_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    report_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    modality text,
    finding text NOT NULL,
    notified_to uuid,
    notified_at timestamp with time zone,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    escalated_at timestamp with time zone,
    escalated_to uuid
);

-- Name: radiology_critical_alerts radiology_critical_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_critical_alerts
    ADD CONSTRAINT radiology_critical_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_radiology_critical_alerts_patient ON public.radiology_critical_alerts USING btree (tenant_id, patient_id);

CREATE INDEX idx_radiology_critical_alerts_report ON public.radiology_critical_alerts USING btree (report_id);

CREATE INDEX idx_radiology_critical_alerts_unacked ON public.radiology_critical_alerts USING btree (tenant_id, created_at) WHERE ((acknowledged_at IS NULL) AND (escalated_at IS NULL));

ALTER TABLE public.radiology_critical_alerts ENABLE ROW LEVEL SECURITY;

-- Name: radiology_critical_alerts radiology_critical_alerts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_critical_alerts_tenant ON public.radiology_critical_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.radiology_dicom_studies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid,
    patient_id uuid NOT NULL,
    study_instance_uid text NOT NULL,
    accession_number text,
    modality text NOT NULL,
    study_date date,
    study_description text,
    referring_physician text,
    instance_count integer DEFAULT 0 NOT NULL,
    series_count integer DEFAULT 0 NOT NULL,
    orthanc_id text,
    pacs_url text,
    viewer_url text,
    file_size_bytes bigint,
    dicom_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiology_dicom_studies radiology_dicom_studies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dicom_studies
    ADD CONSTRAINT radiology_dicom_studies_pkey PRIMARY KEY (id);

-- Name: radiology_dicom_studies radiology_dicom_studies_tenant_id_study_instance_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dicom_studies
    ADD CONSTRAINT radiology_dicom_studies_tenant_id_study_instance_uid_key UNIQUE (tenant_id, study_instance_uid);

CREATE INDEX idx_dicom_studies_order ON public.radiology_dicom_studies USING btree (order_id);

CREATE INDEX idx_dicom_studies_patient ON public.radiology_dicom_studies USING btree (patient_id, study_date DESC);

CREATE INDEX idx_radiology_dicom_studies_deleted_at_edc077a4 ON public.radiology_dicom_studies USING btree (deleted_at);

ALTER TABLE public.radiology_dicom_studies ENABLE ROW LEVEL SECURITY;

-- Name: radiology_dicom_studies radiology_dicom_studies_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_dicom_studies_tenant ON public.radiology_dicom_studies USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_dicom_studies trg_dicom_studies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dicom_studies_updated_at BEFORE UPDATE ON public.radiology_dicom_studies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: radiology_dicom_studies trg_radiology_dicom_studies_soft_delete_edc077a4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_dicom_studies_soft_delete_edc077a4 BEFORE DELETE ON public.radiology_dicom_studies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.radiology_dosimetry_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    badge_number text NOT NULL,
    monitoring_period_start date NOT NULL,
    monitoring_period_end date NOT NULL,
    dose_value numeric(10,4) NOT NULL,
    dose_unit text DEFAULT 'mSv'::text NOT NULL,
    annual_limit numeric(10,4) DEFAULT 20.0 NOT NULL,
    is_compliant boolean DEFAULT true NOT NULL,
    exceeded_action text,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiology_dosimetry_records radiology_dosimetry_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dosimetry_records
    ADD CONSTRAINT radiology_dosimetry_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_dosimetry_staff ON public.radiology_dosimetry_records USING btree (staff_id, monitoring_period_end DESC);

CREATE INDEX idx_radiology_dosimetry_records_deleted_at_3c6cccf5 ON public.radiology_dosimetry_records USING btree (deleted_at);

CREATE INDEX idx_radiology_dosimetry_records_tenant_id ON public.radiology_dosimetry_records USING btree (tenant_id);

ALTER TABLE public.radiology_dosimetry_records ENABLE ROW LEVEL SECURITY;

-- Name: radiology_dosimetry_records radiology_dosimetry_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_dosimetry_records_tenant ON public.radiology_dosimetry_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_dosimetry_records trg_dosimetry_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dosimetry_updated_at BEFORE UPDATE ON public.radiology_dosimetry_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: radiology_dosimetry_records trg_radiology_dosimetry_records_soft_delete_3c6cccf5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_dosimetry_records_soft_delete_3c6cccf5 BEFORE DELETE ON public.radiology_dosimetry_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.radiology_modalities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiology_modalities radiology_modalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_modalities
    ADD CONSTRAINT radiology_modalities_pkey PRIMARY KEY (id);

-- Name: radiology_modalities radiology_modalities_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_modalities
    ADD CONSTRAINT radiology_modalities_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_radiology_modalities_deleted_at_b04affb4 ON public.radiology_modalities USING btree (deleted_at);

CREATE INDEX idx_radiology_modalities_tenant ON public.radiology_modalities USING btree (tenant_id);

ALTER TABLE public.radiology_modalities ENABLE ROW LEVEL SECURITY;

-- Name: radiology_modalities radiology_modalities_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_modalities_tenant_isolation ON public.radiology_modalities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_modalities set_updated_at_radiology_modalities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_radiology_modalities BEFORE UPDATE ON public.radiology_modalities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: radiology_modalities trg_radiology_modalities_soft_delete_b04affb4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_modalities_soft_delete_b04affb4 BEFORE DELETE ON public.radiology_modalities FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.radiology_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    modality_id uuid NOT NULL,
    ordered_by uuid NOT NULL,
    body_part character varying(200),
    clinical_indication text,
    priority public.radiology_priority DEFAULT 'routine'::public.radiology_priority NOT NULL,
    status public.radiology_order_status DEFAULT 'ordered'::public.radiology_order_status NOT NULL,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    contrast_required boolean DEFAULT false NOT NULL,
    pregnancy_checked boolean DEFAULT false NOT NULL,
    allergy_flagged boolean DEFAULT false NOT NULL,
    cancellation_reason character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pacs_study_uid text,
    orthanc_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    is_dummy boolean DEFAULT false NOT NULL
);

-- Name: radiology_orders radiology_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_radiology_orders_deleted_at_e9d0dfab ON public.radiology_orders USING btree (deleted_at);

CREATE INDEX idx_radiology_orders_encounter_id ON public.radiology_orders USING btree (encounter_id);

CREATE INDEX idx_radiology_orders_live ON public.radiology_orders USING btree (tenant_id, patient_id) WHERE (is_dummy = false);

CREATE INDEX idx_radiology_orders_modality ON public.radiology_orders USING btree (modality_id);

CREATE INDEX idx_radiology_orders_patient ON public.radiology_orders USING btree (patient_id);

CREATE INDEX idx_radiology_orders_scheduled ON public.radiology_orders USING btree (scheduled_at);

CREATE INDEX idx_radiology_orders_status ON public.radiology_orders USING btree (status);

CREATE INDEX idx_radiology_orders_tenant ON public.radiology_orders USING btree (tenant_id);

CREATE INDEX idx_radiology_orders_tenant_status ON public.radiology_orders USING btree (tenant_id, status);

ALTER TABLE public.radiology_orders ENABLE ROW LEVEL SECURITY;

-- Name: radiology_orders radiology_orders_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_orders_tenant_isolation ON public.radiology_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_orders audit_radiology_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_radiology_orders AFTER INSERT OR DELETE OR UPDATE ON public.radiology_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('radiology');

-- Name: radiology_orders set_updated_at_radiology_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_radiology_orders BEFORE UPDATE ON public.radiology_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: radiology_orders trg_radiology_orders_soft_delete_e9d0dfab; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_orders_soft_delete_e9d0dfab BEFORE DELETE ON public.radiology_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.radiology_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    reported_by uuid NOT NULL,
    verified_by uuid,
    status public.radiology_report_status DEFAULT 'draft'::public.radiology_report_status NOT NULL,
    findings text NOT NULL,
    impression text,
    recommendations text,
    is_critical boolean DEFAULT false NOT NULL,
    template_name character varying(200),
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    signed_record_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiology_reports radiology_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_reports
    ADD CONSTRAINT radiology_reports_pkey PRIMARY KEY (id);

CREATE INDEX idx_radiology_reports_deleted_at_d3b59bd3 ON public.radiology_reports USING btree (deleted_at);

CREATE INDEX idx_radiology_reports_order ON public.radiology_reports USING btree (order_id);

CREATE INDEX idx_radiology_reports_status ON public.radiology_reports USING btree (status);

CREATE INDEX idx_radiology_reports_tenant ON public.radiology_reports USING btree (tenant_id);

ALTER TABLE public.radiology_reports ENABLE ROW LEVEL SECURITY;

-- Name: radiology_reports radiology_reports_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_reports_tenant_isolation ON public.radiology_reports USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_reports set_updated_at_radiology_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_radiology_reports BEFORE UPDATE ON public.radiology_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: radiology_reports trg_radiology_reports_soft_delete_d3b59bd3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_reports_soft_delete_d3b59bd3 BEFORE DELETE ON public.radiology_reports FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.radiology_share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    study_id uuid NOT NULL,
    token text NOT NULL,
    recipient_name text,
    recipient_email text,
    expires_at timestamp with time zone NOT NULL,
    accessed_count integer DEFAULT 0 NOT NULL,
    last_accessed timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: radiology_share_links radiology_share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_share_links
    ADD CONSTRAINT radiology_share_links_pkey PRIMARY KEY (id);

-- Name: radiology_share_links radiology_share_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_share_links
    ADD CONSTRAINT radiology_share_links_token_key UNIQUE (token);

CREATE INDEX idx_radiology_share_links_deleted_at_76840936 ON public.radiology_share_links USING btree (deleted_at);

CREATE INDEX idx_radiology_share_links_tenant_id ON public.radiology_share_links USING btree (tenant_id);

CREATE INDEX idx_share_links_study ON public.radiology_share_links USING btree (study_id);

CREATE INDEX idx_share_links_token ON public.radiology_share_links USING btree (token);

ALTER TABLE public.radiology_share_links ENABLE ROW LEVEL SECURITY;

-- Name: radiology_share_links radiology_share_links_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY radiology_share_links_tenant ON public.radiology_share_links USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: radiology_share_links trg_radiology_share_links_soft_delete_76840936; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_radiology_share_links_soft_delete_76840936 BEFORE DELETE ON public.radiology_share_links FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: nuclear_med_administrations nuclear_med_administrations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nuclear_med_administrations
    ADD CONSTRAINT nuclear_med_administrations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.nuclear_med_sources(id);

-- Name: radiation_dose_records radiation_dose_records_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiation_dose_records
    ADD CONSTRAINT radiation_dose_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.radiology_orders(id);

-- Name: radiology_dicom_studies radiology_dicom_studies_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_dicom_studies
    ADD CONSTRAINT radiology_dicom_studies_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.radiology_orders(id);

-- Name: radiology_orders radiology_orders_modality_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_orders
    ADD CONSTRAINT radiology_orders_modality_id_fkey FOREIGN KEY (modality_id) REFERENCES public.radiology_modalities(id);

-- Name: radiology_reports radiology_reports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_reports
    ADD CONSTRAINT radiology_reports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.radiology_orders(id);

-- Name: radiology_share_links radiology_share_links_study_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_share_links
    ADD CONSTRAINT radiology_share_links_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.radiology_dicom_studies(id);
