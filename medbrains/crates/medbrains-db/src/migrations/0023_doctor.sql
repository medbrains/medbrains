-- ============================================================
-- MedBrains schema — module: doctor
-- ============================================================

--
-- Name: case_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    case_manager_id uuid NOT NULL,
    status public.case_mgmt_status DEFAULT 'assigned'::public.case_mgmt_status NOT NULL,
    priority text DEFAULT 'routine'::text NOT NULL,
    target_discharge_date date,
    actual_discharge_date date,
    discharge_disposition text,
    disposition_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_assignments_priority_check CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'complex'::text])))
);



--
-- Name: case_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    case_assignment_id uuid NOT NULL,
    referral_type text NOT NULL,
    referred_to text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    facility_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    outcome text,
    referred_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_referrals_referral_type_check CHECK ((referral_type = ANY (ARRAY['post_acute'::text, 'rehab'::text, 'home_health'::text, 'social_work'::text, 'hospice'::text, 'snf'::text, 'other'::text]))),
    CONSTRAINT case_referrals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text, 'cancelled'::text])))
);



--
-- Name: co_signature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.co_signature_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    order_type text NOT NULL,
    order_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    approver_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_at timestamp with time zone,
    denied_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT co_signature_requests_order_type_check CHECK ((order_type = ANY (ARRAY['prescription'::text, 'procedure'::text, 'lab_order'::text, 'referral'::text, 'other'::text]))),
    CONSTRAINT co_signature_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])))
);



--
-- Name: doctor_coverage_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_coverage_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    absent_doctor_id uuid NOT NULL,
    covering_doctor_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT doctor_coverage_assignments_check CHECK ((end_at > start_at)),
    CONSTRAINT doctor_coverage_assignments_check1 CHECK ((absent_doctor_id <> covering_doctor_id))
);

ALTER TABLE ONLY public.doctor_coverage_assignments FORCE ROW LEVEL SECURITY;



--
-- Name: doctor_dockets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_dockets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    docket_date date NOT NULL,
    total_patients integer DEFAULT 0 NOT NULL,
    new_patients integer DEFAULT 0 NOT NULL,
    follow_ups integer DEFAULT 0 NOT NULL,
    referrals_made integer DEFAULT 0 NOT NULL,
    procedures_done integer DEFAULT 0 NOT NULL,
    notes text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: doctor_incentive_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_incentive_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    custom_percentage numeric(7,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.doctor_incentive_assignments FORCE ROW LEVEL SECURITY;



--
-- Name: doctor_package_inclusions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_package_inclusions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    inclusion_type text NOT NULL,
    consultation_specialty_id uuid,
    consultation_doctor_id uuid,
    service_id uuid,
    test_id uuid,
    procedure_id uuid,
    included_quantity integer NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT doctor_package_inclusions_included_quantity_check CHECK ((included_quantity > 0)),
    CONSTRAINT doctor_package_inclusions_inclusion_type_check CHECK ((inclusion_type = ANY (ARRAY['consultation'::text, 'lab'::text, 'procedure'::text, 'service'::text])))
);

ALTER TABLE ONLY public.doctor_package_inclusions FORCE ROW LEVEL SECURITY;



--
-- Name: doctor_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    total_price numeric(12,2) NOT NULL,
    validity_days integer DEFAULT 365 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT doctor_packages_total_price_check CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT doctor_packages_validity_days_check CHECK ((validity_days > 0))
);

ALTER TABLE ONLY public.doctor_packages FORCE ROW LEVEL SECURITY;



--
-- Name: doctor_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    prefix text,
    display_name text NOT NULL,
    qualification_string text,
    mci_number text,
    state_council_number text,
    state_council_name text,
    registration_valid_until date,
    specialty_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    subspecialty text,
    years_experience integer,
    is_full_time boolean DEFAULT true NOT NULL,
    is_visiting boolean DEFAULT false NOT NULL,
    parent_employee_id uuid,
    can_prescribe_schedule_x boolean DEFAULT false NOT NULL,
    can_perform_surgery boolean DEFAULT false NOT NULL,
    can_sign_mlc boolean DEFAULT false NOT NULL,
    can_sign_death_certificate boolean DEFAULT false NOT NULL,
    can_sign_fitness_certificate boolean DEFAULT true NOT NULL,
    bio_short text,
    bio_long text,
    photo_url text,
    languages_spoken text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT doctor_profiles_years_experience_check CHECK (((years_experience >= 0) AND (years_experience <= 80)))
);

ALTER TABLE ONLY public.doctor_profiles FORCE ROW LEVEL SECURITY;



--
-- Name: doctor_rotation_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_rotation_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    schedule_date date NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    shift text DEFAULT 'morning'::text,
    start_time time without time zone,
    end_time time without time zone,
    is_locum boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: doctor_schedule_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedule_exceptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    exception_date date NOT NULL,
    is_available boolean DEFAULT false NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration_mins integer DEFAULT 15 NOT NULL,
    max_patients integer DEFAULT 20 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_schedule_time CHECK ((end_time > start_time)),
    CONSTRAINT doctor_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT doctor_schedules_max_patients_check CHECK ((max_patients > 0)),
    CONSTRAINT doctor_schedules_slot_duration_mins_check CHECK ((slot_duration_mins > 0))
);



--
-- Name: doctor_signature_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_signature_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_user_id uuid NOT NULL,
    credential_type text NOT NULL,
    algorithm text DEFAULT 'Ed25519'::text NOT NULL,
    public_key bytea NOT NULL,
    encrypted_private_key bytea,
    display_image_url text,
    display_font text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_reason text,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT doctor_signature_credentials_credential_type_check CHECK ((credential_type = ANY (ARRAY['stored_key'::text, 'aadhaar_esign'::text, 'dsc_usb'::text, 'external_pkcs11'::text])))
);

ALTER TABLE ONLY public.doctor_signature_credentials FORCE ROW LEVEL SECURITY;



--
-- Name: incentive_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incentive_calculations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    gross_revenue numeric(14,2),
    eligible_revenue numeric(14,2),
    incentive_amount numeric(14,2),
    deductions numeric(14,2),
    net_payable numeric(14,2),
    status text,
    approved_by uuid,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    payment_reference text,
    calculation_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.incentive_calculations FORCE ROW LEVEL SECURITY;



--
-- Name: incentive_plan_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incentive_plan_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    rule_name text NOT NULL,
    service_type text,
    department_id uuid,
    min_threshold numeric(14,2),
    max_threshold numeric(14,2),
    percentage numeric(7,2),
    fixed_amount numeric(14,2),
    multiplier numeric(7,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: incentive_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incentive_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan_name text NOT NULL,
    plan_code text NOT NULL,
    description text,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    calculation_basis text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.incentive_plans FORCE ROW LEVEL SECURITY;



--
-- Name: pg_logbook_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pg_logbook_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    encounter_id uuid,
    entry_type text NOT NULL,
    title text NOT NULL,
    description text,
    diagnosis_codes text[] DEFAULT '{}'::text[],
    procedure_codes text[] DEFAULT '{}'::text[],
    department_id uuid,
    supervisor_id uuid,
    supervisor_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pg_logbook_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['case'::text, 'procedure'::text, 'ward_round'::text, 'emergency'::text, 'seminar'::text, 'other'::text])))
);



--
-- Name: case_assignments case_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_pkey PRIMARY KEY (id);



--
-- Name: case_assignments case_assignments_tenant_id_admission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_assignments
    ADD CONSTRAINT case_assignments_tenant_id_admission_id_key UNIQUE (tenant_id, admission_id);



--
-- Name: case_referrals case_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_pkey PRIMARY KEY (id);



--
-- Name: co_signature_requests co_signature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_signature_requests
    ADD CONSTRAINT co_signature_requests_pkey PRIMARY KEY (id);



--
-- Name: doctor_coverage_assignments doctor_coverage_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_coverage_assignments
    ADD CONSTRAINT doctor_coverage_assignments_pkey PRIMARY KEY (id);



--
-- Name: doctor_dockets doctor_dockets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_pkey PRIMARY KEY (id);



--
-- Name: doctor_dockets doctor_dockets_tenant_id_doctor_id_docket_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_dockets
    ADD CONSTRAINT doctor_dockets_tenant_id_doctor_id_docket_date_key UNIQUE (tenant_id, doctor_id, docket_date);



--
-- Name: doctor_incentive_assignments doctor_incentive_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_pkey PRIMARY KEY (id);



--
-- Name: doctor_package_inclusions doctor_package_inclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_pkey PRIMARY KEY (id);



--
-- Name: doctor_packages doctor_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_pkey PRIMARY KEY (id);



--
-- Name: doctor_packages doctor_packages_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_packages
    ADD CONSTRAINT doctor_packages_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: doctor_profiles doctor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_pkey PRIMARY KEY (id);



--
-- Name: doctor_profiles doctor_profiles_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_profiles
    ADD CONSTRAINT doctor_profiles_tenant_id_user_id_key UNIQUE (tenant_id, user_id);



--
-- Name: doctor_rotation_schedules doctor_rotation_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_rotation_schedules
    ADD CONSTRAINT doctor_rotation_schedules_pkey PRIMARY KEY (id);



--
-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_pkey PRIMARY KEY (id);



--
-- Name: doctor_schedule_exceptions doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule_exceptions
    ADD CONSTRAINT doctor_schedule_exceptions_tenant_id_doctor_id_exception_da_key UNIQUE (tenant_id, doctor_id, exception_date);



--
-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);



--
-- Name: doctor_schedules doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_tenant_id_doctor_id_department_id_day_of_w_key UNIQUE (tenant_id, doctor_id, department_id, day_of_week);



--
-- Name: doctor_signature_credentials doctor_signature_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_signature_credentials
    ADD CONSTRAINT doctor_signature_credentials_pkey PRIMARY KEY (id);



--
-- Name: incentive_calculations incentive_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_pkey PRIMARY KEY (id);



--
-- Name: incentive_plan_rules incentive_plan_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plan_rules
    ADD CONSTRAINT incentive_plan_rules_pkey PRIMARY KEY (id);



--
-- Name: incentive_plans incentive_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_pkey PRIMARY KEY (id);



--
-- Name: incentive_plans incentive_plans_tenant_id_plan_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plans
    ADD CONSTRAINT incentive_plans_tenant_id_plan_code_key UNIQUE (tenant_id, plan_code);



--
-- Name: pg_logbook_entries pg_logbook_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pg_logbook_entries
    ADD CONSTRAINT pg_logbook_entries_pkey PRIMARY KEY (id);



--
-- Name: doctor_coverage_assignments_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_coverage_assignments_active_idx ON public.doctor_coverage_assignments USING btree (tenant_id, absent_doctor_id, start_at, end_at);



--
-- Name: doctor_coverage_assignments_covering_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_coverage_assignments_covering_idx ON public.doctor_coverage_assignments USING btree (tenant_id, covering_doctor_id, start_at, end_at);



--
-- Name: doctor_package_inclusions_pkg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_package_inclusions_pkg_idx ON public.doctor_package_inclusions USING btree (tenant_id, package_id, sort_order);



--
-- Name: doctor_packages_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_packages_active_idx ON public.doctor_packages USING btree (tenant_id, is_active);



--
-- Name: doctor_profiles_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_profiles_active_idx ON public.doctor_profiles USING btree (tenant_id, is_active) WHERE is_active;



--
-- Name: doctor_profiles_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_profiles_user_idx ON public.doctor_profiles USING btree (tenant_id, user_id);



--
-- Name: doctor_signature_credentials_default_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctor_signature_credentials_default_idx ON public.doctor_signature_credentials USING btree (tenant_id, doctor_user_id) WHERE (is_default AND (revoked_at IS NULL));



--
-- Name: doctor_signature_credentials_doctor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_signature_credentials_doctor_idx ON public.doctor_signature_credentials USING btree (tenant_id, doctor_user_id) WHERE (revoked_at IS NULL);



--
-- Name: idx_case_assignments_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignments_manager ON public.case_assignments USING btree (tenant_id, case_manager_id, status);



--
-- Name: idx_case_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_assignments_status ON public.case_assignments USING btree (tenant_id, status);



--
-- Name: idx_case_referrals_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_referrals_case ON public.case_referrals USING btree (tenant_id, case_assignment_id);



--
-- Name: idx_co_signature_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_co_signature_approver ON public.co_signature_requests USING btree (tenant_id, approver_id, status);



--
-- Name: idx_co_signature_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_co_signature_tenant ON public.co_signature_requests USING btree (tenant_id);



--
-- Name: idx_dockets_doctor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dockets_doctor_date ON public.doctor_dockets USING btree (doctor_id, docket_date DESC);



--
-- Name: idx_dockets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dockets_tenant ON public.doctor_dockets USING btree (tenant_id);



--
-- Name: idx_doctor_incentive_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_incentive_doc ON public.doctor_incentive_assignments USING btree (tenant_id, doctor_id);



--
-- Name: idx_doctor_rotation_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_rotation_doctor ON public.doctor_rotation_schedules USING btree (doctor_id, schedule_date);



--
-- Name: idx_doctor_rotation_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_rotation_group ON public.doctor_rotation_schedules USING btree (group_id);



--
-- Name: idx_doctor_rotation_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_rotation_tenant ON public.doctor_rotation_schedules USING btree (tenant_id, schedule_date);



--
-- Name: idx_doctor_schedule_exceptions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_schedule_exceptions_date ON public.doctor_schedule_exceptions USING btree (tenant_id, doctor_id, exception_date);



--
-- Name: idx_doctor_schedules_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_schedules_dept ON public.doctor_schedules USING btree (tenant_id, department_id);



--
-- Name: idx_doctor_schedules_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctor_schedules_doctor ON public.doctor_schedules USING btree (tenant_id, doctor_id);



--
-- Name: idx_incentive_calcs_doctor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incentive_calcs_doctor ON public.incentive_calculations USING btree (tenant_id, doctor_id, period_start DESC);



--
-- Name: idx_incentive_rules_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incentive_rules_plan ON public.incentive_plan_rules USING btree (plan_id);



--
-- Name: idx_pg_logbook_supervisor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pg_logbook_supervisor ON public.pg_logbook_entries USING btree (tenant_id, supervisor_id) WHERE (supervisor_id IS NOT NULL);



--
-- Name: idx_pg_logbook_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pg_logbook_tenant ON public.pg_logbook_entries USING btree (tenant_id);



--
-- Name: idx_pg_logbook_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pg_logbook_user ON public.pg_logbook_entries USING btree (tenant_id, user_id);



--
-- Name: doctor_packages doctor_packages_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER doctor_packages_updated BEFORE UPDATE ON public.doctor_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: doctor_profiles doctor_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER doctor_profiles_updated BEFORE UPDATE ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: case_assignments set_updated_at_case_assignments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_case_assignments BEFORE UPDATE ON public.case_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: case_referrals set_updated_at_case_referrals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_case_referrals BEFORE UPDATE ON public.case_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: co_signature_requests set_updated_at_co_signature; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_co_signature BEFORE UPDATE ON public.co_signature_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pg_logbook_entries set_updated_at_pg_logbook; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pg_logbook BEFORE UPDATE ON public.pg_logbook_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: doctor_rotation_schedules trg_doctor_rotation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_doctor_rotation_updated_at BEFORE UPDATE ON public.doctor_rotation_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: case_referrals case_referrals_case_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_referrals
    ADD CONSTRAINT case_referrals_case_assignment_id_fkey FOREIGN KEY (case_assignment_id) REFERENCES public.case_assignments(id) ON DELETE CASCADE;



--
-- Name: doctor_incentive_assignments doctor_incentive_assignments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_incentive_assignments
    ADD CONSTRAINT doctor_incentive_assignments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id);



--
-- Name: doctor_package_inclusions doctor_package_inclusions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_package_inclusions
    ADD CONSTRAINT doctor_package_inclusions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.doctor_packages(id) ON DELETE CASCADE;



--
-- Name: incentive_calculations incentive_calculations_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_calculations
    ADD CONSTRAINT incentive_calculations_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id);



--
-- Name: incentive_plan_rules incentive_plan_rules_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentive_plan_rules
    ADD CONSTRAINT incentive_plan_rules_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.incentive_plans(id) ON DELETE CASCADE;



--
-- Name: case_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: case_referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_referrals ENABLE ROW LEVEL SECURITY;


--
-- Name: co_signature_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.co_signature_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: co_signature_requests co_signature_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY co_signature_requests_tenant ON public.co_signature_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_coverage_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_coverage_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_dockets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_dockets ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_dockets doctor_dockets_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doctor_dockets_tenant ON public.doctor_dockets USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: doctor_incentive_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_incentive_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_package_inclusions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_package_inclusions ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_packages ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_rotation_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_rotation_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_schedule_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_schedule_exceptions ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: doctor_signature_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctor_signature_credentials ENABLE ROW LEVEL SECURITY;


--
-- Name: incentive_calculations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incentive_calculations ENABLE ROW LEVEL SECURITY;


--
-- Name: incentive_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incentive_plans ENABLE ROW LEVEL SECURITY;


--
-- Name: pg_logbook_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pg_logbook_entries ENABLE ROW LEVEL SECURITY;


--
-- Name: pg_logbook_entries pg_logbook_entries_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pg_logbook_entries_tenant ON public.pg_logbook_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: case_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_assignments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: case_referrals tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.case_referrals USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: doctor_coverage_assignments tenant_isolation_doctor_coverage_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_coverage_assignments ON public.doctor_coverage_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_incentive_assignments tenant_isolation_doctor_incentive_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_incentive_assignments ON public.doctor_incentive_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_package_inclusions tenant_isolation_doctor_package_inclusions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_package_inclusions ON public.doctor_package_inclusions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_packages tenant_isolation_doctor_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_packages ON public.doctor_packages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_profiles tenant_isolation_doctor_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_profiles ON public.doctor_profiles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_rotation_schedules tenant_isolation_doctor_rotation_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_rotation_schedules ON public.doctor_rotation_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_schedule_exceptions tenant_isolation_doctor_schedule_exceptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_schedule_exceptions ON public.doctor_schedule_exceptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_schedules tenant_isolation_doctor_schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_schedules ON public.doctor_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: doctor_signature_credentials tenant_isolation_doctor_signature_credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_doctor_signature_credentials ON public.doctor_signature_credentials USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: incentive_calculations tenant_isolation_incentive_calculations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_incentive_calculations ON public.incentive_calculations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: incentive_plans tenant_isolation_incentive_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_incentive_plans ON public.incentive_plans USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


