-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 17
-- Drops: none
-- audit — schema.
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
    notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_chain_verifications audit_chain_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_chain_verifications
    ADD CONSTRAINT audit_chain_verifications_pkey PRIMARY KEY (id);

CREATE INDEX idx_audit_chain_verifications_deleted_at_7149adc5 ON public.audit_chain_verifications USING btree (deleted_at);

CREATE INDEX idx_audit_chain_verifications_invalid ON public.audit_chain_verifications USING btree (tenant_id, started_at DESC) WHERE (valid = false);

CREATE INDEX idx_audit_chain_verifications_tenant_started ON public.audit_chain_verifications USING btree (tenant_id, started_at DESC);

ALTER TABLE public.audit_chain_verifications ENABLE ROW LEVEL SECURITY;

-- Name: audit_chain_verifications tenant_isolation_audit_chain_verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_audit_chain_verifications ON public.audit_chain_verifications USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: audit_chain_verifications trg_audit_chain_verifications_soft_delete_7149adc5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_chain_verifications_soft_delete_7149adc5 BEFORE DELETE ON public.audit_chain_verifications FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- 2) Recreate as PARTITION BY RANGE (created_at).

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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
)
PARTITION BY RANGE (created_at);

-- Name: audit_log audit_log_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey1 PRIMARY KEY (id, created_at);

CREATE INDEX idx_audit_log_deleted_at_f8ccc35e ON ONLY public.audit_log USING btree (deleted_at);

CREATE INDEX idx_audit_log_tenant_action_time ON ONLY public.audit_log USING btree (tenant_id, action, created_at DESC);

ALTER TABLE ONLY public.audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Name: audit_log audit_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT WITH CHECK (true);

-- Name: audit_log audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT USING (true);

-- Name: audit_log audit_log_hash_chain_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_log_hash_chain_trigger BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.audit_log_hash_chain();

-- Name: audit_log trg_audit_log_soft_delete_f8ccc35e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log_soft_delete_f8ccc35e BEFORE DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.audit_log_2026_07 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_07 audit_log_2026_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_07
    ADD CONSTRAINT audit_log_2026_07_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_07_deleted_at_idx ON public.audit_log_2026_07 USING btree (deleted_at);

CREATE INDEX audit_log_2026_07_tenant_id_action_created_at_idx ON public.audit_log_2026_07 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2026_08 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_08 audit_log_2026_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_08
    ADD CONSTRAINT audit_log_2026_08_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_08_deleted_at_idx ON public.audit_log_2026_08 USING btree (deleted_at);

CREATE INDEX audit_log_2026_08_tenant_id_action_created_at_idx ON public.audit_log_2026_08 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2026_09 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_09 audit_log_2026_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_09
    ADD CONSTRAINT audit_log_2026_09_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_09_deleted_at_idx ON public.audit_log_2026_09 USING btree (deleted_at);

CREATE INDEX audit_log_2026_09_tenant_id_action_created_at_idx ON public.audit_log_2026_09 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2026_10 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_10 audit_log_2026_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_10
    ADD CONSTRAINT audit_log_2026_10_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_10_deleted_at_idx ON public.audit_log_2026_10 USING btree (deleted_at);

CREATE INDEX audit_log_2026_10_tenant_id_action_created_at_idx ON public.audit_log_2026_10 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2026_11 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_11 audit_log_2026_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_11
    ADD CONSTRAINT audit_log_2026_11_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_11_deleted_at_idx ON public.audit_log_2026_11 USING btree (deleted_at);

CREATE INDEX audit_log_2026_11_tenant_id_action_created_at_idx ON public.audit_log_2026_11 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2026_12 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2026_12 audit_log_2026_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2026_12
    ADD CONSTRAINT audit_log_2026_12_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2026_12_deleted_at_idx ON public.audit_log_2026_12 USING btree (deleted_at);

CREATE INDEX audit_log_2026_12_tenant_id_action_created_at_idx ON public.audit_log_2026_12 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_01 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_01 audit_log_2027_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_01
    ADD CONSTRAINT audit_log_2027_01_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_01_deleted_at_idx ON public.audit_log_2027_01 USING btree (deleted_at);

CREATE INDEX audit_log_2027_01_tenant_id_action_created_at_idx ON public.audit_log_2027_01 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_02 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_02 audit_log_2027_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_02
    ADD CONSTRAINT audit_log_2027_02_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_02_deleted_at_idx ON public.audit_log_2027_02 USING btree (deleted_at);

CREATE INDEX audit_log_2027_02_tenant_id_action_created_at_idx ON public.audit_log_2027_02 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_03 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_03 audit_log_2027_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_03
    ADD CONSTRAINT audit_log_2027_03_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_03_deleted_at_idx ON public.audit_log_2027_03 USING btree (deleted_at);

CREATE INDEX audit_log_2027_03_tenant_id_action_created_at_idx ON public.audit_log_2027_03 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_04 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_04 audit_log_2027_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_04
    ADD CONSTRAINT audit_log_2027_04_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_04_deleted_at_idx ON public.audit_log_2027_04 USING btree (deleted_at);

CREATE INDEX audit_log_2027_04_tenant_id_action_created_at_idx ON public.audit_log_2027_04 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_05 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_05 audit_log_2027_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_05
    ADD CONSTRAINT audit_log_2027_05_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_05_deleted_at_idx ON public.audit_log_2027_05 USING btree (deleted_at);

CREATE INDEX audit_log_2027_05_tenant_id_action_created_at_idx ON public.audit_log_2027_05 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_06 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_06 audit_log_2027_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_06
    ADD CONSTRAINT audit_log_2027_06_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_06_deleted_at_idx ON public.audit_log_2027_06 USING btree (deleted_at);

CREATE INDEX audit_log_2027_06_tenant_id_action_created_at_idx ON public.audit_log_2027_06 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_2027_07 (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_2027_07 audit_log_2027_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_2027_07
    ADD CONSTRAINT audit_log_2027_07_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_2027_07_deleted_at_idx ON public.audit_log_2027_07 USING btree (deleted_at);

CREATE INDEX audit_log_2027_07_tenant_id_action_created_at_idx ON public.audit_log_2027_07 USING btree (tenant_id, action, created_at DESC);

CREATE TABLE public.audit_log_legacy (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_legacy audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_legacy
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_audit_log_action ON public.audit_log_legacy USING btree (tenant_id, action, created_at DESC);

CREATE INDEX idx_audit_log_correlation ON public.audit_log_legacy USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);

CREATE INDEX idx_audit_log_created ON public.audit_log_legacy USING btree (tenant_id, created_at);

CREATE INDEX idx_audit_log_entity ON public.audit_log_legacy USING btree (entity_type, entity_id);

CREATE INDEX idx_audit_log_entity_type ON public.audit_log_legacy USING btree (tenant_id, entity_type, created_at DESC);

CREATE INDEX idx_audit_log_legacy_deleted_at_ce2b05d5 ON public.audit_log_legacy USING btree (deleted_at);

CREATE INDEX idx_audit_log_module ON public.audit_log_legacy USING btree (tenant_id, module, created_at DESC);

CREATE INDEX idx_audit_log_tenant ON public.audit_log_legacy USING btree (tenant_id);

CREATE INDEX idx_audit_log_user ON public.audit_log_legacy USING btree (user_id);

ALTER TABLE ONLY public.audit_log_legacy FORCE ROW LEVEL SECURITY;

-- Name: audit_log_legacy audit_log_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_insert ON public.audit_log_legacy FOR INSERT WITH CHECK (true);

-- Name: audit_log_legacy audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select ON public.audit_log_legacy FOR SELECT USING (true);

-- Name: audit_log_legacy tenant_isolation_audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_audit_log ON public.audit_log_legacy USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: audit_log_legacy trg_audit_log_legacy_soft_delete_ce2b05d5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log_legacy_soft_delete_ce2b05d5 BEFORE DELETE ON public.audit_log_legacy FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- 4) Default catch-all partition for any rows outside the current window
--    (legacy backfill goes here; can be split later via DETACH+ATTACH).

CREATE TABLE public.audit_log_legacy_archive (
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
    hash_input_canonical text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: audit_log_legacy_archive audit_log_legacy_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_legacy_archive
    ADD CONSTRAINT audit_log_legacy_archive_pkey PRIMARY KEY (id, created_at);

CREATE INDEX audit_log_legacy_archive_deleted_at_idx ON public.audit_log_legacy_archive USING btree (deleted_at);

CREATE INDEX audit_log_legacy_archive_tenant_id_action_created_at_idx ON public.audit_log_legacy_archive USING btree (tenant_id, action, created_at DESC);

-- ── partition attachment ────────────────────────────────────────────
-- After every child above exists.

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_09 FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_10 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_11 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2026_12 FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_01 FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_02 FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_03 FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_04 FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_05 FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_06 FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_2027_07 FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_legacy_archive DEFAULT;

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: audit_chain_verifications audit_chain_verifications_broken_at_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_chain_verifications
    ADD CONSTRAINT audit_chain_verifications_broken_at_fkey FOREIGN KEY (broken_at) REFERENCES public.audit_log_legacy(id);
