-- ============================================================
-- MedBrains schema — module: audit
-- ============================================================

--
-- Name: audit_chain_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_chain_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    rows_checked bigint DEFAULT 0 NOT NULL,
    head_hash text,
    broken_at uuid,
    valid boolean NOT NULL,
    duration_ms integer,
    triggered_by text DEFAULT 'cron'::text NOT NULL,
    notes text
);



--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    prev_hash text,
    hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_agent text,
    session_id uuid,
    module text,
    description text,
    correlation_id uuid,
    hash_input_canonical text
);



--
-- Name: audit_chain_verifications audit_chain_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_chain_verifications
    ADD CONSTRAINT audit_chain_verifications_pkey PRIMARY KEY (id);



--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);



--
-- Name: idx_audit_chain_verifications_invalid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_chain_verifications_invalid ON public.audit_chain_verifications USING btree (tenant_id, started_at DESC) WHERE (valid = false);



--
-- Name: idx_audit_chain_verifications_tenant_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_chain_verifications_tenant_started ON public.audit_chain_verifications USING btree (tenant_id, started_at DESC);



--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (tenant_id, action, created_at DESC);



--
-- Name: idx_audit_log_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_correlation ON public.audit_log USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);



--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (tenant_id, created_at);



--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);



--
-- Name: idx_audit_log_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity_type ON public.audit_log USING btree (tenant_id, entity_type, created_at DESC);



--
-- Name: idx_audit_log_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_module ON public.audit_log USING btree (tenant_id, module, created_at DESC);



--
-- Name: idx_audit_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_tenant ON public.audit_log USING btree (tenant_id);



--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);



--
-- Name: audit_chain_verifications audit_chain_verifications_broken_at_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_chain_verifications
    ADD CONSTRAINT audit_chain_verifications_broken_at_fkey FOREIGN KEY (broken_at) REFERENCES public.audit_log(id);



--
-- Name: audit_chain_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_chain_verifications ENABLE ROW LEVEL SECURITY;


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


--
-- Name: audit_chain_verifications tenant_isolation_audit_chain_verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_audit_chain_verifications ON public.audit_chain_verifications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: audit_log tenant_isolation_audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_audit_log ON public.audit_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


