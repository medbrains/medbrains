-- Workflow automation: the tables the r8r engine keeps its state in.
--
-- Automation is a bolt-on. It is useful, it is not clinical, and the hospital
-- must keep running if it is switched off — so everything it owns lives in its
-- own `automation_` tables and nothing in the clinical schema references them.
-- Dropping these four tables removes the feature and touches nothing else.
--
-- The interesting column is `run_as_permissions`.
--
-- A workflow fired by a schedule at 03:00 has no user behind it, so something
-- has to decide what it is allowed to do. Letting it act with no limit would
-- make automation a way around the permission system: anyone who can save a
-- workflow could read any patient in the tenant. Instead the permissions are
-- captured from the person who activates it, and the API refuses to store a
-- set larger than that person actually holds. Automation can therefore never
-- do more than the human who armed it, and revoking their access does not
-- silently leave a running workflow with powers nobody has.
--
-- `run_as_user_id` records who that was, so an audit answers "under whose
-- authority did this run" without inference.
--
-- Credential data is ciphertext produced by the engine before it arrives here;
-- this database never sees a token in the clear.

CREATE TABLE IF NOT EXISTS public.automation_workflows (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    name                TEXT NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT FALSE,
    -- The graph, as the engine serialises it.
    nodes               JSONB NOT NULL DEFAULT '[]'::jsonb,
    connections         JSONB NOT NULL DEFAULT '[]'::jsonb,
    settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- The authority this workflow runs with when no user is present.
    run_as_user_id      UUID,
    run_as_permissions  TEXT[] NOT NULL DEFAULT '{}',
    created_by          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_workflows_tenant
    ON public.automation_workflows (tenant_id, updated_at DESC);

-- The scheduler and the webhook router both scan for active workflows on every
-- tick and every inbound request, so that lookup gets its own index.
CREATE INDEX IF NOT EXISTS automation_workflows_active
    ON public.automation_workflows (tenant_id)
    WHERE active;

CREATE TABLE IF NOT EXISTS public.automation_credentials (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,
    -- Sealed by the engine (AES-256-GCM) before it reaches this column.
    data         TEXT NOT NULL,
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_credentials_tenant
    ON public.automation_credentials (tenant_id, type);

CREATE TABLE IF NOT EXISTS public.automation_executions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    workflow_id   UUID NOT NULL
                      REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
    workflow_name TEXT NOT NULL,
    status        TEXT NOT NULL,
    mode          TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ,
    duration_ms   BIGINT NOT NULL DEFAULT 0,
    error         TEXT,
    -- Per-node input and output for the run. Trimmed by retention below.
    data          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS automation_executions_workflow
    ON public.automation_executions (tenant_id, workflow_id, started_at DESC);

-- A run's payload can hold clinical data, so history is not kept forever; the
-- engine prunes per workflow, and this index is what makes that cheap.
CREATE INDEX IF NOT EXISTS automation_executions_age
    ON public.automation_executions (started_at);

-- Webhook paths are claimed per tenant, so two hospitals on the same instance
-- can both own `/webhook/lab-results` without colliding.
CREATE TABLE IF NOT EXISTS public.automation_webhooks (
    tenant_id   UUID NOT NULL,
    path        TEXT NOT NULL,
    method      TEXT NOT NULL,
    workflow_id UUID NOT NULL
                    REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
    node_id     TEXT NOT NULL,
    PRIMARY KEY (tenant_id, path, method)
);

ALTER TABLE public.automation_workflows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_webhooks    ENABLE ROW LEVEL SECURITY;

-- Same tenant isolation the clinical tables use. `USING` keeps reads inside the
-- tenant; `WITH CHECK` is the half that matters for writes, without which a
-- workflow could be inserted against another hospital's id.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'automation_workflows',
        'automation_credentials',
        'automation_executions',
        'automation_webhooks'
    ]
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I', t, t
        );
        EXECUTE format(
            'CREATE POLICY %I_tenant_isolation ON public.%I
                 USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
                 WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
            t, t
        );
    END LOOP;
END $$;
