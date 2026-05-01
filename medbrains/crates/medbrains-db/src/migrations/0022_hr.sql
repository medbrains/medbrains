-- ============================================================
-- MedBrains schema — module: hr
-- ============================================================

--
-- Name: aebas_department_attendance; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.aebas_department_attendance FORCE ROW LEVEL SECURITY;



--
-- Name: aebas_period_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aebas_period_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period text NOT NULL,
    total_employees integer DEFAULT 0 NOT NULL,
    average_attendance_percentage numeric(5,2),
    total_working_days integer DEFAULT 0 NOT NULL,
    holidays integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.aebas_period_summary FORCE ROW LEVEL SECURITY;



--
-- Name: appraisals; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: designations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    category text DEFAULT 'clinical'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: duty_rosters; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: employee_credentials; Type: TABLE; Schema: public; Owner: -
--

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
    credential_number text
);



--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: leave_applications; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.leave_applications FORCE ROW LEVEL SECURITY;



--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: on_call_schedules; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: shift_definitions; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: statutory_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: training_attendance; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.training_attendance FORCE ROW LEVEL SECURITY;



--
-- Name: training_programs; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: training_records; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: aebas_department_attendance aebas_department_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_department_attendance
    ADD CONSTRAINT aebas_department_attendance_pkey PRIMARY KEY (id);



--
-- Name: aebas_period_summary aebas_period_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_period_summary
    ADD CONSTRAINT aebas_period_summary_pkey PRIMARY KEY (id);



--
-- Name: aebas_period_summary aebas_period_summary_tenant_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aebas_period_summary
    ADD CONSTRAINT aebas_period_summary_tenant_id_period_key UNIQUE (tenant_id, period);



--
-- Name: appraisals appraisals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_pkey PRIMARY KEY (id);



--
-- Name: appraisals appraisals_tenant_id_employee_id_appraisal_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_tenant_id_employee_id_appraisal_year_key UNIQUE (tenant_id, employee_id, appraisal_year);



--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);



--
-- Name: attendance_records attendance_records_tenant_id_employee_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_tenant_id_employee_id_attendance_date_key UNIQUE (tenant_id, employee_id, attendance_date);



--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);



--
-- Name: designations designations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: duty_rosters duty_rosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_pkey PRIMARY KEY (id);



--
-- Name: duty_rosters duty_rosters_tenant_id_employee_id_roster_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_tenant_id_employee_id_roster_date_key UNIQUE (tenant_id, employee_id, roster_date);



--
-- Name: employee_credentials employee_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_pkey PRIMARY KEY (id);



--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);



--
-- Name: employees employees_tenant_id_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_tenant_id_employee_code_key UNIQUE (tenant_id, employee_code);



--
-- Name: leave_applications leave_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_pkey PRIMARY KEY (id);



--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);



--
-- Name: leave_balances leave_balances_tenant_id_employee_id_leave_type_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_tenant_id_employee_id_leave_type_year_key UNIQUE (tenant_id, employee_id, leave_type, year);



--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);



--
-- Name: on_call_schedules on_call_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_pkey PRIMARY KEY (id);



--
-- Name: shift_definitions shift_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT shift_definitions_pkey PRIMARY KEY (id);



--
-- Name: shift_definitions shift_definitions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT shift_definitions_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: statutory_records statutory_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_records
    ADD CONSTRAINT statutory_records_pkey PRIMARY KEY (id);



--
-- Name: training_attendance training_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_attendance
    ADD CONSTRAINT training_attendance_pkey PRIMARY KEY (id);



--
-- Name: training_programs training_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);



--
-- Name: training_programs training_programs_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: training_records training_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_pkey PRIMARY KEY (id);



--
-- Name: idx_appraisals_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appraisals_employee ON public.appraisals USING btree (tenant_id, employee_id);



--
-- Name: idx_appraisals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appraisals_tenant ON public.appraisals USING btree (tenant_id);



--
-- Name: idx_attendance_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_date ON public.attendance_records USING btree (tenant_id, attendance_date);



--
-- Name: idx_attendance_records_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_employee ON public.attendance_records USING btree (tenant_id, employee_id, attendance_date);



--
-- Name: idx_attendance_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_tenant ON public.attendance_records USING btree (tenant_id);



--
-- Name: idx_designations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designations_tenant ON public.designations USING btree (tenant_id);



--
-- Name: idx_duty_rosters_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_duty_rosters_date ON public.duty_rosters USING btree (tenant_id, roster_date);



--
-- Name: idx_duty_rosters_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_duty_rosters_employee ON public.duty_rosters USING btree (tenant_id, employee_id, roster_date);



--
-- Name: idx_duty_rosters_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_duty_rosters_tenant ON public.duty_rosters USING btree (tenant_id);



--
-- Name: idx_employee_credentials_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_credentials_employee ON public.employee_credentials USING btree (tenant_id, employee_id);



--
-- Name: idx_employee_credentials_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_credentials_expiry ON public.employee_credentials USING btree (tenant_id, expiry_date) WHERE (status = 'active'::public.credential_status);



--
-- Name: idx_employee_credentials_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_credentials_tenant ON public.employee_credentials USING btree (tenant_id);



--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_department ON public.employees USING btree (tenant_id, department_id);



--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (tenant_id, status);



--
-- Name: idx_employees_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_tenant ON public.employees USING btree (tenant_id);



--
-- Name: idx_employees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user ON public.employees USING btree (tenant_id, user_id);



--
-- Name: idx_leave_balances_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_employee ON public.leave_balances USING btree (tenant_id, employee_id, year);



--
-- Name: idx_leave_balances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_balances_tenant ON public.leave_balances USING btree (tenant_id);



--
-- Name: idx_leave_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_emp ON public.leave_applications USING btree (tenant_id, employee_id, start_date DESC);



--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (tenant_id, employee_id);



--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (tenant_id, status);



--
-- Name: idx_leave_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_tenant ON public.leave_requests USING btree (tenant_id);



--
-- Name: idx_on_call_schedules_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_call_schedules_date ON public.on_call_schedules USING btree (tenant_id, schedule_date);



--
-- Name: idx_on_call_schedules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_call_schedules_tenant ON public.on_call_schedules USING btree (tenant_id);



--
-- Name: idx_shift_definitions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_definitions_tenant ON public.shift_definitions USING btree (tenant_id);



--
-- Name: idx_statutory_records_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutory_records_employee ON public.statutory_records USING btree (tenant_id, employee_id);



--
-- Name: idx_statutory_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statutory_records_tenant ON public.statutory_records USING btree (tenant_id);



--
-- Name: idx_training_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_emp ON public.training_attendance USING btree (tenant_id, employee_id, training_date DESC);



--
-- Name: idx_training_programs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_programs_tenant ON public.training_programs USING btree (tenant_id);



--
-- Name: idx_training_records_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_records_employee ON public.training_records USING btree (tenant_id, employee_id);



--
-- Name: idx_training_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_records_tenant ON public.training_records USING btree (tenant_id);



--
-- Name: appraisals trg_appraisals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appraisals_updated_at BEFORE UPDATE ON public.appraisals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: attendance_records trg_attendance_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attendance_records_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: designations trg_designations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: duty_rosters trg_duty_rosters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_duty_rosters_updated_at BEFORE UPDATE ON public.duty_rosters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: employee_credentials trg_employee_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_credentials_updated_at BEFORE UPDATE ON public.employee_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: employees trg_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: leave_balances trg_leave_balances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: leave_requests trg_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: on_call_schedules trg_on_call_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_on_call_schedules_updated_at BEFORE UPDATE ON public.on_call_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: shift_definitions trg_shift_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_definitions_updated_at BEFORE UPDATE ON public.shift_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: statutory_records trg_statutory_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_statutory_records_updated_at BEFORE UPDATE ON public.statutory_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: training_programs trg_training_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_programs_updated_at BEFORE UPDATE ON public.training_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: training_records trg_training_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_training_records_updated_at BEFORE UPDATE ON public.training_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: appraisals appraisals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisals
    ADD CONSTRAINT appraisals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: attendance_records attendance_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_definitions(id);



--
-- Name: duty_rosters duty_rosters_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: duty_rosters duty_rosters_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_definitions(id);



--
-- Name: duty_rosters duty_rosters_swap_with_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_rosters
    ADD CONSTRAINT duty_rosters_swap_with_fkey FOREIGN KEY (swap_with) REFERENCES public.employees(id);



--
-- Name: employee_credentials employee_credentials_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;



--
-- Name: employees employees_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);



--
-- Name: employees employees_reporting_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_to_fkey FOREIGN KEY (reporting_to) REFERENCES public.employees(id);



--
-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: on_call_schedules on_call_schedules_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.on_call_schedules
    ADD CONSTRAINT on_call_schedules_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: statutory_records statutory_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_records
    ADD CONSTRAINT statutory_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: training_records training_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);



--
-- Name: training_records training_records_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_records
    ADD CONSTRAINT training_records_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id);



--
-- Name: aebas_department_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aebas_department_attendance ENABLE ROW LEVEL SECURITY;


--
-- Name: aebas_period_summary; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aebas_period_summary ENABLE ROW LEVEL SECURITY;


--
-- Name: appraisals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;


--
-- Name: appraisals appraisals_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY appraisals_tenant ON public.appraisals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;


--
-- Name: attendance_records attendance_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_records_tenant ON public.attendance_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: designations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;


--
-- Name: designations designations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designations_tenant ON public.designations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: duty_rosters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.duty_rosters ENABLE ROW LEVEL SECURITY;


--
-- Name: duty_rosters duty_rosters_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_rosters_tenant ON public.duty_rosters USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: employee_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;


--
-- Name: employee_credentials employee_credentials_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_credentials_tenant ON public.employee_credentials USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;


--
-- Name: employees employees_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_tenant ON public.employees USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: leave_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;


--
-- Name: leave_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;


--
-- Name: leave_balances leave_balances_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_balances_tenant ON public.leave_balances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: leave_requests leave_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leave_requests_tenant ON public.leave_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: on_call_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: on_call_schedules on_call_schedules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY on_call_schedules_tenant ON public.on_call_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: shift_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_definitions ENABLE ROW LEVEL SECURITY;


--
-- Name: shift_definitions shift_definitions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_definitions_tenant ON public.shift_definitions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: statutory_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.statutory_records ENABLE ROW LEVEL SECURITY;


--
-- Name: statutory_records statutory_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY statutory_records_tenant ON public.statutory_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: aebas_department_attendance tenant_isolation_aebas_department_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_aebas_department_attendance ON public.aebas_department_attendance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: aebas_period_summary tenant_isolation_aebas_period_summary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_aebas_period_summary ON public.aebas_period_summary USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: leave_applications tenant_isolation_leave_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_leave_applications ON public.leave_applications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: training_attendance tenant_isolation_training_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_training_attendance ON public.training_attendance USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: training_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;


--
-- Name: training_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;


--
-- Name: training_programs training_programs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_programs_tenant ON public.training_programs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: training_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;


--
-- Name: training_records training_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY training_records_tenant ON public.training_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


