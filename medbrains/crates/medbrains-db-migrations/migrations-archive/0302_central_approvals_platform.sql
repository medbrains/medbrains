-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: request_types, request_type_fields, approval_workflows, approval_workflow_steps,
--             approval_requests, approval_steps, approval_step_assignees, approval_decisions,
--             approval_delegations
-- Drops: none
-- The central approvals platform.
--
-- Sixteen request/approval implementations exist across the product. Fifteen
-- have a `status` column and ten a `requested_by`; past that they agree on
-- nothing, including four state machines and two different words for a refusal
-- (`rejected` in IAM, `denied` in antibiotic stewardship). Each re-derives its
-- own controls and most get them wrong: leave requests can be self-approved,
-- their department stage skipped, and a decided request decided again.
--
-- The goal here is not to hold those sixteen. It is that the seventeenth
-- request type needs no table and no deployment — a request type is a row, its
-- form is rows, and its approval chain is rows. Code appears only where a
-- decision has a real effect (granting a permission, releasing stock).
--
-- Shape follows Frappe (DocType + Workflow as data) and Odoo (Approval
-- Category), with the recertification idea from Microsoft PIM to follow in a
-- later migration.

-- ── vocabulary ──────────────────────────────────────────────────────────────
--
-- One set of states for every request type. `rejected` is the word; `denied`
-- is migrated onto it when antibiotic stewardship moves across. A report that
-- groups by status could not previously group those together, so one event
-- counted as two different things.

-- Guarded because `CREATE TYPE` has no IF NOT EXISTS, and a migration that
-- cannot be re-run is a migration that cannot be recovered by hand.
DO $$ BEGIN
    CREATE TYPE approval_request_status AS ENUM (
        'draft', 'pending', 'approved', 'rejected', 'cancelled', 'expired', 'revoked'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE approval_step_status AS ENUM (
        'waiting', 'active', 'approved', 'rejected', 'skipped'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE approval_decision_kind AS ENUM ('approve', 'reject', 'abstain');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── the catalog: what can be asked for ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.request_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    -- Stable key used by code and by the URL: `hr.leave`, `iam.access`.
    code text NOT NULL,
    name text NOT NULL,
    module text NOT NULL,
    description text,
    icon text,
    -- Permission a user needs to raise one. NULL means anyone may.
    raise_permission text,
    requires_justification boolean DEFAULT true NOT NULL,
    requires_attachment boolean DEFAULT false NOT NULL,
    -- Time-boxes the grant this request produces, in hours. The Microsoft PIM
    -- idea: access that does not expire is access nobody revisits.
    max_duration_hours integer,
    -- Which registered effect runs on approval. NULL is deliberate and is what
    -- makes a config-only request type possible: for a parking pass the
    -- approval *is* the outcome, and no code needs to exist.
    effect_key text,
    default_workflow_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT request_types_pkey PRIMARY KEY (id),
    CONSTRAINT request_types_duration_positive
        CHECK (max_duration_hours IS NULL OR max_duration_hours > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_request_types_code
    ON public.request_types (tenant_id, code)
    WHERE deleted_at IS NULL;

-- The request form, as data rather than a component per type.
CREATE TABLE IF NOT EXISTS public.request_type_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    -- text | number | date | select | user | department | attachment | boolean
    field_type text NOT NULL,
    help_text text,
    is_required boolean DEFAULT false NOT NULL,
    -- Choices for `select`, and validation bounds for the rest.
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation jsonb DEFAULT '{}'::jsonb NOT NULL,
    section text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT request_type_fields_pkey PRIMARY KEY (id),
    CONSTRAINT request_type_fields_type_fkey
        FOREIGN KEY (request_type_id) REFERENCES public.request_types (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_request_type_fields_key
    ON public.request_type_fields (request_type_id, key)
    WHERE deleted_at IS NULL;

-- ── the chain, as data and versioned ────────────────────────────────────────
--
-- Versioned because a policy edited next month must not rewrite what happened
-- last month. A request pins the version it was raised under, so the trail
-- still reads correctly years later.

CREATE TABLE IF NOT EXISTS public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    -- When more than one workflow exists for a type, the first whose condition
    -- matches wins: leave over 10 days takes a longer chain than leave over 1.
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    sla_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT approval_workflows_pkey PRIMARY KEY (id),
    CONSTRAINT approval_workflows_type_fkey
        FOREIGN KEY (request_type_id) REFERENCES public.request_types (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_workflows_code_version
    ON public.approval_workflows (tenant_id, code, version)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.approval_workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    seq integer NOT NULL,
    name text NOT NULL,
    -- Who decides. One of: role, permission, reporting_manager,
    -- department_head, designation_level_at_least, named_user, external,
    -- automatic. Resolved when the step activates, not when the request is
    -- raised — an approver who leaves mid-chain must not hold it up.
    approver_rule jsonb NOT NULL,
    -- Approvals needed here. 2 expresses NDPS dual lock and four-eyes review
    -- without either being a special case in code.
    quorum integer DEFAULT 1 NOT NULL,
    -- Schedule X: the decision is invalid without a witness who is not the
    -- person deciding.
    requires_witness boolean DEFAULT false NOT NULL,
    sla_hours integer,
    -- What happens when the SLA passes: widen to a higher designation level,
    -- notify, or nothing. Escalation never approves; it only widens who may.
    escalation jsonb DEFAULT '{}'::jsonb NOT NULL,
    allow_delegate boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT approval_workflow_steps_pkey PRIMARY KEY (id),
    CONSTRAINT approval_workflow_steps_workflow_fkey
        FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows (id),
    CONSTRAINT approval_workflow_steps_quorum_positive CHECK (quorum >= 1),
    -- A chain long enough to be a denial of service is a misconfiguration, not
    -- a policy.
    CONSTRAINT approval_workflow_steps_seq_bounded CHECK (seq >= 1 AND seq <= 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_workflow_steps_seq
    ON public.approval_workflow_steps (workflow_id, seq)
    WHERE deleted_at IS NULL;

DO $$ BEGIN
    ALTER TABLE public.request_types
        ADD CONSTRAINT request_types_default_workflow_fkey
        FOREIGN KEY (default_workflow_id) REFERENCES public.approval_workflows (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── the request itself ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_type_id uuid NOT NULL,
    -- Denormalised from request_types so the inbox does not join to filter,
    -- and so the trail survives a type being renamed.
    kind text NOT NULL,
    -- The domain row this concerns, when one already exists. Null for types
    -- where the request comes first.
    subject_type text,
    subject_id uuid,
    requester_id uuid NOT NULL,
    -- Who it is *about*, when not the requester: the user being granted
    -- access, the employee taking the leave. They may not decide it either.
    on_behalf_of_id uuid,
    reason text NOT NULL,
    -- Answers to request_type_fields.
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    -- Pinned at creation. The chain that ran, not the chain as configured now.
    workflow_id uuid NOT NULL,
    status approval_request_status DEFAULT 'draft'::approval_request_status NOT NULL,
    -- Which stage is live. Every decision guards on this, which is what stops
    -- a stage being skipped and what settles two approvers clicking at once.
    current_step_seq integer DEFAULT 1 NOT NULL,
    -- Set by the type's elevation policy at creation; approving then needs a
    -- bypass role.
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
    CONSTRAINT approval_requests_pkey PRIMARY KEY (id),
    CONSTRAINT approval_requests_type_fkey
        FOREIGN KEY (request_type_id) REFERENCES public.request_types (id),
    CONSTRAINT approval_requests_workflow_fkey
        FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows (id),
    -- Every request says why. This is an audit requirement before it is a
    -- usability one.
    CONSTRAINT approval_requests_reason_present CHECK (length(btrim(reason)) > 0)
);

-- The subject lookup: "what is outstanding against this leave row?"
CREATE INDEX IF NOT EXISTS idx_approval_requests_subject
    ON public.approval_requests (tenant_id, subject_type, subject_id)
    WHERE deleted_at IS NULL;

-- "What did I ask for?"
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester
    ON public.approval_requests (tenant_id, requester_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- The escalation sweep. One periodic pass over this index rather than a timer
-- per request; `status` first because only live requests can breach.
CREATE INDEX IF NOT EXISTS idx_approval_requests_sla
    ON public.approval_requests (tenant_id, status, sla_due_at)
    WHERE deleted_at IS NULL AND sla_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_id uuid NOT NULL,
    seq integer NOT NULL,
    name text NOT NULL,
    -- Copied from the workflow step so the trail is readable even after the
    -- workflow is edited or retired.
    approver_rule jsonb NOT NULL,
    quorum integer DEFAULT 1 NOT NULL,
    requires_witness boolean DEFAULT false NOT NULL,
    status approval_step_status DEFAULT 'waiting'::approval_step_status NOT NULL,
    activated_at timestamp with time zone,
    sla_due_at timestamp with time zone,
    escalated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_steps_pkey PRIMARY KEY (id),
    CONSTRAINT approval_steps_request_fkey
        FOREIGN KEY (request_id) REFERENCES public.approval_requests (id) ON DELETE CASCADE,
    CONSTRAINT approval_steps_quorum_positive CHECK (quorum >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_steps_seq
    ON public.approval_steps (request_id, seq);

-- Resolved approvers, written when a step activates.
--
-- This table is why the inbox is fast. Without it, "what awaits me?" means
-- evaluating every live step's approver rule against the asking user — a rule
-- engine run per candidate row, on the one screen every employee opens. With
-- it, the inbox is an index scan.
CREATE TABLE IF NOT EXISTS public.approval_step_assignees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    step_id uuid NOT NULL,
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    -- Set when this person is here because somebody delegated to them. The
    -- decision records the delegate as the actor and this alongside it, never
    -- the delegator as the actor — they did not decide.
    via_delegation_id uuid,
    -- Added by escalation rather than by the original rule.
    added_by_escalation boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_step_assignees_pkey PRIMARY KEY (id),
    CONSTRAINT approval_step_assignees_step_fkey
        FOREIGN KEY (step_id) REFERENCES public.approval_steps (id) ON DELETE CASCADE,
    CONSTRAINT approval_step_assignees_request_fkey
        FOREIGN KEY (request_id) REFERENCES public.approval_requests (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_step_assignees
    ON public.approval_step_assignees (step_id, user_id);

-- The inbox query, exactly: awaiting me, newest first.
CREATE INDEX IF NOT EXISTS idx_approval_step_assignees_inbox
    ON public.approval_step_assignees (tenant_id, user_id, request_id);

-- Append-only. No updates, no deletes: a reversal is a new decision on a new
-- step, never an edit to what somebody previously said.
CREATE TABLE IF NOT EXISTS public.approval_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    step_id uuid NOT NULL,
    request_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    decision approval_decision_kind NOT NULL,
    note text,
    -- Schedule X and clinical co-signature.
    witnessed_by uuid,
    via_delegation_id uuid,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    signature_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_decisions_pkey PRIMARY KEY (id),
    CONSTRAINT approval_decisions_step_fkey
        FOREIGN KEY (step_id) REFERENCES public.approval_steps (id) ON DELETE CASCADE,
    CONSTRAINT approval_decisions_request_fkey
        FOREIGN KEY (request_id) REFERENCES public.approval_requests (id) ON DELETE CASCADE,
    -- Nobody witnesses themselves. Enforced in the core and again here,
    -- because this is the row an inspector reads.
    CONSTRAINT approval_decisions_witness_not_actor
        CHECK (witnessed_by IS NULL OR witnessed_by <> actor_id)
);

-- One voice per person per step. Without this a quorum of two is one person
-- clicking twice, and a dual lock is a single lock with extra steps.
CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_decisions_actor_step
    ON public.approval_decisions (step_id, actor_id);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_request
    ON public.approval_decisions (request_id, signed_at);

CREATE TABLE IF NOT EXISTS public.approval_delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    -- Empty means every kind. Narrow is better; a blanket delegation is how
    -- an approval chain quietly becomes one person.
    kinds text[] DEFAULT '{}'::text[] NOT NULL,
    reason text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT approval_delegations_pkey PRIMARY KEY (id),
    -- Delegating to yourself is a no-op that looks like coverage.
    CONSTRAINT approval_delegations_not_self CHECK (delegator_id <> delegate_id),
    -- An open-ended delegation is the one nobody remembers to revoke.
    CONSTRAINT approval_delegations_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate
    ON public.approval_delegations (tenant_id, delegate_id, starts_at, ends_at)
    WHERE revoked_at IS NULL;

-- ── the department head the leave chain never had ───────────────────────────
--
-- `departments` had no head column, so the HOD stage of a leave approval could
-- not resolve who the HOD was — the code stamped whoever happened to click.
-- Deriving it from `designations.level` is a fallback, not an answer: two
-- consultants at the same level are ambiguous, and a hospital knows who runs
-- the department.

ALTER TABLE public.departments
    ADD COLUMN IF NOT EXISTS head_employee_id uuid;

-- ── row-level security ──────────────────────────────────────────────────────

ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_type_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_step_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_delegations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_types_tenant_isolation ON public.request_types;
CREATE POLICY request_types_tenant_isolation ON public.request_types
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS request_type_fields_tenant_isolation ON public.request_type_fields;
CREATE POLICY request_type_fields_tenant_isolation ON public.request_type_fields
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_workflows_tenant_isolation ON public.approval_workflows;
CREATE POLICY approval_workflows_tenant_isolation ON public.approval_workflows
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_workflow_steps_tenant_isolation ON public.approval_workflow_steps;
CREATE POLICY approval_workflow_steps_tenant_isolation ON public.approval_workflow_steps
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_requests_tenant_isolation ON public.approval_requests;
CREATE POLICY approval_requests_tenant_isolation ON public.approval_requests
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_steps_tenant_isolation ON public.approval_steps;
CREATE POLICY approval_steps_tenant_isolation ON public.approval_steps
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_step_assignees_tenant_isolation ON public.approval_step_assignees;
CREATE POLICY approval_step_assignees_tenant_isolation ON public.approval_step_assignees
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_decisions_tenant_isolation ON public.approval_decisions;
CREATE POLICY approval_decisions_tenant_isolation ON public.approval_decisions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS approval_delegations_tenant_isolation ON public.approval_delegations;
CREATE POLICY approval_delegations_tenant_isolation ON public.approval_delegations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── updated_at ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_request_types_updated_at ON public.request_types;
CREATE TRIGGER trg_request_types_updated_at BEFORE UPDATE ON public.request_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_request_type_fields_updated_at ON public.request_type_fields;
CREATE TRIGGER trg_request_type_fields_updated_at BEFORE UPDATE ON public.request_type_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_approval_workflows_updated_at ON public.approval_workflows;
CREATE TRIGGER trg_approval_workflows_updated_at BEFORE UPDATE ON public.approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_approval_workflow_steps_updated_at ON public.approval_workflow_steps;
CREATE TRIGGER trg_approval_workflow_steps_updated_at BEFORE UPDATE ON public.approval_workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_approval_steps_updated_at ON public.approval_steps;
CREATE TRIGGER trg_approval_steps_updated_at BEFORE UPDATE ON public.approval_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.approval_requests IS
    'Every request for anything, of any type. The type, its form and its approval chain are all data, so a new kind of request needs no table and no deployment.';
COMMENT ON TABLE public.approval_decisions IS
    'Append-only record of who decided what, when, and with which witness. A reversal is a new decision on a new step, never an edit.';
COMMENT ON TABLE public.approval_step_assignees IS
    'Approvers resolved at step activation. Makes the inbox an index scan instead of a rule evaluation per candidate row.';
