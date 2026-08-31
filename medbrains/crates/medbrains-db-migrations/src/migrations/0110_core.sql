-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 30
-- Drops: none
-- core — schema.
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



CREATE TABLE public.backup_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    backup_type text NOT NULL,
    backup_name text NOT NULL,
    file_path text,
    file_size_bytes bigint,
    status text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    verification_at timestamp with time zone,
    retention_days integer,
    expires_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);

CREATE INDEX idx_backup_history_deleted_at_7d2a9cae ON public.backup_history USING btree (deleted_at);

CREATE INDEX idx_backup_history_recent ON public.backup_history USING btree (started_at DESC);

CREATE INDEX idx_backup_history_tenant_id ON public.backup_history USING btree (tenant_id);

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- Name: backup_history tenant_isolation_backup_history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_backup_history ON public.backup_history USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: backup_history trg_backup_history_soft_delete_7d2a9cae; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_backup_history_soft_delete_7d2a9cae BEFORE DELETE ON public.backup_history FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bed_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    status public.bed_status DEFAULT 'vacant_clean'::public.bed_status NOT NULL,
    patient_id uuid,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    cleaning_started_at timestamp with time zone,
    cleaning_completed_at timestamp with time zone,
    expected_discharge_at timestamp with time zone,
    blocked_reason text,
    reserved_for_patient uuid,
    reserved_until timestamp with time zone,
    ward_id uuid,
    admission_id uuid,
    is_isolation boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bed_states bed_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_pkey PRIMARY KEY (id);

-- Name: bed_states bed_states_tenant_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_tenant_id_location_id_key UNIQUE (tenant_id, location_id);

CREATE INDEX idx_bed_states_admission_id ON public.bed_states USING btree (admission_id);

CREATE INDEX idx_bed_states_deleted_at_9bd76f35 ON public.bed_states USING btree (deleted_at);

CREATE INDEX idx_bed_states_location_id ON public.bed_states USING btree (location_id);

CREATE INDEX idx_bed_states_status ON public.bed_states USING btree (tenant_id, status);

CREATE INDEX idx_bed_states_tenant ON public.bed_states USING btree (tenant_id);

CREATE INDEX idx_bed_states_ward ON public.bed_states USING btree (ward_id);

ALTER TABLE public.bed_states ENABLE ROW LEVEL SECURITY;

-- Name: bed_states tenant_isolation_bed_states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_bed_states ON public.bed_states USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: bed_states trg_bed_states_soft_delete_9bd76f35; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bed_states_soft_delete_9bd76f35 BEFORE DELETE ON public.bed_states FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.data_migrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    direction text NOT NULL,
    entity_type text NOT NULL,
    file_name text,
    file_path text,
    file_size_bytes bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    total_records integer,
    processed_records integer,
    success_count integer,
    error_count integer,
    warning_count integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    initiated_by uuid NOT NULL,
    error_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    mapping_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: data_migrations data_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_migrations
    ADD CONSTRAINT data_migrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_data_migrations_deleted_at_b5a6dbb9 ON public.data_migrations USING btree (deleted_at);

CREATE INDEX idx_data_migrations_tenant ON public.data_migrations USING btree (tenant_id, created_at DESC);

ALTER TABLE ONLY public.data_migrations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.data_migrations ENABLE ROW LEVEL SECURITY;

-- Name: data_migrations tenant_isolation_data_migrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_data_migrations ON public.data_migrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: data_migrations trg_data_migrations_soft_delete_b5a6dbb9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_data_migrations_soft_delete_b5a6dbb9 BEFORE DELETE ON public.data_migrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    department_type public.department_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    working_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    head_employee_id uuid,
    CONSTRAINT chk_departments_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_departments_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_departments_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);

-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);

-- Name: departments departments_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_departments_deleted_at_ca698f1d ON public.departments USING btree (deleted_at);

CREATE INDEX idx_departments_parent ON public.departments USING btree (parent_id);

CREATE INDEX idx_departments_tenant ON public.departments USING btree (tenant_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Name: departments tenant_isolation_departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_departments ON public.departments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: departments trg_departments_soft_delete_ca698f1d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_departments_soft_delete_ca698f1d BEFORE DELETE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: departments trg_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid,
    field_master_id uuid,
    section_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: form_fields form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);

CREATE INDEX idx_form_fields_deleted_at_412b0763 ON public.form_fields USING btree (deleted_at);

CREATE INDEX idx_form_fields_form ON public.form_fields USING btree (form_id, sort_order);

-- Name: form_fields trg_form_fields_soft_delete_412b0763; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_form_fields_soft_delete_412b0763 BEFORE DELETE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.geo_countries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone_code text,
    currency text,
    is_active boolean DEFAULT true NOT NULL,
    default_locale text DEFAULT 'en'::text NOT NULL,
    default_timezone text DEFAULT 'UTC'::text NOT NULL,
    date_format text DEFAULT 'DD/MM/YYYY'::text NOT NULL,
    measurement_system text DEFAULT 'metric'::text NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: geo_countries geo_countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_code_key UNIQUE (code);

-- Name: geo_countries geo_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (id);

CREATE INDEX idx_geo_countries_deleted_at_99284b6f ON public.geo_countries USING btree (deleted_at);

-- Name: geo_countries trg_geo_countries_soft_delete_99284b6f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_countries_soft_delete_99284b6f BEFORE DELETE ON public.geo_countries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.geo_districts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    state_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: geo_districts geo_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_pkey PRIMARY KEY (id);

-- Name: geo_districts geo_districts_state_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_state_id_code_key UNIQUE (state_id, code);

CREATE INDEX idx_geo_districts_deleted_at_ec109520 ON public.geo_districts USING btree (deleted_at);

CREATE INDEX idx_geo_districts_state ON public.geo_districts USING btree (state_id);

-- Name: geo_districts trg_geo_districts_soft_delete_ec109520; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_districts_soft_delete_ec109520 BEFORE DELETE ON public.geo_districts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.geo_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    country_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: geo_states geo_states_country_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_country_id_code_key UNIQUE (country_id, code);

-- Name: geo_states geo_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_pkey PRIMARY KEY (id);

CREATE INDEX idx_geo_states_country ON public.geo_states USING btree (country_id);

CREATE INDEX idx_geo_states_deleted_at_de765226 ON public.geo_states USING btree (deleted_at);

-- Name: geo_states trg_geo_states_soft_delete_de765226; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_states_soft_delete_de765226 BEFORE DELETE ON public.geo_states FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.geo_subdistricts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    district_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: geo_subdistricts geo_subdistricts_district_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_district_id_code_key UNIQUE (district_id, code);

-- Name: geo_subdistricts geo_subdistricts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_pkey PRIMARY KEY (id);

CREATE INDEX idx_geo_subdistricts_deleted_at_cdad7eca ON public.geo_subdistricts USING btree (deleted_at);

CREATE INDEX idx_geo_subdistricts_district ON public.geo_subdistricts USING btree (district_id);

-- Name: geo_subdistricts trg_geo_subdistricts_soft_delete_cdad7eca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_subdistricts_soft_delete_cdad7eca BEFORE DELETE ON public.geo_subdistricts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.geo_towns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subdistrict_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    pincode text,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: geo_towns geo_towns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_pkey PRIMARY KEY (id);

-- Name: geo_towns geo_towns_subdistrict_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_subdistrict_id_code_key UNIQUE (subdistrict_id, code);

CREATE INDEX idx_geo_towns_deleted_at_f710d61d ON public.geo_towns USING btree (deleted_at);

CREATE INDEX idx_geo_towns_pincode ON public.geo_towns USING btree (pincode) WHERE (pincode IS NOT NULL);

CREATE INDEX idx_geo_towns_subdistrict ON public.geo_towns USING btree (subdistrict_id);

-- Name: geo_towns trg_geo_towns_soft_delete_f710d61d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_towns_soft_delete_f710d61d BEFORE DELETE ON public.geo_towns FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.job_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    job_type text NOT NULL,
    pipeline_id uuid,
    execution_id uuid,
    connector_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    locked_by text,
    locked_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error text,
    correlation_id uuid DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT job_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'dead_letter'::text])))
);

-- Name: job_queue job_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_pkey PRIMARY KEY (id);

CREATE INDEX idx_job_queue_correlation ON public.job_queue USING btree (correlation_id);

CREATE INDEX idx_job_queue_deleted_at_acee3fd3 ON public.job_queue USING btree (deleted_at);

CREATE INDEX idx_job_queue_pending ON public.job_queue USING btree (status, priority, created_at) WHERE (status = 'pending'::text);

CREATE INDEX idx_job_queue_retry ON public.job_queue USING btree (next_retry_at) WHERE ((status = 'failed'::text) AND (retry_count < max_retries));

CREATE INDEX idx_job_queue_tenant ON public.job_queue USING btree (tenant_id, status);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Name: job_queue tenant_isolation_job_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_job_queue ON public.job_queue USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: job_queue trg_job_queue_soft_delete_acee3fd3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_job_queue_soft_delete_acee3fd3 BEFORE DELETE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    parent_id uuid,
    level public.location_level NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bed_type_id uuid,
    status text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_locations_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_locations_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_locations_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);

-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);

-- Name: locations locations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_locations_deleted_at_b4c0b6c7 ON public.locations USING btree (deleted_at);

CREATE INDEX idx_locations_level ON public.locations USING btree (tenant_id, level);

CREATE INDEX idx_locations_parent ON public.locations USING btree (parent_id);

CREATE INDEX idx_locations_tenant ON public.locations USING btree (tenant_id);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Name: locations tenant_isolation_locations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_locations ON public.locations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: locations trg_locations_soft_delete_b4c0b6c7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locations_soft_delete_b4c0b6c7 BEFORE DELETE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: locations trg_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.master_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    module text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: master_config master_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_pkey PRIMARY KEY (id);

-- Name: master_config master_config_tenant_id_module_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_tenant_id_module_key_key UNIQUE (tenant_id, module, key);

CREATE INDEX idx_master_config_deleted_at_f0852a1b ON public.master_config USING btree (deleted_at);

CREATE INDEX idx_master_config_tenant ON public.master_config USING btree (tenant_id);

ALTER TABLE public.master_config ENABLE ROW LEVEL SECURITY;

-- Name: master_config tenant_isolation_master_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_master_config ON public.master_config USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: master_config trg_master_config_soft_delete_f0852a1b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_config_soft_delete_f0852a1b BEFORE DELETE ON public.master_config FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: master_config trg_master_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_master_config_updated_at BEFORE UPDATE ON public.master_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.object_storage_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_category text NOT NULL,
    hot_to_cold_days integer,
    cold_to_archive_days integer,
    archive_to_delete_days integer,
    retention_years integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: object_storage_policies object_storage_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_storage_policies
    ADD CONSTRAINT object_storage_policies_pkey PRIMARY KEY (id);

-- Name: object_storage_policies object_storage_policies_tenant_id_document_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_storage_policies
    ADD CONSTRAINT object_storage_policies_tenant_id_document_category_key UNIQUE (tenant_id, document_category);

CREATE INDEX idx_object_storage_policies_deleted_at_80f0489e ON public.object_storage_policies USING btree (deleted_at);

CREATE INDEX idx_object_storage_policies_tenant ON public.object_storage_policies USING btree (tenant_id);

ALTER TABLE public.object_storage_policies ENABLE ROW LEVEL SECURITY;

-- Name: object_storage_policies object_storage_policies_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY object_storage_policies_tenant_isolation ON public.object_storage_policies USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: object_storage_policies object_storage_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER object_storage_policies_updated_at BEFORE UPDATE ON public.object_storage_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: object_storage_policies trg_object_storage_policies_soft_delete_80f0489e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_object_storage_policies_soft_delete_80f0489e BEFORE DELETE ON public.object_storage_policies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Audit row for every tier transition. Tamper-evident via
-- previous_hash chaining (mirrors audit_log pattern).

CREATE TABLE public.object_storage_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_table text NOT NULL,
    from_tier public.storage_tier NOT NULL,
    to_tier public.storage_tier NOT NULL,
    from_key text,
    to_key text,
    byte_size bigint,
    triggered_by text DEFAULT 'medbrains-archive'::text NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_hash text,
    hash text NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: object_storage_transitions object_storage_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_storage_transitions
    ADD CONSTRAINT object_storage_transitions_pkey PRIMARY KEY (id);

CREATE INDEX idx_object_storage_transitions_deleted_at_78d7a0f6 ON public.object_storage_transitions USING btree (deleted_at);

CREATE INDEX idx_object_storage_transitions_doc ON public.object_storage_transitions USING btree (document_id);

CREATE INDEX idx_object_storage_transitions_tenant ON public.object_storage_transitions USING btree (tenant_id, triggered_at DESC);

ALTER TABLE public.object_storage_transitions ENABLE ROW LEVEL SECURITY;

-- Name: object_storage_transitions object_storage_transitions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY object_storage_transitions_tenant_isolation ON public.object_storage_transitions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: object_storage_transitions trg_object_storage_transitions_soft_delete_78d7a0f6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_object_storage_transitions_soft_delete_78d7a0f6 BEFORE DELETE ON public.object_storage_transitions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Registry of partitioned tables and their rules ──────────────────────────
-- Global infra config (not tenant-scoped, no RLS) — like reference tables.

CREATE TABLE public.partition_config (
    table_name text NOT NULL,
    partition_column text NOT NULL,
    partition_interval text DEFAULT 'month'::text NOT NULL,
    premake integer DEFAULT 3 NOT NULL,
    retention_months integer,
    retention_action text DEFAULT 'detach'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partition_config_partition_interval_check CHECK ((partition_interval = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT partition_config_premake_check CHECK (((premake >= 1) AND (premake <= 24))),
    CONSTRAINT partition_config_retention_action_check CHECK ((retention_action = ANY (ARRAY['detach'::text, 'drop'::text]))),
    CONSTRAINT partition_config_retention_months_check CHECK (((retention_months IS NULL) OR (retention_months > 0)))
);

-- Name: partition_config partition_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partition_config
    ADD CONSTRAINT partition_config_pkey PRIMARY KEY (table_name);

-- Name: partition_config partition_config_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER partition_config_set_updated_at BEFORE UPDATE ON public.partition_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.regulatory_bodies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    level public.regulatory_level NOT NULL,
    country_id uuid,
    state_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: regulatory_bodies regulatory_bodies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_code_key UNIQUE (code);

-- Name: regulatory_bodies regulatory_bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_pkey PRIMARY KEY (id);

CREATE INDEX idx_regulatory_bodies_country ON public.regulatory_bodies USING btree (country_id);

CREATE INDEX idx_regulatory_bodies_deleted_at_5922f254 ON public.regulatory_bodies USING btree (deleted_at);

CREATE INDEX idx_regulatory_bodies_level ON public.regulatory_bodies USING btree (level);

-- Name: regulatory_bodies set_updated_at_regulatory_bodies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_regulatory_bodies BEFORE UPDATE ON public.regulatory_bodies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: regulatory_bodies trg_regulatory_bodies_soft_delete_5922f254; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_regulatory_bodies_soft_delete_5922f254 BEFORE DELETE ON public.regulatory_bodies FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.retrospective_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_table text NOT NULL,
    source_record_id uuid NOT NULL,
    clinical_event_date timestamp with time zone NOT NULL,
    entry_date timestamp with time zone DEFAULT now() NOT NULL,
    entered_by uuid NOT NULL,
    reason text NOT NULL,
    status public.retrospective_entry_status DEFAULT 'pending'::public.retrospective_entry_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: retrospective_entries retrospective_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_pkey PRIMARY KEY (id);

CREATE INDEX idx_retro_entries_pending ON public.retrospective_entries USING btree (tenant_id, status) WHERE (status = 'pending'::public.retrospective_entry_status);

CREATE INDEX idx_retro_entries_source ON public.retrospective_entries USING btree (tenant_id, source_table, source_record_id);

CREATE INDEX idx_retrospective_entries_deleted_at_bac79d2b ON public.retrospective_entries USING btree (deleted_at);

ALTER TABLE public.retrospective_entries ENABLE ROW LEVEL SECURITY;

-- Name: retrospective_entries tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.retrospective_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: retrospective_entries trg_retrospective_entries_soft_delete_bac79d2b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_retrospective_entries_soft_delete_bac79d2b BEFORE DELETE ON public.retrospective_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pipeline_id uuid NOT NULL,
    name text NOT NULL,
    cron_expression text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    input_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    next_run_at timestamp with time zone NOT NULL,
    last_run_at timestamp with time zone,
    last_status text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: scheduled_jobs scheduled_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (id);

CREATE INDEX idx_scheduled_jobs_deleted_at_dc1efe2a ON public.scheduled_jobs USING btree (deleted_at);

CREATE INDEX idx_scheduled_jobs_next ON public.scheduled_jobs USING btree (next_run_at) WHERE (is_active = true);

CREATE INDEX idx_scheduled_jobs_tenant_id ON public.scheduled_jobs USING btree (tenant_id);

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- Name: scheduled_jobs scheduled_jobs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scheduled_jobs_tenant ON public.scheduled_jobs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: scheduled_jobs trg_scheduled_jobs_soft_delete_dc1efe2a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scheduled_jobs_soft_delete_dc1efe2a BEFORE DELETE ON public.scheduled_jobs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: scheduled_jobs trg_scheduled_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_scheduled_jobs_updated_at BEFORE UPDATE ON public.scheduled_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.sequences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    seq_type text NOT NULL,
    prefix text DEFAULT ''::text NOT NULL,
    current_val bigint DEFAULT 0 NOT NULL,
    pad_width integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_sequences_pad_width CHECK (((pad_width >= 3) AND (pad_width <= 10))),
    CONSTRAINT chk_sequences_prefix_length CHECK ((length(prefix) <= 20))
);

-- Name: sequences sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_pkey PRIMARY KEY (id);

-- Name: sequences sequences_tenant_id_seq_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_tenant_id_seq_type_key UNIQUE (tenant_id, seq_type);

CREATE INDEX idx_sequences_deleted_at_eb6710dd ON public.sequences USING btree (deleted_at);

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

-- Name: sequences tenant_isolation_sequences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_sequences ON public.sequences USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: sequences trg_sequences_soft_delete_eb6710dd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sequences_soft_delete_eb6710dd BEFORE DELETE ON public.sequences FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: sequences trg_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sequences_updated_at BEFORE UPDATE ON public.sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    service_type public.service_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    workflow_template_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);

-- Name: services services_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_services_deleted_at_10cd395c ON public.services USING btree (deleted_at);

CREATE INDEX idx_services_department ON public.services USING btree (department_id);

CREATE INDEX idx_services_tenant ON public.services USING btree (tenant_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Name: services dept_scope_services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dept_scope_services ON public.services USING (public.check_department_access(department_id));

-- Name: services tenant_isolation_services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_services ON public.services USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: services trg_services_soft_delete_10cd395c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_soft_delete_10cd395c BEFORE DELETE ON public.services FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: services trg_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.signed_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    record_type text NOT NULL,
    record_id uuid NOT NULL,
    signer_user_id uuid NOT NULL,
    signer_role text NOT NULL,
    signer_credential_id uuid,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    payload_hash bytea NOT NULL,
    signature_bytes bytea NOT NULL,
    display_image_snapshot text,
    display_block text,
    legal_class text NOT NULL,
    device_fingerprint text,
    ip_address inet,
    user_agent text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payload_snapshot jsonb,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT signed_records_legal_class_check CHECK ((legal_class = ANY (ARRAY['administrative'::text, 'clinical'::text, 'medico_legal'::text, 'statutory_export'::text]))),
    CONSTRAINT signed_records_record_type_check CHECK ((record_type = ANY (ARRAY['prescription'::text, 'lab_report'::text, 'radiology_report'::text, 'discharge_summary'::text, 'mlc_certificate'::text, 'death_certificate'::text, 'fitness_certificate'::text, 'medical_leave_certificate'::text, 'birth_certificate'::text, 'consent_form'::text, 'operative_note'::text, 'progress_note'::text, 'package_subscription'::text, 'order_basket'::text, 'invoice'::text, 'refund'::text, 'other'::text]))),
    CONSTRAINT signed_records_signer_role_check CHECK ((signer_role = ANY (ARRAY['primary'::text, 'co_signer'::text, 'attestor'::text, 'witness'::text])))
);

-- Name: signed_records signed_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_signed_records_deleted_at_96b361d0 ON public.signed_records USING btree (deleted_at);

CREATE INDEX signed_records_legal_idx ON public.signed_records USING btree (tenant_id, legal_class, signed_at DESC);

CREATE INDEX signed_records_record_idx ON public.signed_records USING btree (tenant_id, record_type, record_id);

CREATE INDEX signed_records_signer_idx ON public.signed_records USING btree (tenant_id, signer_user_id, signed_at DESC);

ALTER TABLE ONLY public.signed_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.signed_records ENABLE ROW LEVEL SECURITY;

-- Name: signed_records tenant_isolation_signed_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_signed_records ON public.signed_records USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: signed_records trg_signed_records_soft_delete_96b361d0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_signed_records_soft_delete_96b361d0 BEFORE DELETE ON public.signed_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.system_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    mode text DEFAULT 'normal'::text NOT NULL,
    since timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    set_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT system_state_mode_check CHECK ((mode = ANY (ARRAY['normal'::text, 'degraded'::text, 'read_only'::text])))
);

-- Name: system_state system_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_pkey PRIMARY KEY (id);

-- Name: system_state system_state_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_tenant_id_key UNIQUE (tenant_id);

CREATE INDEX idx_system_state_deleted_at_729c9068 ON public.system_state USING btree (deleted_at);

CREATE INDEX idx_system_state_tenant ON public.system_state USING btree (tenant_id);

ALTER TABLE ONLY public.system_state FORCE ROW LEVEL SECURITY;

ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;

-- Name: system_state tenant_isolation_system_state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_system_state ON public.system_state USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: system_state system_state_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER system_state_updated_at BEFORE UPDATE ON public.system_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: system_state trg_system_state_soft_delete_729c9068; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_state_soft_delete_729c9068 BEFORE DELETE ON public.system_state FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tenant_db_topology (
    tenant_id uuid NOT NULL,
    topology text DEFAULT 'aurora'::text NOT NULL,
    patroni_writer_url text,
    patroni_reader_url text,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deploy_mode text DEFAULT 'saas'::text NOT NULL,
    tunnel_provider text,
    tunnel_node_key text,
    onprem_cluster_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT tenant_db_topology_deploy_mode_check CHECK ((deploy_mode = ANY (ARRAY['saas'::text, 'hybrid'::text, 'onprem'::text]))),
    CONSTRAINT tenant_db_topology_hybrid_requires_tunnel CHECK (((deploy_mode <> 'hybrid'::text) OR (tunnel_provider IS NOT NULL))),
    CONSTRAINT tenant_db_topology_topology_check CHECK ((topology = ANY (ARRAY['aurora'::text, 'patroni'::text, 'aurora_with_patroni_reads'::text, 'patroni_with_cloud_analytics'::text]))),
    CONSTRAINT tenant_db_topology_tunnel_provider_check CHECK ((tunnel_provider = ANY (ARRAY['headscale'::text, 'wss'::text, 'none'::text])))
);

-- Name: tenant_db_topology tenant_db_topology_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_pkey PRIMARY KEY (tenant_id);

CREATE INDEX idx_tenant_db_topology_deleted_at_a662390d ON public.tenant_db_topology USING btree (deleted_at);

CREATE INDEX idx_tenant_db_topology_deploy_mode ON public.tenant_db_topology USING btree (deploy_mode);

ALTER TABLE public.tenant_db_topology ENABLE ROW LEVEL SECURITY;

-- Name: tenant_db_topology tenant_isolation_tenant_db_topology; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tenant_db_topology ON public.tenant_db_topology USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tenant_db_topology tenant_db_topology_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_db_topology_updated_at BEFORE UPDATE ON public.tenant_db_topology FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: tenant_db_topology tenant_db_topology_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_db_topology_validate BEFORE INSERT OR UPDATE ON public.tenant_db_topology FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_db_topology();

-- Name: tenant_db_topology trg_tenant_db_topology_soft_delete_a662390d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_db_topology_soft_delete_a662390d BEFORE DELETE ON public.tenant_db_topology FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tenant_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_tenant_settings_key_length CHECK ((length(key) >= 1))
);

-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);

-- Name: tenant_settings tenant_settings_tenant_id_category_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_category_key_key UNIQUE (tenant_id, category, key);

CREATE INDEX idx_tenant_settings_category ON public.tenant_settings USING btree (tenant_id, category);

CREATE INDEX idx_tenant_settings_deleted_at_bd78e014 ON public.tenant_settings USING btree (deleted_at);

CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings USING btree (tenant_id);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Name: tenant_settings tenant_isolation_tenant_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tenant_settings trg_tenant_settings_soft_delete_bd78e014; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_settings_soft_delete_bd78e014 BEFORE DELETE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tenant_settings trg_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    hospital_type public.hospital_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    pincode text,
    phone text,
    email text,
    website text,
    logo_url text,
    registration_no text,
    accreditation text,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    locale text DEFAULT 'en-IN'::text NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    fy_start_month integer DEFAULT 4 NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    country_id uuid,
    state_id uuid,
    district_id uuid,
    allowed_ips jsonb DEFAULT '[]'::jsonb NOT NULL,
    group_id uuid,
    region_id uuid,
    branch_code text,
    is_headquarters boolean DEFAULT false,
    abdm_facility_id text,
    abdm_hcx_sender_code text,
    abdm_facility_active boolean DEFAULT false NOT NULL,
    aebas_unit_code text,
    nabh_certificate_number text,
    nabh_valid_until date,
    nabl_accredited boolean DEFAULT false NOT NULL,
    nabl_certificate_number text,
    nmc_registration_number text,
    pcpndt_registration_number text DEFAULT ''::text NOT NULL,
    pcpndt_valid_until text DEFAULT ''::text NOT NULL,
    pcpndt_authority text DEFAULT ''::text NOT NULL,
    peso_license_number text,
    peso_valid_until text,
    tan text,
    pan text,
    hospital_code text,
    municipal_area text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    custom_domain text,
    blocked_ips jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT chk_tenants_code_length CHECK (((length(code) >= 2) AND (length(code) <= 20))),
    CONSTRAINT chk_tenants_code_pattern CHECK ((code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$'::text)),
    CONSTRAINT chk_tenants_currency_length CHECK ((length(currency) = 3)),
    CONSTRAINT chk_tenants_email_pattern CHECK (((email IS NULL) OR (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'::text))),
    CONSTRAINT chk_tenants_fy_start_month CHECK (((fy_start_month >= 1) AND (fy_start_month <= 12))),
    CONSTRAINT chk_tenants_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100))),
    CONSTRAINT chk_tenants_pincode_digits CHECK (((pincode IS NULL) OR (pincode ~ '^\d{4,10}$'::text)))
);

-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);

-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

CREATE INDEX idx_tenants_deleted_at_05662236 ON public.tenants USING btree (deleted_at);

CREATE INDEX idx_tenants_group ON public.tenants USING btree (group_id) WHERE (group_id IS NOT NULL);

CREATE INDEX idx_tenants_region ON public.tenants USING btree (region_id) WHERE (region_id IS NOT NULL);

CREATE UNIQUE INDEX tenants_custom_domain_key ON public.tenants USING btree (lower(custom_domain)) WHERE (custom_domain IS NOT NULL);

-- Name: tenants trg_tenants_soft_delete_05662236; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenants_soft_delete_05662236 BEFORE DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tenants trg_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: COLUMN tenants.abdm_facility_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.abdm_facility_id IS 'NHA HFR-issued facility ID (FCN/FAC pattern). Set by Admin → ABDM Facility once HFR registration completes.';

-- Name: COLUMN tenants.abdm_hcx_sender_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.abdm_hcx_sender_code IS 'HCX participant code issued at NHCX onboarding. Used as x-hcx-sender-code on every claim.';

-- Name: COLUMN tenants.abdm_facility_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.abdm_facility_active IS 'False until both abdm_facility_id and abdm_hcx_sender_code are filled and the gateway smoke-test passes.';

CREATE TABLE public.vulnerabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    cve_id text,
    title text NOT NULL,
    description text,
    severity text NOT NULL,
    affected_component text NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    discovered_by uuid,
    remediation_status text,
    remediation_notes text,
    remediation_deadline date,
    remediated_at timestamp with time zone,
    remediated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: vulnerabilities vulnerabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_pkey PRIMARY KEY (id);

CREATE INDEX idx_vulnerabilities_deleted_at_8960601c ON public.vulnerabilities USING btree (deleted_at);

CREATE INDEX idx_vulns_severity ON public.vulnerabilities USING btree (tenant_id, severity, remediation_status);

ALTER TABLE ONLY public.vulnerabilities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;

-- Name: vulnerabilities tenant_isolation_vulnerabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_vulnerabilities ON public.vulnerabilities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: vulnerabilities trg_vulnerabilities_soft_delete_8960601c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vulnerabilities_soft_delete_8960601c BEFORE DELETE ON public.vulnerabilities FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.workflow_instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    patient_id uuid,
    status public.workflow_status DEFAULT 'pending'::public.workflow_status NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: workflow_instances workflow_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (id);

CREATE INDEX idx_workflow_instances_deleted_at_43f2350e ON public.workflow_instances USING btree (deleted_at);

CREATE INDEX idx_workflow_instances_patient ON public.workflow_instances USING btree (patient_id);

CREATE INDEX idx_workflow_instances_status ON public.workflow_instances USING btree (tenant_id, status);

CREATE INDEX idx_workflow_instances_template_id ON public.workflow_instances USING btree (template_id);

CREATE INDEX idx_workflow_instances_tenant ON public.workflow_instances USING btree (tenant_id);

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

-- Name: workflow_instances tenant_isolation_workflow_instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_instances ON public.workflow_instances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: workflow_instances trg_workflow_instances_soft_delete_43f2350e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_instances_soft_delete_43f2350e BEFORE DELETE ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.workflow_step_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    instance_id uuid NOT NULL,
    step_index integer NOT NULL,
    step_name text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    sla_met boolean,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: workflow_step_logs workflow_step_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_workflow_step_logs_deleted_at_2a93999b ON public.workflow_step_logs USING btree (deleted_at);

CREATE INDEX idx_workflow_step_logs_instance ON public.workflow_step_logs USING btree (instance_id);

CREATE INDEX idx_workflow_step_logs_tenant ON public.workflow_step_logs USING btree (tenant_id);

ALTER TABLE public.workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- Name: workflow_step_logs tenant_isolation_workflow_step_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_step_logs ON public.workflow_step_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: workflow_step_logs trg_workflow_step_logs_soft_delete_2a93999b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_step_logs_soft_delete_2a93999b BEFORE DELETE ON public.workflow_step_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);

-- Name: workflow_templates workflow_templates_tenant_id_code_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_code_version_key UNIQUE (tenant_id, code, version);

CREATE INDEX idx_workflow_templates_deleted_at_53c161ee ON public.workflow_templates USING btree (deleted_at);

CREATE INDEX idx_workflow_templates_tenant ON public.workflow_templates USING btree (tenant_id);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

-- Name: workflow_templates tenant_isolation_workflow_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_workflow_templates ON public.workflow_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: workflow_templates trg_workflow_templates_soft_delete_53c161ee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_templates_soft_delete_53c161ee BEFORE DELETE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: workflow_templates trg_workflow_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_workflow_templates_updated_at BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: backup_history backup_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: bed_states bed_states_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);

-- Name: bed_states bed_states_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_states
    ADD CONSTRAINT bed_states_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: data_migrations data_migrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_migrations
    ADD CONSTRAINT data_migrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);

-- Name: departments departments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: services fk_services_workflow_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT fk_services_workflow_template FOREIGN KEY (workflow_template_id) REFERENCES public.workflow_templates(id);

-- Name: geo_districts geo_districts_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);

-- Name: geo_states geo_states_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);

-- Name: geo_subdistricts geo_subdistricts_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);

-- Name: geo_towns geo_towns_subdistrict_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_subdistrict_id_fkey FOREIGN KEY (subdistrict_id) REFERENCES public.geo_subdistricts(id);

-- Name: job_queue job_queue_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_queue
    ADD CONSTRAINT job_queue_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id);

-- Name: locations locations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: master_config master_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_config
    ADD CONSTRAINT master_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: object_storage_policies object_storage_policies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_storage_policies
    ADD CONSTRAINT object_storage_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Name: object_storage_transitions object_storage_transitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_storage_transitions
    ADD CONSTRAINT object_storage_transitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Name: regulatory_bodies regulatory_bodies_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);

-- Name: regulatory_bodies regulatory_bodies_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_bodies
    ADD CONSTRAINT regulatory_bodies_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);

-- Name: retrospective_entries retrospective_entries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retrospective_entries
    ADD CONSTRAINT retrospective_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: scheduled_jobs scheduled_jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: sequences sequences_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: services services_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);

-- Name: services services_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: signed_records signed_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signed_records
    ADD CONSTRAINT signed_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Name: system_state system_state_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_state
    ADD CONSTRAINT system_state_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: tenant_db_topology tenant_db_topology_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: tenants tenants_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);

-- Name: tenants tenants_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);

-- Name: tenants tenants_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);

-- Name: vulnerabilities vulnerabilities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: workflow_instances workflow_instances_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.workflow_templates(id);

-- Name: workflow_instances workflow_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: workflow_step_logs workflow_step_logs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id);

-- Name: workflow_step_logs workflow_step_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_step_logs
    ADD CONSTRAINT workflow_step_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Name: workflow_templates workflow_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
