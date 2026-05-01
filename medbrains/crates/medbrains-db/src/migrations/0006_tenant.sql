-- ============================================================
-- MedBrains schema — module: tenant
-- ============================================================

--
-- Name: tenant_db_topology; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT tenant_db_topology_deploy_mode_check CHECK ((deploy_mode = ANY (ARRAY['saas'::text, 'hybrid'::text, 'onprem'::text]))),
    CONSTRAINT tenant_db_topology_hybrid_requires_tunnel CHECK (((deploy_mode <> 'hybrid'::text) OR (tunnel_provider IS NOT NULL))),
    CONSTRAINT tenant_db_topology_topology_check CHECK ((topology = ANY (ARRAY['aurora'::text, 'patroni'::text, 'aurora_with_patroni_reads'::text, 'patroni_with_cloud_analytics'::text]))),
    CONSTRAINT tenant_db_topology_tunnel_provider_check CHECK ((tunnel_provider = ANY (ARRAY['headscale'::text, 'wss'::text, 'none'::text])))
);



--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    category text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_tenant_settings_key_length CHECK ((length(key) >= 1))
);



--
-- Name: tenant_db_topology tenant_db_topology_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_db_topology
    ADD CONSTRAINT tenant_db_topology_pkey PRIMARY KEY (tenant_id);



--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);



--
-- Name: tenant_settings tenant_settings_tenant_id_category_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_category_key_key UNIQUE (tenant_id, category, key);



--
-- Name: idx_tenant_db_topology_deploy_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_db_topology_deploy_mode ON public.tenant_db_topology USING btree (deploy_mode);



--
-- Name: idx_tenant_settings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_settings_category ON public.tenant_settings USING btree (tenant_id, category);



--
-- Name: idx_tenant_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings USING btree (tenant_id);



--
-- Name: tenant_db_topology tenant_db_topology_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_db_topology_updated_at BEFORE UPDATE ON public.tenant_db_topology FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: tenant_db_topology tenant_db_topology_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_db_topology_validate BEFORE INSERT OR UPDATE ON public.tenant_db_topology FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_db_topology();



--
-- Name: tenant_settings trg_tenant_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: tenant_db_topology; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_db_topology ENABLE ROW LEVEL SECURITY;


--
-- Name: tenant_db_topology tenant_isolation_tenant_db_topology; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tenant_db_topology ON public.tenant_db_topology USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tenant_settings tenant_isolation_tenant_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tenant_settings ON public.tenant_settings USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

