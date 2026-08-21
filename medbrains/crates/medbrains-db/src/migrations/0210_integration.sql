-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 19
-- Drops: none
-- integration — schema.
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



-- ── HIP-relay callback log ──────────────────────────────────────────
-- The cloud relay records every gateway callback so the on-prem
-- server can pick them up over the tailnet on its next sweep.

CREATE TABLE public.abdm_gateway_callbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    callback_type text NOT NULL,
    payload jsonb NOT NULL,
    forwarded_at timestamp with time zone,
    forward_attempts integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: abdm_gateway_callbacks abdm_gateway_callbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abdm_gateway_callbacks
    ADD CONSTRAINT abdm_gateway_callbacks_pkey PRIMARY KEY (id);

CREATE INDEX idx_abdm_callbacks_tenant_pending ON public.abdm_gateway_callbacks USING btree (tenant_id, received_at DESC) WHERE (forwarded_at IS NULL);

CREATE INDEX idx_abdm_gateway_callbacks_deleted_at_48b5211d ON public.abdm_gateway_callbacks USING btree (deleted_at);

ALTER TABLE public.abdm_gateway_callbacks ENABLE ROW LEVEL SECURITY;

-- Name: abdm_gateway_callbacks tenant_isolation_abdm_gateway_callbacks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_abdm_gateway_callbacks ON public.abdm_gateway_callbacks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: abdm_gateway_callbacks trg_abdm_gateway_callbacks_soft_delete_48b5211d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_abdm_gateway_callbacks_soft_delete_48b5211d BEFORE DELETE ON public.abdm_gateway_callbacks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── HFR registration audit ──────────────────────────────────────────
-- One-row-per-attempt log of ABDM HFR (facility registration)
-- exchanges. Distinct from insurance_claims; used by
-- routes/abdm/hfr.rs to retry / surface errors.

CREATE TABLE public.abdm_hfr_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    nha_facility_id text,
    error_message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT abdm_hfr_registrations_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'failed'::text])))
);

-- Name: abdm_hfr_registrations abdm_hfr_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abdm_hfr_registrations
    ADD CONSTRAINT abdm_hfr_registrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_abdm_hfr_registrations_deleted_at_4dbad397 ON public.abdm_hfr_registrations USING btree (deleted_at);

CREATE INDEX idx_abdm_hfr_tenant ON public.abdm_hfr_registrations USING btree (tenant_id, submitted_at DESC);

ALTER TABLE public.abdm_hfr_registrations ENABLE ROW LEVEL SECURITY;

-- Name: abdm_hfr_registrations tenant_isolation_abdm_hfr_registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_abdm_hfr_registrations ON public.abdm_hfr_registrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: abdm_hfr_registrations trg_abdm_hfr_registrations_soft_delete_4dbad397; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_abdm_hfr_registrations_soft_delete_4dbad397 BEFORE DELETE ON public.abdm_hfr_registrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: abdm_hfr_registrations trg_abdm_hfr_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_abdm_hfr_touch BEFORE UPDATE ON public.abdm_hfr_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bridge_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    agent_key_hash text NOT NULL,
    deployment_mode text DEFAULT 'on_premise'::text NOT NULL,
    version text,
    hostname text,
    capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'offline'::text NOT NULL,
    last_heartbeat timestamp with time zone,
    devices_connected integer DEFAULT 0 NOT NULL,
    buffer_depth integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT bridge_agents_deployment_mode_check CHECK ((deployment_mode = ANY (ARRAY['on_premise'::text, 'cloud_sidecar'::text, 'embedded'::text]))),
    CONSTRAINT bridge_agents_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'degraded'::text])))
);

-- Name: bridge_agents bridge_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bridge_agents
    ADD CONSTRAINT bridge_agents_pkey PRIMARY KEY (id);

CREATE INDEX idx_bridge_agents_deleted_at_3c75c4c7 ON public.bridge_agents USING btree (deleted_at);

CREATE INDEX idx_bridge_agents_status ON public.bridge_agents USING btree (status) WHERE is_active;

CREATE INDEX idx_bridge_agents_tenant ON public.bridge_agents USING btree (tenant_id);

ALTER TABLE public.bridge_agents ENABLE ROW LEVEL SECURITY;

-- Name: bridge_agents bridge_agents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_agents_tenant ON public.bridge_agents USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: bridge_agents trg_bridge_agents_soft_delete_3c75c4c7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bridge_agents_soft_delete_3c75c4c7 BEFORE DELETE ON public.bridge_agents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bridge_agents trg_bridge_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bridge_agents_updated_at BEFORE UPDATE ON public.bridge_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    connector_type text NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    health_check_url text,
    last_health_check timestamp with time zone,
    is_healthy boolean DEFAULT true,
    retry_config jsonb DEFAULT '{"backoff_ms": 1000, "max_retries": 3, "backoff_multiplier": 2}'::jsonb NOT NULL,
    rate_limit jsonb DEFAULT '{"requests_per_minute": 60}'::jsonb NOT NULL,
    stats jsonb DEFAULT '{"success": 0, "failures": 0, "total_calls": 0}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT connectors_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text])))
);

-- Name: connectors connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (id);

CREATE INDEX idx_connectors_deleted_at_faac6c14 ON public.connectors USING btree (deleted_at);

CREATE INDEX idx_connectors_tenant ON public.connectors USING btree (tenant_id);

CREATE INDEX idx_connectors_type ON public.connectors USING btree (connector_type);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

-- Name: connectors connectors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connectors_tenant ON public.connectors USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: connectors trg_connectors_soft_delete_faac6c14; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_connectors_soft_delete_faac6c14 BEFORE DELETE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: connectors trg_connectors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_connectors_updated_at BEFORE UPDATE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.custom_code_snippets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    language text DEFAULT 'expression'::text NOT NULL,
    code text NOT NULL,
    input_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT custom_code_snippets_language_check CHECK ((language = ANY (ARRAY['expression'::text, 'json_logic'::text, 'lua'::text])))
);

-- Name: custom_code_snippets custom_code_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_pkey PRIMARY KEY (id);

-- Name: custom_code_snippets custom_code_snippets_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_tenant_id_name_key UNIQUE (tenant_id, name);

CREATE INDEX idx_custom_code_snippets_deleted_at_ae580c24 ON public.custom_code_snippets USING btree (deleted_at);

ALTER TABLE public.custom_code_snippets ENABLE ROW LEVEL SECURITY;

-- Name: custom_code_snippets custom_code_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_code_tenant ON public.custom_code_snippets USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: custom_code_snippets trg_custom_code_snippets_soft_delete_ae580c24; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_custom_code_snippets_soft_delete_ae580c24 BEFORE DELETE ON public.custom_code_snippets FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: custom_code_snippets trg_custom_code_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_custom_code_updated_at BEFORE UPDATE ON public.custom_code_snippets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.event_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    entity text NOT NULL,
    action text NOT NULL,
    event_code text NOT NULL,
    description text,
    payload_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    phase text DEFAULT 'after'::text NOT NULL,
    is_blocking boolean DEFAULT false NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT event_registry_phase_check CHECK ((phase = ANY (ARRAY['before'::text, 'after'::text])))
);

-- Name: event_registry event_registry_event_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registry
    ADD CONSTRAINT event_registry_event_code_key UNIQUE (event_code);

-- Name: event_registry event_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registry
    ADD CONSTRAINT event_registry_pkey PRIMARY KEY (id);

CREATE INDEX idx_event_registry_code ON public.event_registry USING btree (event_code);

CREATE INDEX idx_event_registry_deleted_at_6f060805 ON public.event_registry USING btree (deleted_at);

CREATE INDEX idx_event_registry_module ON public.event_registry USING btree (module);

-- Name: event_registry trg_event_registry_soft_delete_6f060805; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_event_registry_soft_delete_6f060805 BEFORE DELETE ON public.event_registry FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.event_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    module_code text NOT NULL,
    label text NOT NULL,
    description text,
    payload_schema jsonb DEFAULT '[]'::jsonb NOT NULL,
    entity_code text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: event_schemas event_schemas_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_schemas
    ADD CONSTRAINT event_schemas_event_type_key UNIQUE (event_type);

-- Name: event_schemas event_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_schemas
    ADD CONSTRAINT event_schemas_pkey PRIMARY KEY (id);

CREATE INDEX idx_event_schemas_deleted_at_00bbfd09 ON public.event_schemas USING btree (deleted_at);

-- Name: event_schemas trg_event_schemas_soft_delete_00bbfd09; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_event_schemas_soft_delete_00bbfd09 BEFORE DELETE ON public.event_schemas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.integration_execution_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    node_id text NOT NULL,
    node_label text,
    step_type text NOT NULL,
    input_data jsonb,
    output_data jsonb,
    error text,
    duration_ms integer,
    retry_attempt integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT integration_execution_steps_step_type_check CHECK ((step_type = ANY (ARRAY['enter'::text, 'execute'::text, 'retry'::text, 'complete'::text, 'fail'::text, 'skip'::text])))
);

-- Name: integration_execution_steps integration_execution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_execution_steps
    ADD CONSTRAINT integration_execution_steps_pkey PRIMARY KEY (id);

CREATE INDEX idx_exec_steps_exec ON public.integration_execution_steps USING btree (execution_id, created_at);

CREATE INDEX idx_integration_execution_steps_deleted_at_06f5a70c ON public.integration_execution_steps USING btree (deleted_at);

-- Name: integration_execution_steps trg_integration_execution_steps_soft_delete_06f5a70c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_execution_steps_soft_delete_06f5a70c BEFORE DELETE ON public.integration_execution_steps FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.integration_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pipeline_id uuid NOT NULL,
    pipeline_version integer DEFAULT 1 NOT NULL,
    trigger_event text,
    status text DEFAULT 'pending'::text NOT NULL,
    input_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    node_results jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    triggered_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT integration_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);

-- Name: integration_executions integration_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_pkey PRIMARY KEY (id);

CREATE INDEX idx_int_exec_created ON public.integration_executions USING btree (created_at DESC);

CREATE INDEX idx_int_exec_pipeline ON public.integration_executions USING btree (pipeline_id);

CREATE INDEX idx_int_exec_status ON public.integration_executions USING btree (tenant_id, status);

CREATE INDEX idx_int_exec_tenant ON public.integration_executions USING btree (tenant_id);

CREATE INDEX idx_integration_executions_deleted_at_27170c34 ON public.integration_executions USING btree (deleted_at);

ALTER TABLE public.integration_executions ENABLE ROW LEVEL SECURITY;

-- Name: integration_executions integration_executions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_executions_tenant ON public.integration_executions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: integration_executions trg_integration_executions_soft_delete_27170c34; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_executions_soft_delete_27170c34 BEFORE DELETE ON public.integration_executions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.integration_node_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    node_type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    color text,
    category text NOT NULL,
    config_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    output_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT integration_node_templates_node_type_check CHECK ((node_type = ANY (ARRAY['trigger'::text, 'condition'::text, 'action'::text, 'transform'::text, 'delay'::text])))
);

-- Name: integration_node_templates integration_node_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_node_templates
    ADD CONSTRAINT integration_node_templates_code_key UNIQUE (code);

-- Name: integration_node_templates integration_node_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_node_templates
    ADD CONSTRAINT integration_node_templates_pkey PRIMARY KEY (id);

CREATE INDEX idx_int_node_tpl_category ON public.integration_node_templates USING btree (category);

CREATE INDEX idx_int_node_tpl_tenant ON public.integration_node_templates USING btree (tenant_id);

CREATE INDEX idx_int_node_tpl_type ON public.integration_node_templates USING btree (node_type);

CREATE INDEX idx_integration_node_templates_deleted_at_160c8dbc ON public.integration_node_templates USING btree (deleted_at);

ALTER TABLE public.integration_node_templates ENABLE ROW LEVEL SECURITY;

-- Name: integration_node_templates integration_node_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_node_templates_tenant ON public.integration_node_templates USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: integration_node_templates trg_integration_node_templates_soft_delete_160c8dbc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_node_templates_soft_delete_160c8dbc BEFORE DELETE ON public.integration_node_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.integration_pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    edges jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT integration_pipelines_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT integration_pipelines_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['internal_event'::text, 'schedule'::text, 'webhook'::text, 'manual'::text])))
);

-- Name: integration_pipelines integration_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_pkey PRIMARY KEY (id);

-- Name: integration_pipelines integration_pipelines_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_int_pipelines_status ON public.integration_pipelines USING btree (tenant_id, status);

CREATE INDEX idx_int_pipelines_tenant ON public.integration_pipelines USING btree (tenant_id);

CREATE INDEX idx_int_pipelines_trigger ON public.integration_pipelines USING btree (tenant_id, trigger_type);

CREATE INDEX idx_int_pipelines_trigger_config ON public.integration_pipelines USING gin (trigger_config);

CREATE INDEX idx_integration_pipelines_deleted_at_68a01ed9 ON public.integration_pipelines USING btree (deleted_at);

ALTER TABLE public.integration_pipelines ENABLE ROW LEVEL SECURITY;

-- Name: integration_pipelines integration_pipelines_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_pipelines_tenant ON public.integration_pipelines USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: integration_pipelines trg_integration_pipelines_soft_delete_68a01ed9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_pipelines_soft_delete_68a01ed9 BEFORE DELETE ON public.integration_pipelines FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: integration_pipelines trg_integration_pipelines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_pipelines_updated_at BEFORE UPDATE ON public.integration_pipelines FOR EACH ROW EXECUTE FUNCTION public.update_integration_pipelines_updated_at();

CREATE TABLE public.module_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status public.module_status DEFAULT 'available'::public.module_status NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    depends_on text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_module_config_code_length CHECK ((length(code) >= 1))
);

-- Name: module_config module_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_config
    ADD CONSTRAINT module_config_pkey PRIMARY KEY (id);

-- Name: module_config module_config_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_config
    ADD CONSTRAINT module_config_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_module_config_deleted_at_949b5b1d ON public.module_config USING btree (deleted_at);

CREATE INDEX idx_module_config_tenant ON public.module_config USING btree (tenant_id);

ALTER TABLE public.module_config ENABLE ROW LEVEL SECURITY;

-- Name: module_config tenant_isolation_module_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_module_config ON public.module_config USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: module_config trg_module_config_soft_delete_949b5b1d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_module_config_soft_delete_949b5b1d BEFORE DELETE ON public.module_config FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: module_config trg_module_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_module_config_updated_at BEFORE UPDATE ON public.module_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.module_entity_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    entity_code text NOT NULL,
    entity_label text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: module_entity_schemas module_entity_schemas_module_code_entity_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_entity_schemas
    ADD CONSTRAINT module_entity_schemas_module_code_entity_code_key UNIQUE (module_code, entity_code);

-- Name: module_entity_schemas module_entity_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_entity_schemas
    ADD CONSTRAINT module_entity_schemas_pkey PRIMARY KEY (id);

CREATE INDEX idx_module_entity_schemas_deleted_at_47f721c3 ON public.module_entity_schemas USING btree (deleted_at);

-- Name: module_entity_schemas trg_module_entity_schemas_soft_delete_47f721c3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_module_entity_schemas_soft_delete_47f721c3 BEFORE DELETE ON public.module_entity_schemas FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.module_sidecars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    module_code text NOT NULL,
    context_code text NOT NULL,
    name text NOT NULL,
    trigger_event public.sidecar_trigger NOT NULL,
    pipeline_id uuid,
    inline_action jsonb,
    condition jsonb,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: module_sidecars module_sidecars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_pkey PRIMARY KEY (id);

CREATE INDEX idx_module_sidecars_deleted_at_9bcbf480 ON public.module_sidecars USING btree (deleted_at);

CREATE INDEX idx_module_sidecars_lookup ON public.module_sidecars USING btree (tenant_id, module_code, context_code) WHERE is_active;

CREATE INDEX idx_module_sidecars_tenant ON public.module_sidecars USING btree (tenant_id);

ALTER TABLE public.module_sidecars ENABLE ROW LEVEL SECURITY;

-- Name: module_sidecars module_sidecars_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_sidecars_tenant_isolation ON public.module_sidecars USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: module_sidecars trg_module_sidecars_soft_delete_9bcbf480; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_module_sidecars_soft_delete_9bcbf480 BEFORE DELETE ON public.module_sidecars FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- NHCX webhook receipt log.
-- Every callback the gateway delivers (preauth/on_submit, claim/on_submit,
-- coverageeligibility/on_check) is recorded here verbatim so operators can
-- audit what NHCX sent — independent of whether we successfully matched
-- the correlation_id to a local claim/preauth row.
-- Schema: keep the raw envelope, the decrypted payload, and the matched
-- target (if any). Verification result is stored so we can spot tampered
-- callbacks during a post-mortem.

CREATE TABLE public.nhcx_callback_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    api_call_id uuid,
    sender_code text,
    recipient_code text,
    callback_type text,
    raw_envelope jsonb,
    decrypted_payload jsonb,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    matched_table text,
    matched_id uuid,
    error_detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: nhcx_callback_log nhcx_callback_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhcx_callback_log
    ADD CONSTRAINT nhcx_callback_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_nhcx_callback_log_correlation ON public.nhcx_callback_log USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);

CREATE INDEX idx_nhcx_callback_log_deleted_at_b42c2ac8 ON public.nhcx_callback_log USING btree (deleted_at);

CREATE INDEX idx_nhcx_callback_log_match ON public.nhcx_callback_log USING btree (matched_table, matched_id) WHERE (matched_id IS NOT NULL);

CREATE INDEX idx_nhcx_callback_log_tenant ON public.nhcx_callback_log USING btree (tenant_id, received_at DESC);

ALTER TABLE public.nhcx_callback_log ENABLE ROW LEVEL SECURITY;

-- Name: nhcx_callback_log tenant_isolation_nhcx_callback_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_nhcx_callback_log ON public.nhcx_callback_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: nhcx_callback_log trg_nhcx_callback_log_soft_delete_b42c2ac8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_nhcx_callback_log_soft_delete_b42c2ac8 BEFORE DELETE ON public.nhcx_callback_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0223_nhcx_participants.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- NHCX payer directory. The payer/TPA participants known to NHCX, keyed by their HCX
-- participant code (= the `recipient_code` for claim submission). Populated by the
-- fetch/participants/list sync (or maintained manually); the claim-submit flow resolves
-- recipient_code from here instead of taking it as a per-submit manual field. Tenant RLS.

CREATE TABLE public.nhcx_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    participant_code text NOT NULL,
    participant_name text NOT NULL,
    role text DEFAULT 'PAYER'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    raw jsonb,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: nhcx_participants nhcx_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhcx_participants
    ADD CONSTRAINT nhcx_participants_pkey PRIMARY KEY (id);

-- Name: nhcx_participants nhcx_participants_tenant_id_participant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nhcx_participants
    ADD CONSTRAINT nhcx_participants_tenant_id_participant_code_key UNIQUE (tenant_id, participant_code);

CREATE INDEX idx_nhcx_participants_tenant ON public.nhcx_participants USING btree (tenant_id, role);

ALTER TABLE public.nhcx_participants ENABLE ROW LEVEL SECURITY;

-- Name: nhcx_participants nhcx_participants_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nhcx_participants_tenant_isolation ON public.nhcx_participants USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: nhcx_participants nhcx_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER nhcx_participants_updated_at BEFORE UPDATE ON public.nhcx_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.outbox_dlq (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    attempts integer NOT NULL,
    last_error text,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: outbox_dlq outbox_dlq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dlq
    ADD CONSTRAINT outbox_dlq_pkey PRIMARY KEY (id);

CREATE INDEX idx_outbox_dlq_deleted_at_fa2fec5f ON public.outbox_dlq USING btree (deleted_at);

CREATE INDEX idx_outbox_dlq_event_type ON public.outbox_dlq USING btree (tenant_id, event_type, moved_at DESC);

CREATE INDEX idx_outbox_dlq_tenant_moved ON public.outbox_dlq USING btree (tenant_id, moved_at DESC);

ALTER TABLE ONLY public.outbox_dlq FORCE ROW LEVEL SECURITY;

ALTER TABLE public.outbox_dlq ENABLE ROW LEVEL SECURITY;

-- Name: outbox_dlq tenant_isolation_outbox_dlq; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_outbox_dlq ON public.outbox_dlq USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: outbox_dlq trg_outbox_dlq_soft_delete_fa2fec5f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_outbox_dlq_soft_delete_fa2fec5f BEFORE DELETE ON public.outbox_dlq FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    last_error text,
    dlq_at timestamp with time zone,
    idempotency_key text,
    claimed_at timestamp with time zone,
    claimed_by text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT outbox_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'retrying'::text, 'sent'::text, 'failed'::text, 'dlq'::text])))
);

-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_outbox_events_deleted_at_6c927db9 ON public.outbox_events USING btree (deleted_at);

CREATE INDEX idx_outbox_events_tenant_status ON public.outbox_events USING btree (tenant_id, status);

CREATE INDEX outbox_events_aggregate ON public.outbox_events USING btree (tenant_id, aggregate_type, aggregate_id);

CREATE INDEX outbox_events_drain ON public.outbox_events USING btree (tenant_id, next_retry_at) WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]));

CREATE UNIQUE INDEX outbox_events_idemp ON public.outbox_events USING btree (tenant_id, event_type, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX outbox_events_stale_claim ON public.outbox_events USING btree (claimed_at) WHERE ((status = 'retrying'::text) AND (claimed_at IS NOT NULL));

ALTER TABLE ONLY public.outbox_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- Name: outbox_events tenant_isolation_outbox_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_outbox_events ON public.outbox_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: outbox_events trg_outbox_events_soft_delete_6c927db9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_outbox_events_soft_delete_6c927db9 BEFORE DELETE ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.processed_webhooks (
    provider text NOT NULL,
    event_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    payload jsonb,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: processed_webhooks processed_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_pkey PRIMARY KEY (provider, event_id);

CREATE INDEX idx_processed_webhooks_deleted_at_c87958f5 ON public.processed_webhooks USING btree (deleted_at);

CREATE INDEX idx_processed_webhooks_received ON public.processed_webhooks USING btree (received_at DESC);

CREATE INDEX idx_processed_webhooks_tenant ON public.processed_webhooks USING btree (tenant_id, received_at DESC) WHERE (tenant_id IS NOT NULL);

ALTER TABLE ONLY public.processed_webhooks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Name: processed_webhooks processed_webhooks_dedup_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processed_webhooks_dedup_read ON public.processed_webhooks FOR SELECT USING (true);

-- Name: processed_webhooks processed_webhooks_dedup_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processed_webhooks_dedup_write ON public.processed_webhooks FOR INSERT WITH CHECK (true);

-- Name: processed_webhooks trg_processed_webhooks_soft_delete_c87958f5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_processed_webhooks_soft_delete_c87958f5 BEFORE DELETE ON public.processed_webhooks FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: integration_execution_steps integration_execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_execution_steps
    ADD CONSTRAINT integration_execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.integration_executions(id) ON DELETE CASCADE;

-- Name: integration_executions integration_executions_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id) ON DELETE CASCADE;

-- Name: module_sidecars module_sidecars_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id) ON DELETE SET NULL;
