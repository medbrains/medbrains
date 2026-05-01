-- ============================================================
-- MedBrains schema — module: opd
-- ============================================================

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    appointment_date date NOT NULL,
    slot_start time without time zone NOT NULL,
    slot_end time without time zone NOT NULL,
    appointment_type public.appointment_type DEFAULT 'new_visit'::public.appointment_type NOT NULL,
    status public.appointment_status DEFAULT 'scheduled'::public.appointment_status NOT NULL,
    token_number integer,
    reason text,
    cancel_reason text,
    notes text,
    encounter_id uuid,
    checked_in_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recurrence_pattern character varying(20),
    recurrence_group_id uuid,
    recurrence_index integer DEFAULT 0,
    appointment_group_id uuid,
    booking_source text DEFAULT 'walk_in'::text,
    CONSTRAINT appointments_recurrence_pattern_check CHECK (((recurrence_pattern IS NULL) OR ((recurrence_pattern)::text = ANY ((ARRAY['weekly'::character varying, 'biweekly'::character varying, 'monthly'::character varying])::text[]))))
);



--
-- Name: consultation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultation_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    specialty character varying(100),
    department_id uuid,
    is_shared boolean DEFAULT false NOT NULL,
    chief_complaints text[] DEFAULT '{}'::text[],
    default_history jsonb DEFAULT '{}'::jsonb,
    default_examination jsonb DEFAULT '{}'::jsonb,
    default_ros jsonb DEFAULT '{}'::jsonb,
    default_plan text,
    common_diagnoses text[] DEFAULT '{}'::text[],
    common_medications jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    chief_complaint text,
    history text,
    examination text,
    plan text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hpi text,
    past_medical_history jsonb DEFAULT '[]'::jsonb,
    past_surgical_history jsonb DEFAULT '[]'::jsonb,
    family_history jsonb DEFAULT '[]'::jsonb,
    social_history jsonb DEFAULT '{}'::jsonb,
    review_of_systems jsonb DEFAULT '{}'::jsonb,
    physical_examination jsonb DEFAULT '{}'::jsonb,
    general_appearance text,
    snomed_codes jsonb DEFAULT '[]'::jsonb
);



--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_type public.encounter_type NOT NULL,
    status public.encounter_status DEFAULT 'open'::public.encounter_status NOT NULL,
    department_id uuid,
    doctor_id uuid,
    encounter_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    visit_type character varying(20) DEFAULT 'walk_in'::character varying,
    is_retrospective boolean DEFAULT false NOT NULL,
    retrospective_entry_id uuid,
    CONSTRAINT encounters_visit_type_check CHECK (((visit_type)::text = ANY ((ARRAY['walk_in'::character varying, 'booked'::character varying, 'follow_up'::character varying, 'referral'::character varying, 'emergency'::character varying])::text[])))
);



--
-- Name: multi_doctor_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_doctor_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid,
    slot_start time without time zone,
    slot_end time without time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT multi_doctor_appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text])))
);



--
-- Name: noshow_prediction_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.noshow_prediction_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    predicted_noshow_probability numeric(5,4) NOT NULL,
    risk_level text NOT NULL,
    features_used jsonb DEFAULT '{}'::jsonb NOT NULL,
    model_version text DEFAULT 'v0-stub'::text NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT noshow_prediction_scores_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);



--
-- Name: opd_queues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opd_queues (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    department_id uuid NOT NULL,
    doctor_id uuid,
    token_number integer NOT NULL,
    status public.queue_status DEFAULT 'waiting'::public.queue_status NOT NULL,
    queue_date date DEFAULT CURRENT_DATE NOT NULL,
    called_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);



--
-- Name: queue_display_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_display_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    location_name text NOT NULL,
    display_type text DEFAULT 'waiting_area'::text NOT NULL,
    doctors_per_screen integer DEFAULT 4 NOT NULL,
    show_patient_name boolean DEFAULT false NOT NULL,
    show_wait_time boolean DEFAULT true NOT NULL,
    language jsonb DEFAULT '["en"]'::jsonb NOT NULL,
    announcement_enabled boolean DEFAULT false NOT NULL,
    scroll_speed integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: queue_priority_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_priority_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    priority public.queue_priority NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    auto_detect_criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: queue_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    token_date date DEFAULT CURRENT_DATE NOT NULL,
    token_seq integer NOT NULL,
    token_number character varying(20) NOT NULL,
    patient_id uuid,
    department_id uuid NOT NULL,
    doctor_id uuid,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    priority public.queue_priority DEFAULT 'normal'::public.queue_priority NOT NULL,
    called_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT queue_tokens_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'called'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'no_show'::character varying, 'cancelled'::character varying])::text[])))
);



--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    from_department_id uuid NOT NULL,
    to_department_id uuid NOT NULL,
    from_doctor_id uuid,
    to_doctor_id uuid,
    urgency text DEFAULT 'routine'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text NOT NULL,
    clinical_notes text,
    response_notes text,
    responded_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT referrals_urgency_check CHECK ((urgency = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergency'::text])))
);



--
-- Name: scheduling_overbooking_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduling_overbooking_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    max_overbook_slots integer DEFAULT 2 NOT NULL,
    overbook_threshold_probability numeric(3,2) DEFAULT 0.30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduling_overbooking_rules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);



--
-- Name: scheduling_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduling_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    department_id uuid,
    preferred_date_from date,
    preferred_date_to date,
    preferred_time_from time without time zone,
    preferred_time_to time without time zone,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    offered_appointment_id uuid,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduling_waitlist_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT scheduling_waitlist_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'offered'::text, 'booked'::text, 'expired'::text, 'cancelled'::text])))
);



--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);



--
-- Name: consultation_templates consultation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_templates
    ADD CONSTRAINT consultation_templates_pkey PRIMARY KEY (id);



--
-- Name: consultation_templates consultation_templates_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultation_templates
    ADD CONSTRAINT consultation_templates_tenant_id_name_key UNIQUE (tenant_id, name);



--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);



--
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (id);



--
-- Name: multi_doctor_appointments multi_doctor_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_doctor_appointments
    ADD CONSTRAINT multi_doctor_appointments_pkey PRIMARY KEY (id);



--
-- Name: noshow_prediction_scores noshow_prediction_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noshow_prediction_scores
    ADD CONSTRAINT noshow_prediction_scores_pkey PRIMARY KEY (id);



--
-- Name: opd_queues opd_queues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_pkey PRIMARY KEY (id);



--
-- Name: queue_display_config queue_display_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_display_config
    ADD CONSTRAINT queue_display_config_pkey PRIMARY KEY (id);



--
-- Name: queue_priority_rules queue_priority_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_priority_rules
    ADD CONSTRAINT queue_priority_rules_pkey PRIMARY KEY (id);



--
-- Name: queue_tokens queue_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_pkey PRIMARY KEY (id);



--
-- Name: queue_tokens queue_tokens_tenant_id_department_id_token_date_token_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_tokens
    ADD CONSTRAINT queue_tokens_tenant_id_department_id_token_date_token_seq_key UNIQUE (tenant_id, department_id, token_date, token_seq);



--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);



--
-- Name: scheduling_overbooking_rules scheduling_overbooking_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_overbooking_rules
    ADD CONSTRAINT scheduling_overbooking_rules_pkey PRIMARY KEY (id);



--
-- Name: scheduling_overbooking_rules scheduling_overbooking_rules_tenant_id_doctor_id_department_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_overbooking_rules
    ADD CONSTRAINT scheduling_overbooking_rules_tenant_id_doctor_id_department_key UNIQUE (tenant_id, doctor_id, department_id, day_of_week);



--
-- Name: scheduling_waitlist scheduling_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_pkey PRIMARY KEY (id);



--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (tenant_id, appointment_date);



--
-- Name: idx_appointments_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_doctor ON public.appointments USING btree (tenant_id, doctor_id, appointment_date);



--
-- Name: idx_appointments_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_encounter ON public.appointments USING btree (encounter_id) WHERE (encounter_id IS NOT NULL);



--
-- Name: idx_appointments_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_group_id ON public.appointments USING btree (appointment_group_id) WHERE (appointment_group_id IS NOT NULL);



--
-- Name: idx_appointments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_patient ON public.appointments USING btree (tenant_id, patient_id);



--
-- Name: idx_appointments_recurrence_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_recurrence_group ON public.appointments USING btree (recurrence_group_id) WHERE (recurrence_group_id IS NOT NULL);



--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (tenant_id, status) WHERE (status <> ALL (ARRAY['completed'::public.appointment_status, 'cancelled'::public.appointment_status]));



--
-- Name: idx_consult_templates_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_templates_dept ON public.consultation_templates USING btree (department_id);



--
-- Name: idx_consult_templates_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_templates_specialty ON public.consultation_templates USING btree (specialty);



--
-- Name: idx_consult_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consult_templates_tenant ON public.consultation_templates USING btree (tenant_id);



--
-- Name: idx_consultations_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_encounter ON public.consultations USING btree (encounter_id);



--
-- Name: idx_consultations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_tenant ON public.consultations USING btree (tenant_id);



--
-- Name: idx_encounters_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_created_by ON public.encounters USING btree (created_by);



--
-- Name: idx_encounters_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_date ON public.encounters USING btree (tenant_id, encounter_date);



--
-- Name: idx_encounters_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_doctor ON public.encounters USING btree (doctor_id);



--
-- Name: idx_encounters_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_patient ON public.encounters USING btree (patient_id);



--
-- Name: idx_encounters_retrospective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_retrospective ON public.encounters USING btree (tenant_id, is_retrospective) WHERE (is_retrospective = true);



--
-- Name: idx_encounters_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_encounters_tenant ON public.encounters USING btree (tenant_id);



--
-- Name: idx_multi_doctor_appt_appointment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_doctor_appt_appointment ON public.multi_doctor_appointments USING btree (appointment_id);



--
-- Name: idx_multi_doctor_appt_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_doctor_appt_tenant ON public.multi_doctor_appointments USING btree (tenant_id);



--
-- Name: idx_noshow_predictions_appt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noshow_predictions_appt ON public.noshow_prediction_scores USING btree (tenant_id, appointment_id);



--
-- Name: idx_noshow_predictions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_noshow_predictions_patient ON public.noshow_prediction_scores USING btree (tenant_id, patient_id);



--
-- Name: idx_opd_queues_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opd_queues_date ON public.opd_queues USING btree (tenant_id, queue_date);



--
-- Name: idx_opd_queues_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opd_queues_doctor ON public.opd_queues USING btree (doctor_id, queue_date);



--
-- Name: idx_opd_queues_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_opd_queues_tenant ON public.opd_queues USING btree (tenant_id);



--
-- Name: idx_overbooking_rules_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overbooking_rules_doctor ON public.scheduling_overbooking_rules USING btree (tenant_id, doctor_id, department_id);



--
-- Name: idx_queue_display_config_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_display_config_tenant ON public.queue_display_config USING btree (tenant_id);



--
-- Name: idx_queue_priority_rules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_priority_rules_tenant ON public.queue_priority_rules USING btree (tenant_id);



--
-- Name: idx_queue_tokens_dept_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_tokens_dept_date ON public.queue_tokens USING btree (department_id, token_date);



--
-- Name: idx_queue_tokens_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_tokens_patient ON public.queue_tokens USING btree (patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_queue_tokens_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_tokens_status ON public.queue_tokens USING btree (status) WHERE ((status)::text = ANY ((ARRAY['waiting'::character varying, 'called'::character varying])::text[]));



--
-- Name: idx_queue_tokens_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_tokens_tenant ON public.queue_tokens USING btree (tenant_id);



--
-- Name: idx_referrals_from_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_from_dept ON public.referrals USING btree (tenant_id, from_department_id);



--
-- Name: idx_referrals_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_patient ON public.referrals USING btree (tenant_id, patient_id);



--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_status ON public.referrals USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));



--
-- Name: idx_referrals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_tenant ON public.referrals USING btree (tenant_id);



--
-- Name: idx_referrals_to_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_to_dept ON public.referrals USING btree (tenant_id, to_department_id);



--
-- Name: idx_waitlist_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_doctor ON public.scheduling_waitlist USING btree (tenant_id, doctor_id, status);



--
-- Name: idx_waitlist_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waitlist_status ON public.scheduling_waitlist USING btree (tenant_id, status) WHERE (status = 'waiting'::text);



--
-- Name: appointments audit_appointments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_appointments AFTER INSERT OR DELETE OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');



--
-- Name: consultations audit_consultations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_consultations AFTER INSERT OR DELETE OR UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');



--
-- Name: encounters audit_encounters; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_encounters AFTER INSERT OR DELETE OR UPDATE ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');



--
-- Name: referrals set_updated_at_referrals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_referrals BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: scheduling_overbooking_rules set_updated_at_scheduling_overbooking_rules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_scheduling_overbooking_rules BEFORE UPDATE ON public.scheduling_overbooking_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: scheduling_waitlist set_updated_at_scheduling_waitlist; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_scheduling_waitlist BEFORE UPDATE ON public.scheduling_waitlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: consultations trg_consultations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_consultations_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: encounters trg_encounters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encounters_updated_at BEFORE UPDATE ON public.encounters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: opd_queues trg_opd_queues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opd_queues_updated_at BEFORE UPDATE ON public.opd_queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: queue_display_config trg_queue_display_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_queue_display_config_updated_at BEFORE UPDATE ON public.queue_display_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: queue_priority_rules trg_queue_priority_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_queue_priority_rules_updated_at BEFORE UPDATE ON public.queue_priority_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: queue_tokens trg_queue_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_queue_tokens_updated_at BEFORE UPDATE ON public.queue_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: appointments appointments_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);



--
-- Name: consultations consultations_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);



--
-- Name: multi_doctor_appointments multi_doctor_appointments_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_doctor_appointments
    ADD CONSTRAINT multi_doctor_appointments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;



--
-- Name: noshow_prediction_scores noshow_prediction_scores_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noshow_prediction_scores
    ADD CONSTRAINT noshow_prediction_scores_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);



--
-- Name: opd_queues opd_queues_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_queues
    ADD CONSTRAINT opd_queues_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);



--
-- Name: referrals referrals_encounter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);



--
-- Name: scheduling_waitlist scheduling_waitlist_offered_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduling_waitlist
    ADD CONSTRAINT scheduling_waitlist_offered_appointment_id_fkey FOREIGN KEY (offered_appointment_id) REFERENCES public.appointments(id);



--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;


--
-- Name: consultation_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultation_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: consultation_templates consultation_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY consultation_templates_tenant ON public.consultation_templates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: consultations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;


--
-- Name: encounters dept_scope_encounters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_encounters ON public.encounters USING (public.check_department_access(department_id));



--
-- Name: opd_queues dept_scope_opd_queues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_opd_queues ON public.opd_queues USING (public.check_department_access(department_id));



--
-- Name: encounters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;


--
-- Name: multi_doctor_appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.multi_doctor_appointments ENABLE ROW LEVEL SECURITY;


--
-- Name: multi_doctor_appointments multi_doctor_appointments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_doctor_appointments_tenant ON public.multi_doctor_appointments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: noshow_prediction_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.noshow_prediction_scores ENABLE ROW LEVEL SECURITY;


--
-- Name: opd_queues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opd_queues ENABLE ROW LEVEL SECURITY;


--
-- Name: queue_display_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_display_config ENABLE ROW LEVEL SECURITY;


--
-- Name: queue_display_config queue_display_config_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_display_config_tenant ON public.queue_display_config USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: queue_priority_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_priority_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: queue_priority_rules queue_priority_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_priority_rules_tenant ON public.queue_priority_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: queue_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;


--
-- Name: queue_tokens queue_tokens_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_tokens_tenant ON public.queue_tokens USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;


--
-- Name: referrals referrals_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_tenant ON public.referrals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: scheduling_overbooking_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduling_overbooking_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: scheduling_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduling_waitlist ENABLE ROW LEVEL SECURITY;


--
-- Name: noshow_prediction_scores tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.noshow_prediction_scores USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: scheduling_overbooking_rules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.scheduling_overbooking_rules USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: scheduling_waitlist tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.scheduling_waitlist USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: appointments tenant_isolation_appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_appointments ON public.appointments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: consultations tenant_isolation_consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_consultations ON public.consultations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: encounters tenant_isolation_encounters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_encounters ON public.encounters USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: opd_queues tenant_isolation_opd_queues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_opd_queues ON public.opd_queues USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


