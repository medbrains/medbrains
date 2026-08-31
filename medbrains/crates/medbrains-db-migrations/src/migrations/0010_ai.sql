-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 3
-- Drops: none
-- ai — schema.
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



-- ====================================================================
-- Migration: 0217_ai_chat.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ai_conversations, ai_messages
-- Drops: none
-- ====================================================================
-- Phase 1 of the AI Clinical Copilot (RFC-AI-CLINICAL-COPILOT): persist
-- assistant conversations + messages so a thread survives reloads and can be
-- listed/resumed. Tenant-scoped under RLS; owner-scoped in the handler.
-- Sharing (visibility != 'private'), rolling summaries, and message
-- embeddings are later phases and get their own migrations — not built yet.

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    title text,
    patient_id uuid,
    encounter_id uuid,
    visibility text DEFAULT 'private'::text NOT NULL,
    model text,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);

CREATE INDEX idx_ai_conversations_owner ON public.ai_conversations USING btree (tenant_id, owner_user_id, last_message_at DESC) WHERE (archived_at IS NULL);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Name: ai_conversations ai_conversations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conversations_tenant ON public.ai_conversations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: ai_conversations set_ai_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    token_count integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);

CREATE INDEX idx_ai_messages_conversation ON public.ai_messages USING btree (tenant_id, conversation_id, created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Name: ai_messages ai_messages_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_messages_tenant ON public.ai_messages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- RLS-Posture: tenant-scoped
-- LLM-driven simulator: per-run findings.
-- The scripted simulator (migration 0140) records numeric counts in
-- `simulator_runs.summary` and per-step audit in `simulator_run_steps`.
-- The agent simulator additionally emits free-text FINDINGS — a synthetic
-- user (an LLM acting as a real role, in a real department/locale) reporting
-- what it could not do, what confused it, a permission it hit that it should
-- not have, an untranslated string, or a workflow dead-end. These are the
-- payoff of the agent runs and have no home in the typed numeric summary, so
-- they live here.
-- `cell` captures the factor combination the finding came from (role,
-- department, locale, persona, goal) so findings can be grouped/de-duped and
-- fed back into the self-improving loop. `step_ref` optionally points at the
-- `simulator_run_steps` row that triggered it. Tenant-scoped + RLS; cascades
-- with the run so `reject_run` purges findings alongside the synthetic rows.

CREATE TABLE public.simulator_run_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    cell jsonb DEFAULT '{}'::jsonb NOT NULL,
    kind text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    message text NOT NULL,
    step_ref uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verdict text DEFAULT 'unverified'::text NOT NULL,
    CONSTRAINT simulator_run_findings_kind_check CHECK ((kind = ANY (ARRAY['usability'::text, 'permission'::text, 'locale'::text, 'error'::text, 'workflow'::text, 'discovery'::text, 'logic'::text]))),
    CONSTRAINT simulator_run_findings_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT simulator_run_findings_verdict_check CHECK ((verdict = ANY (ARRAY['unverified'::text, 'confirmed'::text, 'plausible'::text, 'rejected'::text])))
);

-- Name: simulator_run_findings simulator_run_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_run_findings
    ADD CONSTRAINT simulator_run_findings_pkey PRIMARY KEY (id);

CREATE INDEX idx_simulator_run_findings_run ON public.simulator_run_findings USING btree (run_id, created_at);

ALTER TABLE public.simulator_run_findings ENABLE ROW LEVEL SECURITY;

-- Name: simulator_run_findings simulator_run_findings_tenant_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY simulator_run_findings_tenant_rls ON public.simulator_run_findings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;
