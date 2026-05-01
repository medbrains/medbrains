-- ============================================================
-- MedBrains schema — module: devices
-- ============================================================

--
-- Name: device_adapter_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_adapter_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adapter_code text NOT NULL,
    manufacturer text NOT NULL,
    manufacturer_code text NOT NULL,
    model text NOT NULL,
    model_code text NOT NULL,
    device_category text NOT NULL,
    device_subcategory text,
    data_direction text DEFAULT 'producer'::text NOT NULL,
    protocol text NOT NULL,
    transport text DEFAULT 'tcp'::text NOT NULL,
    default_port integer,
    default_baud_rate integer,
    default_data_bits integer DEFAULT 8,
    default_parity text DEFAULT 'none'::text,
    default_stop_bits integer DEFAULT 1,
    default_ae_title text,
    default_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    field_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_transforms jsonb DEFAULT '[]'::jsonb NOT NULL,
    qc_recommendations jsonb DEFAULT '[]'::jsonb NOT NULL,
    known_quirks jsonb DEFAULT '[]'::jsonb NOT NULL,
    supported_tests jsonb DEFAULT '[]'::jsonb NOT NULL,
    adapter_version text DEFAULT '0.0.0'::text NOT NULL,
    sdk_version text DEFAULT '0.1.0'::text NOT NULL,
    wasm_hash text,
    wasm_size_bytes integer,
    is_verified boolean DEFAULT false NOT NULL,
    contributed_by text DEFAULT 'medbrains'::text NOT NULL,
    documentation_url text,
    download_count integer DEFAULT 0 NOT NULL,
    install_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_adapter_catalog_contributed_by_check CHECK ((contributed_by = ANY (ARRAY['medbrains'::text, 'community'::text, 'tenant'::text, 'manufacturer'::text]))),
    CONSTRAINT device_adapter_catalog_data_direction_check CHECK ((data_direction = ANY (ARRAY['producer'::text, 'consumer'::text, 'bidirectional'::text]))),
    CONSTRAINT device_adapter_catalog_default_parity_check CHECK ((default_parity = ANY (ARRAY['none'::text, 'even'::text, 'odd'::text]))),
    CONSTRAINT device_adapter_catalog_device_category_check CHECK ((device_category = ANY (ARRAY['lab_analyzer'::text, 'lab_hematology'::text, 'lab_chemistry'::text, 'lab_immunoassay'::text, 'lab_coagulation'::text, 'lab_urinalysis'::text, 'lab_blood_gas'::text, 'lab_microbiology'::text, 'patient_monitor'::text, 'ventilator'::text, 'infusion_pump'::text, 'syringe_pump'::text, 'ct_scanner'::text, 'mri_scanner'::text, 'xray'::text, 'ultrasound'::text, 'mammography'::text, 'ecg_machine'::text, 'defibrillator'::text, 'pulse_oximeter'::text, 'glucometer'::text, 'blood_bank_analyzer'::text, 'blood_gas_analyzer'::text, 'barcode_scanner'::text, 'rfid_reader'::text, 'label_printer'::text, 'wristband_printer'::text, 'cold_chain_sensor'::text, 'environment_sensor'::text, 'weighing_scale'::text, 'biometric_reader'::text, 'access_control'::text, 'pacs_server'::text, 'ris_server'::text, 'lis_server'::text, 'bedside_tablet'::text, 'queue_display'::text, 'nurse_station'::text, 'digital_signage'::text, 'self_checkin_kiosk'::text, 'wayfinding_kiosk'::text, 'pharmacy_display'::text, 'mobile_nurse'::text, 'mobile_doctor'::text, 'generic'::text, 'other'::text]))),
    CONSTRAINT device_adapter_catalog_protocol_check CHECK ((protocol = ANY (ARRAY['hl7_v2'::text, 'astm_e1381'::text, 'dicom'::text, 'serial_rs232'::text, 'rest_json'::text, 'mqtt'::text, 'tcp_raw'::text, 'file_drop'::text, 'usb_hid'::text, 'websocket'::text, 'http_api'::text, 'browser_app'::text]))),
    CONSTRAINT device_adapter_catalog_transport_check CHECK ((transport = ANY (ARRAY['tcp'::text, 'serial'::text, 'usb'::text, 'http'::text, 'mqtt'::text, 'file'::text])))
);



--
-- Name: device_config_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_config_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_instance_id uuid NOT NULL,
    change_type text NOT NULL,
    previous_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    new_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
    changed_by uuid,
    change_reason text,
    ai_confidence real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_config_history_change_type_check CHECK ((change_type = ANY (ARRAY['ai_auto_config'::text, 'human_override'::text, 'firmware_update'::text, 'recalibration'::text, 'adapter_upgrade'::text, 'initial_setup'::text])))
);



--
-- Name: device_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    adapter_code text NOT NULL,
    facility_id uuid,
    department_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    serial_number text,
    asset_tag text,
    bme_equipment_id uuid,
    hostname text,
    port integer,
    connection_string text,
    credentials jsonb DEFAULT '{}'::jsonb NOT NULL,
    protocol_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    field_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_transforms jsonb DEFAULT '[]'::jsonb NOT NULL,
    qc_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    message_filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_config_version integer DEFAULT 0 NOT NULL,
    ai_confidence real,
    human_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    config_source text DEFAULT 'manual'::text NOT NULL,
    status public.device_instance_status DEFAULT 'pending_setup'::public.device_instance_status NOT NULL,
    last_heartbeat timestamp with time zone,
    last_message_at timestamp with time zone,
    last_error text,
    error_count_24h integer DEFAULT 0 NOT NULL,
    message_count_24h integer DEFAULT 0 NOT NULL,
    bridge_agent_id uuid,
    notes text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_instances_config_source_check CHECK ((config_source = ANY (ARRAY['ai_auto'::text, 'ai_assisted'::text, 'manual'::text, 'imported'::text])))
);



--
-- Name: device_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_instance_id uuid NOT NULL,
    direction text NOT NULL,
    protocol text NOT NULL,
    raw_payload bytea,
    parsed_payload jsonb,
    mapped_data jsonb,
    processing_status public.device_message_status DEFAULT 'received'::public.device_message_status NOT NULL,
    target_module text,
    target_entity_id uuid,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 100 NOT NULL,
    next_retry_at timestamp with time zone,
    processing_duration_ms integer,
    bridge_agent_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);



--
-- Name: device_routing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_routing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    device_instance_id uuid,
    adapter_code text,
    name text NOT NULL,
    description text,
    target_module text NOT NULL,
    match_strategy text DEFAULT 'order_id'::text NOT NULL,
    match_field text NOT NULL,
    target_entity text NOT NULL,
    field_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    transform_rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    auto_verify boolean DEFAULT false NOT NULL,
    notify_on_critical boolean DEFAULT true NOT NULL,
    trigger_pipeline uuid,
    reject_duplicates boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_routing_rules_match_strategy_check CHECK ((match_strategy = ANY (ARRAY['order_id'::text, 'sample_barcode'::text, 'patient_id'::text, 'accession_number'::text, 'uhid'::text, 'custom'::text]))),
    CONSTRAINT device_routing_rules_target_module_check CHECK ((target_module = ANY (ARRAY['lab'::text, 'radiology'::text, 'vitals'::text, 'pharmacy'::text, 'blood_bank'::text, 'icu'::text, 'generic'::text])))
);



--
-- Name: device_adapter_catalog device_adapter_catalog_adapter_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_adapter_catalog
    ADD CONSTRAINT device_adapter_catalog_adapter_code_key UNIQUE (adapter_code);



--
-- Name: device_adapter_catalog device_adapter_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_adapter_catalog
    ADD CONSTRAINT device_adapter_catalog_pkey PRIMARY KEY (id);



--
-- Name: device_config_history device_config_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_pkey PRIMARY KEY (id);



--
-- Name: device_instances device_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_pkey PRIMARY KEY (id);



--
-- Name: device_instances device_instances_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: device_messages device_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_pkey PRIMARY KEY (id);



--
-- Name: device_routing_rules device_routing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_pkey PRIMARY KEY (id);



--
-- Name: idx_adapter_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adapter_catalog_category ON public.device_adapter_catalog USING btree (device_category);



--
-- Name: idx_adapter_catalog_manufacturer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adapter_catalog_manufacturer ON public.device_adapter_catalog USING btree (manufacturer_code);



--
-- Name: idx_adapter_catalog_protocol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adapter_catalog_protocol ON public.device_adapter_catalog USING btree (protocol);



--
-- Name: idx_adapter_catalog_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adapter_catalog_search ON public.device_adapter_catalog USING gin (to_tsvector('english'::regconfig, ((((manufacturer || ' '::text) || model) || ' '::text) || COALESCE(device_subcategory, ''::text))));



--
-- Name: idx_device_config_history_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_config_history_device ON public.device_config_history USING btree (device_instance_id, created_at DESC);



--
-- Name: idx_device_instances_adapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_instances_adapter ON public.device_instances USING btree (adapter_code);



--
-- Name: idx_device_instances_bridge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_instances_bridge ON public.device_instances USING btree (bridge_agent_id);



--
-- Name: idx_device_instances_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_instances_dept ON public.device_instances USING btree (department_id);



--
-- Name: idx_device_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_instances_status ON public.device_instances USING btree (tenant_id, status);



--
-- Name: idx_device_instances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_instances_tenant ON public.device_instances USING btree (tenant_id);



--
-- Name: idx_device_messages_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_messages_device ON public.device_messages USING btree (device_instance_id, created_at DESC);



--
-- Name: idx_device_messages_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_messages_retry ON public.device_messages USING btree (next_retry_at) WHERE ((processing_status = 'failed'::public.device_message_status) AND (next_retry_at IS NOT NULL));



--
-- Name: idx_device_messages_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_messages_status ON public.device_messages USING btree (processing_status) WHERE (processing_status = ANY (ARRAY['received'::public.device_message_status, 'parsed'::public.device_message_status, 'mapped'::public.device_message_status, 'failed'::public.device_message_status]));



--
-- Name: idx_device_routing_rules_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_routing_rules_active ON public.device_routing_rules USING btree (tenant_id, target_module) WHERE is_active;



--
-- Name: idx_device_routing_rules_adapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_routing_rules_adapter ON public.device_routing_rules USING btree (adapter_code);



--
-- Name: idx_device_routing_rules_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_routing_rules_device ON public.device_routing_rules USING btree (device_instance_id);



--
-- Name: idx_device_routing_rules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_routing_rules_tenant ON public.device_routing_rules USING btree (tenant_id);



--
-- Name: device_adapter_catalog trg_adapter_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_adapter_catalog_updated_at BEFORE UPDATE ON public.device_adapter_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: device_instances trg_device_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_instances_updated_at BEFORE UPDATE ON public.device_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: device_routing_rules trg_device_routing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_routing_rules_updated_at BEFORE UPDATE ON public.device_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: device_config_history device_config_history_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);



--
-- Name: device_messages device_messages_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);



--
-- Name: device_routing_rules device_routing_rules_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);



--
-- Name: device_config_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_config_history ENABLE ROW LEVEL SECURITY;


--
-- Name: device_config_history device_config_history_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_config_history_tenant ON public.device_config_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: device_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_instances ENABLE ROW LEVEL SECURITY;


--
-- Name: device_instances device_instances_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_instances_tenant ON public.device_instances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: device_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_messages ENABLE ROW LEVEL SECURITY;


--
-- Name: device_messages device_messages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_messages_tenant ON public.device_messages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: device_routing_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_routing_rules ENABLE ROW LEVEL SECURITY;


--
-- Name: device_routing_rules device_routing_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_routing_rules_tenant ON public.device_routing_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


