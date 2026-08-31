-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 10
-- Drops: none
-- approvals — schema.
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



-- Append-only. No updates, no deletes: a reversal is a new decision on a new
-- step, never an edit to what somebody previously said.

CREATE TABLE public.approval_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    step_id uuid NOT NULL,
    request_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    decision public.approval_decision_kind NOT NULL,
    note text,
    witnessed_by uuid,
    via_delegation_id uuid,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    signature_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_decisions_witness_not_actor CHECK (((witnessed_by IS NULL) OR (witnessed_by <> actor_id)))
);

-- Name: approval_decisions approval_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_pkey PRIMARY KEY (id);

CREATE INDEX idx_approval_decisions_request ON public.approval_decisions USING btree (request_id, signed_at);

CREATE UNIQUE INDEX uq_approval_decisions_actor_step ON public.approval_decisions USING btree (step_id, actor_id);

ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

-- Name: approval_decisions approval_decisions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_decisions_tenant_isolation ON public.approval_decisions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: TABLE approval_decisions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_decisions IS 'Append-only record of who decided what, when, and with which witness. A reversal is a new decision on a new step, never an edit.';

CREATE TABLE public.approval_delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    kinds text[] DEFAULT '{}'::text[] NOT NULL,
    reason text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT approval_delegations_not_self CHECK ((delegator_id <> delegate_id)),
    CONSTRAINT approval_delegations_window CHECK ((ends_at > starts_at))
);

-- Name: approval_delegations approval_delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT approval_delegations_pkey PRIMARY KEY (id);

CREATE INDEX idx_approval_delegations_delegate ON public.approval_delegations USING btree (tenant_id, delegate_id, starts_at, ends_at) WHERE (revoked_at IS NULL);

ALTER TABLE public.approval_delegations ENABLE ROW LEVEL SECURITY;

-- Name: approval_delegations approval_delegations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_delegations_tenant_isolation ON public.approval_delegations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- ── the request itself ──────────────────────────────────────────────────────

CREATE TABLE public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    kind text NOT NULL,
    subject_type text,
    subject_id uuid,
    requester_id uuid NOT NULL,
    on_behalf_of_id uuid,
    reason text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    workflow_id uuid NOT NULL,
    status public.approval_request_status DEFAULT 'draft'::public.approval_request_status NOT NULL,
    current_step_seq integer DEFAULT 1 NOT NULL,
    requires_elevation boolean DEFAULT false NOT NULL,
    sla_due_at timestamp with time zone,
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT approval_requests_reason_present CHECK ((length(btrim(reason)) > 0))
);

-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_approval_requests_requester ON public.approval_requests USING btree (tenant_id, requester_id, status, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_approval_requests_sla ON public.approval_requests USING btree (tenant_id, status, sla_due_at) WHERE ((deleted_at IS NULL) AND (sla_due_at IS NOT NULL));

CREATE INDEX idx_approval_requests_subject ON public.approval_requests USING btree (tenant_id, subject_type, subject_id) WHERE (deleted_at IS NULL);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Name: approval_requests approval_requests_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_requests_tenant_isolation ON public.approval_requests USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: approval_requests trg_approval_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: TABLE approval_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_requests IS 'Every request for anything, of any type. The type, its form and its approval chain are all data, so a new kind of request needs no table and no deployment.';

-- Resolved approvers, written when a step activates.
-- This table is why the inbox is fast. Without it, "what awaits me?" means
-- evaluating every live step's approver rule against the asking user — a rule
-- engine run per candidate row, on the one screen every employee opens. With
-- it, the inbox is an index scan.

CREATE TABLE public.approval_step_assignees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    step_id uuid NOT NULL,
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    via_delegation_id uuid,
    added_by_escalation boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: approval_step_assignees approval_step_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_step_assignees
    ADD CONSTRAINT approval_step_assignees_pkey PRIMARY KEY (id);

CREATE INDEX idx_approval_step_assignees_inbox ON public.approval_step_assignees USING btree (tenant_id, user_id, request_id);

CREATE UNIQUE INDEX uq_approval_step_assignees ON public.approval_step_assignees USING btree (step_id, user_id);

ALTER TABLE public.approval_step_assignees ENABLE ROW LEVEL SECURITY;

-- Name: approval_step_assignees approval_step_assignees_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_step_assignees_tenant_isolation ON public.approval_step_assignees USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: TABLE approval_step_assignees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.approval_step_assignees IS 'Approvers resolved at step activation. Makes the inbox an index scan instead of a rule evaluation per candidate row.';

CREATE TABLE public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_id uuid NOT NULL,
    seq integer NOT NULL,
    name text NOT NULL,
    approver_rule jsonb NOT NULL,
    quorum integer DEFAULT 1 NOT NULL,
    requires_witness boolean DEFAULT false NOT NULL,
    status public.approval_step_status DEFAULT 'waiting'::public.approval_step_status NOT NULL,
    activated_at timestamp with time zone,
    sla_due_at timestamp with time zone,
    escalated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_steps_quorum_positive CHECK ((quorum >= 1))
);

-- Name: approval_steps approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_approval_steps_seq ON public.approval_steps USING btree (request_id, seq);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

-- Name: approval_steps approval_steps_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_steps_tenant_isolation ON public.approval_steps USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: approval_steps trg_approval_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_steps_updated_at BEFORE UPDATE ON public.approval_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.approval_workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    seq integer NOT NULL,
    name text NOT NULL,
    approver_rule jsonb NOT NULL,
    quorum integer DEFAULT 1 NOT NULL,
    requires_witness boolean DEFAULT false NOT NULL,
    sla_hours integer,
    escalation jsonb DEFAULT '{}'::jsonb NOT NULL,
    allow_delegate boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT approval_workflow_steps_quorum_positive CHECK ((quorum >= 1)),
    CONSTRAINT approval_workflow_steps_seq_bounded CHECK (((seq >= 1) AND (seq <= 20)))
);

-- Name: approval_workflow_steps approval_workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_approval_workflow_steps_seq ON public.approval_workflow_steps USING btree (workflow_id, seq) WHERE (deleted_at IS NULL);

ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Name: approval_workflow_steps approval_workflow_steps_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_workflow_steps_tenant_isolation ON public.approval_workflow_steps USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: approval_workflow_steps trg_approval_workflow_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_workflow_steps_updated_at BEFORE UPDATE ON public.approval_workflow_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── the chain, as data and versioned ────────────────────────────────────────
-- Versioned because a policy edited next month must not rewrite what happened
-- last month. A request pins the version it was raised under, so the trail
-- still reads correctly years later.

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    sla_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_approval_workflows_code_version ON public.approval_workflows USING btree (tenant_id, code, version) WHERE (deleted_at IS NULL);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- Name: approval_workflows approval_workflows_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_workflows_tenant_isolation ON public.approval_workflows USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: approval_workflows trg_approval_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.iam_access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    requested_permissions text[] NOT NULL,
    requested_modules text[] DEFAULT '{}'::text[] NOT NULL,
    resource_scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text NOT NULL,
    requested_expires_at timestamp with time zone,
    status public.iam_access_request_status DEFAULT 'pending'::public.iam_access_request_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_note text,
    applied_at timestamp with time zone,
    revoked_by uuid,
    revoked_at timestamp with time zone,
    revoke_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT iam_access_requests_expiry_future_or_null CHECK (((requested_expires_at IS NULL) OR (requested_expires_at > created_at))),
    CONSTRAINT iam_access_requests_permissions_nonempty CHECK ((array_length(requested_permissions, 1) > 0)),
    CONSTRAINT iam_access_requests_reason_nonempty CHECK ((length(btrim(reason)) >= 3))
);

-- Name: iam_access_requests iam_access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.iam_access_requests
    ADD CONSTRAINT iam_access_requests_pkey PRIMARY KEY (id);

CREATE INDEX idx_iam_access_requests_deleted_at_37031396 ON public.iam_access_requests USING btree (deleted_at);

CREATE INDEX idx_iam_access_requests_requester ON public.iam_access_requests USING btree (tenant_id, requester_id, created_at DESC);

CREATE INDEX idx_iam_access_requests_status ON public.iam_access_requests USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_iam_access_requests_target ON public.iam_access_requests USING btree (tenant_id, target_user_id, created_at DESC);

ALTER TABLE public.iam_access_requests ENABLE ROW LEVEL SECURITY;

-- Name: iam_access_requests tenant_isolation_iam_access_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_iam_access_requests ON public.iam_access_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: iam_access_requests trg_iam_access_requests_soft_delete_37031396; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_iam_access_requests_soft_delete_37031396 BEFORE DELETE ON public.iam_access_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: iam_access_requests update_iam_access_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_iam_access_requests_updated_at BEFORE UPDATE ON public.iam_access_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- The request form, as data rather than a component per type.

CREATE TABLE public.request_type_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    help_text text,
    is_required boolean DEFAULT false NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation jsonb DEFAULT '{}'::jsonb NOT NULL,
    section text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: request_type_fields request_type_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_type_fields
    ADD CONSTRAINT request_type_fields_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_request_type_fields_key ON public.request_type_fields USING btree (request_type_id, key) WHERE (deleted_at IS NULL);

ALTER TABLE public.request_type_fields ENABLE ROW LEVEL SECURITY;

-- Name: request_type_fields request_type_fields_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY request_type_fields_tenant_isolation ON public.request_type_fields USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: request_type_fields trg_request_type_fields_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_type_fields_updated_at BEFORE UPDATE ON public.request_type_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── the catalog: what can be asked for ──────────────────────────────────────

CREATE TABLE public.request_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    description text,
    icon text,
    raise_permission text,
    requires_justification boolean DEFAULT true NOT NULL,
    requires_attachment boolean DEFAULT false NOT NULL,
    max_duration_hours integer,
    effect_key text,
    default_workflow_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT request_types_duration_positive CHECK (((max_duration_hours IS NULL) OR (max_duration_hours > 0)))
);

-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX uq_request_types_code ON public.request_types USING btree (tenant_id, code) WHERE (deleted_at IS NULL);

ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;

-- Name: request_types request_types_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY request_types_tenant_isolation ON public.request_types USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: request_types trg_request_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: approval_decisions approval_decisions_request_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_request_fkey FOREIGN KEY (request_id) REFERENCES public.approval_requests(id) ON DELETE CASCADE;

-- Name: approval_decisions approval_decisions_step_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_decisions
    ADD CONSTRAINT approval_decisions_step_fkey FOREIGN KEY (step_id) REFERENCES public.approval_steps(id) ON DELETE CASCADE;

-- Name: approval_requests approval_requests_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_type_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id);

-- Name: approval_requests approval_requests_workflow_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_workflow_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);

-- Name: approval_step_assignees approval_step_assignees_request_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_step_assignees
    ADD CONSTRAINT approval_step_assignees_request_fkey FOREIGN KEY (request_id) REFERENCES public.approval_requests(id) ON DELETE CASCADE;

-- Name: approval_step_assignees approval_step_assignees_step_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_step_assignees
    ADD CONSTRAINT approval_step_assignees_step_fkey FOREIGN KEY (step_id) REFERENCES public.approval_steps(id) ON DELETE CASCADE;

-- Name: approval_steps approval_steps_request_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_request_fkey FOREIGN KEY (request_id) REFERENCES public.approval_requests(id) ON DELETE CASCADE;

-- Name: approval_workflow_steps approval_workflow_steps_workflow_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflow_steps
    ADD CONSTRAINT approval_workflow_steps_workflow_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);

-- Name: approval_workflows approval_workflows_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_type_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id);

-- Name: request_type_fields request_type_fields_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_type_fields
    ADD CONSTRAINT request_type_fields_type_fkey FOREIGN KEY (request_type_id) REFERENCES public.request_types(id);

-- Name: request_types request_types_default_workflow_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_types
    ADD CONSTRAINT request_types_default_workflow_fkey FOREIGN KEY (default_workflow_id) REFERENCES public.approval_workflows(id);
