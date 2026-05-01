-- ============================================================
-- MedBrains schema — module: ot
-- ============================================================

--
-- Name: ot_anesthesia_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_anesthesia_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    anesthetist_id uuid NOT NULL,
    anesthesia_type public.anesthesia_type NOT NULL,
    asa_class public.asa_classification,
    induction_time timestamp with time zone,
    intubation_time timestamp with time zone,
    extubation_time timestamp with time zone,
    airway_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    drugs_administered jsonb DEFAULT '[]'::jsonb NOT NULL,
    monitoring_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    fluids_given jsonb DEFAULT '[]'::jsonb NOT NULL,
    blood_products jsonb DEFAULT '[]'::jsonb NOT NULL,
    adverse_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    complications text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_bookings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    ot_room_id uuid NOT NULL,
    primary_surgeon_id uuid NOT NULL,
    anesthetist_id uuid,
    scheduled_date date NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    procedure_name text NOT NULL,
    procedure_code character varying(20),
    laterality character varying(10),
    priority public.ot_case_priority DEFAULT 'elective'::public.ot_case_priority NOT NULL,
    status public.ot_booking_status DEFAULT 'requested'::public.ot_booking_status NOT NULL,
    consent_obtained boolean DEFAULT false NOT NULL,
    site_marked boolean DEFAULT false NOT NULL,
    blood_arranged boolean DEFAULT false NOT NULL,
    assistant_surgeons jsonb DEFAULT '[]'::jsonb NOT NULL,
    scrub_nurses jsonb DEFAULT '[]'::jsonb NOT NULL,
    circulating_nurses jsonb DEFAULT '[]'::jsonb NOT NULL,
    estimated_duration_min integer,
    cancellation_reason text,
    postpone_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_start_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    turnaround_minutes integer,
    surgeon_id uuid
);



--
-- Name: ot_case_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_case_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    surgeon_id uuid NOT NULL,
    patient_in_time timestamp with time zone,
    patient_out_time timestamp with time zone,
    incision_time timestamp with time zone,
    closure_time timestamp with time zone,
    procedure_performed text NOT NULL,
    findings text,
    technique text,
    complications text,
    blood_loss_ml integer,
    specimens jsonb DEFAULT '[]'::jsonb NOT NULL,
    implants jsonb DEFAULT '[]'::jsonb NOT NULL,
    drains jsonb DEFAULT '[]'::jsonb NOT NULL,
    instrument_count_correct_before boolean,
    instrument_count_correct_after boolean,
    sponge_count_correct boolean,
    cssd_issuance_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    surgical_site_infection boolean DEFAULT false NOT NULL,
    ssi_detected_at date
);



--
-- Name: ot_consumable_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_consumable_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    item_name character varying(200) NOT NULL,
    category public.ot_consumable_category DEFAULT 'other'::public.ot_consumable_category NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit character varying(50),
    unit_price numeric(10,2),
    batch_number character varying(100),
    recorded_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_postop_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_postop_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    destination_bed_id uuid,
    recovery_status public.postop_recovery_status DEFAULT 'in_recovery'::public.postop_recovery_status NOT NULL,
    arrival_time timestamp with time zone,
    discharge_time timestamp with time zone,
    aldrete_score_arrival integer,
    aldrete_score_discharge integer,
    vitals_on_arrival jsonb DEFAULT '{}'::jsonb NOT NULL,
    monitoring_entries jsonb DEFAULT '[]'::jsonb NOT NULL,
    pain_assessment text,
    fluid_orders text,
    diet_orders text,
    activity_orders text,
    disposition text,
    postop_orders jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_preop_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_preop_assessments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    clearance_status public.preop_clearance_status DEFAULT 'pending'::public.preop_clearance_status NOT NULL,
    asa_class public.asa_classification,
    airway_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    cardiac_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    pulmonary_assessment jsonb DEFAULT '{}'::jsonb NOT NULL,
    lab_results_reviewed boolean DEFAULT false NOT NULL,
    imaging_reviewed boolean DEFAULT false NOT NULL,
    blood_group_confirmed boolean DEFAULT false NOT NULL,
    fasting_status boolean DEFAULT false NOT NULL,
    npo_since timestamp with time zone,
    allergies_noted text,
    current_medications text,
    conditions text,
    assessed_by uuid NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_rooms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    name text NOT NULL,
    code character varying(30) NOT NULL,
    status public.ot_room_status DEFAULT 'available'::public.ot_room_status NOT NULL,
    specialties jsonb DEFAULT '[]'::jsonb NOT NULL,
    equipment jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_surgeon_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_surgeon_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    surgeon_id uuid NOT NULL,
    procedure_name text NOT NULL,
    "position" text,
    skin_prep text,
    draping text,
    instruments jsonb DEFAULT '[]'::jsonb NOT NULL,
    sutures jsonb DEFAULT '[]'::jsonb NOT NULL,
    implants jsonb DEFAULT '[]'::jsonb NOT NULL,
    equipment jsonb DEFAULT '[]'::jsonb NOT NULL,
    medications jsonb DEFAULT '[]'::jsonb NOT NULL,
    special_instructions text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: ot_surgical_safety_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ot_surgical_safety_checklists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    phase public.checklist_phase NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: surgeries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surgeries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    ot_id uuid,
    diagnosis text,
    procedure_name text,
    surgery_type text,
    surgeon_id uuid,
    assistant_surgeon_id uuid,
    anesthesiologist_id uuid,
    anesthesia_type text,
    scrub_nurse text,
    scrub_nurse_id uuid,
    circulating_nurse text,
    circulating_nurse_id uuid,
    surgery_date date,
    scheduled_time timestamp with time zone,
    surgery_start_time timestamp with time zone,
    surgery_end_time timestamp with time zone,
    actual_start_time timestamp with time zone,
    actual_end_time timestamp with time zone,
    outcome text,
    complications text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.surgeries FORCE ROW LEVEL SECURITY;



--
-- Name: ot_anesthesia_records ot_anesthesia_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_pkey PRIMARY KEY (id);



--
-- Name: ot_bookings ot_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_pkey PRIMARY KEY (id);



--
-- Name: ot_case_records ot_case_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_pkey PRIMARY KEY (id);



--
-- Name: ot_consumable_usage ot_consumable_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_pkey PRIMARY KEY (id);



--
-- Name: ot_postop_records ot_postop_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_pkey PRIMARY KEY (id);



--
-- Name: ot_preop_assessments ot_preop_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_pkey PRIMARY KEY (id);



--
-- Name: ot_rooms ot_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_pkey PRIMARY KEY (id);



--
-- Name: ot_rooms ot_rooms_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: ot_surgeon_preferences ot_surgeon_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_pkey PRIMARY KEY (id);



--
-- Name: ot_surgeon_preferences ot_surgeon_preferences_tenant_id_surgeon_id_procedure_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_tenant_id_surgeon_id_procedure_name_key UNIQUE (tenant_id, surgeon_id, procedure_name);



--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_pkey PRIMARY KEY (id);



--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_tenant_id_booking_id_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_tenant_id_booking_id_phase_key UNIQUE (tenant_id, booking_id, phase);



--
-- Name: surgeries surgeries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_pkey PRIMARY KEY (id);



--
-- Name: idx_ot_anesthesia_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_anesthesia_booking ON public.ot_anesthesia_records USING btree (booking_id);



--
-- Name: idx_ot_anesthesia_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_anesthesia_tenant ON public.ot_anesthesia_records USING btree (tenant_id);



--
-- Name: idx_ot_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_date ON public.ot_bookings USING btree (tenant_id, scheduled_date);



--
-- Name: idx_ot_bookings_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_patient ON public.ot_bookings USING btree (patient_id);



--
-- Name: idx_ot_bookings_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_room ON public.ot_bookings USING btree (ot_room_id, scheduled_date);



--
-- Name: idx_ot_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_status ON public.ot_bookings USING btree (tenant_id, status);



--
-- Name: idx_ot_bookings_surgeon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_surgeon ON public.ot_bookings USING btree (primary_surgeon_id, scheduled_date);



--
-- Name: idx_ot_bookings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_bookings_tenant ON public.ot_bookings USING btree (tenant_id);



--
-- Name: idx_ot_case_records_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_case_records_booking ON public.ot_case_records USING btree (booking_id);



--
-- Name: idx_ot_case_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_case_records_tenant ON public.ot_case_records USING btree (tenant_id);



--
-- Name: idx_ot_consumables_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_consumables_booking ON public.ot_consumable_usage USING btree (booking_id);



--
-- Name: idx_ot_postop_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_postop_booking ON public.ot_postop_records USING btree (booking_id);



--
-- Name: idx_ot_postop_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_postop_tenant ON public.ot_postop_records USING btree (tenant_id);



--
-- Name: idx_ot_preop_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_preop_booking ON public.ot_preop_assessments USING btree (booking_id);



--
-- Name: idx_ot_preop_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_preop_tenant ON public.ot_preop_assessments USING btree (tenant_id);



--
-- Name: idx_ot_rooms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_rooms_status ON public.ot_rooms USING btree (tenant_id, status);



--
-- Name: idx_ot_rooms_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_rooms_tenant ON public.ot_rooms USING btree (tenant_id);



--
-- Name: idx_ot_safety_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_safety_booking ON public.ot_surgical_safety_checklists USING btree (booking_id);



--
-- Name: idx_ot_safety_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_safety_tenant ON public.ot_surgical_safety_checklists USING btree (tenant_id);



--
-- Name: idx_ot_surgeon_prefs_surgeon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_surgeon_prefs_surgeon ON public.ot_surgeon_preferences USING btree (surgeon_id);



--
-- Name: idx_ot_surgeon_prefs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ot_surgeon_prefs_tenant ON public.ot_surgeon_preferences USING btree (tenant_id);



--
-- Name: idx_surgeries_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surgeries_patient ON public.surgeries USING btree (tenant_id, patient_id, surgery_date DESC);



--
-- Name: ot_anesthesia_records trg_ot_anesthesia_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_anesthesia_updated BEFORE UPDATE ON public.ot_anesthesia_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_bookings trg_ot_bookings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_bookings_updated BEFORE UPDATE ON public.ot_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_case_records trg_ot_case_records_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_case_records_updated BEFORE UPDATE ON public.ot_case_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_postop_records trg_ot_postop_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_postop_updated BEFORE UPDATE ON public.ot_postop_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_preop_assessments trg_ot_preop_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_preop_updated BEFORE UPDATE ON public.ot_preop_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_rooms trg_ot_rooms_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_rooms_updated BEFORE UPDATE ON public.ot_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_surgical_safety_checklists trg_ot_safety_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_safety_updated BEFORE UPDATE ON public.ot_surgical_safety_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_surgeon_preferences trg_ot_surgeon_prefs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_surgeon_prefs_updated BEFORE UPDATE ON public.ot_surgeon_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: ot_anesthesia_records ot_anesthesia_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_bookings ot_bookings_ot_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_ot_room_id_fkey FOREIGN KEY (ot_room_id) REFERENCES public.ot_rooms(id);



--
-- Name: ot_case_records ot_case_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_consumable_usage ot_consumable_usage_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_postop_records ot_postop_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_preop_assessments ot_preop_assessments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);



--
-- Name: ot_anesthesia_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_anesthesia_records ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_bookings ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_case_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_case_records ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_consumable_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_consumable_usage ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_postop_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_postop_records ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_preop_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_preop_assessments ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_rooms ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_surgeon_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_surgeon_preferences ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_surgical_safety_checklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ot_surgical_safety_checklists ENABLE ROW LEVEL SECURITY;


--
-- Name: surgeries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;


--
-- Name: ot_consumable_usage tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ot_consumable_usage USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_anesthesia_records tenant_isolation_ot_anesthesia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_anesthesia ON public.ot_anesthesia_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_bookings tenant_isolation_ot_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_bookings ON public.ot_bookings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_case_records tenant_isolation_ot_case_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_case_records ON public.ot_case_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_postop_records tenant_isolation_ot_postop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_postop ON public.ot_postop_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_preop_assessments tenant_isolation_ot_preop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_preop ON public.ot_preop_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_rooms tenant_isolation_ot_rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_rooms ON public.ot_rooms USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_surgical_safety_checklists tenant_isolation_ot_safety; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_safety ON public.ot_surgical_safety_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: ot_surgeon_preferences tenant_isolation_ot_surgeon_prefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_surgeon_prefs ON public.ot_surgeon_preferences USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: surgeries tenant_isolation_surgeries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_surgeries ON public.surgeries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


