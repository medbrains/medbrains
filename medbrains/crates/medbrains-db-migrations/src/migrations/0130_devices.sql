-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 11
-- Drops: none
-- devices — schema.
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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_adapter_catalog_contributed_by_check CHECK ((contributed_by = ANY (ARRAY['medbrains'::text, 'community'::text, 'tenant'::text, 'manufacturer'::text]))),
    CONSTRAINT device_adapter_catalog_data_direction_check CHECK ((data_direction = ANY (ARRAY['producer'::text, 'consumer'::text, 'bidirectional'::text]))),
    CONSTRAINT device_adapter_catalog_default_parity_check CHECK ((default_parity = ANY (ARRAY['none'::text, 'even'::text, 'odd'::text]))),
    CONSTRAINT device_adapter_catalog_device_category_check CHECK ((device_category = ANY (ARRAY['lab_analyzer'::text, 'lab_hematology'::text, 'lab_chemistry'::text, 'lab_immunoassay'::text, 'lab_coagulation'::text, 'lab_urinalysis'::text, 'lab_blood_gas'::text, 'lab_microbiology'::text, 'patient_monitor'::text, 'ventilator'::text, 'infusion_pump'::text, 'syringe_pump'::text, 'ct_scanner'::text, 'mri_scanner'::text, 'xray'::text, 'ultrasound'::text, 'mammography'::text, 'ecg_machine'::text, 'defibrillator'::text, 'pulse_oximeter'::text, 'glucometer'::text, 'blood_bank_analyzer'::text, 'blood_gas_analyzer'::text, 'barcode_scanner'::text, 'rfid_reader'::text, 'label_printer'::text, 'wristband_printer'::text, 'cold_chain_sensor'::text, 'environment_sensor'::text, 'weighing_scale'::text, 'biometric_reader'::text, 'access_control'::text, 'pacs_server'::text, 'ris_server'::text, 'lis_server'::text, 'bedside_tablet'::text, 'queue_display'::text, 'nurse_station'::text, 'digital_signage'::text, 'self_checkin_kiosk'::text, 'wayfinding_kiosk'::text, 'pharmacy_display'::text, 'mobile_nurse'::text, 'mobile_doctor'::text, 'generic'::text, 'other'::text]))),
    CONSTRAINT device_adapter_catalog_protocol_check CHECK ((protocol = ANY (ARRAY['hl7_v2'::text, 'astm_e1381'::text, 'dicom'::text, 'serial_rs232'::text, 'rest_json'::text, 'mqtt'::text, 'tcp_raw'::text, 'file_drop'::text, 'usb_hid'::text, 'websocket'::text, 'http_api'::text, 'browser_app'::text]))),
    CONSTRAINT device_adapter_catalog_transport_check CHECK ((transport = ANY (ARRAY['tcp'::text, 'serial'::text, 'usb'::text, 'http'::text, 'mqtt'::text, 'file'::text])))
);

-- Name: device_adapter_catalog device_adapter_catalog_adapter_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_adapter_catalog
    ADD CONSTRAINT device_adapter_catalog_adapter_code_key UNIQUE (adapter_code);

-- Name: device_adapter_catalog device_adapter_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_adapter_catalog
    ADD CONSTRAINT device_adapter_catalog_pkey PRIMARY KEY (id);

CREATE INDEX idx_adapter_catalog_category ON public.device_adapter_catalog USING btree (device_category);

CREATE INDEX idx_adapter_catalog_manufacturer ON public.device_adapter_catalog USING btree (manufacturer_code);

CREATE INDEX idx_adapter_catalog_protocol ON public.device_adapter_catalog USING btree (protocol);

CREATE INDEX idx_adapter_catalog_search ON public.device_adapter_catalog USING gin (to_tsvector('english'::regconfig, ((((manufacturer || ' '::text) || model) || ' '::text) || COALESCE(device_subcategory, ''::text))));

CREATE INDEX idx_device_adapter_catalog_deleted_at_37216f05 ON public.device_adapter_catalog USING btree (deleted_at);

-- Name: device_adapter_catalog trg_adapter_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_adapter_catalog_updated_at BEFORE UPDATE ON public.device_adapter_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: device_adapter_catalog trg_device_adapter_catalog_soft_delete_37216f05; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_adapter_catalog_soft_delete_37216f05 BEFORE DELETE ON public.device_adapter_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_config_history_change_type_check CHECK ((change_type = ANY (ARRAY['ai_auto_config'::text, 'human_override'::text, 'firmware_update'::text, 'recalibration'::text, 'adapter_upgrade'::text, 'initial_setup'::text])))
);

-- Name: device_config_history device_config_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_pkey PRIMARY KEY (id);

CREATE INDEX idx_device_config_history_deleted_at_ece9e489 ON public.device_config_history USING btree (deleted_at);

CREATE INDEX idx_device_config_history_device ON public.device_config_history USING btree (device_instance_id, created_at DESC);

CREATE INDEX idx_device_config_history_tenant_id ON public.device_config_history USING btree (tenant_id);

ALTER TABLE public.device_config_history ENABLE ROW LEVEL SECURITY;

-- Name: device_config_history device_config_history_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_config_history_tenant ON public.device_config_history USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: device_config_history trg_device_config_history_soft_delete_ece9e489; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_config_history_soft_delete_ece9e489 BEFORE DELETE ON public.device_config_history FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_instances_config_source_check CHECK ((config_source = ANY (ARRAY['ai_auto'::text, 'ai_assisted'::text, 'manual'::text, 'imported'::text])))
);

-- Name: device_instances device_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_pkey PRIMARY KEY (id);

-- Name: device_instances device_instances_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_instances
    ADD CONSTRAINT device_instances_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_device_instances_adapter ON public.device_instances USING btree (adapter_code);

CREATE INDEX idx_device_instances_bridge ON public.device_instances USING btree (bridge_agent_id);

CREATE INDEX idx_device_instances_deleted_at_964a634f ON public.device_instances USING btree (deleted_at);

CREATE INDEX idx_device_instances_dept ON public.device_instances USING btree (department_id);

CREATE INDEX idx_device_instances_status ON public.device_instances USING btree (tenant_id, status);

CREATE INDEX idx_device_instances_tenant ON public.device_instances USING btree (tenant_id);

ALTER TABLE public.device_instances ENABLE ROW LEVEL SECURITY;

-- Name: device_instances device_instances_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_instances_tenant ON public.device_instances USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: device_instances trg_device_instances_soft_delete_964a634f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_instances_soft_delete_964a634f BEFORE DELETE ON public.device_instances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: device_instances trg_device_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_instances_updated_at BEFORE UPDATE ON public.device_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);

-- Name: device_messages device_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_pkey PRIMARY KEY (id);

CREATE INDEX idx_device_messages_deleted_at_85ee6299 ON public.device_messages USING btree (deleted_at);

CREATE INDEX idx_device_messages_device ON public.device_messages USING btree (device_instance_id, created_at DESC);

CREATE INDEX idx_device_messages_retry ON public.device_messages USING btree (next_retry_at) WHERE ((processing_status = 'failed'::public.device_message_status) AND (next_retry_at IS NOT NULL));

CREATE INDEX idx_device_messages_status ON public.device_messages USING btree (processing_status) WHERE (processing_status = ANY (ARRAY['received'::public.device_message_status, 'parsed'::public.device_message_status, 'mapped'::public.device_message_status, 'failed'::public.device_message_status]));

CREATE INDEX idx_device_messages_tenant_id ON public.device_messages USING btree (tenant_id);

ALTER TABLE public.device_messages ENABLE ROW LEVEL SECURITY;

-- Name: device_messages device_messages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_messages_tenant ON public.device_messages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: device_messages trg_device_messages_soft_delete_85ee6299; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_messages_soft_delete_85ee6299 BEFORE DELETE ON public.device_messages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: device_node_keys
-- Drops: none
-- Peer identities for direct device-to-device sync.
-- A peer-to-peer transport identifies a peer by its own public key. That key
-- proves the far end holds a private key; it proves nothing about whether the
-- device is one this hospital has admitted. Those are different questions, and
-- conflating them is how a transport becomes an authorisation system by
-- accident.
-- So a node key is never an identity on its own. It is a claim that must
-- already be bound to a paired `device_instances` row — which carries the
-- tenant, the app variant, and a status that an administrator can revoke. A key
-- with no binding here is refused before a single frame is read.
-- One key per device and one device per key: a device that rotates its key
-- replaces the row, and a key cannot be claimed by two devices.

CREATE TABLE public.device_node_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    paired_device_id uuid NOT NULL,
    node_id text NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

-- Name: device_node_keys device_node_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_node_keys
    ADD CONSTRAINT device_node_keys_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_device_node_keys_node_id ON public.device_node_keys USING btree (node_id) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX uq_device_node_keys_paired_device ON public.device_node_keys USING btree (paired_device_id) WHERE (revoked_at IS NULL);

ALTER TABLE public.device_node_keys ENABLE ROW LEVEL SECURITY;

-- Name: device_node_keys device_node_keys_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_node_keys_tenant_isolation ON public.device_node_keys USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: TABLE device_node_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.device_node_keys IS 'Binds a peer-to-peer node key to a paired device (staff phone, tablet, TV). A key that is not bound here is not admitted, however valid its cryptography.';

-- RLS-Posture: tenant-scoped
-- Device-code pairing for camera-less surfaces (RFC 8628 shape).
-- The existing flow in 0059 is admin-first: an administrator mints a token and
-- the device redeems it. That suits a phone, which can scan the QR the admin is
-- holding. A TV has no camera, so the direction has to reverse — the display
-- asks for a code, shows it, and an administrator approves it from a device
-- that does have a keyboard.
-- Two codes, as the RFC has them, because they do different jobs:
--   user_code    short and unambiguous, shown on the TV and read aloud or typed
--                by whoever approves it
--   device_code  long and secret, never displayed, the only thing that can
--                redeem the approval
-- Approving does not itself mint the JWT. The device polls, and the JWT is
-- issued to the poller holding device_code, so a shoulder-surfed user_code
-- cannot be redeemed by a bystander.

CREATE TABLE public.device_pairing_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    device_code text NOT NULL,
    user_code text NOT NULL,
    app_variant text NOT NULL,
    requested_label text NOT NULL,
    public_key_pem text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by_user_id uuid,
    approved_for_user_id uuid,
    approved_at timestamp with time zone,
    claimed_at timestamp with time zone,
    paired_device_id uuid,
    expires_at timestamp with time zone NOT NULL,
    poll_count integer DEFAULT 0 NOT NULL,
    last_polled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT device_pairing_requests_app_variant_check CHECK ((app_variant = ANY (ARRAY['staff'::text, 'tv'::text, 'vendor'::text]))),
    CONSTRAINT device_pairing_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'claimed'::text])))
);

-- Name: device_pairing_requests device_pairing_requests_device_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_requests
    ADD CONSTRAINT device_pairing_requests_device_code_key UNIQUE (device_code);

-- Name: device_pairing_requests device_pairing_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_requests
    ADD CONSTRAINT device_pairing_requests_pkey PRIMARY KEY (id);

-- Name: device_pairing_requests device_pairing_requests_user_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_requests
    ADD CONSTRAINT device_pairing_requests_user_code_key UNIQUE (user_code);

CREATE INDEX idx_device_pairing_requests_pending ON public.device_pairing_requests USING btree (status, created_at DESC);

CREATE INDEX idx_device_pairing_requests_tenant ON public.device_pairing_requests USING btree (tenant_id);

ALTER TABLE public.device_pairing_requests ENABLE ROW LEVEL SECURITY;

-- Name: device_pairing_requests tenant_isolation_device_pairing_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_device_pairing_requests ON public.device_pairing_requests USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- 0059 — Device pairing infrastructure
-- Two tables:
--   device_pairing_tokens  short-lived (5 min) one-time codes the
--                          admin generates for an unpaired device.
--                          The admin shows a QR encoding the token;
--                          the device scans, posts to /api/device-
--                          pairing/pair, and exchanges it for a
--                          cert + JWT.
--   paired_devices         long-lived registry of every device that
--                          has paired into the tenant. Cert
--                          fingerprint binds JWT issuance to device
--                          identity; revoked_at terminates
--                          authorisation immediately.
-- mTLS posture: the device generates an Ed25519 keypair locally,
-- signs a CSR with the pairing token, and the server returns the
-- signed cert + a JWT scoped to the issuing user. cert_fingerprint
-- is the SHA-256 of the device's public key in DER form.

CREATE TABLE public.device_pairing_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    used_by_device_id uuid,
    issued_by_user_id uuid NOT NULL,
    intended_device_label text NOT NULL,
    intended_app_variant text NOT NULL,
    intended_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    department_id uuid,
    location_label text,
    location_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    station_id uuid
);

-- Name: device_pairing_tokens device_pairing_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_tokens
    ADD CONSTRAINT device_pairing_tokens_pkey PRIMARY KEY (id);

-- Name: device_pairing_tokens device_pairing_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_tokens
    ADD CONSTRAINT device_pairing_tokens_token_key UNIQUE (token);

CREATE INDEX idx_device_pairing_tokens_deleted_at_4142efcd ON public.device_pairing_tokens USING btree (deleted_at);

CREATE INDEX idx_device_pairing_tokens_tenant ON public.device_pairing_tokens USING btree (tenant_id);

CREATE INDEX idx_device_pairing_tokens_token ON public.device_pairing_tokens USING btree (token);

CREATE INDEX idx_device_pairing_tokens_unused ON public.device_pairing_tokens USING btree (tenant_id, expires_at) WHERE (used_at IS NULL);

ALTER TABLE public.device_pairing_tokens ENABLE ROW LEVEL SECURITY;

-- Name: device_pairing_tokens device_pairing_tokens_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_pairing_tokens_tenant_isolation ON public.device_pairing_tokens USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: device_pairing_tokens trg_device_pairing_tokens_soft_delete_4142efcd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_pairing_tokens_soft_delete_4142efcd BEFORE DELETE ON public.device_pairing_tokens FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0286_device_push_tokens.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Expo push tokens (RFC-NOTIFICATION-SYSTEM, P4).
-- One row per (user, device) push registration. The mobile apps register their
-- Expo push token here; the notification listener sends a push via the Expo
-- Push API for backgrounded devices when a notification is created.

CREATE TABLE public.device_push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    expo_token text NOT NULL,
    platform text,
    surface text,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: device_push_tokens device_push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_push_tokens
    ADD CONSTRAINT device_push_tokens_pkey PRIMARY KEY (id);

-- Name: device_push_tokens device_push_tokens_tenant_id_user_id_expo_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_push_tokens
    ADD CONSTRAINT device_push_tokens_tenant_id_user_id_expo_token_key UNIQUE (tenant_id, user_id, expo_token);

CREATE INDEX idx_device_push_tokens_user ON public.device_push_tokens USING btree (tenant_id, user_id) WHERE (revoked = false);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Name: device_push_tokens tenant_isolation_device_push_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_device_push_tokens ON public.device_push_tokens USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT device_routing_rules_match_strategy_check CHECK ((match_strategy = ANY (ARRAY['order_id'::text, 'sample_barcode'::text, 'patient_id'::text, 'accession_number'::text, 'uhid'::text, 'custom'::text]))),
    CONSTRAINT device_routing_rules_target_module_check CHECK ((target_module = ANY (ARRAY['lab'::text, 'radiology'::text, 'vitals'::text, 'pharmacy'::text, 'blood_bank'::text, 'icu'::text, 'generic'::text])))
);

-- Name: device_routing_rules device_routing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_pkey PRIMARY KEY (id);

CREATE INDEX idx_device_routing_rules_active ON public.device_routing_rules USING btree (tenant_id, target_module) WHERE is_active;

CREATE INDEX idx_device_routing_rules_adapter ON public.device_routing_rules USING btree (adapter_code);

CREATE INDEX idx_device_routing_rules_deleted_at_54d4e75d ON public.device_routing_rules USING btree (deleted_at);

CREATE INDEX idx_device_routing_rules_device ON public.device_routing_rules USING btree (device_instance_id);

CREATE INDEX idx_device_routing_rules_tenant ON public.device_routing_rules USING btree (tenant_id);

ALTER TABLE public.device_routing_rules ENABLE ROW LEVEL SECURITY;

-- Name: device_routing_rules device_routing_rules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY device_routing_rules_tenant ON public.device_routing_rules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: device_routing_rules trg_device_routing_rules_soft_delete_54d4e75d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_routing_rules_soft_delete_54d4e75d BEFORE DELETE ON public.device_routing_rules FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: device_routing_rules trg_device_routing_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_device_routing_rules_updated_at BEFORE UPDATE ON public.device_routing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.paired_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    label text NOT NULL,
    app_variant text NOT NULL,
    cert_fingerprint text NOT NULL,
    cert_pem text NOT NULL,
    issued_to_user_id uuid,
    paired_via_token_id uuid,
    paired_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    last_seen_ip inet,
    revoked_at timestamp with time zone,
    revoked_by_user_id uuid,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    department_id uuid,
    location_label text,
    location_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    station_id uuid
);

-- Name: paired_devices paired_devices_cert_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paired_devices
    ADD CONSTRAINT paired_devices_cert_fingerprint_key UNIQUE (cert_fingerprint);

-- Name: paired_devices paired_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paired_devices
    ADD CONSTRAINT paired_devices_pkey PRIMARY KEY (id);

CREATE INDEX idx_paired_devices_active ON public.paired_devices USING btree (tenant_id, last_seen_at) WHERE (revoked_at IS NULL);

CREATE INDEX idx_paired_devices_cert_fp ON public.paired_devices USING btree (cert_fingerprint);

CREATE INDEX idx_paired_devices_deleted_at_5bc77380 ON public.paired_devices USING btree (deleted_at);

CREATE INDEX idx_paired_devices_tenant ON public.paired_devices USING btree (tenant_id);

ALTER TABLE public.paired_devices ENABLE ROW LEVEL SECURITY;

-- Name: paired_devices paired_devices_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY paired_devices_tenant_isolation ON public.paired_devices USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: paired_devices paired_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER paired_devices_updated_at BEFORE UPDATE ON public.paired_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: paired_devices trg_paired_devices_soft_delete_5bc77380; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_paired_devices_soft_delete_5bc77380 BEFORE DELETE ON public.paired_devices FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0219_vpn_devices.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- VPN device inventory (RFC-VPN-PLATFORM, Phase 1). One row per enrolled remote
-- device. The device joins the on-prem Headscale tailnet via a per-device,
-- single-use pre-auth key minted by POST /api/vpn/enroll; revoked on logout-all /
-- deprovision / role loss. Tenant-scoped RLS (app.tenant_id).

CREATE TABLE public.vpn_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    headscale_node_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone
);

-- Name: vpn_devices vpn_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vpn_devices
    ADD CONSTRAINT vpn_devices_pkey PRIMARY KEY (id);

CREATE INDEX idx_vpn_devices_tenant_user ON public.vpn_devices USING btree (tenant_id, user_id) WHERE (revoked_at IS NULL);

ALTER TABLE public.vpn_devices ENABLE ROW LEVEL SECURITY;

-- Name: vpn_devices vpn_devices_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vpn_devices_tenant_isolation ON public.vpn_devices USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: device_config_history device_config_history_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_config_history
    ADD CONSTRAINT device_config_history_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);

-- Name: device_messages device_messages_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_messages
    ADD CONSTRAINT device_messages_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);

-- Name: device_node_keys device_node_keys_paired_device_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_node_keys
    ADD CONSTRAINT device_node_keys_paired_device_fkey FOREIGN KEY (paired_device_id) REFERENCES public.paired_devices(id) ON DELETE CASCADE;

-- Name: device_pairing_requests device_pairing_requests_paired_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_requests
    ADD CONSTRAINT device_pairing_requests_paired_device_id_fkey FOREIGN KEY (paired_device_id) REFERENCES public.paired_devices(id) ON DELETE SET NULL;

-- Name: device_routing_rules device_routing_rules_device_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_routing_rules
    ADD CONSTRAINT device_routing_rules_device_instance_id_fkey FOREIGN KEY (device_instance_id) REFERENCES public.device_instances(id);

-- Name: device_pairing_tokens fk_device_pairing_tokens_used_by_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_pairing_tokens
    ADD CONSTRAINT fk_device_pairing_tokens_used_by_device FOREIGN KEY (used_by_device_id) REFERENCES public.paired_devices(id) ON DELETE SET NULL;

-- Name: paired_devices paired_devices_paired_via_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paired_devices
    ADD CONSTRAINT paired_devices_paired_via_token_id_fkey FOREIGN KEY (paired_via_token_id) REFERENCES public.device_pairing_tokens(id) ON DELETE RESTRICT;
