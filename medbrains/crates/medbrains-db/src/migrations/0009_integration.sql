-- ============================================================
-- MedBrains schema — module: integration
-- ============================================================

--
-- Name: bridge_agents; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT bridge_agents_deployment_mode_check CHECK ((deployment_mode = ANY (ARRAY['on_premise'::text, 'cloud_sidecar'::text, 'embedded'::text]))),
    CONSTRAINT bridge_agents_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'degraded'::text])))
);



--
-- Name: connectors; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT connectors_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text])))
);



--
-- Name: custom_code_snippets; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT custom_code_snippets_language_check CHECK ((language = ANY (ARRAY['expression'::text, 'json_logic'::text, 'lua'::text])))
);



--
-- Name: event_registry; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT event_registry_phase_check CHECK ((phase = ANY (ARRAY['before'::text, 'after'::text])))
);



--
-- Name: event_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    module_code text NOT NULL,
    label text NOT NULL,
    description text,
    payload_schema jsonb DEFAULT '[]'::jsonb NOT NULL,
    entity_code text
);



--
-- Name: integration_execution_steps; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT integration_execution_steps_step_type_check CHECK ((step_type = ANY (ARRAY['enter'::text, 'execute'::text, 'retry'::text, 'complete'::text, 'fail'::text, 'skip'::text])))
);



--
-- Name: integration_executions; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT integration_executions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
);



--
-- Name: integration_node_templates; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT integration_node_templates_node_type_check CHECK ((node_type = ANY (ARRAY['trigger'::text, 'condition'::text, 'action'::text, 'transform'::text, 'delay'::text])))
);



--
-- Name: integration_pipelines; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT integration_pipelines_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text]))),
    CONSTRAINT integration_pipelines_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['internal_event'::text, 'schedule'::text, 'webhook'::text, 'manual'::text])))
);



--
-- Name: module_config; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT chk_module_config_code_length CHECK ((length(code) >= 1))
);



--
-- Name: module_entity_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_entity_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code text NOT NULL,
    entity_code text NOT NULL,
    entity_label text NOT NULL,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL
);



--
-- Name: module_sidecars; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: outbox_dlq; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_dlq (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    attempts integer NOT NULL,
    last_error text,
    moved_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.outbox_dlq FORCE ROW LEVEL SECURITY;



--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT outbox_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'retrying'::text, 'sent'::text, 'failed'::text, 'dlq'::text])))
);

ALTER TABLE ONLY public.outbox_events FORCE ROW LEVEL SECURITY;



--
-- Name: processed_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_webhooks (
    provider text NOT NULL,
    event_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    payload jsonb
);

ALTER TABLE ONLY public.processed_webhooks FORCE ROW LEVEL SECURITY;



--
-- Name: bridge_agents bridge_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bridge_agents
    ADD CONSTRAINT bridge_agents_pkey PRIMARY KEY (id);



--
-- Name: connectors connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (id);



--
-- Name: custom_code_snippets custom_code_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_pkey PRIMARY KEY (id);



--
-- Name: custom_code_snippets custom_code_snippets_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_code_snippets
    ADD CONSTRAINT custom_code_snippets_tenant_id_name_key UNIQUE (tenant_id, name);



--
-- Name: event_registry event_registry_event_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registry
    ADD CONSTRAINT event_registry_event_code_key UNIQUE (event_code);



--
-- Name: event_registry event_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_registry
    ADD CONSTRAINT event_registry_pkey PRIMARY KEY (id);



--
-- Name: event_schemas event_schemas_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_schemas
    ADD CONSTRAINT event_schemas_event_type_key UNIQUE (event_type);



--
-- Name: event_schemas event_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_schemas
    ADD CONSTRAINT event_schemas_pkey PRIMARY KEY (id);



--
-- Name: integration_execution_steps integration_execution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_execution_steps
    ADD CONSTRAINT integration_execution_steps_pkey PRIMARY KEY (id);



--
-- Name: integration_executions integration_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_pkey PRIMARY KEY (id);



--
-- Name: integration_node_templates integration_node_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_node_templates
    ADD CONSTRAINT integration_node_templates_code_key UNIQUE (code);



--
-- Name: integration_node_templates integration_node_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_node_templates
    ADD CONSTRAINT integration_node_templates_pkey PRIMARY KEY (id);



--
-- Name: integration_pipelines integration_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_pkey PRIMARY KEY (id);



--
-- Name: integration_pipelines integration_pipelines_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_pipelines
    ADD CONSTRAINT integration_pipelines_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: module_config module_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_config
    ADD CONSTRAINT module_config_pkey PRIMARY KEY (id);



--
-- Name: module_config module_config_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_config
    ADD CONSTRAINT module_config_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: module_entity_schemas module_entity_schemas_module_code_entity_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_entity_schemas
    ADD CONSTRAINT module_entity_schemas_module_code_entity_code_key UNIQUE (module_code, entity_code);



--
-- Name: module_entity_schemas module_entity_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_entity_schemas
    ADD CONSTRAINT module_entity_schemas_pkey PRIMARY KEY (id);



--
-- Name: module_sidecars module_sidecars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_pkey PRIMARY KEY (id);



--
-- Name: outbox_dlq outbox_dlq_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_dlq
    ADD CONSTRAINT outbox_dlq_pkey PRIMARY KEY (id);



--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);



--
-- Name: processed_webhooks processed_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhooks
    ADD CONSTRAINT processed_webhooks_pkey PRIMARY KEY (provider, event_id);



--
-- Name: idx_bridge_agents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bridge_agents_status ON public.bridge_agents USING btree (status) WHERE is_active;



--
-- Name: idx_bridge_agents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bridge_agents_tenant ON public.bridge_agents USING btree (tenant_id);



--
-- Name: idx_connectors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_tenant ON public.connectors USING btree (tenant_id);



--
-- Name: idx_connectors_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_type ON public.connectors USING btree (connector_type);



--
-- Name: idx_event_registry_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_registry_code ON public.event_registry USING btree (event_code);



--
-- Name: idx_event_registry_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_registry_module ON public.event_registry USING btree (module);



--
-- Name: idx_exec_steps_exec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exec_steps_exec ON public.integration_execution_steps USING btree (execution_id, created_at);



--
-- Name: idx_int_exec_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_exec_created ON public.integration_executions USING btree (created_at DESC);



--
-- Name: idx_int_exec_pipeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_exec_pipeline ON public.integration_executions USING btree (pipeline_id);



--
-- Name: idx_int_exec_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_exec_status ON public.integration_executions USING btree (tenant_id, status);



--
-- Name: idx_int_exec_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_exec_tenant ON public.integration_executions USING btree (tenant_id);



--
-- Name: idx_int_node_tpl_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_node_tpl_category ON public.integration_node_templates USING btree (category);



--
-- Name: idx_int_node_tpl_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_node_tpl_tenant ON public.integration_node_templates USING btree (tenant_id);



--
-- Name: idx_int_node_tpl_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_node_tpl_type ON public.integration_node_templates USING btree (node_type);



--
-- Name: idx_int_pipelines_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_pipelines_status ON public.integration_pipelines USING btree (tenant_id, status);



--
-- Name: idx_int_pipelines_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_pipelines_tenant ON public.integration_pipelines USING btree (tenant_id);



--
-- Name: idx_int_pipelines_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_pipelines_trigger ON public.integration_pipelines USING btree (tenant_id, trigger_type);



--
-- Name: idx_int_pipelines_trigger_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_int_pipelines_trigger_config ON public.integration_pipelines USING gin (trigger_config);



--
-- Name: idx_module_config_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_module_config_tenant ON public.module_config USING btree (tenant_id);



--
-- Name: idx_module_sidecars_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_module_sidecars_lookup ON public.module_sidecars USING btree (tenant_id, module_code, context_code) WHERE is_active;



--
-- Name: idx_module_sidecars_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_module_sidecars_tenant ON public.module_sidecars USING btree (tenant_id);



--
-- Name: idx_outbox_dlq_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_dlq_event_type ON public.outbox_dlq USING btree (tenant_id, event_type, moved_at DESC);



--
-- Name: idx_outbox_dlq_tenant_moved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_dlq_tenant_moved ON public.outbox_dlq USING btree (tenant_id, moved_at DESC);



--
-- Name: idx_processed_webhooks_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_webhooks_received ON public.processed_webhooks USING btree (received_at DESC);



--
-- Name: idx_processed_webhooks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_webhooks_tenant ON public.processed_webhooks USING btree (tenant_id, received_at DESC) WHERE (tenant_id IS NOT NULL);



--
-- Name: outbox_events_aggregate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_events_aggregate ON public.outbox_events USING btree (tenant_id, aggregate_type, aggregate_id);



--
-- Name: outbox_events_drain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_events_drain ON public.outbox_events USING btree (tenant_id, next_retry_at) WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]));



--
-- Name: outbox_events_idemp; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX outbox_events_idemp ON public.outbox_events USING btree (tenant_id, event_type, idempotency_key) WHERE (idempotency_key IS NOT NULL);



--
-- Name: outbox_events_stale_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_events_stale_claim ON public.outbox_events USING btree (claimed_at) WHERE ((status = 'retrying'::text) AND (claimed_at IS NOT NULL));



--
-- Name: bridge_agents trg_bridge_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bridge_agents_updated_at BEFORE UPDATE ON public.bridge_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: connectors trg_connectors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_connectors_updated_at BEFORE UPDATE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: custom_code_snippets trg_custom_code_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_custom_code_updated_at BEFORE UPDATE ON public.custom_code_snippets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: integration_pipelines trg_integration_pipelines_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integration_pipelines_updated_at BEFORE UPDATE ON public.integration_pipelines FOR EACH ROW EXECUTE FUNCTION public.update_integration_pipelines_updated_at();



--
-- Name: module_config trg_module_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_module_config_updated_at BEFORE UPDATE ON public.module_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: integration_execution_steps integration_execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_execution_steps
    ADD CONSTRAINT integration_execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.integration_executions(id) ON DELETE CASCADE;



--
-- Name: integration_executions integration_executions_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id) ON DELETE CASCADE;



--
-- Name: module_sidecars module_sidecars_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_sidecars
    ADD CONSTRAINT module_sidecars_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.integration_pipelines(id) ON DELETE SET NULL;



--
-- Name: bridge_agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bridge_agents ENABLE ROW LEVEL SECURITY;


--
-- Name: bridge_agents bridge_agents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_agents_tenant ON public.bridge_agents USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: connectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;


--
-- Name: connectors connectors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connectors_tenant ON public.connectors USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: custom_code_snippets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_code_snippets ENABLE ROW LEVEL SECURITY;


--
-- Name: custom_code_snippets custom_code_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY custom_code_tenant ON public.custom_code_snippets USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: integration_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_executions ENABLE ROW LEVEL SECURITY;


--
-- Name: integration_executions integration_executions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_executions_tenant ON public.integration_executions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: integration_node_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_node_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: integration_node_templates integration_node_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_node_templates_tenant ON public.integration_node_templates USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));



--
-- Name: integration_pipelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integration_pipelines ENABLE ROW LEVEL SECURITY;


--
-- Name: integration_pipelines integration_pipelines_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY integration_pipelines_tenant ON public.integration_pipelines USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: module_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_config ENABLE ROW LEVEL SECURITY;


--
-- Name: module_sidecars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_sidecars ENABLE ROW LEVEL SECURITY;


--
-- Name: module_sidecars module_sidecars_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_sidecars_tenant_isolation ON public.module_sidecars USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: outbox_dlq; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_dlq ENABLE ROW LEVEL SECURITY;


--
-- Name: outbox_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;


--
-- Name: processed_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;


--
-- Name: processed_webhooks processed_webhooks_dedup_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processed_webhooks_dedup_read ON public.processed_webhooks FOR SELECT USING (true);



--
-- Name: processed_webhooks processed_webhooks_dedup_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processed_webhooks_dedup_write ON public.processed_webhooks FOR INSERT WITH CHECK (true);



--
-- Name: module_config tenant_isolation_module_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_module_config ON public.module_config USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: outbox_dlq tenant_isolation_outbox_dlq; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_outbox_dlq ON public.outbox_dlq USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: outbox_events tenant_isolation_outbox_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_outbox_events ON public.outbox_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


