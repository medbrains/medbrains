-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 21
-- Drops: none
-- theatre — schema.
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



CREATE TABLE public.cssd_indicator_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_id uuid NOT NULL,
    indicator_type public.indicator_type NOT NULL,
    indicator_brand text,
    indicator_lot text,
    result_pass boolean NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    read_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_indicator_results cssd_indicator_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_indicator_results
    ADD CONSTRAINT cssd_indicator_results_pkey PRIMARY KEY (id);

CREATE INDEX idx_cssd_indicator_results_deleted_at_90442b0b ON public.cssd_indicator_results USING btree (deleted_at);

CREATE INDEX idx_cssd_indicator_results_tenant_id ON public.cssd_indicator_results USING btree (tenant_id);

CREATE INDEX idx_cssd_indicators_load ON public.cssd_indicator_results USING btree (load_id);

ALTER TABLE public.cssd_indicator_results ENABLE ROW LEVEL SECURITY;

-- Name: cssd_indicator_results tenant_cssd_indicator_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_indicator_results ON public.cssd_indicator_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_indicator_results trg_cssd_indicator_results_soft_delete_90442b0b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_indicator_results_soft_delete_90442b0b BEFORE DELETE ON public.cssd_indicator_results FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_instrument_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    set_code text NOT NULL,
    set_name text NOT NULL,
    department text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_instrument_sets cssd_instrument_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instrument_sets
    ADD CONSTRAINT cssd_instrument_sets_pkey PRIMARY KEY (id);

-- Name: cssd_instrument_sets cssd_instrument_sets_tenant_id_set_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instrument_sets
    ADD CONSTRAINT cssd_instrument_sets_tenant_id_set_code_key UNIQUE (tenant_id, set_code);

CREATE INDEX idx_cssd_instrument_sets_deleted_at_bcd1e31e ON public.cssd_instrument_sets USING btree (deleted_at);

CREATE INDEX idx_cssd_instrument_sets_tenant ON public.cssd_instrument_sets USING btree (tenant_id);

ALTER TABLE public.cssd_instrument_sets ENABLE ROW LEVEL SECURITY;

-- Name: cssd_instrument_sets tenant_cssd_instrument_sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_instrument_sets ON public.cssd_instrument_sets USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_instrument_sets set_cssd_instrument_sets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_instrument_sets_updated_at BEFORE UPDATE ON public.cssd_instrument_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: cssd_instrument_sets trg_cssd_instrument_sets_soft_delete_bcd1e31e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_instrument_sets_soft_delete_bcd1e31e BEFORE DELETE ON public.cssd_instrument_sets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_instruments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    barcode text NOT NULL,
    name text NOT NULL,
    category text,
    manufacturer text,
    status public.instrument_status DEFAULT 'available'::public.instrument_status NOT NULL,
    purchase_date date,
    lifecycle_uses integer DEFAULT 0 NOT NULL,
    max_uses integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_instruments cssd_instruments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instruments
    ADD CONSTRAINT cssd_instruments_pkey PRIMARY KEY (id);

-- Name: cssd_instruments cssd_instruments_tenant_id_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instruments
    ADD CONSTRAINT cssd_instruments_tenant_id_barcode_key UNIQUE (tenant_id, barcode);

CREATE INDEX idx_cssd_instruments_deleted_at_3ae4a9f4 ON public.cssd_instruments USING btree (deleted_at);

CREATE INDEX idx_cssd_instruments_status ON public.cssd_instruments USING btree (tenant_id, status);

CREATE INDEX idx_cssd_instruments_tenant ON public.cssd_instruments USING btree (tenant_id);

ALTER TABLE public.cssd_instruments ENABLE ROW LEVEL SECURITY;

-- Name: cssd_instruments tenant_cssd_instruments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_instruments ON public.cssd_instruments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_instruments set_cssd_instruments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_instruments_updated_at BEFORE UPDATE ON public.cssd_instruments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: cssd_instruments trg_cssd_instruments_soft_delete_3ae4a9f4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_instruments_soft_delete_3ae4a9f4 BEFORE DELETE ON public.cssd_instruments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_issuances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_item_id uuid,
    set_id uuid,
    issued_to_department text NOT NULL,
    issued_to_patient_id uuid,
    issued_by uuid,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    returned_at timestamp with time zone,
    returned_by uuid,
    is_recalled boolean DEFAULT false NOT NULL,
    recall_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_issuances cssd_issuances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_pkey PRIMARY KEY (id);

CREATE INDEX idx_cssd_issuances_deleted_at_b008f60f ON public.cssd_issuances USING btree (deleted_at);

CREATE INDEX idx_cssd_issuances_department ON public.cssd_issuances USING btree (tenant_id, issued_to_department);

CREATE INDEX idx_cssd_issuances_tenant ON public.cssd_issuances USING btree (tenant_id);

ALTER TABLE public.cssd_issuances ENABLE ROW LEVEL SECURITY;

-- Name: cssd_issuances tenant_cssd_issuances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_issuances ON public.cssd_issuances USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_issuances trg_cssd_issuances_soft_delete_b008f60f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_issuances_soft_delete_b008f60f BEFORE DELETE ON public.cssd_issuances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_load_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_id uuid NOT NULL,
    set_id uuid,
    instrument_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    pack_expiry_date date,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_load_items cssd_load_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_cssd_load_items_deleted_at_ee98105c ON public.cssd_load_items USING btree (deleted_at);

CREATE INDEX idx_cssd_load_items_load ON public.cssd_load_items USING btree (load_id);

CREATE INDEX idx_cssd_load_items_tenant_id ON public.cssd_load_items USING btree (tenant_id);

ALTER TABLE public.cssd_load_items ENABLE ROW LEVEL SECURITY;

-- Name: cssd_load_items tenant_cssd_load_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_load_items ON public.cssd_load_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_load_items trg_cssd_load_items_soft_delete_ee98105c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_load_items_soft_delete_ee98105c BEFORE DELETE ON public.cssd_load_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_maintenance_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    sterilizer_id uuid NOT NULL,
    maintenance_type text NOT NULL,
    performed_by text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    next_due_at timestamp with time zone,
    findings text,
    actions_taken text,
    cost numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_maintenance_logs cssd_maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_maintenance_logs
    ADD CONSTRAINT cssd_maintenance_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_cssd_maintenance_logs_deleted_at_658f022a ON public.cssd_maintenance_logs USING btree (deleted_at);

CREATE INDEX idx_cssd_maintenance_logs_tenant_id ON public.cssd_maintenance_logs USING btree (tenant_id);

CREATE INDEX idx_cssd_maintenance_sterilizer ON public.cssd_maintenance_logs USING btree (sterilizer_id);

ALTER TABLE public.cssd_maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Name: cssd_maintenance_logs tenant_cssd_maintenance_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_maintenance_logs ON public.cssd_maintenance_logs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_maintenance_logs trg_cssd_maintenance_logs_soft_delete_658f022a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_maintenance_logs_soft_delete_658f022a BEFORE DELETE ON public.cssd_maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_set_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    set_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_set_items cssd_set_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_pkey PRIMARY KEY (id);

-- Name: cssd_set_items cssd_set_items_set_id_instrument_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_set_id_instrument_id_key UNIQUE (set_id, instrument_id);

CREATE INDEX idx_cssd_set_items_deleted_at_3033d89e ON public.cssd_set_items USING btree (deleted_at);

CREATE INDEX idx_cssd_set_items_tenant_id ON public.cssd_set_items USING btree (tenant_id);

ALTER TABLE public.cssd_set_items ENABLE ROW LEVEL SECURITY;

-- Name: cssd_set_items tenant_cssd_set_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_set_items ON public.cssd_set_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_set_items trg_cssd_set_items_soft_delete_3033d89e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_set_items_soft_delete_3033d89e BEFORE DELETE ON public.cssd_set_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_sterilization_loads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_number text NOT NULL,
    sterilizer_id uuid NOT NULL,
    method public.sterilization_method NOT NULL,
    status public.load_status DEFAULT 'loading'::public.load_status NOT NULL,
    operator_id uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cycle_time_minutes integer,
    temperature_c numeric(5,1),
    pressure_psi numeric(5,1),
    is_flash boolean DEFAULT false NOT NULL,
    flash_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_sterilization_loads cssd_sterilization_loads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_pkey PRIMARY KEY (id);

-- Name: cssd_sterilization_loads cssd_sterilization_loads_tenant_id_load_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_tenant_id_load_number_key UNIQUE (tenant_id, load_number);

CREATE INDEX idx_cssd_loads_sterilizer ON public.cssd_sterilization_loads USING btree (sterilizer_id);

CREATE INDEX idx_cssd_loads_tenant ON public.cssd_sterilization_loads USING btree (tenant_id);

CREATE INDEX idx_cssd_sterilization_loads_deleted_at_739ad126 ON public.cssd_sterilization_loads USING btree (deleted_at);

ALTER TABLE public.cssd_sterilization_loads ENABLE ROW LEVEL SECURITY;

-- Name: cssd_sterilization_loads tenant_cssd_sterilization_loads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_sterilization_loads ON public.cssd_sterilization_loads USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_sterilization_loads trg_cssd_sterilization_loads_soft_delete_739ad126; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_sterilization_loads_soft_delete_739ad126 BEFORE DELETE ON public.cssd_sterilization_loads FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.cssd_sterilizers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    model text,
    serial_number text,
    method public.sterilization_method DEFAULT 'steam'::public.sterilization_method NOT NULL,
    chamber_size_liters numeric(10,2),
    location text,
    is_active boolean DEFAULT true NOT NULL,
    last_maintenance_at timestamp with time zone,
    next_maintenance_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cssd_sterilizers cssd_sterilizers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilizers
    ADD CONSTRAINT cssd_sterilizers_pkey PRIMARY KEY (id);

CREATE INDEX idx_cssd_sterilizers_deleted_at_252e7058 ON public.cssd_sterilizers USING btree (deleted_at);

CREATE INDEX idx_cssd_sterilizers_tenant_id ON public.cssd_sterilizers USING btree (tenant_id);

ALTER TABLE public.cssd_sterilizers ENABLE ROW LEVEL SECURITY;

-- Name: cssd_sterilizers tenant_cssd_sterilizers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_sterilizers ON public.cssd_sterilizers USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: cssd_sterilizers set_cssd_sterilizers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_sterilizers_updated_at BEFORE UPDATE ON public.cssd_sterilizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: cssd_sterilizers trg_cssd_sterilizers_soft_delete_252e7058; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cssd_sterilizers_soft_delete_252e7058 BEFORE DELETE ON public.cssd_sterilizers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    fasting_override_reason text
);

-- Name: ot_anesthesia_records ot_anesthesia_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_anesthesia_booking ON public.ot_anesthesia_records USING btree (booking_id);

CREATE INDEX idx_ot_anesthesia_records_deleted_at_f8e64257 ON public.ot_anesthesia_records USING btree (deleted_at);

CREATE INDEX idx_ot_anesthesia_tenant ON public.ot_anesthesia_records USING btree (tenant_id);

ALTER TABLE public.ot_anesthesia_records ENABLE ROW LEVEL SECURITY;

-- Name: ot_anesthesia_records tenant_isolation_ot_anesthesia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_anesthesia ON public.ot_anesthesia_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_anesthesia_records trg_ot_anesthesia_records_soft_delete_f8e64257; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_anesthesia_records_soft_delete_f8e64257 BEFORE DELETE ON public.ot_anesthesia_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_anesthesia_records trg_ot_anesthesia_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_anesthesia_updated BEFORE UPDATE ON public.ot_anesthesia_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    surgeon_id uuid,
    anesthesiologist_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_bookings ot_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_bookings_admission_id ON public.ot_bookings USING btree (admission_id);

CREATE INDEX idx_ot_bookings_date ON public.ot_bookings USING btree (tenant_id, scheduled_date);

CREATE INDEX idx_ot_bookings_deleted_at_1c25b91c ON public.ot_bookings USING btree (deleted_at);

CREATE INDEX idx_ot_bookings_patient ON public.ot_bookings USING btree (patient_id);

CREATE INDEX idx_ot_bookings_room ON public.ot_bookings USING btree (ot_room_id, scheduled_date);

CREATE INDEX idx_ot_bookings_status ON public.ot_bookings USING btree (tenant_id, status);

CREATE INDEX idx_ot_bookings_surgeon ON public.ot_bookings USING btree (primary_surgeon_id, scheduled_date);

CREATE INDEX idx_ot_bookings_tenant ON public.ot_bookings USING btree (tenant_id);

ALTER TABLE public.ot_bookings ENABLE ROW LEVEL SECURITY;

-- Name: ot_bookings tenant_isolation_ot_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_bookings ON public.ot_bookings USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_bookings trg_ot_bookings_soft_delete_1c25b91c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_bookings_soft_delete_1c25b91c BEFORE DELETE ON public.ot_bookings FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_bookings trg_ot_bookings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_bookings_updated BEFORE UPDATE ON public.ot_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    ssi_detected_at date,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    count_discrepancy_action text
);

-- Name: ot_case_records ot_case_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_case_records_booking ON public.ot_case_records USING btree (booking_id);

CREATE INDEX idx_ot_case_records_deleted_at_a7c40b64 ON public.ot_case_records USING btree (deleted_at);

CREATE INDEX idx_ot_case_records_tenant ON public.ot_case_records USING btree (tenant_id);

ALTER TABLE public.ot_case_records ENABLE ROW LEVEL SECURITY;

-- Name: ot_case_records tenant_isolation_ot_case_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_case_records ON public.ot_case_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_case_records trg_ot_case_records_soft_delete_a7c40b64; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_case_records_soft_delete_a7c40b64 BEFORE DELETE ON public.ot_case_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_case_records trg_ot_case_records_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_case_records_updated BEFORE UPDATE ON public.ot_case_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_consumable_usage ot_consumable_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_consumable_usage_deleted_at_37a674ed ON public.ot_consumable_usage USING btree (deleted_at);

CREATE INDEX idx_ot_consumable_usage_tenant_id ON public.ot_consumable_usage USING btree (tenant_id);

CREATE INDEX idx_ot_consumables_booking ON public.ot_consumable_usage USING btree (booking_id);

ALTER TABLE public.ot_consumable_usage ENABLE ROW LEVEL SECURITY;

-- Name: ot_consumable_usage tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ot_consumable_usage USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_consumable_usage trg_ot_consumable_usage_soft_delete_37a674ed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_consumable_usage_soft_delete_37a674ed BEFORE DELETE ON public.ot_consumable_usage FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0176_ot_postop_handoff.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- OT → PACU / ward post-op handoff. After surgery the OT nurse hands the
-- patient over to the receiving PACU/ward nurse with a structured safety
-- checklist (airway, vitals, pain/PONV, dressing, drains/lines, Aldrete,
-- post-op orders). Mirrors the pre-op send-off (ot_preop_handoffs); distinct
-- from ot_postop_records, which tracks the recovery course itself.

CREATE TABLE public.ot_postop_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    handed_off_by uuid,
    received_by uuid,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ot_postop_handoffs ot_postop_handoffs_booking_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_handoffs
    ADD CONSTRAINT ot_postop_handoffs_booking_uniq UNIQUE (tenant_id, booking_id);

-- Name: ot_postop_handoffs ot_postop_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_handoffs
    ADD CONSTRAINT ot_postop_handoffs_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_postop_handoff_booking ON public.ot_postop_handoffs USING btree (tenant_id, booking_id);

ALTER TABLE public.ot_postop_handoffs ENABLE ROW LEVEL SECURITY;

-- Name: ot_postop_handoffs tenant_isolation_ot_postop_handoff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_postop_handoff ON public.ot_postop_handoffs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_postop_records ot_postop_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_postop_booking ON public.ot_postop_records USING btree (booking_id);

CREATE INDEX idx_ot_postop_records_deleted_at_7b6dc8f4 ON public.ot_postop_records USING btree (deleted_at);

CREATE INDEX idx_ot_postop_tenant ON public.ot_postop_records USING btree (tenant_id);

ALTER TABLE public.ot_postop_records ENABLE ROW LEVEL SECURITY;

-- Name: ot_postop_records tenant_isolation_ot_postop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_postop ON public.ot_postop_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_postop_records trg_ot_postop_records_soft_delete_7b6dc8f4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_postop_records_soft_delete_7b6dc8f4 BEFORE DELETE ON public.ot_postop_records FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_postop_records trg_ot_postop_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_postop_updated BEFORE UPDATE ON public.ot_postop_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_preop_assessments ot_preop_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_preop_assessments_deleted_at_144db91a ON public.ot_preop_assessments USING btree (deleted_at);

CREATE INDEX idx_ot_preop_booking ON public.ot_preop_assessments USING btree (booking_id);

CREATE INDEX idx_ot_preop_tenant ON public.ot_preop_assessments USING btree (tenant_id);

ALTER TABLE public.ot_preop_assessments ENABLE ROW LEVEL SECURITY;

-- Name: ot_preop_assessments tenant_isolation_ot_preop; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_preop ON public.ot_preop_assessments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_preop_assessments trg_ot_preop_assessments_soft_delete_144db91a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_preop_assessments_soft_delete_144db91a BEFORE DELETE ON public.ot_preop_assessments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_preop_assessments trg_ot_preop_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_preop_updated BEFORE UPDATE ON public.ot_preop_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0175_ot_preop_handoff.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Ward → OT pre-op send-off handoff. Before a patient leaves the ward for
-- surgery, the ward nurse completes a safety checklist (consent, NPO, site
-- marking, ID band, prosthetics removed, pre-op meds) and formally hands the
-- patient off to the receiving OT nurse. Distinct from ot_preop_assessments
-- (the anaesthetic clearance) — this is the nursing transfer of care.

CREATE TABLE public.ot_preop_handoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    handed_off_by uuid,
    received_by uuid,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ot_preop_handoffs ot_preop_handoffs_booking_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_handoffs
    ADD CONSTRAINT ot_preop_handoffs_booking_uniq UNIQUE (tenant_id, booking_id);

-- Name: ot_preop_handoffs ot_preop_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_handoffs
    ADD CONSTRAINT ot_preop_handoffs_pkey PRIMARY KEY (id);

CREATE INDEX idx_ot_preop_handoff_booking ON public.ot_preop_handoffs USING btree (tenant_id, booking_id);

ALTER TABLE public.ot_preop_handoffs ENABLE ROW LEVEL SECURITY;

-- Name: ot_preop_handoffs tenant_isolation_ot_preop_handoff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_preop_handoff ON public.ot_preop_handoffs USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_rooms ot_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_pkey PRIMARY KEY (id);

-- Name: ot_rooms ot_rooms_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_rooms
    ADD CONSTRAINT ot_rooms_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_ot_rooms_deleted_at_f071d2ca ON public.ot_rooms USING btree (deleted_at);

CREATE INDEX idx_ot_rooms_location_id ON public.ot_rooms USING btree (location_id);

CREATE INDEX idx_ot_rooms_status ON public.ot_rooms USING btree (tenant_id, status);

CREATE INDEX idx_ot_rooms_tenant ON public.ot_rooms USING btree (tenant_id);

ALTER TABLE public.ot_rooms ENABLE ROW LEVEL SECURITY;

-- Name: ot_rooms tenant_isolation_ot_rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_rooms ON public.ot_rooms USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_rooms trg_ot_rooms_soft_delete_f071d2ca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_rooms_soft_delete_f071d2ca BEFORE DELETE ON public.ot_rooms FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_rooms trg_ot_rooms_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_rooms_updated BEFORE UPDATE ON public.ot_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_surgeon_preferences ot_surgeon_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_pkey PRIMARY KEY (id);

-- Name: ot_surgeon_preferences ot_surgeon_preferences_tenant_id_surgeon_id_procedure_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgeon_preferences
    ADD CONSTRAINT ot_surgeon_preferences_tenant_id_surgeon_id_procedure_name_key UNIQUE (tenant_id, surgeon_id, procedure_name);

CREATE INDEX idx_ot_surgeon_preferences_deleted_at_82ff2b2a ON public.ot_surgeon_preferences USING btree (deleted_at);

CREATE INDEX idx_ot_surgeon_prefs_surgeon ON public.ot_surgeon_preferences USING btree (surgeon_id);

CREATE INDEX idx_ot_surgeon_prefs_tenant ON public.ot_surgeon_preferences USING btree (tenant_id);

ALTER TABLE public.ot_surgeon_preferences ENABLE ROW LEVEL SECURITY;

-- Name: ot_surgeon_preferences tenant_isolation_ot_surgeon_prefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_surgeon_prefs ON public.ot_surgeon_preferences USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_surgeon_preferences trg_ot_surgeon_preferences_soft_delete_82ff2b2a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_surgeon_preferences_soft_delete_82ff2b2a BEFORE DELETE ON public.ot_surgeon_preferences FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: ot_surgeon_preferences trg_ot_surgeon_prefs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_surgeon_prefs_updated BEFORE UPDATE ON public.ot_surgeon_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_pkey PRIMARY KEY (id);

-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_tenant_id_booking_id_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_tenant_id_booking_id_phase_key UNIQUE (tenant_id, booking_id, phase);

CREATE INDEX idx_ot_safety_booking ON public.ot_surgical_safety_checklists USING btree (booking_id);

CREATE INDEX idx_ot_safety_tenant ON public.ot_surgical_safety_checklists USING btree (tenant_id);

CREATE INDEX idx_ot_surgical_safety_checklists_deleted_at_24868612 ON public.ot_surgical_safety_checklists USING btree (deleted_at);

ALTER TABLE public.ot_surgical_safety_checklists ENABLE ROW LEVEL SECURITY;

-- Name: ot_surgical_safety_checklists tenant_isolation_ot_safety; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ot_safety ON public.ot_surgical_safety_checklists USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: ot_surgical_safety_checklists trg_ot_safety_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_safety_updated BEFORE UPDATE ON public.ot_surgical_safety_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: ot_surgical_safety_checklists trg_ot_surgical_safety_checklists_soft_delete_24868612; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ot_surgical_safety_checklists_soft_delete_24868612 BEFORE DELETE ON public.ot_surgical_safety_checklists FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    procedure_code text,
    indication text,
    "position" text,
    incision text,
    findings text,
    procedure_details text,
    drain_details text,
    closure_details text,
    estimated_blood_loss_ml integer,
    transfusion_given boolean DEFAULT false NOT NULL,
    immediate_postop_condition text,
    postop_instructions text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: surgeries surgeries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_pkey PRIMARY KEY (id);

CREATE INDEX idx_surgeries_deleted_at_adde85b0 ON public.surgeries USING btree (deleted_at);

CREATE INDEX idx_surgeries_patient ON public.surgeries USING btree (tenant_id, patient_id, surgery_date DESC);

ALTER TABLE ONLY public.surgeries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;

-- Name: surgeries tenant_isolation_surgeries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_surgeries ON public.surgeries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: surgeries trg_surgeries_soft_delete_adde85b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_surgeries_soft_delete_adde85b0 BEFORE DELETE ON public.surgeries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: cssd_indicator_results cssd_indicator_results_load_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_indicator_results
    ADD CONSTRAINT cssd_indicator_results_load_id_fkey FOREIGN KEY (load_id) REFERENCES public.cssd_sterilization_loads(id);

-- Name: cssd_issuances cssd_issuances_load_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_load_item_id_fkey FOREIGN KEY (load_item_id) REFERENCES public.cssd_load_items(id);

-- Name: cssd_issuances cssd_issuances_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id);

-- Name: cssd_load_items cssd_load_items_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.cssd_instruments(id);

-- Name: cssd_load_items cssd_load_items_load_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_load_id_fkey FOREIGN KEY (load_id) REFERENCES public.cssd_sterilization_loads(id) ON DELETE CASCADE;

-- Name: cssd_load_items cssd_load_items_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id);

-- Name: cssd_maintenance_logs cssd_maintenance_logs_sterilizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_maintenance_logs
    ADD CONSTRAINT cssd_maintenance_logs_sterilizer_id_fkey FOREIGN KEY (sterilizer_id) REFERENCES public.cssd_sterilizers(id);

-- Name: cssd_set_items cssd_set_items_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.cssd_instruments(id);

-- Name: cssd_set_items cssd_set_items_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id) ON DELETE CASCADE;

-- Name: cssd_sterilization_loads cssd_sterilization_loads_sterilizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_sterilizer_id_fkey FOREIGN KEY (sterilizer_id) REFERENCES public.cssd_sterilizers(id);

-- Name: ot_anesthesia_records ot_anesthesia_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_anesthesia_records
    ADD CONSTRAINT ot_anesthesia_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);

-- Name: ot_bookings ot_bookings_ot_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_bookings
    ADD CONSTRAINT ot_bookings_ot_room_id_fkey FOREIGN KEY (ot_room_id) REFERENCES public.ot_rooms(id);

-- Name: ot_case_records ot_case_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_case_records
    ADD CONSTRAINT ot_case_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);

-- Name: ot_consumable_usage ot_consumable_usage_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_consumable_usage
    ADD CONSTRAINT ot_consumable_usage_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);

-- Name: ot_postop_records ot_postop_records_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_postop_records
    ADD CONSTRAINT ot_postop_records_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);

-- Name: ot_preop_assessments ot_preop_assessments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_preop_assessments
    ADD CONSTRAINT ot_preop_assessments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);

-- Name: ot_surgical_safety_checklists ot_surgical_safety_checklists_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ot_surgical_safety_checklists
    ADD CONSTRAINT ot_surgical_safety_checklists_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.ot_bookings(id);
