-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 28
-- Drops: none
-- hr — schema.
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



CREATE TABLE public.aebas_department_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    department_name text NOT NULL,
    total_employees integer DEFAULT 0 NOT NULL,
    average_present integer DEFAULT 0 NOT NULL,
    average_absent integer DEFAULT 0 NOT NULL,
    average_leave integer DEFAULT 0 NOT NULL,
    attendance_percentage numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: aebas_department_attendance aebas_department_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_department_attendance
    ADD CONSTRAINT aebas_department_attendance_pkey PRIMARY KEY (id);

CREATE INDEX idx_aebas_department_attendance_deleted_at_ffd09092 ON public.aebas_department_attendance USING btree (deleted_at);

CREATE INDEX idx_aebas_department_attendance_tenant_id ON public.aebas_department_attendance USING btree (tenant_id);

ALTER TABLE ONLY public.aebas_department_attendance FORCE ROW LEVEL SECURITY;

ALTER TABLE public.aebas_department_attendance ENABLE ROW LEVEL SECURITY;

-- Name: aebas_department_attendance tenant_isolation_aebas_department_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_aebas_department_attendance ON public.aebas_department_attendance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: aebas_department_attendance trg_aebas_department_attendance_soft_delete_ffd09092; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_aebas_department_attendance_soft_delete_ffd09092 BEFORE DELETE ON public.aebas_department_attendance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.aebas_period_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_employees integer DEFAULT 0 NOT NULL,
    average_attendance_percentage numeric(5,2),
    total_working_days integer DEFAULT 0 NOT NULL,
    holidays integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: aebas_period_summary aebas_period_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_period_summary
    ADD CONSTRAINT aebas_period_summary_pkey PRIMARY KEY (id);

-- Name: aebas_period_summary aebas_period_summary_tenant_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_period_summary
    ADD CONSTRAINT aebas_period_summary_tenant_id_period_key UNIQUE (tenant_id, period);

CREATE INDEX idx_aebas_period_summary_deleted_at_081982f4 ON public.aebas_period_summary USING btree (deleted_at);

ALTER TABLE ONLY public.aebas_period_summary FORCE ROW LEVEL SECURITY;

ALTER TABLE public.aebas_period_summary ENABLE ROW LEVEL SECURITY;

-- Name: aebas_period_summary tenant_isolation_aebas_period_summary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_aebas_period_summary ON public.aebas_period_summary USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: aebas_period_summary trg_aebas_period_summary_soft_delete_081982f4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_aebas_period_summary_soft_delete_081982f4 BEFORE DELETE ON public.aebas_period_summary FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.appraisals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    appraisal_year integer NOT NULL,
    appraiser_id uuid,
    rating numeric(3,1),
    strengths text,
    improvements text,
    goals jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: appraisals appraisals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_pkey PRIMARY KEY (id);

-- Name: appraisals appraisals_tenant_id_employee_id_appraisal_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_tenant_id_employee_id_appraisal_year_key UNIQUE (tenant_id, employee_id, appraisal_year);

CREATE INDEX idx_appraisals_deleted_at_82b0aba4 ON public.appraisals USING btree (deleted_at);

CREATE INDEX idx_appraisals_employee ON public.appraisals USING btree (tenant_id, employee_id);

CREATE INDEX idx_appraisals_tenant ON public.appraisals USING btree (tenant_id);

ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

-- Name: appraisals appraisals_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appraisals_tenant ON public.appraisals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: appraisals trg_appraisals_soft_delete_82b0aba4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appraisals_soft_delete_82b0aba4 BEFORE DELETE ON public.appraisals FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: appraisals trg_appraisals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appraisals_updated_at BEFORE UPDATE ON public.appraisals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    attendance_date date NOT NULL,
    shift_id uuid,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    is_late boolean DEFAULT false NOT NULL,
    late_minutes integer DEFAULT 0 NOT NULL,
    is_early_out boolean DEFAULT false NOT NULL,
    early_minutes integer DEFAULT 0 NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    notes text,
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    planned_end timestamp with time zone,
    extended_until timestamp with time zone,
    extension_reason text,
    paused_at timestamp with time zone,
    paused_minutes integer DEFAULT 0 NOT NULL,
    session_status text DEFAULT 'off'::text NOT NULL,
    fatigue_ack_at timestamp with time zone,
    fatigue_ack_reason text,
    fatigue_flags text[],
    CONSTRAINT attendance_records_session_status_check CHECK ((session_status = ANY (ARRAY['off'::text, 'on_duty'::text, 'paused'::text, 'ended'::text])))
);

-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

-- Name: attendance_records attendance_records_tenant_id_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_tenant_id_employee_id_attendance_date_key UNIQUE (tenant_id, employee_id, attendance_date);

CREATE UNIQUE INDEX idx_attendance_open_session ON public.attendance_records USING btree (tenant_id, employee_id) WHERE (session_status = ANY (ARRAY['on_duty'::text, 'paused'::text]));

CREATE INDEX idx_attendance_records_date ON public.attendance_records USING btree (tenant_id, attendance_date);

CREATE INDEX idx_attendance_records_deleted_at_d6d0b23e ON public.attendance_records USING btree (deleted_at);

CREATE INDEX idx_attendance_records_employee ON public.attendance_records USING btree (tenant_id, employee_id, attendance_date);

CREATE INDEX idx_attendance_records_tenant ON public.attendance_records USING btree (tenant_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Name: attendance_records attendance_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_records_tenant ON public.attendance_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: attendance_records trg_attendance_records_soft_delete_d6d0b23e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attendance_records_soft_delete_d6d0b23e BEFORE DELETE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: attendance_records trg_attendance_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attendance_records_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.designations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    category text DEFAULT 'clinical'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);

-- Name: designations designations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_designations_deleted_at_35cfe196 ON public.designations USING btree (deleted_at);

CREATE INDEX idx_designations_tenant ON public.designations USING btree (tenant_id);

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

-- Name: designations designations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designations_tenant ON public.designations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: designations trg_designations_soft_delete_35cfe196; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_designations_soft_delete_35cfe196 BEFORE DELETE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: designations trg_designations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.duty_rosters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    department_id uuid,
    shift_id uuid NOT NULL,
    roster_date date NOT NULL,
    is_on_call boolean DEFAULT false NOT NULL,
    swap_with uuid,
    swap_approved boolean DEFAULT false NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: duty_rosters duty_rosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_pkey PRIMARY KEY (id);

-- Name: duty_rosters duty_rosters_tenant_id_employee_id_roster_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_tenant_id_employee_id_roster_date_key UNIQUE (tenant_id, employee_id, roster_date);

CREATE INDEX idx_duty_rosters_date ON public.duty_rosters USING btree (tenant_id, roster_date);

CREATE INDEX idx_duty_rosters_deleted_at_c4bf1008 ON public.duty_rosters USING btree (deleted_at);

CREATE INDEX idx_duty_rosters_department_id ON public.duty_rosters USING btree (department_id);

CREATE INDEX idx_duty_rosters_employee ON public.duty_rosters USING btree (tenant_id, employee_id, roster_date);

CREATE INDEX idx_duty_rosters_tenant ON public.duty_rosters USING btree (tenant_id);

ALTER TABLE public.duty_rosters ENABLE ROW LEVEL SECURITY;

-- Name: duty_rosters duty_rosters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_rosters_tenant ON public.duty_rosters USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: duty_rosters trg_duty_rosters_soft_delete_c4bf1008; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_duty_rosters_soft_delete_c4bf1008 BEFORE DELETE ON public.duty_rosters FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: duty_rosters trg_duty_rosters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_duty_rosters_updated_at BEFORE UPDATE ON public.duty_rosters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.employee_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    credential_type public.credential_type NOT NULL,
    issuing_body text NOT NULL,
    registration_no text NOT NULL,
    state_code text,
    issued_date date,
    expiry_date date,
    status public.credential_status DEFAULT 'active'::public.credential_status NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    document_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credential_number text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: employee_credentials employee_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_pkey PRIMARY KEY (id);

CREATE INDEX idx_employee_credentials_deleted_at_4b92b305 ON public.employee_credentials USING btree (deleted_at);

CREATE INDEX idx_employee_credentials_employee ON public.employee_credentials USING btree (tenant_id, employee_id);

CREATE INDEX idx_employee_credentials_expiry ON public.employee_credentials USING btree (tenant_id, expiry_date) WHERE (status = 'active'::public.credential_status);

CREATE INDEX idx_employee_credentials_tenant ON public.employee_credentials USING btree (tenant_id);

ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;

-- Name: employee_credentials employee_credentials_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_credentials_tenant ON public.employee_credentials USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: employee_credentials trg_employee_credentials_soft_delete_4b92b305; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_credentials_soft_delete_4b92b305 BEFORE DELETE ON public.employee_credentials FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: employee_credentials trg_employee_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_credentials_updated_at BEFORE UPDATE ON public.employee_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    employee_code text NOT NULL,
    first_name text NOT NULL,
    last_name text,
    date_of_birth date,
    gender text,
    phone text,
    email text,
    employment_type public.employment_type DEFAULT 'permanent'::public.employment_type NOT NULL,
    status public.employee_status DEFAULT 'active'::public.employee_status NOT NULL,
    department_id uuid,
    designation_id uuid,
    reporting_to uuid,
    date_of_joining date DEFAULT CURRENT_DATE NOT NULL,
    date_of_leaving date,
    qualifications jsonb DEFAULT '[]'::jsonb NOT NULL,
    blood_group text,
    address jsonb DEFAULT '{}'::jsonb NOT NULL,
    emergency_contact jsonb DEFAULT '{}'::jsonb NOT NULL,
    bank_name text,
    bank_account text,
    bank_ifsc text,
    pf_number text,
    esi_number text,
    uan_number text,
    pan_number text,
    aadhaar_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);

-- Name: employees employees_tenant_id_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_tenant_id_employee_code_key UNIQUE (tenant_id, employee_code);

CREATE INDEX idx_employees_deleted_at_582ca3f7 ON public.employees USING btree (deleted_at);

CREATE INDEX idx_employees_department ON public.employees USING btree (tenant_id, department_id);

CREATE INDEX idx_employees_department_id ON public.employees USING btree (department_id);

CREATE INDEX idx_employees_status ON public.employees USING btree (tenant_id, status);

CREATE INDEX idx_employees_tenant ON public.employees USING btree (tenant_id);

CREATE INDEX idx_employees_user ON public.employees USING btree (tenant_id, user_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Name: employees employees_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_tenant ON public.employees USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: employees trg_employees_soft_delete_582ca3f7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employees_soft_delete_582ca3f7 BEFORE DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: employees trg_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.leave_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days numeric(4,1),
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    leave_type_id uuid,
    application_number text,
    leave_from date,
    leave_to date,
    remarks text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: leave_applications leave_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_pkey PRIMARY KEY (id);

CREATE INDEX idx_leave_applications_deleted_at_e3dd9ab3 ON public.leave_applications USING btree (deleted_at);

CREATE INDEX idx_leave_emp ON public.leave_applications USING btree (tenant_id, employee_id, start_date DESC);

ALTER TABLE ONLY public.leave_applications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- Name: leave_applications tenant_isolation_leave_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_leave_applications ON public.leave_applications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: leave_applications trg_leave_applications_soft_delete_e3dd9ab3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_applications_soft_delete_e3dd9ab3 BEFORE DELETE ON public.leave_applications FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type public.leave_type NOT NULL,
    year integer NOT NULL,
    opening numeric(5,1) DEFAULT 0 NOT NULL,
    earned numeric(5,1) DEFAULT 0 NOT NULL,
    used numeric(5,1) DEFAULT 0 NOT NULL,
    balance numeric(5,1) DEFAULT 0 NOT NULL,
    carry_forward numeric(5,1) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);

-- Name: leave_balances leave_balances_tenant_id_employee_id_leave_type_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_tenant_id_employee_id_leave_type_year_key UNIQUE (tenant_id, employee_id, leave_type, year);

CREATE INDEX idx_leave_balances_deleted_at_6a1c433b ON public.leave_balances USING btree (deleted_at);

CREATE INDEX idx_leave_balances_employee ON public.leave_balances USING btree (tenant_id, employee_id, year);

CREATE INDEX idx_leave_balances_tenant ON public.leave_balances USING btree (tenant_id);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Name: leave_balances leave_balances_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_balances_tenant ON public.leave_balances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: leave_balances trg_leave_balances_soft_delete_6a1c433b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_balances_soft_delete_6a1c433b BEFORE DELETE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: leave_balances trg_leave_balances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    leave_type public.leave_type NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days numeric(4,1) DEFAULT 1 NOT NULL,
    is_half_day boolean DEFAULT false NOT NULL,
    reason text,
    status public.leave_status DEFAULT 'draft'::public.leave_status NOT NULL,
    hod_id uuid,
    hod_action_at timestamp with time zone,
    hod_remarks text,
    admin_id uuid,
    admin_action_at timestamp with time zone,
    admin_remarks text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_leave_requests_deleted_at_715fc77c ON public.leave_requests USING btree (deleted_at);

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (tenant_id, employee_id);

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (tenant_id, status);

CREATE INDEX idx_leave_requests_tenant ON public.leave_requests USING btree (tenant_id);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Name: leave_requests leave_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_requests_tenant ON public.leave_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: leave_requests trg_leave_requests_soft_delete_715fc77c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_requests_soft_delete_715fc77c BEFORE DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: leave_requests trg_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lms_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    path_id uuid,
    enrollment_id uuid,
    certificate_no text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at date,
    issued_by uuid,
    training_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_certificates lms_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_pkey PRIMARY KEY (id);

-- Name: lms_certificates lms_certificates_tenant_id_certificate_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_tenant_id_certificate_no_key UNIQUE (tenant_id, certificate_no);

CREATE INDEX idx_lms_certificates_deleted_at_b88c57a4 ON public.lms_certificates USING btree (deleted_at);

CREATE INDEX idx_lms_certificates_expiry ON public.lms_certificates USING btree (tenant_id, expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX idx_lms_certificates_user ON public.lms_certificates USING btree (tenant_id, user_id);

ALTER TABLE public.lms_certificates ENABLE ROW LEVEL SECURITY;

-- Name: lms_certificates lms_certificates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_certificates_tenant ON public.lms_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lms_certificates trg_lms_certificates_soft_delete_b88c57a4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_certificates_soft_delete_b88c57a4 BEFORE DELETE ON public.lms_certificates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lms_course_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_course_modules lms_course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_course_modules
    ADD CONSTRAINT lms_course_modules_pkey PRIMARY KEY (id);

CREATE INDEX idx_lms_course_modules_deleted_at_078d28c8 ON public.lms_course_modules USING btree (deleted_at);

CREATE INDEX idx_lms_modules_course ON public.lms_course_modules USING btree (course_id, sort_order);

-- Name: lms_course_modules trg_lms_course_modules_soft_delete_078d28c8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_course_modules_soft_delete_078d28c8 BEFORE DELETE ON public.lms_course_modules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lms_course_modules trg_lms_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_modules_updated_at BEFORE UPDATE ON public.lms_course_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lms_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    duration_hours numeric(5,1),
    is_mandatory boolean DEFAULT false NOT NULL,
    target_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    thumbnail_url text,
    content_type public.lms_content_type DEFAULT 'text'::public.lms_content_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    training_program_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_courses lms_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_pkey PRIMARY KEY (id);

-- Name: lms_courses lms_courses_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lms_courses_active ON public.lms_courses USING btree (tenant_id, is_active) WHERE (is_active = true);

CREATE INDEX idx_lms_courses_category ON public.lms_courses USING btree (tenant_id, category);

CREATE INDEX idx_lms_courses_deleted_at_9fac0244 ON public.lms_courses USING btree (deleted_at);

CREATE INDEX idx_lms_courses_tenant ON public.lms_courses USING btree (tenant_id);

ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;

-- Name: lms_courses lms_courses_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_courses_tenant ON public.lms_courses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lms_courses trg_lms_courses_soft_delete_9fac0244; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_courses_soft_delete_9fac0244 BEFORE DELETE ON public.lms_courses FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lms_courses trg_lms_courses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_courses_updated_at BEFORE UPDATE ON public.lms_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lms_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    status public.lms_enrollment_status DEFAULT 'assigned'::public.lms_enrollment_status NOT NULL,
    progress_percentage integer DEFAULT 0 NOT NULL,
    last_module_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_enrollments lms_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_pkey PRIMARY KEY (id);

-- Name: lms_enrollments lms_enrollments_tenant_id_user_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_tenant_id_user_id_course_id_key UNIQUE (tenant_id, user_id, course_id);

CREATE INDEX idx_lms_enrollments_course ON public.lms_enrollments USING btree (tenant_id, course_id);

CREATE INDEX idx_lms_enrollments_deleted_at_62f73263 ON public.lms_enrollments USING btree (deleted_at);

CREATE INDEX idx_lms_enrollments_status ON public.lms_enrollments USING btree (tenant_id, status);

CREATE INDEX idx_lms_enrollments_user ON public.lms_enrollments USING btree (tenant_id, user_id);

ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;

-- Name: lms_enrollments lms_enrollments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_enrollments_tenant ON public.lms_enrollments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lms_enrollments trg_lms_enrollments_soft_delete_62f73263; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_enrollments_soft_delete_62f73263 BEFORE DELETE ON public.lms_enrollments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lms_enrollments trg_lms_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_enrollments_updated_at BEFORE UPDATE ON public.lms_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lms_learning_path_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path_id uuid NOT NULL,
    course_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_learning_path_courses lms_learning_path_courses_path_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_path_id_course_id_key UNIQUE (path_id, course_id);

-- Name: lms_learning_path_courses lms_learning_path_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_pkey PRIMARY KEY (id);

CREATE INDEX idx_lms_learning_path_courses_deleted_at_8ed2b496 ON public.lms_learning_path_courses USING btree (deleted_at);

CREATE INDEX idx_lms_path_courses ON public.lms_learning_path_courses USING btree (path_id, sort_order);

-- Name: lms_learning_path_courses trg_lms_learning_path_courses_soft_delete_8ed2b496; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_learning_path_courses_soft_delete_8ed2b496 BEFORE DELETE ON public.lms_learning_path_courses FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lms_learning_paths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    target_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_learning_paths lms_learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_pkey PRIMARY KEY (id);

-- Name: lms_learning_paths lms_learning_paths_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_lms_learning_paths_deleted_at_87db6fba ON public.lms_learning_paths USING btree (deleted_at);

CREATE INDEX idx_lms_paths_tenant ON public.lms_learning_paths USING btree (tenant_id);

ALTER TABLE public.lms_learning_paths ENABLE ROW LEVEL SECURITY;

-- Name: lms_learning_paths lms_paths_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_paths_tenant ON public.lms_learning_paths USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: lms_learning_paths trg_lms_learning_paths_soft_delete_87db6fba; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_learning_paths_soft_delete_87db6fba BEFORE DELETE ON public.lms_learning_paths FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lms_learning_paths trg_lms_paths_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_paths_updated_at BEFORE UPDATE ON public.lms_learning_paths FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.lms_quiz_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    score integer,
    max_score integer,
    passed boolean,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_quiz_attempts lms_quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_pkey PRIMARY KEY (id);

CREATE INDEX idx_lms_attempts_enrollment ON public.lms_quiz_attempts USING btree (enrollment_id);

CREATE INDEX idx_lms_attempts_quiz ON public.lms_quiz_attempts USING btree (quiz_id);

CREATE INDEX idx_lms_quiz_attempts_deleted_at_5961f475 ON public.lms_quiz_attempts USING btree (deleted_at);

-- Name: lms_quiz_attempts trg_lms_quiz_attempts_soft_delete_5961f475; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_quiz_attempts_soft_delete_5961f475 BEFORE DELETE ON public.lms_quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lms_quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type public.lms_question_type DEFAULT 'single_choice'::public.lms_question_type NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    correct_answer jsonb DEFAULT '""'::jsonb NOT NULL,
    explanation text,
    points integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_quiz_questions lms_quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_questions
    ADD CONSTRAINT lms_quiz_questions_pkey PRIMARY KEY (id);

CREATE INDEX idx_lms_questions_quiz ON public.lms_quiz_questions USING btree (quiz_id, sort_order);

CREATE INDEX idx_lms_quiz_questions_deleted_at_03d0a855 ON public.lms_quiz_questions USING btree (deleted_at);

-- Name: lms_quiz_questions trg_lms_quiz_questions_soft_delete_03d0a855; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_quiz_questions_soft_delete_03d0a855 BEFORE DELETE ON public.lms_quiz_questions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.lms_quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    pass_percentage integer DEFAULT 70 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    time_limit_minutes integer,
    shuffle_questions boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: lms_quizzes lms_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quizzes
    ADD CONSTRAINT lms_quizzes_pkey PRIMARY KEY (id);

CREATE INDEX idx_lms_quizzes_course ON public.lms_quizzes USING btree (course_id);

CREATE INDEX idx_lms_quizzes_deleted_at_b687c704 ON public.lms_quizzes USING btree (deleted_at);

-- Name: lms_quizzes trg_lms_quizzes_soft_delete_b687c704; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_quizzes_soft_delete_b687c704 BEFORE DELETE ON public.lms_quizzes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: lms_quizzes trg_lms_quizzes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_quizzes_updated_at BEFORE UPDATE ON public.lms_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0282_occ_health_exposures.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Occupational blood & body-fluid / sharps exposure reporting (NABH HR, BMW Rules 2016, national
-- needlestick-injury guidelines). A needlestick or mucocutaneous exposure to a source patient's blood
-- is a time-critical staff-safety event: HIV post-exposure prophylaxis (PEP) is most effective within
-- 2 hours and must start within 72, so the source serostatus and the PEP decision have to be captured
-- immediately. The generic injury report can't hold this, and the needlestick-rate KPI had no backing
-- capture — this table records each exposure, its source risk, and the PEP decision.

CREATE TABLE public.occ_health_exposures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    exposure_at timestamp with time zone NOT NULL,
    exposure_type text NOT NULL,
    device text,
    body_site text,
    source_patient_id uuid,
    source_known boolean DEFAULT false NOT NULL,
    source_hiv text DEFAULT 'unknown'::text NOT NULL,
    source_hbv text DEFAULT 'unknown'::text NOT NULL,
    source_hcv text DEFAULT 'unknown'::text NOT NULL,
    first_aid_done boolean DEFAULT false NOT NULL,
    pep_recommended boolean DEFAULT false NOT NULL,
    pep_started boolean DEFAULT false NOT NULL,
    pep_details text,
    notes text,
    reported_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT occ_exposure_hbv_check CHECK ((source_hbv = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text]))),
    CONSTRAINT occ_exposure_hcv_check CHECK ((source_hcv = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text]))),
    CONSTRAINT occ_exposure_hiv_check CHECK ((source_hiv = ANY (ARRAY['positive'::text, 'negative'::text, 'unknown'::text]))),
    CONSTRAINT occ_exposure_type_check CHECK ((exposure_type = ANY (ARRAY['needlestick'::text, 'sharps_cut'::text, 'mucocutaneous'::text, 'other'::text])))
);

-- Name: occ_health_exposures occ_health_exposures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.occ_health_exposures
    ADD CONSTRAINT occ_health_exposures_pkey PRIMARY KEY (id);

CREATE INDEX idx_occ_health_exposures_tenant ON public.occ_health_exposures USING btree (tenant_id, exposure_at DESC);

ALTER TABLE public.occ_health_exposures ENABLE ROW LEVEL SECURITY;

-- Name: occ_health_exposures occ_health_exposures_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occ_health_exposures_tenant_isolation ON public.occ_health_exposures USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

CREATE TABLE public.on_call_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    department_id uuid,
    schedule_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    contact_number text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: on_call_schedules on_call_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_on_call_schedules_date ON public.on_call_schedules USING btree (tenant_id, schedule_date);

CREATE INDEX idx_on_call_schedules_deleted_at_c5f1d34d ON public.on_call_schedules USING btree (deleted_at);

CREATE INDEX idx_on_call_schedules_department_id ON public.on_call_schedules USING btree (department_id);

CREATE INDEX idx_on_call_schedules_tenant ON public.on_call_schedules USING btree (tenant_id);

ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;

-- Name: on_call_schedules on_call_schedules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY on_call_schedules_tenant ON public.on_call_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: on_call_schedules trg_on_call_schedules_soft_delete_c5f1d34d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_on_call_schedules_soft_delete_c5f1d34d BEFORE DELETE ON public.on_call_schedules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: on_call_schedules trg_on_call_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_on_call_schedules_updated_at BEFORE UPDATE ON public.on_call_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.shift_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    shift_type public.shift_type DEFAULT 'general'::public.shift_type NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_minutes integer DEFAULT 0 NOT NULL,
    is_night boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: shift_definitions shift_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT shift_definitions_pkey PRIMARY KEY (id);

-- Name: shift_definitions shift_definitions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT shift_definitions_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_shift_definitions_deleted_at_7d185731 ON public.shift_definitions USING btree (deleted_at);

CREATE INDEX idx_shift_definitions_tenant ON public.shift_definitions USING btree (tenant_id);

ALTER TABLE public.shift_definitions ENABLE ROW LEVEL SECURITY;

-- Name: shift_definitions shift_definitions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_definitions_tenant ON public.shift_definitions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: shift_definitions trg_shift_definitions_soft_delete_7d185731; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_definitions_soft_delete_7d185731 BEFORE DELETE ON public.shift_definitions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: shift_definitions trg_shift_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_definitions_updated_at BEFORE UPDATE ON public.shift_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.staff_location_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid NOT NULL,
    role_label text,
    is_primary boolean DEFAULT false NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: staff_location_assignments staff_location_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_location_assignments
    ADD CONSTRAINT staff_location_assignments_pkey PRIMARY KEY (id);

-- Name: staff_location_assignments staff_location_assignments_tenant_id_user_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_location_assignments
    ADD CONSTRAINT staff_location_assignments_tenant_id_user_id_location_id_key UNIQUE (tenant_id, user_id, location_id);

CREATE INDEX idx_staff_loc_location ON public.staff_location_assignments USING btree (tenant_id, location_id);

CREATE INDEX idx_staff_loc_user ON public.staff_location_assignments USING btree (tenant_id, user_id);

ALTER TABLE public.staff_location_assignments ENABLE ROW LEVEL SECURITY;

-- Name: staff_location_assignments staff_location_assignments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_location_assignments_tenant_isolation ON public.staff_location_assignments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: staff_location_assignments staff_location_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_location_assignments_updated_at BEFORE UPDATE ON public.staff_location_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.statutory_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    record_type text NOT NULL,
    title text NOT NULL,
    compliance_date date,
    expiry_date date,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: statutory_records statutory_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_records
    ADD CONSTRAINT statutory_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_statutory_records_deleted_at_4f8c195b ON public.statutory_records USING btree (deleted_at);

CREATE INDEX idx_statutory_records_employee ON public.statutory_records USING btree (tenant_id, employee_id);

CREATE INDEX idx_statutory_records_tenant ON public.statutory_records USING btree (tenant_id);

ALTER TABLE public.statutory_records ENABLE ROW LEVEL SECURITY;

-- Name: statutory_records statutory_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY statutory_records_tenant ON public.statutory_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: statutory_records trg_statutory_records_soft_delete_4f8c195b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_statutory_records_soft_delete_4f8c195b BEFORE DELETE ON public.statutory_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: statutory_records trg_statutory_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_statutory_records_updated_at BEFORE UPDATE ON public.statutory_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.training_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    training_name text NOT NULL,
    training_date date NOT NULL,
    duration_hours numeric(5,2),
    location text,
    trainer text,
    certificate_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    training_id uuid,
    user_id uuid,
    certificate_number text,
    score double precision,
    issued_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: training_attendance training_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_pkey PRIMARY KEY (id);

CREATE INDEX idx_training_attendance_deleted_at_edb15bf5 ON public.training_attendance USING btree (deleted_at);

CREATE INDEX idx_training_emp ON public.training_attendance USING btree (tenant_id, employee_id, training_date DESC);

ALTER TABLE ONLY public.training_attendance FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;

-- Name: training_attendance tenant_isolation_training_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_training_attendance ON public.training_attendance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: training_attendance trg_training_attendance_soft_delete_edb15bf5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_attendance_soft_delete_edb15bf5 BEFORE DELETE ON public.training_attendance FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.training_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_mandatory boolean DEFAULT false NOT NULL,
    frequency_months integer,
    duration_hours numeric(5,1),
    target_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: training_programs training_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);

-- Name: training_programs training_programs_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_training_programs_deleted_at_f357c159 ON public.training_programs USING btree (deleted_at);

CREATE INDEX idx_training_programs_tenant ON public.training_programs USING btree (tenant_id);

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

-- Name: training_programs training_programs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_programs_tenant ON public.training_programs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: training_programs trg_training_programs_soft_delete_f357c159; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_programs_soft_delete_f357c159 BEFORE DELETE ON public.training_programs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: training_programs trg_training_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_programs_updated_at BEFORE UPDATE ON public.training_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.training_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    program_id uuid NOT NULL,
    training_date date NOT NULL,
    status public.training_status DEFAULT 'scheduled'::public.training_status NOT NULL,
    score numeric(5,1),
    certificate_no text,
    expiry_date date,
    trainer_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: training_records training_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_training_records_deleted_at_e7cd272c ON public.training_records USING btree (deleted_at);

CREATE INDEX idx_training_records_employee ON public.training_records USING btree (tenant_id, employee_id);

CREATE INDEX idx_training_records_tenant ON public.training_records USING btree (tenant_id);

ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;

-- Name: training_records training_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_records_tenant ON public.training_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: training_records trg_training_records_soft_delete_e7cd272c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_records_soft_delete_e7cd272c BEFORE DELETE ON public.training_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: training_records trg_training_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_records_updated_at BEFORE UPDATE ON public.training_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: appraisals appraisals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: attendance_records attendance_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_definitions(id);

-- Name: duty_rosters duty_rosters_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: duty_rosters duty_rosters_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_definitions(id);

-- Name: duty_rosters duty_rosters_swap_with_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_swap_with_fkey FOREIGN KEY (swap_with) REFERENCES public.employees(id);

-- Name: employee_credentials employee_credentials_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Name: employees employees_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);

-- Name: employees employees_reporting_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_to_fkey FOREIGN KEY (reporting_to) REFERENCES public.employees(id);

-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: lms_certificates lms_certificates_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id);

-- Name: lms_certificates lms_certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.lms_enrollments(id);

-- Name: lms_certificates lms_certificates_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.lms_learning_paths(id);

-- Name: lms_certificates lms_certificates_training_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_training_record_id_fkey FOREIGN KEY (training_record_id) REFERENCES public.training_records(id);

-- Name: lms_course_modules lms_course_modules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_course_modules
    ADD CONSTRAINT lms_course_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;

-- Name: lms_courses lms_courses_training_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_training_program_id_fkey FOREIGN KEY (training_program_id) REFERENCES public.training_programs(id);

-- Name: lms_enrollments lms_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id);

-- Name: lms_enrollments lms_enrollments_last_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_last_module_id_fkey FOREIGN KEY (last_module_id) REFERENCES public.lms_course_modules(id);

-- Name: lms_learning_path_courses lms_learning_path_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;

-- Name: lms_learning_path_courses lms_learning_path_courses_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.lms_learning_paths(id) ON DELETE CASCADE;

-- Name: lms_quiz_attempts lms_quiz_attempts_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.lms_enrollments(id) ON DELETE CASCADE;

-- Name: lms_quiz_attempts lms_quiz_attempts_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.lms_quizzes(id);

-- Name: lms_quiz_questions lms_quiz_questions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_questions
    ADD CONSTRAINT lms_quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.lms_quizzes(id) ON DELETE CASCADE;

-- Name: lms_quizzes lms_quizzes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quizzes
    ADD CONSTRAINT lms_quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;

-- Name: on_call_schedules on_call_schedules_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: statutory_records statutory_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_records
    ADD CONSTRAINT statutory_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: training_records training_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- Name: training_records training_records_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id);
