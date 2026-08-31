-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 11
-- Drops: none
-- notifications — schema.
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



CREATE TABLE public.code_blue_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    location text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    leader_user_id uuid,
    outcome text,
    recorder_user_id uuid,
    medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    shocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    ecg_rhythm_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT code_blue_events_outcome_check CHECK ((outcome = ANY (ARRAY['rosc'::text, 'transferred'::text, 'expired'::text, 'stable'::text])))
);

-- Name: code_blue_events code_blue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_blue_events
    ADD CONSTRAINT code_blue_events_pkey PRIMARY KEY (id);

CREATE INDEX code_blue_active_idx ON public.code_blue_events USING btree (tenant_id, started_at DESC) WHERE (ended_at IS NULL);

CREATE INDEX idx_code_blue_events_deleted_at_01464002 ON public.code_blue_events USING btree (deleted_at);

ALTER TABLE ONLY public.code_blue_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.code_blue_events ENABLE ROW LEVEL SECURITY;

-- Name: code_blue_events tenant_isolation_code_blue_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_code_blue_events ON public.code_blue_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: code_blue_events trg_code_blue_events_soft_delete_01464002; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_code_blue_events_soft_delete_01464002 BEFORE DELETE ON public.code_blue_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.comm_clinical_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    message_code text NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    recipient_department_id uuid,
    patient_id uuid,
    priority public.comm_clinical_priority DEFAULT 'routine'::public.comm_clinical_priority NOT NULL,
    message_type text NOT NULL,
    subject text,
    body text NOT NULL,
    sbar_data jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    is_urgent boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    parent_message_id uuid,
    attachments jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: comm_clinical_messages comm_clinical_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_pkey PRIMARY KEY (id);

-- Name: comm_clinical_messages comm_clinical_messages_tenant_id_message_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_tenant_id_message_code_key UNIQUE (tenant_id, message_code);

CREATE INDEX idx_comm_clin_created ON public.comm_clinical_messages USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_comm_clin_patient ON public.comm_clinical_messages USING btree (tenant_id, patient_id);

CREATE INDEX idx_comm_clin_priority ON public.comm_clinical_messages USING btree (tenant_id, priority);

CREATE INDEX idx_comm_clin_recipient ON public.comm_clinical_messages USING btree (tenant_id, recipient_id);

CREATE INDEX idx_comm_clin_sender ON public.comm_clinical_messages USING btree (tenant_id, sender_id);

CREATE INDEX idx_comm_clin_tenant ON public.comm_clinical_messages USING btree (tenant_id);

CREATE INDEX idx_comm_clinical_messages_deleted_at_9d924bd4 ON public.comm_clinical_messages USING btree (deleted_at);

CREATE INDEX idx_comm_clinical_messages_patient_id ON public.comm_clinical_messages USING btree (patient_id);

ALTER TABLE public.comm_clinical_messages ENABLE ROW LEVEL SECURITY;

-- Name: comm_clinical_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_clinical_messages USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_clinical_messages trg_comm_clinical_messages_soft_delete_9d924bd4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_clinical_messages_soft_delete_9d924bd4 BEFORE DELETE ON public.comm_clinical_messages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: comm_clinical_messages trg_comm_clinical_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_clinical_updated_at BEFORE UPDATE ON public.comm_clinical_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.comm_complaints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    complaint_code text NOT NULL,
    source public.comm_complaint_source NOT NULL,
    status public.comm_complaint_status DEFAULT 'open'::public.comm_complaint_status NOT NULL,
    patient_id uuid,
    complainant_name text NOT NULL,
    complainant_phone text,
    complainant_email text,
    department_id uuid,
    category text,
    subcategory text,
    subject text NOT NULL,
    description text NOT NULL,
    severity text DEFAULT 'medium'::text,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    sla_hours integer,
    sla_deadline timestamp with time zone,
    sla_breached boolean DEFAULT false NOT NULL,
    sla_breached_at timestamp with time zone,
    resolution_notes text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    satisfaction_score integer,
    service_recovery_action text,
    service_recovery_cost numeric(12,2),
    escalation_level integer DEFAULT 0,
    escalation_history jsonb,
    google_review_id text,
    external_reference text,
    attachments jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT comm_complaints_satisfaction_score_check CHECK (((satisfaction_score >= 1) AND (satisfaction_score <= 5)))
);

-- Name: comm_complaints comm_complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_pkey PRIMARY KEY (id);

-- Name: comm_complaints comm_complaints_tenant_id_complaint_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_tenant_id_complaint_code_key UNIQUE (tenant_id, complaint_code);

CREATE INDEX idx_comm_cmp_dept ON public.comm_complaints USING btree (tenant_id, department_id);

CREATE INDEX idx_comm_cmp_sla ON public.comm_complaints USING btree (tenant_id, sla_deadline) WHERE (status <> ALL (ARRAY['resolved'::public.comm_complaint_status, 'closed'::public.comm_complaint_status]));

CREATE INDEX idx_comm_cmp_source ON public.comm_complaints USING btree (tenant_id, source);

CREATE INDEX idx_comm_cmp_status ON public.comm_complaints USING btree (tenant_id, status);

CREATE INDEX idx_comm_cmp_tenant ON public.comm_complaints USING btree (tenant_id);

CREATE INDEX idx_comm_complaints_deleted_at_0b02d45c ON public.comm_complaints USING btree (deleted_at);

CREATE INDEX idx_comm_complaints_department_id ON public.comm_complaints USING btree (department_id);

CREATE INDEX idx_comm_complaints_patient_id ON public.comm_complaints USING btree (patient_id);

ALTER TABLE public.comm_complaints ENABLE ROW LEVEL SECURITY;

-- Name: comm_complaints tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_complaints USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_complaints trg_comm_complaints_soft_delete_0b02d45c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_complaints_soft_delete_0b02d45c BEFORE DELETE ON public.comm_complaints FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: comm_complaints trg_comm_complaints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_complaints_updated_at BEFORE UPDATE ON public.comm_complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.comm_critical_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    alert_code text NOT NULL,
    alert_source text NOT NULL,
    source_id uuid,
    patient_id uuid NOT NULL,
    department_id uuid,
    priority public.comm_clinical_priority DEFAULT 'critical'::public.comm_clinical_priority NOT NULL,
    status public.comm_alert_status DEFAULT 'triggered'::public.comm_alert_status NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    alert_value text,
    normal_range text,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_notes text,
    escalation_level integer DEFAULT 0,
    escalated_at timestamp with time zone,
    escalated_to uuid,
    notification_log jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: comm_critical_alerts comm_critical_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_pkey PRIMARY KEY (id);

-- Name: comm_critical_alerts comm_critical_alerts_tenant_id_alert_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_tenant_id_alert_code_key UNIQUE (tenant_id, alert_code);

CREATE INDEX idx_comm_alert_patient ON public.comm_critical_alerts USING btree (tenant_id, patient_id);

CREATE INDEX idx_comm_alert_source ON public.comm_critical_alerts USING btree (tenant_id, alert_source);

CREATE INDEX idx_comm_alert_status ON public.comm_critical_alerts USING btree (tenant_id, status);

CREATE INDEX idx_comm_alert_tenant ON public.comm_critical_alerts USING btree (tenant_id);

CREATE INDEX idx_comm_alert_time ON public.comm_critical_alerts USING btree (tenant_id, triggered_at DESC);

CREATE INDEX idx_comm_critical_alerts_deleted_at_127e1385 ON public.comm_critical_alerts USING btree (deleted_at);

CREATE INDEX idx_comm_critical_alerts_department_id ON public.comm_critical_alerts USING btree (department_id);

CREATE INDEX idx_comm_critical_alerts_patient_id ON public.comm_critical_alerts USING btree (patient_id);

ALTER TABLE public.comm_critical_alerts ENABLE ROW LEVEL SECURITY;

-- Name: comm_critical_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_critical_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_critical_alerts trg_comm_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_alerts_updated_at BEFORE UPDATE ON public.comm_critical_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: comm_critical_alerts trg_comm_critical_alerts_soft_delete_127e1385; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_critical_alerts_soft_delete_127e1385 BEFORE DELETE ON public.comm_critical_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.comm_escalation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rule_name text NOT NULL,
    rule_type text NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    trigger_condition jsonb NOT NULL,
    escalation_chain jsonb NOT NULL,
    max_escalation_level integer DEFAULT 3,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: comm_escalation_rules comm_escalation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_escalation_rules
    ADD CONSTRAINT comm_escalation_rules_pkey PRIMARY KEY (id);

CREATE INDEX idx_comm_esc_tenant ON public.comm_escalation_rules USING btree (tenant_id);

CREATE INDEX idx_comm_esc_type ON public.comm_escalation_rules USING btree (tenant_id, rule_type);

CREATE INDEX idx_comm_escalation_rules_deleted_at_2d94e2f4 ON public.comm_escalation_rules USING btree (deleted_at);

CREATE INDEX idx_comm_escalation_rules_department_id ON public.comm_escalation_rules USING btree (department_id);

ALTER TABLE public.comm_escalation_rules ENABLE ROW LEVEL SECURITY;

-- Name: comm_escalation_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_escalation_rules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_escalation_rules trg_comm_escalation_rules_soft_delete_2d94e2f4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_escalation_rules_soft_delete_2d94e2f4 BEFORE DELETE ON public.comm_escalation_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: comm_escalation_rules trg_comm_escalation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_escalation_updated_at BEFORE UPDATE ON public.comm_escalation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.comm_feedback_surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    feedback_code text NOT NULL,
    feedback_type public.comm_feedback_type NOT NULL,
    patient_id uuid,
    department_id uuid,
    doctor_id uuid,
    overall_rating integer,
    nps_score integer,
    wait_time_rating integer,
    staff_rating integer,
    cleanliness_rating integer,
    food_rating integer,
    communication_rating integer,
    discharge_rating integer,
    would_recommend boolean,
    comments text,
    suggestions text,
    is_anonymous boolean DEFAULT false NOT NULL,
    channel text,
    survey_data jsonb,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    waiting_time_minutes integer,
    collection_point text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT comm_feedback_surveys_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_communication_rating_check CHECK (((communication_rating >= 1) AND (communication_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_discharge_rating_check CHECK (((discharge_rating >= 1) AND (discharge_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_food_rating_check CHECK (((food_rating >= 1) AND (food_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_nps_score_check CHECK (((nps_score >= 0) AND (nps_score <= 10))),
    CONSTRAINT comm_feedback_surveys_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_staff_rating_check CHECK (((staff_rating >= 1) AND (staff_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_wait_time_rating_check CHECK (((wait_time_rating >= 1) AND (wait_time_rating <= 5)))
);

-- Name: comm_feedback_surveys comm_feedback_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_pkey PRIMARY KEY (id);

-- Name: comm_feedback_surveys comm_feedback_surveys_tenant_id_feedback_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_tenant_id_feedback_code_key UNIQUE (tenant_id, feedback_code);

CREATE INDEX idx_comm_fb_date ON public.comm_feedback_surveys USING btree (tenant_id, submitted_at DESC);

CREATE INDEX idx_comm_fb_dept ON public.comm_feedback_surveys USING btree (tenant_id, department_id);

CREATE INDEX idx_comm_fb_tenant ON public.comm_feedback_surveys USING btree (tenant_id);

CREATE INDEX idx_comm_fb_type ON public.comm_feedback_surveys USING btree (tenant_id, feedback_type);

CREATE INDEX idx_comm_feedback_surveys_deleted_at_5040e466 ON public.comm_feedback_surveys USING btree (deleted_at);

CREATE INDEX idx_comm_feedback_surveys_department_id ON public.comm_feedback_surveys USING btree (department_id);

CREATE INDEX idx_comm_feedback_surveys_doctor_id ON public.comm_feedback_surveys USING btree (doctor_id);

CREATE INDEX idx_comm_feedback_surveys_patient_id ON public.comm_feedback_surveys USING btree (patient_id);

ALTER TABLE public.comm_feedback_surveys ENABLE ROW LEVEL SECURITY;

-- Name: comm_feedback_surveys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_feedback_surveys USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_feedback_surveys trg_comm_feedback_surveys_soft_delete_5040e466; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_feedback_surveys_soft_delete_5040e466 BEFORE DELETE ON public.comm_feedback_surveys FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.comm_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    message_code text NOT NULL,
    template_id uuid,
    channel public.comm_channel NOT NULL,
    status public.comm_message_status DEFAULT 'queued'::public.comm_message_status NOT NULL,
    recipient_type text,
    recipient_id uuid,
    recipient_name text,
    recipient_contact text NOT NULL,
    subject text,
    body text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    external_message_id text,
    context_type text,
    context_id uuid,
    retry_count integer DEFAULT 0,
    sent_by uuid,
    cost numeric(10,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: comm_messages comm_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_pkey PRIMARY KEY (id);

-- Name: comm_messages comm_messages_tenant_id_message_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_tenant_id_message_code_key UNIQUE (tenant_id, message_code);

CREATE INDEX idx_comm_messages_deleted_at_65bdd72e ON public.comm_messages USING btree (deleted_at);

CREATE INDEX idx_comm_messages_template_id ON public.comm_messages USING btree (template_id);

CREATE INDEX idx_comm_msg_channel ON public.comm_messages USING btree (tenant_id, channel);

CREATE INDEX idx_comm_msg_created ON public.comm_messages USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_comm_msg_status ON public.comm_messages USING btree (tenant_id, status);

CREATE INDEX idx_comm_msg_tenant ON public.comm_messages USING btree (tenant_id);

ALTER TABLE public.comm_messages ENABLE ROW LEVEL SECURITY;

-- Name: comm_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_messages USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_messages trg_comm_messages_soft_delete_65bdd72e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_messages_soft_delete_65bdd72e BEFORE DELETE ON public.comm_messages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: comm_messages trg_comm_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_messages_updated_at BEFORE UPDATE ON public.comm_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.comm_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_name text NOT NULL,
    template_code text NOT NULL,
    channel public.comm_channel NOT NULL,
    template_type public.comm_template_type NOT NULL,
    subject text,
    body_template text NOT NULL,
    placeholders jsonb,
    language text DEFAULT 'en'::text,
    is_active boolean DEFAULT true NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    external_template_id text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: comm_templates comm_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_pkey PRIMARY KEY (id);

-- Name: comm_templates comm_templates_tenant_id_template_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_tenant_id_template_code_key UNIQUE (tenant_id, template_code);

CREATE INDEX idx_comm_templates_deleted_at_1596bae9 ON public.comm_templates USING btree (deleted_at);

CREATE INDEX idx_comm_tpl_channel ON public.comm_templates USING btree (tenant_id, channel);

CREATE INDEX idx_comm_tpl_tenant ON public.comm_templates USING btree (tenant_id);

CREATE INDEX idx_comm_tpl_type ON public.comm_templates USING btree (tenant_id, template_type);

ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;

-- Name: comm_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_templates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: comm_templates trg_comm_templates_soft_delete_1596bae9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_templates_soft_delete_1596bae9 BEFORE DELETE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: comm_templates trg_comm_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_templates_updated_at BEFORE UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- DLT (Distributed Ledger Technology) SMS template registry — India.
-- Indian telcos require every commercial / transactional SMS to use a
-- pre-registered DLT template. Untemplated traffic is dropped at the
-- carrier gateway. This table maps our internal "template_scope"
-- (e.g. "sms.appointment_confirmation") to the DLT-issued template_id
-- so the SMS dispatcher can attach it on every send.
-- Reference: TRAI TCCCPR, 2018 — telco-managed DLT registry.

CREATE TABLE public.dlt_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id text NOT NULL,
    template_name text NOT NULL,
    category text NOT NULL,
    sender_id text NOT NULL,
    entity_id text NOT NULL,
    body_pattern text NOT NULL,
    variable_count integer DEFAULT 0 NOT NULL,
    scope text,
    language character(2) DEFAULT 'en'::bpchar NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    registered_at date,
    expires_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: dlt_templates dlt_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dlt_templates
    ADD CONSTRAINT dlt_templates_pkey PRIMARY KEY (id);

-- Name: dlt_templates dlt_templates_tenant_id_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dlt_templates
    ADD CONSTRAINT dlt_templates_tenant_id_template_id_key UNIQUE (tenant_id, template_id);

CREATE INDEX idx_dlt_templates_deleted_at_83bd6bbf ON public.dlt_templates USING btree (deleted_at);

CREATE INDEX idx_dlt_templates_scope ON public.dlt_templates USING btree (tenant_id, scope, language) WHERE is_active;

CREATE INDEX idx_dlt_templates_tenant ON public.dlt_templates USING btree (tenant_id);

ALTER TABLE public.dlt_templates ENABLE ROW LEVEL SECURITY;

-- Name: dlt_templates dlt_templates_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dlt_templates_tenant_isolation ON public.dlt_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: dlt_templates dlt_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dlt_templates_updated_at BEFORE UPDATE ON public.dlt_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: dlt_templates trg_dlt_templates_soft_delete_83bd6bbf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dlt_templates_soft_delete_83bd6bbf BEFORE DELETE ON public.dlt_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0256_family_messages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Family communication portal (ticket #2964): messages between the care team and a resident's
-- family — care updates pushed to the family, and visit requests / general messages from the
-- family — with a read/actioned status. Tenant RLS.

CREATE TABLE public.family_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    direction text DEFAULT 'to_family'::text NOT NULL,
    message_type text DEFAULT 'care_update'::text NOT NULL,
    subject text,
    body text NOT NULL,
    family_contact text,
    status text DEFAULT 'sent'::text NOT NULL,
    posted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT family_message_direction_check CHECK ((direction = ANY (ARRAY['to_family'::text, 'from_family'::text]))),
    CONSTRAINT family_message_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'read'::text, 'actioned'::text]))),
    CONSTRAINT family_message_type_check CHECK ((message_type = ANY (ARRAY['care_update'::text, 'visit_request'::text, 'general'::text])))
);

-- Name: family_messages family_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_messages
    ADD CONSTRAINT family_messages_pkey PRIMARY KEY (id);

CREATE INDEX idx_family_messages_patient ON public.family_messages USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

-- Name: family_messages family_messages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY family_messages_tenant_isolation ON public.family_messages USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: family_messages family_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER family_messages_updated_at BEFORE UPDATE ON public.family_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0158_notifications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: notifications (in-app notification centre)
-- Per-user, tenant-scoped notification feed with read/unread state.
-- ============================================================

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    body text,
    category text,
    entity_type text,
    entity_id uuid,
    action_url text,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

CREATE INDEX idx_notifications_user_feed ON public.notifications USING btree (tenant_id, user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Name: notifications tenant_isolation_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_notifications ON public.notifications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: notifications notifications_notify_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notifications_notify_created AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notify_notification_created();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: comm_clinical_messages comm_clinical_messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.comm_clinical_messages(id);

-- Name: comm_messages comm_messages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.comm_templates(id);
