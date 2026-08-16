-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 13
-- Drops: none
-- nursing — schema.
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



CREATE TABLE public.bedside_education_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    video_url text NOT NULL,
    thumbnail_url text,
    category text NOT NULL,
    condition_codes jsonb,
    language text DEFAULT 'en'::text,
    duration_seconds integer,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bedside_education_videos bedside_education_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_videos
    ADD CONSTRAINT bedside_education_videos_pkey PRIMARY KEY (id);

CREATE INDEX idx_bedside_education_videos_deleted_at_026666e5 ON public.bedside_education_videos USING btree (deleted_at);

CREATE INDEX idx_bedside_vid_category ON public.bedside_education_videos USING btree (tenant_id, category);

CREATE INDEX idx_bedside_vid_tenant ON public.bedside_education_videos USING btree (tenant_id);

ALTER TABLE public.bedside_education_videos ENABLE ROW LEVEL SECURITY;

-- Name: bedside_education_videos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_education_videos USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bedside_education_videos trg_bedside_education_videos_soft_delete_026666e5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_education_videos_soft_delete_026666e5 BEFORE DELETE ON public.bedside_education_videos FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bedside_education_videos trg_bedside_vid_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_vid_updated_at BEFORE UPDATE ON public.bedside_education_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bedside_education_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    video_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    watched_seconds integer DEFAULT 0,
    completed boolean DEFAULT false NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bedside_education_views bedside_education_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_pkey PRIMARY KEY (id);

CREATE INDEX idx_bedside_education_views_deleted_at_4c559d68 ON public.bedside_education_views USING btree (deleted_at);

CREATE INDEX idx_bedside_education_views_patient_id ON public.bedside_education_views USING btree (patient_id);

CREATE INDEX idx_bedside_views_patient ON public.bedside_education_views USING btree (tenant_id, patient_id);

CREATE INDEX idx_bedside_views_tenant ON public.bedside_education_views USING btree (tenant_id);

ALTER TABLE public.bedside_education_views ENABLE ROW LEVEL SECURITY;

-- Name: bedside_education_views tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_education_views USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bedside_education_views trg_bedside_education_views_soft_delete_4c559d68; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_education_views_soft_delete_4c559d68 BEFORE DELETE ON public.bedside_education_views FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bedside_nurse_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    request_type public.bedside_request_type NOT NULL,
    status public.bedside_request_status DEFAULT 'pending'::public.bedside_request_status NOT NULL,
    notes text,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    completed_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bedside_nurse_requests bedside_nurse_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_bedside_nurse_requests_deleted_at_614ba01e ON public.bedside_nurse_requests USING btree (deleted_at);

CREATE INDEX idx_bedside_nurse_requests_patient_id ON public.bedside_nurse_requests USING btree (patient_id);

CREATE INDEX idx_bedside_req_admission ON public.bedside_nurse_requests USING btree (tenant_id, admission_id);

CREATE INDEX idx_bedside_req_pending ON public.bedside_nurse_requests USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['pending'::public.bedside_request_status, 'acknowledged'::public.bedside_request_status]));

CREATE INDEX idx_bedside_req_status ON public.bedside_nurse_requests USING btree (tenant_id, status);

CREATE INDEX idx_bedside_req_tenant ON public.bedside_nurse_requests USING btree (tenant_id);

ALTER TABLE public.bedside_nurse_requests ENABLE ROW LEVEL SECURITY;

-- Name: bedside_nurse_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_nurse_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bedside_nurse_requests trg_bedside_nurse_requests_soft_delete_614ba01e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_nurse_requests_soft_delete_614ba01e BEFORE DELETE ON public.bedside_nurse_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bedside_nurse_requests trg_bedside_req_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_req_updated_at BEFORE UPDATE ON public.bedside_nurse_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bedside_realtime_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    pain_level integer,
    comfort_level integer,
    cleanliness_level integer,
    noise_level integer,
    staff_response integer,
    comments text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT bedside_realtime_feedback_cleanliness_level_check CHECK (((cleanliness_level >= 1) AND (cleanliness_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_comfort_level_check CHECK (((comfort_level >= 1) AND (comfort_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_noise_level_check CHECK (((noise_level >= 1) AND (noise_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_pain_level_check CHECK (((pain_level >= 0) AND (pain_level <= 10))),
    CONSTRAINT bedside_realtime_feedback_staff_response_check CHECK (((staff_response >= 1) AND (staff_response <= 5)))
);

-- Name: bedside_realtime_feedback bedside_realtime_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_realtime_feedback
    ADD CONSTRAINT bedside_realtime_feedback_pkey PRIMARY KEY (id);

CREATE INDEX idx_bedside_fb_admission ON public.bedside_realtime_feedback USING btree (tenant_id, admission_id);

CREATE INDEX idx_bedside_fb_tenant ON public.bedside_realtime_feedback USING btree (tenant_id);

CREATE INDEX idx_bedside_fb_time ON public.bedside_realtime_feedback USING btree (tenant_id, submitted_at DESC);

CREATE INDEX idx_bedside_realtime_feedback_deleted_at_252711af ON public.bedside_realtime_feedback USING btree (deleted_at);

CREATE INDEX idx_bedside_realtime_feedback_patient_id ON public.bedside_realtime_feedback USING btree (patient_id);

ALTER TABLE public.bedside_realtime_feedback ENABLE ROW LEVEL SECURITY;

-- Name: bedside_realtime_feedback tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_realtime_feedback USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bedside_realtime_feedback trg_bedside_realtime_feedback_soft_delete_252711af; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_realtime_feedback_soft_delete_252711af BEFORE DELETE ON public.bedside_realtime_feedback FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bedside_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    bed_location text,
    device_id text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bedside_sessions bedside_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_sessions
    ADD CONSTRAINT bedside_sessions_pkey PRIMARY KEY (id);

CREATE INDEX idx_bedside_sess_active ON public.bedside_sessions USING btree (tenant_id, is_active) WHERE (is_active = true);

CREATE INDEX idx_bedside_sess_admission ON public.bedside_sessions USING btree (tenant_id, admission_id);

CREATE INDEX idx_bedside_sess_tenant ON public.bedside_sessions USING btree (tenant_id);

CREATE INDEX idx_bedside_sessions_deleted_at_27737549 ON public.bedside_sessions USING btree (deleted_at);

CREATE INDEX idx_bedside_sessions_patient_id ON public.bedside_sessions USING btree (patient_id);

ALTER TABLE public.bedside_sessions ENABLE ROW LEVEL SECURITY;

-- Name: bedside_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_sessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: bedside_sessions trg_bedside_sessions_soft_delete_27737549; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_sessions_soft_delete_27737549 BEFORE DELETE ON public.bedside_sessions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nurse_profiles nurse_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_pkey PRIMARY KEY (id);

-- Name: nurse_profiles nurse_profiles_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_profiles
    ADD CONSTRAINT nurse_profiles_tenant_id_user_id_key UNIQUE (tenant_id, user_id);

CREATE INDEX idx_nurse_profiles_deleted_at_d4eaccf3 ON public.nurse_profiles USING btree (deleted_at);

ALTER TABLE ONLY public.nurse_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.nurse_profiles ENABLE ROW LEVEL SECURITY;

-- Name: nurse_profiles tenant_isolation_nurse_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nurse_profiles ON public.nurse_profiles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nurse_profiles nurse_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER nurse_profiles_updated BEFORE UPDATE ON public.nurse_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: nurse_profiles trg_nurse_profiles_soft_delete_d4eaccf3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nurse_profiles_soft_delete_d4eaccf3 BEFORE DELETE ON public.nurse_profiles FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT nurse_shift_assignments_shift_type_check CHECK ((shift_type = ANY (ARRAY['day'::text, 'evening'::text, 'night'::text])))
);

-- Name: nurse_shift_assignments nurse_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse_shift_assignments
    ADD CONSTRAINT nurse_shift_assignments_pkey PRIMARY KEY (id);

CREATE INDEX idx_nurse_shift_assignments_deleted_at_54bc4c0d ON public.nurse_shift_assignments USING btree (deleted_at);

CREATE INDEX nurse_shift_assignments_today_idx ON public.nurse_shift_assignments USING btree (tenant_id, nurse_user_id, shift_date DESC);

ALTER TABLE ONLY public.nurse_shift_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.nurse_shift_assignments ENABLE ROW LEVEL SECURITY;

-- Name: nurse_shift_assignments tenant_isolation_nurse_shift_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nurse_shift_assignments ON public.nurse_shift_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nurse_shift_assignments trg_nurse_shift_assignments_soft_delete_54bc4c0d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nurse_shift_assignments_soft_delete_54bc4c0d BEFORE DELETE ON public.nurse_shift_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    category public.nursing_task_category,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nursing_tasks nursing_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_tasks
    ADD CONSTRAINT nursing_tasks_pkey PRIMARY KEY (id);

CREATE INDEX idx_nursing_tasks_admission ON public.nursing_tasks USING btree (admission_id);

CREATE INDEX idx_nursing_tasks_assigned ON public.nursing_tasks USING btree (assigned_to);

CREATE INDEX idx_nursing_tasks_assigned_due ON public.nursing_tasks USING btree (tenant_id, assigned_to, due_at) WHERE (is_completed = false);

CREATE INDEX idx_nursing_tasks_deleted_at_abfcf589 ON public.nursing_tasks USING btree (deleted_at);

CREATE INDEX idx_nursing_tasks_due_incomplete ON public.nursing_tasks USING btree (tenant_id, admission_id, due_at) WHERE (is_completed = false);

CREATE INDEX idx_nursing_tasks_tenant ON public.nursing_tasks USING btree (tenant_id);

ALTER TABLE public.nursing_tasks ENABLE ROW LEVEL SECURITY;

-- Name: nursing_tasks tenant_isolation_nursing_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nursing_tasks ON public.nursing_tasks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nursing_tasks audit_nursing_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_nursing_tasks AFTER INSERT OR DELETE OR UPDATE ON public.nursing_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('ipd');

-- Name: nursing_tasks trg_nursing_tasks_soft_delete_abfcf589; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nursing_tasks_soft_delete_abfcf589 BEFORE DELETE ON public.nursing_tasks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: nursing_tasks trg_nursing_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nursing_tasks_updated_at BEFORE UPDATE ON public.nursing_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0257_readmission_risk.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Readmission risk scoring (ticket #2965): a LACE-style index for a patient — Length of stay,
-- Acuity of admission, Comorbidity burden, Emergency-department visits — summed to a total score
-- and banded into low / moderate / high readmission risk. Tenant RLS.

CREATE TABLE public.readmission_risk_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    length_of_stay integer DEFAULT 0 NOT NULL,
    acuity_score integer DEFAULT 0 NOT NULL,
    comorbidity_score integer DEFAULT 0 NOT NULL,
    ed_visits integer DEFAULT 0 NOT NULL,
    total_score integer DEFAULT 0 NOT NULL,
    risk_level text DEFAULT 'low'::text NOT NULL,
    notes text,
    assessed_by uuid,
    assessed_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT readmission_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text])))
);

-- Name: readmission_risk_assessments readmission_risk_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.readmission_risk_assessments
    ADD CONSTRAINT readmission_risk_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_readmission_risk_high ON public.readmission_risk_assessments USING btree (tenant_id, risk_level) WHERE (risk_level = 'high'::text);

CREATE INDEX idx_readmission_risk_patient ON public.readmission_risk_assessments USING btree (tenant_id, patient_id, assessed_at DESC);

ALTER TABLE public.readmission_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Name: readmission_risk_assessments readmission_risk_assessments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY readmission_risk_assessments_tenant_isolation ON public.readmission_risk_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: readmission_risk_assessments readmission_risk_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER readmission_risk_assessments_updated_at BEFORE UPDATE ON public.readmission_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT shift_handoffs_check CHECK ((outgoing_nurse_id <> incoming_nurse_id))
);

-- Name: shift_handoffs shift_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_handoffs
    ADD CONSTRAINT shift_handoffs_pkey PRIMARY KEY (id);

CREATE INDEX idx_shift_handoffs_deleted_at_77c1d336 ON public.shift_handoffs USING btree (deleted_at);

CREATE INDEX shift_handoffs_encounter_idx ON public.shift_handoffs USING btree (tenant_id, encounter_id, created_at DESC);

ALTER TABLE ONLY public.shift_handoffs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.shift_handoffs ENABLE ROW LEVEL SECURITY;

-- Name: shift_handoffs tenant_isolation_shift_handoffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_shift_handoffs ON public.shift_handoffs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: shift_handoffs trg_shift_handoffs_soft_delete_77c1d336; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_handoffs_soft_delete_77c1d336 BEFORE DELETE ON public.shift_handoffs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0177_station_handoffs.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Generic location/station handoff (open-pickup model). Distinct from the
-- user-based handoffs (shift_handoffs, ot_*_handoffs) which name an incoming
-- person: a station handoff is keyed to a LOCATION (OT room, ward, bed,
-- pharmacy/billing counter, …) and sits OPEN until whoever staffs that
-- location next acknowledges it. One reusable primitive used everywhere.

CREATE TABLE public.station_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    module text NOT NULL,
    station_type text NOT NULL,
    station_key text NOT NULL,
    station_label text,
    title text NOT NULL,
    summary text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    handed_off_by uuid NOT NULL,
    handed_off_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT station_handoffs_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text])))
);

-- Name: station_handoffs station_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.station_handoffs
    ADD CONSTRAINT station_handoffs_pkey PRIMARY KEY (id);

CREATE INDEX idx_station_handoffs_lookup ON public.station_handoffs USING btree (tenant_id, module, station_type, station_key, status);

ALTER TABLE public.station_handoffs ENABLE ROW LEVEL SECURITY;

-- Name: station_handoffs tenant_isolation_station_handoffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_station_handoffs ON public.station_handoffs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Migration: 0267_stations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Stations master: a first-class place a device/app instance sits — a nurse station, an OPD
-- counter, a ward console, a kiosk point, a reception desk. Department-scoped. Devices bind to a
-- station (paired_devices.station_id) so the boot manifest resolves the concrete station, not just
-- a free-text label. Complements the location axis added in 0266 (a station carries its department).

CREATE TABLE public.stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    station_type text DEFAULT 'other'::text NOT NULL,
    location_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT stations_type_check CHECK ((station_type = ANY (ARRAY['nurse_station'::text, 'opd_counter'::text, 'ward_console'::text, 'kiosk_point'::text, 'billing_counter'::text, 'pharmacy_counter'::text, 'lab_counter'::text, 'reception'::text, 'display'::text, 'other'::text])))
);

-- Name: stations stations_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_code_unique UNIQUE (tenant_id, code);

-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (id);

CREATE INDEX idx_stations_department ON public.stations USING btree (tenant_id, department_id) WHERE (deleted_at IS NULL);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

-- Name: stations stations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stations_tenant_isolation ON public.stations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: stations stations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stations_updated_at BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0270_vte_risk_assessment.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- VTE (venous thromboembolism) risk assessment — a leading cause of PREVENTABLE inpatient death and
-- a core NABH/JCI safety measure. Uses the Padua Prediction Score for medical inpatients: score >= 4
-- is high risk and warrants pharmacological thromboprophylaxis unless a bleeding risk contraindicates
-- it. The score is computed server-side from the documented risk factors.

CREATE TABLE public.vte_risk_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    active_cancer boolean DEFAULT false NOT NULL,
    previous_vte boolean DEFAULT false NOT NULL,
    reduced_mobility boolean DEFAULT false NOT NULL,
    thrombophilia boolean DEFAULT false NOT NULL,
    recent_trauma_surgery boolean DEFAULT false NOT NULL,
    age_over_70 boolean DEFAULT false NOT NULL,
    cardiac_resp_failure boolean DEFAULT false NOT NULL,
    acute_mi_stroke boolean DEFAULT false NOT NULL,
    acute_infection_rheum boolean DEFAULT false NOT NULL,
    obesity boolean DEFAULT false NOT NULL,
    hormonal_treatment boolean DEFAULT false NOT NULL,
    score integer NOT NULL,
    high_risk boolean NOT NULL,
    prophylaxis_recommended boolean NOT NULL,
    has_bleeding_risk boolean DEFAULT false NOT NULL,
    prophylaxis_type text,
    notes text,
    assessed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vte_prophylaxis_type_check CHECK (((prophylaxis_type IS NULL) OR (prophylaxis_type = ANY (ARRAY['pharmacological'::text, 'mechanical'::text, 'none'::text]))))
);

-- Name: vte_risk_assessments vte_risk_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vte_risk_assessments
    ADD CONSTRAINT vte_risk_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_vte_patient ON public.vte_risk_assessments USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.vte_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Name: vte_risk_assessments vte_risk_assessments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vte_risk_assessments_tenant_isolation ON public.vte_risk_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: bedside_education_views bedside_education_views_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.bedside_education_videos(id);
