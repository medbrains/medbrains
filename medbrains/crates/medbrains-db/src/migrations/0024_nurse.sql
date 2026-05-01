-- ============================================================
-- MedBrains schema — module: nurse
-- ============================================================

--
-- Name: medication_administration_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_administration_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    scheduled_at timestamp with time zone NOT NULL,
    administered_at timestamp with time zone,
    administered_by uuid,
    dose_index integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    dose_administered text,
    route text,
    hold_reason text,
    refusal_reason text,
    wristband_scan_at timestamp with time zone,
    drug_scan_at timestamp with time zone,
    witness_user_id uuid,
    is_prn boolean DEFAULT false NOT NULL,
    prn_indication text,
    prn_requested_at timestamp with time zone,
    signed_record_id uuid,
    late_minutes integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medication_administration_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'administered'::text, 'held'::text, 'refused'::text, 'missed'::text])))
);

ALTER TABLE ONLY public.medication_administration_records FORCE ROW LEVEL SECURITY;



--
-- Name: nurse_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nurse_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    license_number text,
    specialty text,
    shift_pattern text,
    employment_type text,
    is_charge_nurse boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.nurse_profiles FORCE ROW LEVEL SECURITY;



--
-- Name: nurse_shift_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nurse_shift_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    nurse_user_id uuid NOT NULL,
    ward_id uuid,
    shift_date date NOT NULL,
    shift_type text NOT NULL,
    patient_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    primary_assigned boolean DEFAULT true NOT NULL,
    charge_nurse_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nurse_shift_assignments_shift_type_check CHECK ((shift_type = ANY (ARRAY['day'::text, 'evening'::text, 'night'::text])))
);

ALTER TABLE ONLY public.nurse_shift_assignments FORCE ROW LEVEL SECURITY;



--
-- Name: nursing_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nursing_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    assigned_to uuid,
    task_type text NOT NULL,
    description text NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority public.nursing_task_priority DEFAULT 'routine'::public.nursing_task_priority NOT NULL,
    category public.nursing_task_category
);



--
-- Name: shift_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    outgoing_nurse_id uuid NOT NULL,
    incoming_nurse_id uuid NOT NULL,
    outgoing_signed_at timestamp with time zone,
    incoming_signed_at timestamp with time zone,
    situation text,
    background text,
    assessment text,
    recommendation text,
    alerts jsonb DEFAULT '[]'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_handoffs_check CHECK ((outgoing_nurse_id <> incoming_nurse_id))
);

ALTER TABLE ONLY public.shift_handoffs FORCE ROW LEVEL SECURITY;



--
-- Name: medication_administration_records medication_administration_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administration_records
    ADD CONSTRAINT medication_administration_records_pkey PRIMARY KEY (id);



--
-- Name: nurse_profiles nurse_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_pkey PRIMARY KEY (id);



--
-- Name: nurse_profiles nurse_profiles_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_tenant_id_user_id_key UNIQUE (tenant_id, user_id);



--
-- Name: nurse_shift_assignments nurse_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_assignments
    ADD CONSTRAINT nurse_shift_assignments_pkey PRIMARY KEY (id);



--
-- Name: nursing_tasks nursing_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_pkey PRIMARY KEY (id);



--
-- Name: shift_handoffs shift_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_handoffs
    ADD CONSTRAINT shift_handoffs_pkey PRIMARY KEY (id);



--
-- Name: idx_nursing_tasks_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nursing_tasks_admission ON public.nursing_tasks USING btree (admission_id);



--
-- Name: idx_nursing_tasks_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nursing_tasks_assigned ON public.nursing_tasks USING btree (assigned_to);



--
-- Name: idx_nursing_tasks_assigned_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nursing_tasks_assigned_due ON public.nursing_tasks USING btree (tenant_id, assigned_to, due_at) WHERE (is_completed = false);



--
-- Name: idx_nursing_tasks_due_incomplete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nursing_tasks_due_incomplete ON public.nursing_tasks USING btree (tenant_id, admission_id, due_at) WHERE (is_completed = false);



--
-- Name: idx_nursing_tasks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nursing_tasks_tenant ON public.nursing_tasks USING btree (tenant_id);



--
-- Name: mar_administrator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mar_administrator_idx ON public.medication_administration_records USING btree (tenant_id, administered_by, administered_at DESC) WHERE (administered_by IS NOT NULL);



--
-- Name: mar_patient_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mar_patient_recent_idx ON public.medication_administration_records USING btree (tenant_id, patient_id, scheduled_at DESC);



--
-- Name: mar_pending_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mar_pending_due_idx ON public.medication_administration_records USING btree (tenant_id, scheduled_at) WHERE (status = 'pending'::text);



--
-- Name: nurse_shift_assignments_today_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nurse_shift_assignments_today_idx ON public.nurse_shift_assignments USING btree (tenant_id, nurse_user_id, shift_date DESC);



--
-- Name: shift_handoffs_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shift_handoffs_encounter_idx ON public.shift_handoffs USING btree (tenant_id, encounter_id, created_at DESC);



--
-- Name: nursing_tasks audit_nursing_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_nursing_tasks AFTER INSERT OR DELETE OR UPDATE ON public.nursing_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('ipd');



--
-- Name: medication_administration_records mar_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mar_updated BEFORE UPDATE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: nurse_profiles nurse_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER nurse_profiles_updated BEFORE UPDATE ON public.nurse_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: nursing_tasks trg_nursing_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nursing_tasks_updated_at BEFORE UPDATE ON public.nursing_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: medication_administration_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_administration_records ENABLE ROW LEVEL SECURITY;


--
-- Name: nurse_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nurse_profiles ENABLE ROW LEVEL SECURITY;


--
-- Name: nurse_shift_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nurse_shift_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: nursing_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nursing_tasks ENABLE ROW LEVEL SECURITY;


--
-- Name: shift_handoffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_handoffs ENABLE ROW LEVEL SECURITY;


--
-- Name: medication_administration_records tenant_isolation_medication_administration_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_medication_administration_records ON public.medication_administration_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: nurse_profiles tenant_isolation_nurse_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nurse_profiles ON public.nurse_profiles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: nurse_shift_assignments tenant_isolation_nurse_shift_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nurse_shift_assignments ON public.nurse_shift_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: nursing_tasks tenant_isolation_nursing_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nursing_tasks ON public.nursing_tasks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: shift_handoffs tenant_isolation_shift_handoffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_shift_handoffs ON public.shift_handoffs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


