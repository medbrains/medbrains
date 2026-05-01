-- ============================================================
-- MedBrains schema — module: insurance
-- ============================================================

--
-- Name: insurance_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claims (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    insurance_provider text NOT NULL,
    policy_number text,
    claim_number text,
    claim_type text DEFAULT 'cashless'::text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    pre_auth_amount numeric(12,2),
    approved_amount numeric(12,2),
    settled_amount numeric(12,2),
    tpa_name text,
    notes text,
    submitted_at timestamp with time zone,
    settled_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scheme_type public.insurance_scheme_type DEFAULT 'private'::public.insurance_scheme_type,
    co_pay_percent numeric(5,2),
    deductible_amount numeric(12,2),
    member_id text,
    scheme_card_number text,
    is_secondary boolean DEFAULT false NOT NULL,
    primary_claim_id uuid,
    tpa_rate_plan_id uuid,
    reimbursement_docs jsonb DEFAULT '[]'::jsonb,
    claim_amount numeric(12,2),
    secondary_payout numeric(12,2),
    coordination_of_benefits text
);



--
-- Name: insurance_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    patient_insurance_id uuid NOT NULL,
    trigger_point text NOT NULL,
    trigger_entity_id uuid,
    status public.verification_status DEFAULT 'pending'::public.verification_status NOT NULL,
    verified_at timestamp with time zone,
    payer_name text,
    payer_id text,
    member_id text,
    group_number text,
    subscriber_name text,
    relationship_to_subscriber text,
    coverage_start date,
    coverage_end date,
    benefits jsonb,
    individual_deductible numeric(12,2),
    individual_deductible_met numeric(12,2),
    family_deductible numeric(12,2),
    family_deductible_met numeric(12,2),
    co_pay_percent numeric(5,2),
    co_insurance_percent numeric(5,2),
    out_of_pocket_max numeric(12,2),
    out_of_pocket_met numeric(12,2),
    scheme_type public.insurance_scheme_type,
    scheme_balance numeric(14,2),
    error_code text,
    error_message text,
    raw_response jsonb,
    notes text,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: master_insurance_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_insurance_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    provider_type text NOT NULL,
    contact_phone text,
    contact_email text,
    website text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pa_requirement_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pa_requirement_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rule_name text NOT NULL,
    description text,
    insurance_provider text,
    scheme_type public.insurance_scheme_type,
    tpa_name text,
    service_type text,
    charge_code text,
    charge_code_pattern text,
    cost_threshold numeric(12,2),
    los_threshold integer,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: patient_insurance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_insurance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    insurance_provider text NOT NULL,
    policy_number text NOT NULL,
    group_number text,
    member_id text,
    plan_name text,
    policy_holder_name text,
    policy_holder_relation text,
    valid_from date NOT NULL,
    valid_until date NOT NULL,
    sum_insured numeric(14,2),
    tpa_name text,
    tpa_id text,
    coverage_type text,
    priority integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pre_authorization_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_authorization_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    insurance_provider text NOT NULL,
    policy_number text,
    procedure_codes text[] DEFAULT '{}'::text[] NOT NULL,
    diagnosis_codes text[] DEFAULT '{}'::text[] NOT NULL,
    estimated_cost numeric(12,2),
    status text DEFAULT 'pending'::text NOT NULL,
    auth_number text,
    approved_amount numeric(12,2),
    valid_from date,
    valid_until date,
    notes text,
    submitted_by uuid NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pre_authorization_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'denied'::text, 'expired'::text])))
);



--
-- Name: prior_auth_appeals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prior_auth_appeals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prior_auth_id uuid NOT NULL,
    appeal_number text NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    status public.appeal_status DEFAULT 'draft'::public.appeal_status NOT NULL,
    reason text,
    clinical_rationale text,
    supporting_evidence text,
    letter_content text,
    payer_decision text,
    payer_response_date date,
    payer_notes text,
    submitted_at timestamp with time zone,
    resolved_at timestamp with time zone,
    deadline date,
    created_by uuid,
    submitted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: prior_auth_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prior_auth_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prior_auth_id uuid NOT NULL,
    document_type text NOT NULL,
    file_name text,
    file_path text,
    file_size_bytes bigint,
    mime_type text,
    content_text text,
    content_json jsonb,
    source_entity text,
    source_id uuid,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: prior_auth_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prior_auth_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pa_number text NOT NULL,
    patient_id uuid NOT NULL,
    patient_insurance_id uuid NOT NULL,
    service_type text NOT NULL,
    service_code text,
    service_description text,
    diagnosis_codes text[],
    ordering_doctor_id uuid,
    department_id uuid,
    encounter_id uuid,
    invoice_id uuid,
    insurance_claim_id uuid,
    status public.prior_auth_status DEFAULT 'draft'::public.prior_auth_status NOT NULL,
    urgency public.pa_urgency DEFAULT 'standard'::public.pa_urgency NOT NULL,
    requested_start date,
    requested_end date,
    requested_units integer,
    estimated_cost numeric(12,2),
    auth_number text,
    approved_start date,
    approved_end date,
    approved_units integer,
    approved_amount numeric(12,2),
    denial_reason text,
    denial_code text,
    submitted_at timestamp with time zone,
    responded_at timestamp with time zone,
    expires_at timestamp with time zone,
    expected_tat_hours integer,
    escalated boolean DEFAULT false NOT NULL,
    escalated_at timestamp with time zone,
    created_by uuid,
    submitted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: prior_auth_status_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prior_auth_status_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prior_auth_id uuid NOT NULL,
    from_status public.prior_auth_status,
    to_status public.prior_auth_status NOT NULL,
    notes text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ur_payer_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ur_payer_communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    review_id uuid NOT NULL,
    communication_type text NOT NULL,
    payer_name text NOT NULL,
    reference_number text,
    communicated_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text,
    response text,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    communicated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ur_payer_communications_communication_type_check CHECK ((communication_type = ANY (ARRAY['initial_auth'::text, 'continued_stay'::text, 'denial_appeal'::text, 'peer_review'::text, 'info_request'::text, 'response'::text])))
);



--
-- Name: ur_status_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ur_status_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    conversion_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    converted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: utilization_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utilization_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    reviewer_id uuid,
    review_type public.ur_review_type NOT NULL,
    review_date date DEFAULT CURRENT_DATE NOT NULL,
    patient_status text DEFAULT 'inpatient'::text NOT NULL,
    decision public.ur_decision DEFAULT 'pending_info'::public.ur_decision NOT NULL,
    criteria_source text,
    criteria_met jsonb DEFAULT '[]'::jsonb NOT NULL,
    clinical_summary text,
    expected_los_days integer,
    actual_los_days integer,
    is_outlier boolean DEFAULT false NOT NULL,
    approved_days integer,
    next_review_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT utilization_reviews_patient_status_check CHECK ((patient_status = ANY (ARRAY['inpatient'::text, 'observation'::text])))
);



--
-- Name: insurance_claims insurance_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_pkey PRIMARY KEY (id);



--
-- Name: insurance_verifications insurance_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_verifications
    ADD CONSTRAINT insurance_verifications_pkey PRIMARY KEY (id);



--
-- Name: master_insurance_providers master_insurance_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_insurance_providers
    ADD CONSTRAINT master_insurance_providers_pkey PRIMARY KEY (id);



--
-- Name: master_insurance_providers master_insurance_providers_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_insurance_providers
    ADD CONSTRAINT master_insurance_providers_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: pa_requirement_rules pa_requirement_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pa_requirement_rules
    ADD CONSTRAINT pa_requirement_rules_pkey PRIMARY KEY (id);



--
-- Name: patient_insurance patient_insurance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_insurance
    ADD CONSTRAINT patient_insurance_pkey PRIMARY KEY (id);



--
-- Name: pre_authorization_requests pre_authorization_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorization_requests
    ADD CONSTRAINT pre_authorization_requests_pkey PRIMARY KEY (id);



--
-- Name: prior_auth_appeals prior_auth_appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT prior_auth_appeals_pkey PRIMARY KEY (id);



--
-- Name: prior_auth_documents prior_auth_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_documents
    ADD CONSTRAINT prior_auth_documents_pkey PRIMARY KEY (id);



--
-- Name: prior_auth_requests prior_auth_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_pkey PRIMARY KEY (id);



--
-- Name: prior_auth_status_log prior_auth_status_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_status_log
    ADD CONSTRAINT prior_auth_status_log_pkey PRIMARY KEY (id);



--
-- Name: prior_auth_appeals uq_appeal_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT uq_appeal_number UNIQUE (tenant_id, appeal_number);



--
-- Name: prior_auth_requests uq_pa_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT uq_pa_number UNIQUE (tenant_id, pa_number);



--
-- Name: ur_payer_communications ur_payer_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_payer_communications
    ADD CONSTRAINT ur_payer_communications_pkey PRIMARY KEY (id);



--
-- Name: ur_status_conversions ur_status_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_status_conversions
    ADD CONSTRAINT ur_status_conversions_pkey PRIMARY KEY (id);



--
-- Name: utilization_reviews utilization_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utilization_reviews
    ADD CONSTRAINT utilization_reviews_pkey PRIMARY KEY (id);



--
-- Name: idx_appeals_pa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_pa ON public.prior_auth_appeals USING btree (prior_auth_id);



--
-- Name: idx_appeals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_status ON public.prior_auth_appeals USING btree (tenant_id, status);



--
-- Name: idx_appeals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_tenant ON public.prior_auth_appeals USING btree (tenant_id);



--
-- Name: idx_insurance_claims_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insurance_claims_invoice ON public.insurance_claims USING btree (invoice_id);



--
-- Name: idx_insurance_claims_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insurance_claims_patient ON public.insurance_claims USING btree (patient_id);



--
-- Name: idx_insurance_claims_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insurance_claims_status ON public.insurance_claims USING btree (status);



--
-- Name: idx_insurance_claims_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insurance_claims_tenant ON public.insurance_claims USING btree (tenant_id);



--
-- Name: idx_pa_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_created ON public.prior_auth_requests USING btree (tenant_id, created_at DESC);



--
-- Name: idx_pa_docs_pa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_docs_pa ON public.prior_auth_documents USING btree (prior_auth_id);



--
-- Name: idx_pa_docs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_docs_tenant ON public.prior_auth_documents USING btree (tenant_id);



--
-- Name: idx_pa_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_expires ON public.prior_auth_requests USING btree (tenant_id, expires_at) WHERE (expires_at IS NOT NULL);



--
-- Name: idx_pa_log_pa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_log_pa ON public.prior_auth_status_log USING btree (prior_auth_id);



--
-- Name: idx_pa_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_log_tenant ON public.prior_auth_status_log USING btree (tenant_id);



--
-- Name: idx_pa_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_patient ON public.prior_auth_requests USING btree (tenant_id, patient_id);



--
-- Name: idx_pa_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_rules_active ON public.pa_requirement_rules USING btree (tenant_id, is_active) WHERE (is_active = true);



--
-- Name: idx_pa_rules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_rules_tenant ON public.pa_requirement_rules USING btree (tenant_id);



--
-- Name: idx_pa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_status ON public.prior_auth_requests USING btree (tenant_id, status);



--
-- Name: idx_pa_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_tenant ON public.prior_auth_requests USING btree (tenant_id);



--
-- Name: idx_patient_insurance_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_insurance_patient ON public.patient_insurance USING btree (tenant_id, patient_id);



--
-- Name: idx_pre_auth_requests_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pre_auth_requests_patient ON public.pre_authorization_requests USING btree (tenant_id, patient_id);



--
-- Name: idx_pre_auth_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pre_auth_requests_status ON public.pre_authorization_requests USING btree (tenant_id, status);



--
-- Name: idx_pre_auth_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pre_auth_requests_tenant ON public.pre_authorization_requests USING btree (tenant_id);



--
-- Name: idx_ur_communications_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ur_communications_review ON public.ur_payer_communications USING btree (tenant_id, review_id);



--
-- Name: idx_ur_conversions_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ur_conversions_admission ON public.ur_status_conversions USING btree (tenant_id, admission_id);



--
-- Name: idx_ur_reviews_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ur_reviews_admission ON public.utilization_reviews USING btree (tenant_id, admission_id);



--
-- Name: idx_ur_reviews_next_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ur_reviews_next_review ON public.utilization_reviews USING btree (tenant_id, next_review_date) WHERE (next_review_date IS NOT NULL);



--
-- Name: idx_ur_reviews_outlier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ur_reviews_outlier ON public.utilization_reviews USING btree (tenant_id, is_outlier) WHERE (is_outlier = true);



--
-- Name: idx_verifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_created ON public.insurance_verifications USING btree (tenant_id, created_at DESC);



--
-- Name: idx_verifications_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_patient ON public.insurance_verifications USING btree (tenant_id, patient_id);



--
-- Name: idx_verifications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_status ON public.insurance_verifications USING btree (tenant_id, status);



--
-- Name: idx_verifications_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verifications_tenant ON public.insurance_verifications USING btree (tenant_id);



--
-- Name: insurance_claims set_updated_at_insurance_claims; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_insurance_claims BEFORE UPDATE ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pre_authorization_requests set_updated_at_pre_auth_requests; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pre_auth_requests BEFORE UPDATE ON public.pre_authorization_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ur_payer_communications set_updated_at_ur_payer_communications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_ur_payer_communications BEFORE UPDATE ON public.ur_payer_communications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ur_status_conversions set_updated_at_ur_status_conversions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_ur_status_conversions BEFORE UPDATE ON public.ur_status_conversions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: utilization_reviews set_updated_at_utilization_reviews; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_utilization_reviews BEFORE UPDATE ON public.utilization_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pa_requirement_rules trg_pa_requirement_rules_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pa_requirement_rules_updated BEFORE UPDATE ON public.pa_requirement_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_insurance trg_patient_insurance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_insurance_updated_at BEFORE UPDATE ON public.patient_insurance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: prior_auth_appeals trg_prior_auth_appeals_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prior_auth_appeals_updated BEFORE UPDATE ON public.prior_auth_appeals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: prior_auth_requests trg_prior_auth_requests_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prior_auth_requests_updated BEFORE UPDATE ON public.prior_auth_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: insurance_claims insurance_claims_primary_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT insurance_claims_primary_claim_id_fkey FOREIGN KEY (primary_claim_id) REFERENCES public.insurance_claims(id);



--
-- Name: insurance_verifications insurance_verifications_patient_insurance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_verifications
    ADD CONSTRAINT insurance_verifications_patient_insurance_id_fkey FOREIGN KEY (patient_insurance_id) REFERENCES public.patient_insurance(id);



--
-- Name: prior_auth_appeals prior_auth_appeals_prior_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_appeals
    ADD CONSTRAINT prior_auth_appeals_prior_auth_id_fkey FOREIGN KEY (prior_auth_id) REFERENCES public.prior_auth_requests(id);



--
-- Name: prior_auth_documents prior_auth_documents_prior_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_documents
    ADD CONSTRAINT prior_auth_documents_prior_auth_id_fkey FOREIGN KEY (prior_auth_id) REFERENCES public.prior_auth_requests(id) ON DELETE CASCADE;



--
-- Name: prior_auth_requests prior_auth_requests_insurance_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_insurance_claim_id_fkey FOREIGN KEY (insurance_claim_id) REFERENCES public.insurance_claims(id);



--
-- Name: prior_auth_requests prior_auth_requests_patient_insurance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_requests
    ADD CONSTRAINT prior_auth_requests_patient_insurance_id_fkey FOREIGN KEY (patient_insurance_id) REFERENCES public.patient_insurance(id);



--
-- Name: prior_auth_status_log prior_auth_status_log_prior_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prior_auth_status_log
    ADD CONSTRAINT prior_auth_status_log_prior_auth_id_fkey FOREIGN KEY (prior_auth_id) REFERENCES public.prior_auth_requests(id) ON DELETE CASCADE;



--
-- Name: ur_payer_communications ur_payer_communications_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ur_payer_communications
    ADD CONSTRAINT ur_payer_communications_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.utilization_reviews(id);



--
-- Name: insurance_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;


--
-- Name: insurance_claims insurance_claims_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insurance_claims_tenant_isolation ON public.insurance_claims USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: insurance_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_verifications ENABLE ROW LEVEL SECURITY;


--
-- Name: insurance_verifications insurance_verifications_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insurance_verifications_rls ON public.insurance_verifications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: master_insurance_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_insurance_providers ENABLE ROW LEVEL SECURITY;


--
-- Name: pa_requirement_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pa_requirement_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: pa_requirement_rules pa_requirement_rules_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pa_requirement_rules_rls ON public.pa_requirement_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_insurance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_insurance ENABLE ROW LEVEL SECURITY;


--
-- Name: pre_authorization_requests pre_auth_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pre_auth_requests_tenant ON public.pre_authorization_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pre_authorization_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pre_authorization_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: prior_auth_appeals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prior_auth_appeals ENABLE ROW LEVEL SECURITY;


--
-- Name: prior_auth_appeals prior_auth_appeals_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prior_auth_appeals_rls ON public.prior_auth_appeals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prior_auth_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prior_auth_documents ENABLE ROW LEVEL SECURITY;


--
-- Name: prior_auth_documents prior_auth_documents_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prior_auth_documents_rls ON public.prior_auth_documents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prior_auth_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prior_auth_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: prior_auth_requests prior_auth_requests_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prior_auth_requests_rls ON public.prior_auth_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prior_auth_status_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prior_auth_status_log ENABLE ROW LEVEL SECURITY;


--
-- Name: prior_auth_status_log prior_auth_status_log_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prior_auth_status_log_rls ON public.prior_auth_status_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: ur_payer_communications tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ur_payer_communications USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ur_status_conversions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ur_status_conversions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: utilization_reviews tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.utilization_reviews USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: master_insurance_providers tenant_isolation_master_insurance_providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_insurance_providers ON public.master_insurance_providers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: patient_insurance tenant_isolation_patient_insurance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_insurance ON public.patient_insurance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: ur_payer_communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ur_payer_communications ENABLE ROW LEVEL SECURITY;


--
-- Name: ur_status_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ur_status_conversions ENABLE ROW LEVEL SECURITY;


--
-- Name: utilization_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.utilization_reviews ENABLE ROW LEVEL SECURITY;

