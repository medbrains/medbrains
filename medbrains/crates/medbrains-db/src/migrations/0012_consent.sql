-- ============================================================
-- MedBrains schema — module: consent
-- ============================================================

--
-- Name: consent_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consent_source text NOT NULL,
    consent_id uuid NOT NULL,
    action public.consent_audit_action NOT NULL,
    old_status text,
    new_status text,
    changed_by uuid,
    change_reason text,
    ip_address text,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_audit_log_consent_source_check CHECK ((consent_source = ANY (ARRAY['patient_consent'::text, 'procedure_consent'::text])))
);



--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    encounter_id uuid,
    booking_id uuid,
    consent_type character varying(50) NOT NULL,
    template_id uuid,
    procedure_name text,
    risks_explained text,
    alternatives_discussed text,
    language character varying(10) DEFAULT 'en'::character varying NOT NULL,
    signed_by_patient boolean DEFAULT false,
    patient_signature_data text,
    patient_signed_at timestamp with time zone,
    patient_capacity_confirmed boolean DEFAULT true,
    guardian_name character varying(200),
    guardian_relation character varying(100),
    guardian_signature_data text,
    guardian_signed_at timestamp with time zone,
    witness_name character varying(200),
    witness_designation character varying(100),
    witness_signature_data text,
    witness_signed_at timestamp with time zone,
    obtained_by uuid,
    obtained_at timestamp with time zone,
    pdf_url text,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revocation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_records_consent_type_check CHECK (((consent_type)::text = ANY ((ARRAY['general_admission'::character varying, 'surgical'::character varying, 'anesthesia'::character varying, 'blood_transfusion'::character varying, 'hiv_testing'::character varying, 'ama'::character varying, 'photography'::character varying, 'teaching'::character varying, 'research'::character varying, 'dnr'::character varying, 'organ_donation'::character varying, 'abdm'::character varying, 'refusal_treatment'::character varying])::text[])))
);



--
-- Name: consent_signature_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_signature_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consent_source text NOT NULL,
    consent_id uuid NOT NULL,
    signature_type public.signature_type NOT NULL,
    signature_image_url text,
    video_consent_url text,
    aadhaar_esign_ref text,
    aadhaar_esign_timestamp timestamp with time zone,
    biometric_hash text,
    biometric_device_id text,
    witness_name text,
    witness_designation text,
    witness_signature_url text,
    doctor_signature_url text,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    captured_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT consent_signature_metadata_consent_source_check CHECK ((consent_source = ANY (ARRAY['patient_consent'::text, 'procedure_consent'::text])))
);



--
-- Name: consent_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category public.consent_template_category DEFAULT 'general'::public.consent_template_category NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    body_text jsonb DEFAULT '{}'::jsonb NOT NULL,
    risks_section jsonb,
    alternatives_section jsonb,
    benefits_section jsonb,
    required_fields text[] DEFAULT '{}'::text[],
    requires_witness boolean DEFAULT false NOT NULL,
    requires_doctor boolean DEFAULT true NOT NULL,
    validity_days integer,
    applicable_departments uuid[],
    is_read_aloud_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    consent_type public.consent_type NOT NULL,
    consent_status public.consent_status DEFAULT 'pending'::public.consent_status NOT NULL,
    consent_date timestamp with time zone DEFAULT now() NOT NULL,
    consent_version text,
    consented_by text NOT NULL,
    consented_by_relation text,
    witness_name text,
    capture_mode public.consent_capture_mode NOT NULL,
    document_url text,
    valid_until date,
    notes text,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id uuid,
    signature_metadata_id uuid
);



--
-- Name: procedure_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedure_consents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    procedure_order_id uuid,
    procedure_name character varying(200) NOT NULL,
    consent_type character varying(30) DEFAULT 'procedure'::character varying NOT NULL,
    risks_explained text,
    alternatives_explained text,
    benefits_explained text,
    patient_questions text,
    consented_by_name character varying(200),
    consented_by_relation character varying(50),
    witness_name character varying(200),
    witness_designation character varying(100),
    doctor_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    signed_at timestamp with time zone,
    refused_at timestamp with time zone,
    refusal_reason text,
    withdrawn_at timestamp with time zone,
    withdrawal_reason text,
    expires_at timestamp with time zone,
    body jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_id uuid,
    signature_metadata_id uuid,
    CONSTRAINT procedure_consents_consent_type_check CHECK (((consent_type)::text = ANY ((ARRAY['procedure'::character varying, 'anesthesia'::character varying, 'blood_transfusion'::character varying, 'surgery'::character varying, 'investigation'::character varying, 'general'::character varying])::text[]))),
    CONSTRAINT procedure_consents_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'signed'::character varying, 'refused'::character varying, 'withdrawn'::character varying, 'expired'::character varying])::text[])))
);



--
-- Name: consent_audit_log consent_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_audit_log
    ADD CONSTRAINT consent_audit_log_pkey PRIMARY KEY (id);



--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);



--
-- Name: consent_signature_metadata consent_signature_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_signature_metadata
    ADD CONSTRAINT consent_signature_metadata_pkey PRIMARY KEY (id);



--
-- Name: consent_templates consent_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_pkey PRIMARY KEY (id);



--
-- Name: consent_templates consent_templates_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_templates
    ADD CONSTRAINT consent_templates_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: patient_consents patient_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_pkey PRIMARY KEY (id);



--
-- Name: procedure_consents procedure_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_pkey PRIMARY KEY (id);



--
-- Name: idx_consent_audit_consent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_audit_consent ON public.consent_audit_log USING btree (consent_source, consent_id);



--
-- Name: idx_consent_audit_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_audit_patient ON public.consent_audit_log USING btree (tenant_id, patient_id);



--
-- Name: idx_consent_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_audit_tenant ON public.consent_audit_log USING btree (tenant_id);



--
-- Name: idx_consent_records_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_active ON public.consent_records USING btree (patient_id, consent_type) WHERE (NOT is_revoked);



--
-- Name: idx_consent_records_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_admission ON public.consent_records USING btree (admission_id) WHERE (admission_id IS NOT NULL);



--
-- Name: idx_consent_records_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_patient ON public.consent_records USING btree (patient_id);



--
-- Name: idx_consent_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_tenant ON public.consent_records USING btree (tenant_id);



--
-- Name: idx_consent_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_type ON public.consent_records USING btree (consent_type);



--
-- Name: idx_consent_sig_consent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_sig_consent ON public.consent_signature_metadata USING btree (consent_source, consent_id);



--
-- Name: idx_consent_sig_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_sig_tenant ON public.consent_signature_metadata USING btree (tenant_id);



--
-- Name: idx_consent_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_templates_category ON public.consent_templates USING btree (tenant_id, category);



--
-- Name: idx_consent_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_templates_tenant ON public.consent_templates USING btree (tenant_id);



--
-- Name: idx_consents_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_encounter ON public.procedure_consents USING btree (encounter_id);



--
-- Name: idx_consents_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_patient ON public.procedure_consents USING btree (patient_id);



--
-- Name: idx_consents_procedure_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_procedure_order ON public.procedure_consents USING btree (procedure_order_id);



--
-- Name: idx_consents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consents_tenant ON public.procedure_consents USING btree (tenant_id);



--
-- Name: idx_patient_consents_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_consents_patient ON public.patient_consents USING btree (tenant_id, patient_id);



--
-- Name: patient_consents audit_patient_consents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_patient_consents AFTER INSERT OR DELETE OR UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('consent');



--
-- Name: consent_records trg_consent_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_records_updated_at BEFORE UPDATE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: consent_templates trg_consent_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consent_templates_updated_at BEFORE UPDATE ON public.consent_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_consents trg_patient_consents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consents_updated_at BEFORE UPDATE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_consents patient_consents_signature_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_signature_metadata_id_fkey FOREIGN KEY (signature_metadata_id) REFERENCES public.consent_signature_metadata(id);



--
-- Name: patient_consents patient_consents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consents
    ADD CONSTRAINT patient_consents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.consent_templates(id);



--
-- Name: procedure_consents procedure_consents_signature_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_signature_metadata_id_fkey FOREIGN KEY (signature_metadata_id) REFERENCES public.consent_signature_metadata(id);



--
-- Name: procedure_consents procedure_consents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_consents
    ADD CONSTRAINT procedure_consents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.consent_templates(id);



--
-- Name: consent_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;


--
-- Name: consent_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;


--
-- Name: consent_records consent_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consent_records_tenant ON public.consent_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: consent_signature_metadata; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_signature_metadata ENABLE ROW LEVEL SECURITY;


--
-- Name: consent_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;


--
-- Name: procedure_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedure_consents ENABLE ROW LEVEL SECURITY;


--
-- Name: procedure_consents procedure_consents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_consents_tenant ON public.procedure_consents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: consent_audit_log tenant_isolation_consent_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_audit ON public.consent_audit_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: consent_signature_metadata tenant_isolation_consent_sig; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_sig ON public.consent_signature_metadata USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: consent_templates tenant_isolation_consent_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consent_templates ON public.consent_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_consents tenant_isolation_patient_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_consents ON public.patient_consents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


