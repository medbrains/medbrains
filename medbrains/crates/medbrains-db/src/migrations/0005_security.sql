-- ============================================================
-- MedBrains schema — module: security
-- ============================================================

--
-- Name: security_access_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_access_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    card_number text NOT NULL,
    card_type text DEFAULT 'standard'::text,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date date,
    allowed_zones jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    deactivated_at timestamp with time zone,
    deactivation_reason text,
    issued_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    employee_id uuid,
    person_name text,
    access_method public.sec_access_method DEFAULT 'manual'::public.sec_access_method NOT NULL,
    card_number text,
    direction text DEFAULT 'entry'::text NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    denied_reason text,
    is_after_hours boolean DEFAULT false NOT NULL,
    accessed_at timestamp with time zone DEFAULT now() NOT NULL,
    device_id text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_cameras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_cameras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    camera_id text,
    zone_id uuid,
    location_description text,
    camera_type text DEFAULT 'dome'::text,
    resolution text,
    is_recording boolean DEFAULT true NOT NULL,
    retention_days integer DEFAULT 30 NOT NULL,
    ip_address text,
    is_active boolean DEFAULT true NOT NULL,
    last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_code_debriefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_code_debriefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code_activation_id uuid NOT NULL,
    debrief_date date DEFAULT CURRENT_DATE NOT NULL,
    facilitator_id uuid,
    attendees jsonb DEFAULT '[]'::jsonb,
    response_time_seconds integer,
    total_duration_minutes integer,
    what_went_well text,
    what_went_wrong text,
    root_cause text,
    lessons_learned text,
    action_items jsonb DEFAULT '[]'::jsonb,
    equipment_issues text,
    training_gaps text,
    protocol_changes_recommended text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    incident_number text NOT NULL,
    severity public.sec_incident_severity DEFAULT 'medium'::public.sec_incident_severity NOT NULL,
    status public.sec_incident_status DEFAULT 'reported'::public.sec_incident_status NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    zone_id uuid,
    location_description text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    description text NOT NULL,
    persons_involved jsonb DEFAULT '[]'::jsonb,
    witnesses jsonb DEFAULT '[]'::jsonb,
    camera_ids jsonb DEFAULT '[]'::jsonb,
    video_timestamp_start text,
    video_timestamp_end text,
    police_notified boolean DEFAULT false NOT NULL,
    police_report_number text,
    investigation_notes text,
    resolution text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    reported_by uuid,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cert_in_reported boolean DEFAULT false NOT NULL,
    cert_in_report_date timestamp with time zone,
    cert_in_reference text
);



--
-- Name: security_patient_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_patient_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    tag_type public.sec_patient_tag_type NOT NULL,
    tag_identifier text,
    allowed_zone_id uuid,
    alert_status public.sec_tag_alert_status DEFAULT 'active'::public.sec_tag_alert_status NOT NULL,
    mother_id uuid,
    admission_id uuid,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    activated_by uuid,
    deactivated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_tag_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_tag_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    alert_type text DEFAULT 'zone_breach'::text NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    zone_id uuid,
    location_description text,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    was_false_alarm boolean DEFAULT false NOT NULL,
    resolution_notes text,
    code_activation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    zone_code text NOT NULL,
    level public.sec_zone_level DEFAULT 'general'::public.sec_zone_level NOT NULL,
    department_id uuid,
    description text,
    allowed_methods jsonb DEFAULT '["card", "biometric", "pin", "manual"]'::jsonb,
    after_hours_restricted boolean DEFAULT false NOT NULL,
    after_hours_start text,
    after_hours_end text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: security_access_cards security_access_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_pkey PRIMARY KEY (id);



--
-- Name: security_access_cards security_access_cards_tenant_id_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_cards
    ADD CONSTRAINT security_access_cards_tenant_id_card_number_key UNIQUE (tenant_id, card_number);



--
-- Name: security_access_logs security_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_pkey PRIMARY KEY (id);



--
-- Name: security_cameras security_cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_cameras
    ADD CONSTRAINT security_cameras_pkey PRIMARY KEY (id);



--
-- Name: security_code_debriefs security_code_debriefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_code_debriefs
    ADD CONSTRAINT security_code_debriefs_pkey PRIMARY KEY (id);



--
-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);



--
-- Name: security_incidents security_incidents_tenant_id_incident_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_tenant_id_incident_number_key UNIQUE (tenant_id, incident_number);



--
-- Name: security_patient_tags security_patient_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_pkey PRIMARY KEY (id);



--
-- Name: security_tag_alerts security_tag_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_pkey PRIMARY KEY (id);



--
-- Name: security_zones security_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_pkey PRIMARY KEY (id);



--
-- Name: security_zones security_zones_tenant_id_zone_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_zones
    ADD CONSTRAINT security_zones_tenant_id_zone_code_key UNIQUE (tenant_id, zone_code);



--
-- Name: idx_security_access_cards_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_cards_employee ON public.security_access_cards USING btree (employee_id);



--
-- Name: idx_security_access_cards_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_cards_tenant ON public.security_access_cards USING btree (tenant_id);



--
-- Name: idx_security_access_logs_accessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_logs_accessed ON public.security_access_logs USING btree (accessed_at DESC);



--
-- Name: idx_security_access_logs_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_logs_employee ON public.security_access_logs USING btree (employee_id);



--
-- Name: idx_security_access_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_logs_tenant ON public.security_access_logs USING btree (tenant_id);



--
-- Name: idx_security_access_logs_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_access_logs_zone ON public.security_access_logs USING btree (zone_id);



--
-- Name: idx_security_cameras_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_cameras_tenant ON public.security_cameras USING btree (tenant_id);



--
-- Name: idx_security_cameras_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_cameras_zone ON public.security_cameras USING btree (zone_id);



--
-- Name: idx_security_code_debriefs_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_code_debriefs_code ON public.security_code_debriefs USING btree (code_activation_id);



--
-- Name: idx_security_code_debriefs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_code_debriefs_tenant ON public.security_code_debriefs USING btree (tenant_id);



--
-- Name: idx_security_incidents_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_occurred ON public.security_incidents USING btree (occurred_at DESC);



--
-- Name: idx_security_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_severity ON public.security_incidents USING btree (severity);



--
-- Name: idx_security_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_status ON public.security_incidents USING btree (status);



--
-- Name: idx_security_incidents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_tenant ON public.security_incidents USING btree (tenant_id);



--
-- Name: idx_security_patient_tags_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_patient_tags_patient ON public.security_patient_tags USING btree (patient_id);



--
-- Name: idx_security_patient_tags_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_patient_tags_status ON public.security_patient_tags USING btree (alert_status);



--
-- Name: idx_security_patient_tags_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_patient_tags_tenant ON public.security_patient_tags USING btree (tenant_id);



--
-- Name: idx_security_tag_alerts_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_tag_alerts_resolved ON public.security_tag_alerts USING btree (is_resolved);



--
-- Name: idx_security_tag_alerts_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_tag_alerts_tag ON public.security_tag_alerts USING btree (tag_id);



--
-- Name: idx_security_tag_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_tag_alerts_tenant ON public.security_tag_alerts USING btree (tenant_id);



--
-- Name: idx_security_zones_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_zones_tenant ON public.security_zones USING btree (tenant_id);



--
-- Name: security_access_cards trg_security_access_cards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_cards_updated_at BEFORE UPDATE ON public.security_access_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_access_logs trg_security_access_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_access_logs_updated_at BEFORE UPDATE ON public.security_access_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_cameras trg_security_cameras_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_cameras_updated_at BEFORE UPDATE ON public.security_cameras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_code_debriefs trg_security_code_debriefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_code_debriefs_updated_at BEFORE UPDATE ON public.security_code_debriefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_incidents trg_security_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_incidents_updated_at BEFORE UPDATE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_patient_tags trg_security_patient_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_patient_tags_updated_at BEFORE UPDATE ON public.security_patient_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_tag_alerts trg_security_tag_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_tag_alerts_updated_at BEFORE UPDATE ON public.security_tag_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_zones trg_security_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_security_zones_updated_at BEFORE UPDATE ON public.security_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: security_access_logs security_access_logs_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_access_logs
    ADD CONSTRAINT security_access_logs_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);



--
-- Name: security_cameras security_cameras_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_cameras
    ADD CONSTRAINT security_cameras_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);



--
-- Name: security_incidents security_incidents_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);



--
-- Name: security_patient_tags security_patient_tags_allowed_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_patient_tags
    ADD CONSTRAINT security_patient_tags_allowed_zone_id_fkey FOREIGN KEY (allowed_zone_id) REFERENCES public.security_zones(id);



--
-- Name: security_tag_alerts security_tag_alerts_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.security_patient_tags(id);



--
-- Name: security_tag_alerts security_tag_alerts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_tag_alerts
    ADD CONSTRAINT security_tag_alerts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.security_zones(id);



--
-- Name: security_access_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_access_cards ENABLE ROW LEVEL SECURITY;


--
-- Name: security_access_cards security_access_cards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_access_cards_tenant ON public.security_access_cards USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_access_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_access_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: security_access_logs security_access_logs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_access_logs_tenant ON public.security_access_logs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_cameras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_cameras ENABLE ROW LEVEL SECURITY;


--
-- Name: security_cameras security_cameras_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_cameras_tenant ON public.security_cameras USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_code_debriefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_code_debriefs ENABLE ROW LEVEL SECURITY;


--
-- Name: security_code_debriefs security_code_debriefs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_code_debriefs_tenant ON public.security_code_debriefs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;


--
-- Name: security_incidents security_incidents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_incidents_tenant ON public.security_incidents USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_patient_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_patient_tags ENABLE ROW LEVEL SECURITY;


--
-- Name: security_patient_tags security_patient_tags_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_patient_tags_tenant ON public.security_patient_tags USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_tag_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_tag_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: security_tag_alerts security_tag_alerts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_tag_alerts_tenant ON public.security_tag_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: security_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_zones ENABLE ROW LEVEL SECURITY;


--
-- Name: security_zones security_zones_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_zones_tenant ON public.security_zones USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


