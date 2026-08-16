-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 53
-- Drops: none
-- auth — schema.
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



CREATE TABLE public.access_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_type text NOT NULL,
    module text,
    ip_address text,
    is_authorized boolean,
    alert_sent boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: access_alerts access_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_access_alerts_deleted_at_2b8915af ON public.access_alerts USING btree (deleted_at);

CREATE INDEX idx_access_alerts_tenant ON public.access_alerts USING btree (tenant_id, created_at DESC);

ALTER TABLE ONLY public.access_alerts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.access_alerts ENABLE ROW LEVEL SECURITY;

-- Name: access_alerts tenant_isolation_access_alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_alerts ON public.access_alerts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: access_alerts trg_access_alerts_soft_delete_2b8915af; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_access_alerts_soft_delete_2b8915af BEFORE DELETE ON public.access_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.access_group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    added_by uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    source text DEFAULT 'manual'::text NOT NULL
);

-- Name: access_group_members access_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_pkey PRIMARY KEY (group_id, user_id);

CREATE INDEX idx_access_group_members_deleted_at_53ebaac9 ON public.access_group_members USING btree (deleted_at);

CREATE INDEX idx_agm_user ON public.access_group_members USING btree (tenant_id, user_id) WHERE (expires_at IS NULL);

CREATE INDEX idx_agm_user_expiring ON public.access_group_members USING btree (tenant_id, user_id, expires_at) WHERE (expires_at IS NOT NULL);

ALTER TABLE public.access_group_members ENABLE ROW LEVEL SECURITY;

-- Name: access_group_members tenant_isolation_access_group_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_group_members ON public.access_group_members USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: access_group_members trg_access_group_members_soft_delete_53ebaac9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_access_group_members_soft_delete_53ebaac9 BEFORE DELETE ON public.access_group_members FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: access_group_members trg_bump_perm_version_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bump_perm_version_membership AFTER INSERT OR DELETE OR UPDATE ON public.access_group_members FOR EACH ROW EXECUTE FUNCTION public.bump_perm_version_on_membership();

CREATE TABLE public.access_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    priority integer DEFAULT 0 NOT NULL
);

-- Name: access_groups access_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_pkey PRIMARY KEY (id);

-- Name: access_groups access_groups_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_access_groups_deleted_at_bd8c8156 ON public.access_groups USING btree (deleted_at);

CREATE INDEX idx_access_groups_tenant ON public.access_groups USING btree (tenant_id) WHERE (is_active = true);

ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;

-- Name: access_groups tenant_isolation_access_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_access_groups ON public.access_groups USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: access_groups trg_access_groups_soft_delete_bd8c8156; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_access_groups_soft_delete_bd8c8156 BEFORE DELETE ON public.access_groups FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: access_groups trg_bump_perm_version_group; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bump_perm_version_group AFTER UPDATE ON public.access_groups FOR EACH ROW EXECUTE FUNCTION public.bump_perm_version_on_group_change();

CREATE TABLE public.access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    patient_id uuid,
    action text DEFAULT 'view'::text NOT NULL,
    ip_address text,
    user_agent text,
    module text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: access_log access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_access_log_correlation ON public.access_log USING btree (correlation_id) WHERE (correlation_id IS NOT NULL);

CREATE INDEX idx_access_log_deleted_at_47f52ded ON public.access_log USING btree (deleted_at);

CREATE INDEX idx_access_log_entity ON public.access_log USING btree (entity_type, entity_id);

CREATE INDEX idx_access_log_patient ON public.access_log USING btree (tenant_id, patient_id, created_at DESC);

CREATE INDEX idx_access_log_patient_id ON public.access_log USING btree (patient_id);

CREATE INDEX idx_access_log_tenant ON public.access_log USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_access_log_user ON public.access_log USING btree (tenant_id, user_id, created_at DESC);

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

-- Name: access_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.access_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: access_log trg_access_log_soft_delete_47f52ded; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_access_log_soft_delete_47f52ded BEFORE DELETE ON public.access_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.break_glass_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    patient_id uuid,
    reason text NOT NULL,
    justification text,
    modules_accessed text[] DEFAULT '{}'::text[] NOT NULL,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    ip_address text,
    user_agent text,
    supervisor_id uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    scope_type text DEFAULT 'patient'::text NOT NULL,
    scope_id uuid,
    requested_modules text[] DEFAULT '{}'::text[] NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '04:00:00'::interval) NOT NULL,
    phi_access_count integer DEFAULT 0 NOT NULL,
    last_phi_accessed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT break_glass_expiry_window_check CHECK (((expires_at > start_time) AND (expires_at <= (start_time + '04:00:00'::interval)))),
    CONSTRAINT break_glass_patient_scope_check CHECK ((((scope_type = 'patient'::text) AND (patient_id IS NOT NULL) AND (scope_id = patient_id)) OR ((scope_type = 'emergency_context'::text) AND (scope_id IS NOT NULL)))),
    CONSTRAINT break_glass_reason_not_blank_check CHECK ((length(TRIM(BOTH FROM reason)) >= 5)),
    CONSTRAINT break_glass_scope_type_check CHECK ((scope_type = ANY (ARRAY['patient'::text, 'emergency_context'::text])))
);

-- Name: break_glass_events break_glass_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_break_glass_active ON public.break_glass_events USING btree (tenant_id, is_active);

CREATE INDEX idx_break_glass_events_deleted_at_a71e5332 ON public.break_glass_events USING btree (deleted_at);

CREATE INDEX idx_break_glass_patient_scope ON public.break_glass_events USING btree (tenant_id, patient_id, expires_at) WHERE (scope_type = 'patient'::text);

CREATE INDEX idx_break_glass_user_expiry ON public.break_glass_events USING btree (tenant_id, user_id, expires_at) WHERE (is_active = true);

ALTER TABLE ONLY public.break_glass_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.break_glass_events ENABLE ROW LEVEL SECURITY;

-- Name: break_glass_events tenant_isolation_break_glass_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_break_glass_events ON public.break_glass_events USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: break_glass_events trg_break_glass_events_soft_delete_a71e5332; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_break_glass_events_soft_delete_a71e5332 BEFORE DELETE ON public.break_glass_events FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.dpdp_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consent_number text,
    patient_id uuid NOT NULL,
    guardian_name text,
    retention_period text DEFAULT '5 years or as per legal requirement'::text NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    consent_method text DEFAULT 'Physical'::text NOT NULL,
    witness_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: dpdp_consents dpdp_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dpdp_consents
    ADD CONSTRAINT dpdp_consents_pkey PRIMARY KEY (id);

CREATE INDEX idx_dpdp_consents_deleted_at_c6794f1e ON public.dpdp_consents USING btree (deleted_at);

CREATE INDEX idx_dpdp_consents_patient ON public.dpdp_consents USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE ONLY public.dpdp_consents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dpdp_consents ENABLE ROW LEVEL SECURITY;

-- Name: dpdp_consents tenant_isolation_dpdp_consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_dpdp_consents ON public.dpdp_consents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: dpdp_consents trg_dpdp_consents_soft_delete_c6794f1e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dpdp_consents_soft_delete_c6794f1e BEFORE DELETE ON public.dpdp_consents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);

-- Name: email_verification_tokens email_verification_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash);

CREATE INDEX idx_email_verification_tokens_user ON public.email_verification_tokens USING btree (user_id, created_at DESC);

-- ── Identity providers (per tenant) ─────────────────────────────────────────

CREATE TABLE public.identity_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    protocol text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    discovery_url text,
    metadata_url text,
    client_id text,
    client_secret_enc text,
    group_claim text DEFAULT 'groups'::text NOT NULL,
    default_role text,
    jit_enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT identity_providers_protocol_check CHECK ((protocol = ANY (ARRAY['oidc'::text, 'saml'::text])))
);

-- Name: identity_providers identity_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_providers
    ADD CONSTRAINT identity_providers_pkey PRIMARY KEY (id);

-- Name: identity_providers identity_providers_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_providers
    ADD CONSTRAINT identity_providers_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE public.identity_providers ENABLE ROW LEVEL SECURITY;

-- Name: identity_providers identity_providers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY identity_providers_tenant ON public.identity_providers USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: identity_providers identity_providers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER identity_providers_set_updated_at BEFORE UPDATE ON public.identity_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── IdP group → MedBrains role / access-group mappings ──────────────────────

CREATE TABLE public.idp_group_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    idp_group text NOT NULL,
    role_code text,
    access_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: idp_group_mappings idp_group_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idp_group_mappings
    ADD CONSTRAINT idp_group_mappings_pkey PRIMARY KEY (id);

-- Name: idp_group_mappings idp_group_mappings_provider_id_idp_group_role_code_access_g_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idp_group_mappings
    ADD CONSTRAINT idp_group_mappings_provider_id_idp_group_role_code_access_g_key UNIQUE (provider_id, idp_group, role_code, access_group_id);

CREATE INDEX idx_idp_group_mappings_provider ON public.idp_group_mappings USING btree (provider_id);

ALTER TABLE public.idp_group_mappings ENABLE ROW LEVEL SECURITY;

-- Name: idp_group_mappings idp_group_mappings_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY idp_group_mappings_tenant ON public.idp_group_mappings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0169_oauth_connections.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — oauth_connections (common 3rd-party OAuth token store)
-- One reusable per-tenant OAuth connection per provider (Google / Microsoft /
-- Zoom / …). Access + refresh tokens are AEAD-encrypted at rest. The shared
-- token getter refreshes transparently. Used by telemedicine (Google Meet /
-- Teams) and any future integration that needs a provider token.
-- ============================================================

CREATE TABLE public.oauth_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text NOT NULL,
    grant_type text DEFAULT 'authorization_code'::text NOT NULL,
    access_token_enc text,
    refresh_token_enc text,
    token_type text DEFAULT 'Bearer'::text NOT NULL,
    scope text,
    expires_at timestamp with time zone,
    external_account_id text,
    status text DEFAULT 'connected'::text NOT NULL,
    last_error text,
    connected_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: oauth_connections oauth_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_connections
    ADD CONSTRAINT oauth_connections_pkey PRIMARY KEY (id);

-- Name: oauth_connections oauth_connections_tenant_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_connections
    ADD CONSTRAINT oauth_connections_tenant_provider_key UNIQUE (tenant_id, provider);

CREATE INDEX idx_oauth_connections_tenant ON public.oauth_connections USING btree (tenant_id, provider, status);

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;

-- Name: oauth_connections tenant_isolation_oauth_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_oauth_connections ON public.oauth_connections USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: oauth_connections oauth_connections_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER oauth_connections_set_updated_at BEFORE UPDATE ON public.oauth_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.onboarding_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    completed_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_complete boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);

-- Name: onboarding_progress onboarding_progress_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_tenant_id_key UNIQUE (tenant_id);

CREATE INDEX idx_onboarding_progress_deleted_at_6650e12f ON public.onboarding_progress USING btree (deleted_at);

CREATE INDEX idx_onboarding_progress_tenant ON public.onboarding_progress USING btree (tenant_id);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Name: onboarding_progress tenant_isolation_onboarding_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_onboarding_progress ON public.onboarding_progress USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: onboarding_progress trg_onboarding_progress_soft_delete_6650e12f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_progress_soft_delete_6650e12f BEFORE DELETE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: onboarding_progress trg_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.password_reset_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: password_reset_otps password_reset_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_otps
    ADD CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id);

CREATE INDEX idx_password_reset_otps_user ON public.password_reset_otps USING btree (user_id, created_at DESC);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Name: password_reset_otps tenant_isolation_password_reset_otps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_password_reset_otps ON public.password_reset_otps USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    device_fingerprint text,
    ip_address inet,
    user_agent text,
    family_id uuid DEFAULT gen_random_uuid(),
    replaced_by uuid,
    used_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);

CREATE INDEX idx_refresh_tokens_deleted_at_71ef94b0 ON public.refresh_tokens USING btree (deleted_at);

CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens USING btree (family_id);

CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash);

CREATE INDEX idx_refresh_tokens_tenant_id ON public.refresh_tokens USING btree (tenant_id);

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);

CREATE INDEX idx_refresh_tokens_user_active ON public.refresh_tokens USING btree (user_id) WHERE (revoked = false);

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Name: refresh_tokens tenant_isolation_refresh_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_refresh_tokens ON public.refresh_tokens USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: refresh_tokens trg_refresh_tokens_soft_delete_71ef94b0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_tokens_soft_delete_71ef94b0 BEFORE DELETE ON public.refresh_tokens FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.relation_tuples (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
)
PARTITION BY HASH (tenant_id);

-- Name: relation_tuples relation_tuples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples
    ADD CONSTRAINT relation_tuples_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX idx_relation_tuples_deleted_at_14d7b207 ON ONLY public.relation_tuples USING btree (deleted_at);

CREATE INDEX rt_expiry_idx ON ONLY public.relation_tuples USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX rt_lookup_idx ON ONLY public.relation_tuples USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX rt_derived_idx ON ONLY public.relation_tuples USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX rt_spicedb_failed_idx ON ONLY public.relation_tuples USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX rt_spicedb_outbox_idx ON ONLY public.relation_tuples USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX rt_subject_idx ON ONLY public.relation_tuples USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples tenant_isolation_relation_tuples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples ON public.relation_tuples USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: relation_tuples trg_relation_tuples_soft_delete_14d7b207; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_relation_tuples_soft_delete_14d7b207 BEFORE DELETE ON public.relation_tuples FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.relation_tuples_p0 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p0 relation_tuples_p0_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p0
    ADD CONSTRAINT relation_tuples_p0_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p0_deleted_at_idx ON public.relation_tuples_p0 USING btree (deleted_at);

CREATE INDEX relation_tuples_p0_expires_at_idx ON public.relation_tuples_p0 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p0_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p0 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p0_tenant_id_source_derived_from_idx ON public.relation_tuples_p0 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p0_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p0 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p0_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p0 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p0_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p0 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p0 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p0 tenant_isolation_relation_tuples_p0; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p0 ON public.relation_tuples_p0 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p1 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p1 relation_tuples_p1_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p1
    ADD CONSTRAINT relation_tuples_p1_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p1_deleted_at_idx ON public.relation_tuples_p1 USING btree (deleted_at);

CREATE INDEX relation_tuples_p1_expires_at_idx ON public.relation_tuples_p1 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p1_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p1 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p1_tenant_id_source_derived_from_idx ON public.relation_tuples_p1 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p1_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p1 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p1_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p1 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p1_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p1 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p1 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p1 tenant_isolation_relation_tuples_p1; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p1 ON public.relation_tuples_p1 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p10 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p10 relation_tuples_p10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p10
    ADD CONSTRAINT relation_tuples_p10_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p10_deleted_at_idx ON public.relation_tuples_p10 USING btree (deleted_at);

CREATE INDEX relation_tuples_p10_expires_at_idx ON public.relation_tuples_p10 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p10_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p10 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p10_tenant_id_source_derived_from_idx ON public.relation_tuples_p10 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p10_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p10 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p10_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p10 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p10_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p10 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p10 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p10 tenant_isolation_relation_tuples_p10; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p10 ON public.relation_tuples_p10 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p11 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p11 relation_tuples_p11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p11
    ADD CONSTRAINT relation_tuples_p11_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p11_deleted_at_idx ON public.relation_tuples_p11 USING btree (deleted_at);

CREATE INDEX relation_tuples_p11_expires_at_idx ON public.relation_tuples_p11 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p11_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p11 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p11_tenant_id_source_derived_from_idx ON public.relation_tuples_p11 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p11_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p11 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p11_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p11 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p11_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p11 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p11 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p11 tenant_isolation_relation_tuples_p11; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p11 ON public.relation_tuples_p11 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p12 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p12 relation_tuples_p12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p12
    ADD CONSTRAINT relation_tuples_p12_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p12_deleted_at_idx ON public.relation_tuples_p12 USING btree (deleted_at);

CREATE INDEX relation_tuples_p12_expires_at_idx ON public.relation_tuples_p12 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p12_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p12 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p12_tenant_id_source_derived_from_idx ON public.relation_tuples_p12 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p12_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p12 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p12_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p12 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p12_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p12 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p12 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p12 tenant_isolation_relation_tuples_p12; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p12 ON public.relation_tuples_p12 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p13 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p13 relation_tuples_p13_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p13
    ADD CONSTRAINT relation_tuples_p13_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p13_deleted_at_idx ON public.relation_tuples_p13 USING btree (deleted_at);

CREATE INDEX relation_tuples_p13_expires_at_idx ON public.relation_tuples_p13 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p13_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p13 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p13_tenant_id_source_derived_from_idx ON public.relation_tuples_p13 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p13_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p13 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p13_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p13 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p13_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p13 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p13 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p13 tenant_isolation_relation_tuples_p13; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p13 ON public.relation_tuples_p13 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p14 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p14 relation_tuples_p14_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p14
    ADD CONSTRAINT relation_tuples_p14_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p14_deleted_at_idx ON public.relation_tuples_p14 USING btree (deleted_at);

CREATE INDEX relation_tuples_p14_expires_at_idx ON public.relation_tuples_p14 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p14_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p14 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p14_tenant_id_source_derived_from_idx ON public.relation_tuples_p14 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p14_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p14 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p14_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p14 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p14_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p14 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p14 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p14 tenant_isolation_relation_tuples_p14; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p14 ON public.relation_tuples_p14 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p15 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p15 relation_tuples_p15_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p15
    ADD CONSTRAINT relation_tuples_p15_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p15_deleted_at_idx ON public.relation_tuples_p15 USING btree (deleted_at);

CREATE INDEX relation_tuples_p15_expires_at_idx ON public.relation_tuples_p15 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p15_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p15 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p15_tenant_id_source_derived_from_idx ON public.relation_tuples_p15 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p15_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p15 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p15_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p15 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p15_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p15 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p15 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p15 tenant_isolation_relation_tuples_p15; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p15 ON public.relation_tuples_p15 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p16 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p16 relation_tuples_p16_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p16
    ADD CONSTRAINT relation_tuples_p16_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p16_deleted_at_idx ON public.relation_tuples_p16 USING btree (deleted_at);

CREATE INDEX relation_tuples_p16_expires_at_idx ON public.relation_tuples_p16 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p16_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p16 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p16_tenant_id_source_derived_from_idx ON public.relation_tuples_p16 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p16_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p16 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p16_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p16 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p16_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p16 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p16 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p16 tenant_isolation_relation_tuples_p16; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p16 ON public.relation_tuples_p16 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p17 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p17 relation_tuples_p17_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p17
    ADD CONSTRAINT relation_tuples_p17_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p17_deleted_at_idx ON public.relation_tuples_p17 USING btree (deleted_at);

CREATE INDEX relation_tuples_p17_expires_at_idx ON public.relation_tuples_p17 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p17_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p17 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p17_tenant_id_source_derived_from_idx ON public.relation_tuples_p17 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p17_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p17 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p17_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p17 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p17_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p17 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p17 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p17 tenant_isolation_relation_tuples_p17; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p17 ON public.relation_tuples_p17 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p18 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p18 relation_tuples_p18_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p18
    ADD CONSTRAINT relation_tuples_p18_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p18_deleted_at_idx ON public.relation_tuples_p18 USING btree (deleted_at);

CREATE INDEX relation_tuples_p18_expires_at_idx ON public.relation_tuples_p18 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p18_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p18 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p18_tenant_id_source_derived_from_idx ON public.relation_tuples_p18 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p18_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p18 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p18_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p18 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p18_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p18 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p18 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p18 tenant_isolation_relation_tuples_p18; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p18 ON public.relation_tuples_p18 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p19 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p19 relation_tuples_p19_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p19
    ADD CONSTRAINT relation_tuples_p19_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p19_deleted_at_idx ON public.relation_tuples_p19 USING btree (deleted_at);

CREATE INDEX relation_tuples_p19_expires_at_idx ON public.relation_tuples_p19 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p19_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p19 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p19_tenant_id_source_derived_from_idx ON public.relation_tuples_p19 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p19_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p19 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p19_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p19 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p19_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p19 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p19 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p19 tenant_isolation_relation_tuples_p19; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p19 ON public.relation_tuples_p19 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p2 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p2 relation_tuples_p2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p2
    ADD CONSTRAINT relation_tuples_p2_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p2_deleted_at_idx ON public.relation_tuples_p2 USING btree (deleted_at);

CREATE INDEX relation_tuples_p2_expires_at_idx ON public.relation_tuples_p2 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p2_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p2 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p2_tenant_id_source_derived_from_idx ON public.relation_tuples_p2 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p2_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p2 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p2_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p2 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p2_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p2 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p2 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p2 tenant_isolation_relation_tuples_p2; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p2 ON public.relation_tuples_p2 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p20 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p20 relation_tuples_p20_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p20
    ADD CONSTRAINT relation_tuples_p20_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p20_deleted_at_idx ON public.relation_tuples_p20 USING btree (deleted_at);

CREATE INDEX relation_tuples_p20_expires_at_idx ON public.relation_tuples_p20 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p20_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p20 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p20_tenant_id_source_derived_from_idx ON public.relation_tuples_p20 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p20_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p20 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p20_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p20 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p20_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p20 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p20 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p20 tenant_isolation_relation_tuples_p20; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p20 ON public.relation_tuples_p20 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p21 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p21 relation_tuples_p21_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p21
    ADD CONSTRAINT relation_tuples_p21_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p21_deleted_at_idx ON public.relation_tuples_p21 USING btree (deleted_at);

CREATE INDEX relation_tuples_p21_expires_at_idx ON public.relation_tuples_p21 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p21_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p21 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p21_tenant_id_source_derived_from_idx ON public.relation_tuples_p21 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p21_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p21 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p21_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p21 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p21_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p21 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p21 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p21 tenant_isolation_relation_tuples_p21; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p21 ON public.relation_tuples_p21 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p22 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p22 relation_tuples_p22_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p22
    ADD CONSTRAINT relation_tuples_p22_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p22_deleted_at_idx ON public.relation_tuples_p22 USING btree (deleted_at);

CREATE INDEX relation_tuples_p22_expires_at_idx ON public.relation_tuples_p22 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p22_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p22 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p22_tenant_id_source_derived_from_idx ON public.relation_tuples_p22 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p22_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p22 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p22_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p22 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p22_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p22 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p22 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p22 tenant_isolation_relation_tuples_p22; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p22 ON public.relation_tuples_p22 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p23 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p23 relation_tuples_p23_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p23
    ADD CONSTRAINT relation_tuples_p23_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p23_deleted_at_idx ON public.relation_tuples_p23 USING btree (deleted_at);

CREATE INDEX relation_tuples_p23_expires_at_idx ON public.relation_tuples_p23 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p23_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p23 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p23_tenant_id_source_derived_from_idx ON public.relation_tuples_p23 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p23_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p23 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p23_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p23 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p23_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p23 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p23 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p23 tenant_isolation_relation_tuples_p23; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p23 ON public.relation_tuples_p23 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p24 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p24 relation_tuples_p24_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p24
    ADD CONSTRAINT relation_tuples_p24_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p24_deleted_at_idx ON public.relation_tuples_p24 USING btree (deleted_at);

CREATE INDEX relation_tuples_p24_expires_at_idx ON public.relation_tuples_p24 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p24_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p24 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p24_tenant_id_source_derived_from_idx ON public.relation_tuples_p24 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p24_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p24 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p24_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p24 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p24_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p24 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p24 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p24 tenant_isolation_relation_tuples_p24; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p24 ON public.relation_tuples_p24 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p25 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p25 relation_tuples_p25_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p25
    ADD CONSTRAINT relation_tuples_p25_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p25_deleted_at_idx ON public.relation_tuples_p25 USING btree (deleted_at);

CREATE INDEX relation_tuples_p25_expires_at_idx ON public.relation_tuples_p25 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p25_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p25 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p25_tenant_id_source_derived_from_idx ON public.relation_tuples_p25 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p25_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p25 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p25_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p25 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p25_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p25 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p25 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p25 tenant_isolation_relation_tuples_p25; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p25 ON public.relation_tuples_p25 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p26 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p26 relation_tuples_p26_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p26
    ADD CONSTRAINT relation_tuples_p26_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p26_deleted_at_idx ON public.relation_tuples_p26 USING btree (deleted_at);

CREATE INDEX relation_tuples_p26_expires_at_idx ON public.relation_tuples_p26 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p26_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p26 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p26_tenant_id_source_derived_from_idx ON public.relation_tuples_p26 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p26_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p26 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p26_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p26 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p26_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p26 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p26 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p26 tenant_isolation_relation_tuples_p26; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p26 ON public.relation_tuples_p26 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p27 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p27 relation_tuples_p27_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p27
    ADD CONSTRAINT relation_tuples_p27_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p27_deleted_at_idx ON public.relation_tuples_p27 USING btree (deleted_at);

CREATE INDEX relation_tuples_p27_expires_at_idx ON public.relation_tuples_p27 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p27_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p27 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p27_tenant_id_source_derived_from_idx ON public.relation_tuples_p27 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p27_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p27 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p27_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p27 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p27_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p27 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p27 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p27 tenant_isolation_relation_tuples_p27; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p27 ON public.relation_tuples_p27 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p28 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p28 relation_tuples_p28_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p28
    ADD CONSTRAINT relation_tuples_p28_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p28_deleted_at_idx ON public.relation_tuples_p28 USING btree (deleted_at);

CREATE INDEX relation_tuples_p28_expires_at_idx ON public.relation_tuples_p28 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p28_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p28 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p28_tenant_id_source_derived_from_idx ON public.relation_tuples_p28 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p28_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p28 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p28_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p28 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p28_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p28 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p28 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p28 tenant_isolation_relation_tuples_p28; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p28 ON public.relation_tuples_p28 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p29 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p29 relation_tuples_p29_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p29
    ADD CONSTRAINT relation_tuples_p29_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p29_deleted_at_idx ON public.relation_tuples_p29 USING btree (deleted_at);

CREATE INDEX relation_tuples_p29_expires_at_idx ON public.relation_tuples_p29 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p29_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p29 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p29_tenant_id_source_derived_from_idx ON public.relation_tuples_p29 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p29_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p29 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p29_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p29 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p29_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p29 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p29 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p29 tenant_isolation_relation_tuples_p29; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p29 ON public.relation_tuples_p29 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p3 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p3 relation_tuples_p3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p3
    ADD CONSTRAINT relation_tuples_p3_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p3_deleted_at_idx ON public.relation_tuples_p3 USING btree (deleted_at);

CREATE INDEX relation_tuples_p3_expires_at_idx ON public.relation_tuples_p3 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p3_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p3 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p3_tenant_id_source_derived_from_idx ON public.relation_tuples_p3 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p3_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p3 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p3_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p3 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p3_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p3 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p3 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p3 tenant_isolation_relation_tuples_p3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p3 ON public.relation_tuples_p3 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p30 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p30 relation_tuples_p30_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p30
    ADD CONSTRAINT relation_tuples_p30_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p30_deleted_at_idx ON public.relation_tuples_p30 USING btree (deleted_at);

CREATE INDEX relation_tuples_p30_expires_at_idx ON public.relation_tuples_p30 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p30_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p30 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p30_tenant_id_source_derived_from_idx ON public.relation_tuples_p30 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p30_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p30 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p30_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p30 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p30_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p30 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p30 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p30 tenant_isolation_relation_tuples_p30; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p30 ON public.relation_tuples_p30 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p31 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p31 relation_tuples_p31_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p31
    ADD CONSTRAINT relation_tuples_p31_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p31_deleted_at_idx ON public.relation_tuples_p31 USING btree (deleted_at);

CREATE INDEX relation_tuples_p31_expires_at_idx ON public.relation_tuples_p31 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p31_tenant_id_object_type_object_id_relatio_idx ON public.relation_tuples_p31 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p31_tenant_id_source_derived_from_idx ON public.relation_tuples_p31 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p31_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p31 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p31_tenant_id_spicedb_next_attempt_at_tuple_idx ON public.relation_tuples_p31 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p31_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p31 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p31 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p31 tenant_isolation_relation_tuples_p31; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p31 ON public.relation_tuples_p31 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p4 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p4 relation_tuples_p4_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p4
    ADD CONSTRAINT relation_tuples_p4_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p4_deleted_at_idx ON public.relation_tuples_p4 USING btree (deleted_at);

CREATE INDEX relation_tuples_p4_expires_at_idx ON public.relation_tuples_p4 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p4_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p4 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p4_tenant_id_source_derived_from_idx ON public.relation_tuples_p4 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p4_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p4 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p4_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p4 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p4_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p4 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p4 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p4 tenant_isolation_relation_tuples_p4; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p4 ON public.relation_tuples_p4 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p5 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p5 relation_tuples_p5_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p5
    ADD CONSTRAINT relation_tuples_p5_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p5_deleted_at_idx ON public.relation_tuples_p5 USING btree (deleted_at);

CREATE INDEX relation_tuples_p5_expires_at_idx ON public.relation_tuples_p5 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p5_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p5 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p5_tenant_id_source_derived_from_idx ON public.relation_tuples_p5 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p5_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p5 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p5_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p5 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p5_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p5 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p5 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p5 tenant_isolation_relation_tuples_p5; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p5 ON public.relation_tuples_p5 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p6 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p6 relation_tuples_p6_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p6
    ADD CONSTRAINT relation_tuples_p6_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p6_deleted_at_idx ON public.relation_tuples_p6 USING btree (deleted_at);

CREATE INDEX relation_tuples_p6_expires_at_idx ON public.relation_tuples_p6 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p6_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p6 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p6_tenant_id_source_derived_from_idx ON public.relation_tuples_p6 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p6_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p6 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p6_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p6 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p6_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p6 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p6 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p6 tenant_isolation_relation_tuples_p6; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p6 ON public.relation_tuples_p6 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p7 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p7 relation_tuples_p7_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p7
    ADD CONSTRAINT relation_tuples_p7_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p7_deleted_at_idx ON public.relation_tuples_p7 USING btree (deleted_at);

CREATE INDEX relation_tuples_p7_expires_at_idx ON public.relation_tuples_p7 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p7_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p7 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p7_tenant_id_source_derived_from_idx ON public.relation_tuples_p7 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p7_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p7 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p7_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p7 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p7_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p7 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p7 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p7 tenant_isolation_relation_tuples_p7; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p7 ON public.relation_tuples_p7 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p8 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p8 relation_tuples_p8_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p8
    ADD CONSTRAINT relation_tuples_p8_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p8_deleted_at_idx ON public.relation_tuples_p8 USING btree (deleted_at);

CREATE INDEX relation_tuples_p8_expires_at_idx ON public.relation_tuples_p8 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p8_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p8 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p8_tenant_id_source_derived_from_idx ON public.relation_tuples_p8 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p8_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p8 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p8_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p8 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p8_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p8 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p8 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p8 tenant_isolation_relation_tuples_p8; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p8 ON public.relation_tuples_p8 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.relation_tuples_p9 (
    tuple_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    relation text NOT NULL,
    subject_type text NOT NULL,
    subject_id text NOT NULL,
    caveat jsonb,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    granted_by uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_reason text,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    source text DEFAULT 'explicit'::text NOT NULL,
    derived_from text,
    spicedb_sync_status text DEFAULT 'pending'::text NOT NULL,
    spicedb_synced_at timestamp with time zone,
    spicedb_last_error text,
    spicedb_attempts integer DEFAULT 0 NOT NULL,
    spicedb_next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT relation_tuples_source_check CHECK ((source = ANY (ARRAY['explicit'::text, 'derived'::text]))),
    CONSTRAINT relation_tuples_spicedb_sync_status_check CHECK ((spicedb_sync_status = ANY (ARRAY['pending'::text, 'applied'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT relation_tuples_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'superseded'::text]))),
    CONSTRAINT relation_tuples_subject_type_check CHECK ((subject_type = ANY (ARRAY['user'::text, 'role'::text, 'department'::text, 'group'::text, 'tuple_set'::text])))
);

-- Name: relation_tuples_p9 relation_tuples_p9_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relation_tuples_p9
    ADD CONSTRAINT relation_tuples_p9_pkey PRIMARY KEY (tenant_id, tuple_id);

CREATE INDEX relation_tuples_p9_deleted_at_idx ON public.relation_tuples_p9 USING btree (deleted_at);

CREATE INDEX relation_tuples_p9_expires_at_idx ON public.relation_tuples_p9 USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (status = 'active'::text));

CREATE INDEX relation_tuples_p9_tenant_id_object_type_object_id_relation_idx ON public.relation_tuples_p9 USING btree (tenant_id, object_type, object_id, relation) WHERE (status = 'active'::text);

CREATE INDEX relation_tuples_p9_tenant_id_source_derived_from_idx ON public.relation_tuples_p9 USING btree (tenant_id, source, derived_from) WHERE (source = 'derived'::text);

CREATE INDEX relation_tuples_p9_tenant_id_spicedb_attempts_tuple_id_idx ON public.relation_tuples_p9 USING btree (tenant_id, spicedb_attempts DESC, tuple_id) WHERE (spicedb_sync_status = 'failed'::text);

CREATE INDEX relation_tuples_p9_tenant_id_spicedb_next_attempt_at_tuple__idx ON public.relation_tuples_p9 USING btree (tenant_id, spicedb_next_attempt_at, tuple_id) WHERE (spicedb_sync_status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX relation_tuples_p9_tenant_id_subject_type_subject_id_idx ON public.relation_tuples_p9 USING btree (tenant_id, subject_type, subject_id) WHERE (status = 'active'::text);

ALTER TABLE public.relation_tuples_p9 ENABLE ROW LEVEL SECURITY;

-- Name: relation_tuples_p9 tenant_isolation_relation_tuples_p9; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_relation_tuples_p9 ON public.relation_tuples_p9 USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    field_access_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    widget_access_defaults jsonb DEFAULT '{}'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT chk_roles_code_length CHECK (((length(code) >= 2) AND (length(code) <= 32))),
    CONSTRAINT chk_roles_name_length CHECK (((length(name) >= 2) AND (length(name) <= 100)))
);

-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

-- Name: roles roles_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_roles_deleted_at_4295e806 ON public.roles USING btree (deleted_at);

CREATE INDEX idx_roles_tenant ON public.roles USING btree (tenant_id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Name: roles tenant_isolation_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_roles ON public.roles USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: roles audit_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_roles AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('admin');

-- Name: roles trg_bump_perm_version_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bump_perm_version_role AFTER UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.bump_perm_version_on_role_change();

-- Name: roles trg_roles_soft_delete_4295e806; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_soft_delete_4295e806 BEFORE DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: roles trg_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.sensitive_patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    sensitivity_type text NOT NULL,
    reason text,
    access_restricted_to uuid[],
    alert_on_access boolean DEFAULT true NOT NULL,
    notify_users uuid[],
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: sensitive_patients sensitive_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_pkey PRIMARY KEY (id);

-- Name: sensitive_patients sensitive_patients_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);

CREATE INDEX idx_sensitive_patients_deleted_at_0594bdc7 ON public.sensitive_patients USING btree (deleted_at);

ALTER TABLE ONLY public.sensitive_patients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sensitive_patients ENABLE ROW LEVEL SECURITY;

-- Name: sensitive_patients tenant_isolation_sensitive_patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_sensitive_patients ON public.sensitive_patients USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: sensitive_patients trg_sensitive_patients_soft_delete_0594bdc7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sensitive_patients_soft_delete_0594bdc7 BEFORE DELETE ON public.sensitive_patients FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Transient login state (state → nonce / PKCE / provider) ──────────────────

CREATE TABLE public.sso_auth_state (
    state text NOT NULL,
    provider_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    nonce text NOT NULL,
    pkce_verifier text NOT NULL,
    return_to text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL
);

-- Name: sso_auth_state sso_auth_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_auth_state
    ADD CONSTRAINT sso_auth_state_pkey PRIMARY KEY (state);

CREATE INDEX idx_sso_auth_state_expiry ON public.sso_auth_state USING btree (expires_at);

ALTER TABLE public.sso_auth_state ENABLE ROW LEVEL SECURITY;

-- Name: sso_auth_state sso_auth_state_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sso_auth_state_tenant_isolation ON public.sso_auth_state USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0159_tokens.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: tokens (unified multi-module queue/token system)
-- One token stream model for every module + scope (department / room /
-- counter / combined). Drives TV / web / mobile token boards + "now serving".
-- ============================================================

CREATE TABLE public.tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    module text NOT NULL,
    scope text DEFAULT 'department'::text NOT NULL,
    scope_id uuid,
    scope_label text,
    number text NOT NULL,
    seq integer NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    patient_id uuid,
    patient_name text,
    entity_type text,
    entity_id uuid,
    counter_label text,
    issued_by uuid,
    called_by uuid,
    called_at timestamp with time zone,
    served_at timestamp with time zone,
    completed_at timestamp with time zone,
    token_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referred_from_module text,
    referred_from_scope text,
    referred_from_scope_id uuid,
    returned_from_label text,
    returned_at timestamp with time zone,
    visit_id uuid
);

-- Name: tokens tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);

CREATE INDEX idx_tokens_board ON public.tokens USING btree (tenant_id, module, scope, scope_id, token_date, status);

CREATE INDEX idx_tokens_patient ON public.tokens USING btree (tenant_id, patient_id, token_date);

CREATE INDEX idx_tokens_referred_from ON public.tokens USING btree (tenant_id, referred_from_module, referred_from_scope_id, token_date) WHERE (referred_from_module IS NOT NULL);

CREATE INDEX idx_tokens_scope_live ON public.tokens USING btree (tenant_id, scope, scope_id, token_date, status);

CREATE INDEX idx_tokens_visit ON public.tokens USING btree (tenant_id, visit_id, created_at) WHERE (visit_id IS NOT NULL);

ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- Name: tokens tenant_isolation_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tokens ON public.tokens USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tokens tokens_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tokens_set_updated_at BEFORE UPDATE ON public.tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.user_facility_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: user_facility_assignments user_facility_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_pkey PRIMARY KEY (id);

-- Name: user_facility_assignments user_facility_assignments_tenant_id_user_id_facility_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_tenant_id_user_id_facility_id_key UNIQUE (tenant_id, user_id, facility_id);

CREATE INDEX idx_ufa_facility ON public.user_facility_assignments USING btree (facility_id);

CREATE INDEX idx_ufa_tenant ON public.user_facility_assignments USING btree (tenant_id);

CREATE INDEX idx_ufa_user ON public.user_facility_assignments USING btree (user_id);

CREATE INDEX idx_user_facility_assignments_deleted_at_817173f8 ON public.user_facility_assignments USING btree (deleted_at);

ALTER TABLE public.user_facility_assignments ENABLE ROW LEVEL SECURITY;

-- Name: user_facility_assignments tenant_isolation_ufa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_ufa ON public.user_facility_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: user_facility_assignments set_updated_at_ufa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_ufa BEFORE UPDATE ON public.user_facility_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: user_facility_assignments trg_user_facility_assignments_soft_delete_817173f8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_facility_assignments_soft_delete_817173f8 BEFORE DELETE ON public.user_facility_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ====================================================================
-- Migration: 0206_user_invitations.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: tenant_id
-- New-Tables: user_invitations
-- Drops: none
-- ====================================================================
-- Team invites — an admin invites a colleague by email; they follow a link to
-- set their own password and the account is created (email already proven by
-- the invite, so email_verified = true on accept).
-- Like the email-verification table, this is a pre-auth CAPABILITY table: the
-- unguessable token IS the authorization, so it is NOT tenant-RLS'd (the public
-- accept endpoint has no tenant context). Only the SHA-256 hash is stored. The
-- admin list/revoke endpoints filter by tenant_id explicitly. `role` holds a
-- `user_role` enum value (or a custom role code), cast/validated on accept.

CREATE TABLE public.user_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    full_name text,
    token_hash text NOT NULL,
    invited_by uuid,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: user_invitations user_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id);

-- Name: user_invitations user_invitations_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_token_hash_key UNIQUE (token_hash);

CREATE INDEX idx_user_invitations_tenant ON public.user_invitations USING btree (tenant_id, created_at DESC);

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text,
    full_name text NOT NULL,
    role public.user_role NOT NULL,
    access_matrix jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    specialization text,
    medical_registration_number text,
    qualification text,
    consultation_fee numeric(10,2),
    department_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    perm_version integer DEFAULT 1 NOT NULL,
    supervisor_id uuid,
    user_level text,
    designation_id uuid,
    deactivated_at timestamp with time zone,
    department_id uuid,
    designation text,
    registration_number text,
    employee_code text,
    name text,
    date_of_joining date,
    blood_group text,
    emergency_contact text,
    photo_url text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    must_change_password boolean DEFAULT false NOT NULL,
    phone text,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    mfa_secret text,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_recovery_codes jsonb DEFAULT '[]'::jsonb NOT NULL,
    idp_id uuid,
    external_subject text,
    email_verified boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_users_email_pattern CHECK ((email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'::text)),
    CONSTRAINT chk_users_full_name_length CHECK (((length(full_name) >= 2) AND (length(full_name) <= 100))),
    CONSTRAINT chk_users_username_length CHECK (((length(username) >= 3) AND (length(username) <= 30))),
    CONSTRAINT chk_users_username_pattern CHECK ((username ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT users_user_level_check CHECK (((user_level IS NULL) OR (user_level = ANY (ARRAY['intern'::text, 'resident'::text, 'senior_resident'::text, 'consultant'::text, 'hod'::text]))))
);

-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- Name: users users_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_key UNIQUE (tenant_id, email);

-- Name: users users_tenant_id_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_username_key UNIQUE (tenant_id, username);

CREATE INDEX idx_users_deactivated_at ON public.users USING btree (tenant_id, deactivated_at) WHERE (deactivated_at IS NOT NULL);

CREATE INDEX idx_users_deleted_at_9bc65c2a ON public.users USING btree (deleted_at);

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);

CREATE UNIQUE INDEX uq_users_idp_subject ON public.users USING btree (idp_id, external_subject) WHERE ((idp_id IS NOT NULL) AND (external_subject IS NOT NULL));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Name: users tenant_isolation_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_users ON public.users USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: users audit_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('admin');

-- Name: users trg_users_soft_delete_9bc65c2a; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_soft_delete_9bc65c2a BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: users trg_users_track_deactivation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_track_deactivation BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_track_deactivation();

-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: COLUMN users.deactivated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deactivated_at IS 'Timestamp the user was disabled. NULL while is_active=true. Used by /api/auth/revocations so offline devices can compare against jwt.iat.';

-- ── partition attachment ────────────────────────────────────────────
-- After every child above exists.

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p0 FOR VALUES WITH (modulus 32, remainder 0);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p1 FOR VALUES WITH (modulus 32, remainder 1);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p10 FOR VALUES WITH (modulus 32, remainder 10);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p11 FOR VALUES WITH (modulus 32, remainder 11);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p12 FOR VALUES WITH (modulus 32, remainder 12);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p13 FOR VALUES WITH (modulus 32, remainder 13);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p14 FOR VALUES WITH (modulus 32, remainder 14);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p15 FOR VALUES WITH (modulus 32, remainder 15);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p16 FOR VALUES WITH (modulus 32, remainder 16);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p17 FOR VALUES WITH (modulus 32, remainder 17);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p18 FOR VALUES WITH (modulus 32, remainder 18);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p19 FOR VALUES WITH (modulus 32, remainder 19);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p2 FOR VALUES WITH (modulus 32, remainder 2);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p20 FOR VALUES WITH (modulus 32, remainder 20);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p21 FOR VALUES WITH (modulus 32, remainder 21);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p22 FOR VALUES WITH (modulus 32, remainder 22);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p23 FOR VALUES WITH (modulus 32, remainder 23);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p24 FOR VALUES WITH (modulus 32, remainder 24);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p25 FOR VALUES WITH (modulus 32, remainder 25);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p26 FOR VALUES WITH (modulus 32, remainder 26);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p27 FOR VALUES WITH (modulus 32, remainder 27);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p28 FOR VALUES WITH (modulus 32, remainder 28);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p29 FOR VALUES WITH (modulus 32, remainder 29);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p3 FOR VALUES WITH (modulus 32, remainder 3);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p30 FOR VALUES WITH (modulus 32, remainder 30);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p31 FOR VALUES WITH (modulus 32, remainder 31);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p4 FOR VALUES WITH (modulus 32, remainder 4);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p5 FOR VALUES WITH (modulus 32, remainder 5);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p6 FOR VALUES WITH (modulus 32, remainder 6);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p7 FOR VALUES WITH (modulus 32, remainder 7);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p8 FOR VALUES WITH (modulus 32, remainder 8);

ALTER TABLE ONLY public.relation_tuples ATTACH PARTITION public.relation_tuples_p9 FOR VALUES WITH (modulus 32, remainder 9);

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: access_alerts access_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);

-- Name: access_alerts access_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_alerts
    ADD CONSTRAINT access_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: access_group_members access_group_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);

-- Name: access_group_members access_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE;

-- Name: access_group_members access_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_group_members
    ADD CONSTRAINT access_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: access_groups access_groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_groups
    ADD CONSTRAINT access_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

-- Name: access_log access_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_log
    ADD CONSTRAINT access_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: break_glass_events break_glass_events_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);

-- Name: break_glass_events break_glass_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.break_glass_events
    ADD CONSTRAINT break_glass_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: idp_group_mappings idp_group_mappings_access_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idp_group_mappings
    ADD CONSTRAINT idp_group_mappings_access_group_id_fkey FOREIGN KEY (access_group_id) REFERENCES public.access_groups(id) ON DELETE CASCADE;

-- Name: idp_group_mappings idp_group_mappings_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idp_group_mappings
    ADD CONSTRAINT idp_group_mappings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.identity_providers(id) ON DELETE CASCADE;

-- Name: password_reset_otps password_reset_otps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_otps
    ADD CONSTRAINT password_reset_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: refresh_tokens refresh_tokens_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.refresh_tokens(id);

-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: relation_tuples relation_tuples_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);

-- Name: relation_tuples relation_tuples_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(id);

-- Name: sensitive_patients sensitive_patients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_patients
    ADD CONSTRAINT sensitive_patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

-- Name: sso_auth_state sso_auth_state_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sso_auth_state
    ADD CONSTRAINT sso_auth_state_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.identity_providers(id) ON DELETE CASCADE;

-- Name: user_facility_assignments user_facility_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_facility_assignments
    ADD CONSTRAINT user_facility_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: users users_idp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_idp_id_fkey FOREIGN KEY (idp_id) REFERENCES public.identity_providers(id) ON DELETE SET NULL;

-- Name: users users_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);
