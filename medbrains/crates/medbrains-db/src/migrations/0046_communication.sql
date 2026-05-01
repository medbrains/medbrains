-- ============================================================
-- MedBrains schema — module: communication
-- ============================================================

--
-- Name: code_blue_events; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT code_blue_events_outcome_check CHECK ((outcome = ANY (ARRAY['rosc'::text, 'transferred'::text, 'expired'::text, 'stable'::text])))
);

ALTER TABLE ONLY public.code_blue_events FORCE ROW LEVEL SECURITY;



--
-- Name: comm_clinical_messages; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: comm_complaints; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT comm_complaints_satisfaction_score_check CHECK (((satisfaction_score >= 1) AND (satisfaction_score <= 5)))
);



--
-- Name: comm_critical_alerts; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: comm_escalation_rules; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: comm_feedback_surveys; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT comm_feedback_surveys_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_communication_rating_check CHECK (((communication_rating >= 1) AND (communication_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_discharge_rating_check CHECK (((discharge_rating >= 1) AND (discharge_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_food_rating_check CHECK (((food_rating >= 1) AND (food_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_nps_score_check CHECK (((nps_score >= 0) AND (nps_score <= 10))),
    CONSTRAINT comm_feedback_surveys_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_staff_rating_check CHECK (((staff_rating >= 1) AND (staff_rating <= 5))),
    CONSTRAINT comm_feedback_surveys_wait_time_rating_check CHECK (((wait_time_rating >= 1) AND (wait_time_rating <= 5)))
);



--
-- Name: comm_messages; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: comm_templates; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: code_blue_events code_blue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_blue_events
    ADD CONSTRAINT code_blue_events_pkey PRIMARY KEY (id);



--
-- Name: comm_clinical_messages comm_clinical_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_pkey PRIMARY KEY (id);



--
-- Name: comm_clinical_messages comm_clinical_messages_tenant_id_message_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_tenant_id_message_code_key UNIQUE (tenant_id, message_code);



--
-- Name: comm_complaints comm_complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_pkey PRIMARY KEY (id);



--
-- Name: comm_complaints comm_complaints_tenant_id_complaint_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_complaints
    ADD CONSTRAINT comm_complaints_tenant_id_complaint_code_key UNIQUE (tenant_id, complaint_code);



--
-- Name: comm_critical_alerts comm_critical_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_pkey PRIMARY KEY (id);



--
-- Name: comm_critical_alerts comm_critical_alerts_tenant_id_alert_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_critical_alerts
    ADD CONSTRAINT comm_critical_alerts_tenant_id_alert_code_key UNIQUE (tenant_id, alert_code);



--
-- Name: comm_escalation_rules comm_escalation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_escalation_rules
    ADD CONSTRAINT comm_escalation_rules_pkey PRIMARY KEY (id);



--
-- Name: comm_feedback_surveys comm_feedback_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_pkey PRIMARY KEY (id);



--
-- Name: comm_feedback_surveys comm_feedback_surveys_tenant_id_feedback_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_feedback_surveys
    ADD CONSTRAINT comm_feedback_surveys_tenant_id_feedback_code_key UNIQUE (tenant_id, feedback_code);



--
-- Name: comm_messages comm_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_pkey PRIMARY KEY (id);



--
-- Name: comm_messages comm_messages_tenant_id_message_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_tenant_id_message_code_key UNIQUE (tenant_id, message_code);



--
-- Name: comm_templates comm_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_pkey PRIMARY KEY (id);



--
-- Name: comm_templates comm_templates_tenant_id_template_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_templates
    ADD CONSTRAINT comm_templates_tenant_id_template_code_key UNIQUE (tenant_id, template_code);



--
-- Name: code_blue_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX code_blue_active_idx ON public.code_blue_events USING btree (tenant_id, started_at DESC) WHERE (ended_at IS NULL);



--
-- Name: idx_comm_alert_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_alert_patient ON public.comm_critical_alerts USING btree (tenant_id, patient_id);



--
-- Name: idx_comm_alert_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_alert_source ON public.comm_critical_alerts USING btree (tenant_id, alert_source);



--
-- Name: idx_comm_alert_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_alert_status ON public.comm_critical_alerts USING btree (tenant_id, status);



--
-- Name: idx_comm_alert_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_alert_tenant ON public.comm_critical_alerts USING btree (tenant_id);



--
-- Name: idx_comm_alert_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_alert_time ON public.comm_critical_alerts USING btree (tenant_id, triggered_at DESC);



--
-- Name: idx_comm_clin_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_created ON public.comm_clinical_messages USING btree (tenant_id, created_at DESC);



--
-- Name: idx_comm_clin_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_patient ON public.comm_clinical_messages USING btree (tenant_id, patient_id);



--
-- Name: idx_comm_clin_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_priority ON public.comm_clinical_messages USING btree (tenant_id, priority);



--
-- Name: idx_comm_clin_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_recipient ON public.comm_clinical_messages USING btree (tenant_id, recipient_id);



--
-- Name: idx_comm_clin_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_sender ON public.comm_clinical_messages USING btree (tenant_id, sender_id);



--
-- Name: idx_comm_clin_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_clin_tenant ON public.comm_clinical_messages USING btree (tenant_id);



--
-- Name: idx_comm_cmp_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_cmp_dept ON public.comm_complaints USING btree (tenant_id, department_id);



--
-- Name: idx_comm_cmp_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_cmp_sla ON public.comm_complaints USING btree (tenant_id, sla_deadline) WHERE (status <> ALL (ARRAY['resolved'::public.comm_complaint_status, 'closed'::public.comm_complaint_status]));



--
-- Name: idx_comm_cmp_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_cmp_source ON public.comm_complaints USING btree (tenant_id, source);



--
-- Name: idx_comm_cmp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_cmp_status ON public.comm_complaints USING btree (tenant_id, status);



--
-- Name: idx_comm_cmp_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_cmp_tenant ON public.comm_complaints USING btree (tenant_id);



--
-- Name: idx_comm_esc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_esc_tenant ON public.comm_escalation_rules USING btree (tenant_id);



--
-- Name: idx_comm_esc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_esc_type ON public.comm_escalation_rules USING btree (tenant_id, rule_type);



--
-- Name: idx_comm_fb_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_fb_date ON public.comm_feedback_surveys USING btree (tenant_id, submitted_at DESC);



--
-- Name: idx_comm_fb_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_fb_dept ON public.comm_feedback_surveys USING btree (tenant_id, department_id);



--
-- Name: idx_comm_fb_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_fb_tenant ON public.comm_feedback_surveys USING btree (tenant_id);



--
-- Name: idx_comm_fb_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_fb_type ON public.comm_feedback_surveys USING btree (tenant_id, feedback_type);



--
-- Name: idx_comm_msg_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_msg_channel ON public.comm_messages USING btree (tenant_id, channel);



--
-- Name: idx_comm_msg_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_msg_created ON public.comm_messages USING btree (tenant_id, created_at DESC);



--
-- Name: idx_comm_msg_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_msg_status ON public.comm_messages USING btree (tenant_id, status);



--
-- Name: idx_comm_msg_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_msg_tenant ON public.comm_messages USING btree (tenant_id);



--
-- Name: idx_comm_tpl_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_tpl_channel ON public.comm_templates USING btree (tenant_id, channel);



--
-- Name: idx_comm_tpl_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_tpl_tenant ON public.comm_templates USING btree (tenant_id);



--
-- Name: idx_comm_tpl_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_tpl_type ON public.comm_templates USING btree (tenant_id, template_type);



--
-- Name: comm_critical_alerts trg_comm_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_alerts_updated_at BEFORE UPDATE ON public.comm_critical_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_clinical_messages trg_comm_clinical_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_clinical_updated_at BEFORE UPDATE ON public.comm_clinical_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_complaints trg_comm_complaints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_complaints_updated_at BEFORE UPDATE ON public.comm_complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_escalation_rules trg_comm_escalation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_escalation_updated_at BEFORE UPDATE ON public.comm_escalation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_messages trg_comm_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_messages_updated_at BEFORE UPDATE ON public.comm_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_templates trg_comm_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comm_templates_updated_at BEFORE UPDATE ON public.comm_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: comm_clinical_messages comm_clinical_messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_clinical_messages
    ADD CONSTRAINT comm_clinical_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.comm_clinical_messages(id);



--
-- Name: comm_messages comm_messages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comm_messages
    ADD CONSTRAINT comm_messages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.comm_templates(id);



--
-- Name: code_blue_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.code_blue_events ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_clinical_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_clinical_messages ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_complaints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_complaints ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_critical_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_critical_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_escalation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_escalation_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_feedback_surveys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_feedback_surveys ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_messages ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: comm_clinical_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_clinical_messages USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_complaints tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_complaints USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_critical_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_critical_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_escalation_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_escalation_rules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_feedback_surveys tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_feedback_surveys USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_messages USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: comm_templates tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.comm_templates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: code_blue_events tenant_isolation_code_blue_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_code_blue_events ON public.code_blue_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


