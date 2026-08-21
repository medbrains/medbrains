-- Automation: what a workflow remembers, what a deployment is configured with,
-- and where the files it downloads live.
--
-- All three are per tenant, and that is the whole reason they are here rather
-- than in a config file. A watermark shared between two hospitals would have
-- each one skipping the other's records. A base URL shared would point one
-- hospital's sync at another's server. A file readable across tenants is a
-- disclosure, and the file in question is usually a scanned discharge summary.

-- What a workflow remembers between runs: the timestamp an incremental sync
-- last reached, and nothing bigger. Deliberately small — anything holding
-- clinical data belongs in the execution history, which is pruned.
CREATE TABLE IF NOT EXISTS public.automation_state (
    tenant_id   UUID NOT NULL,
    workflow_id UUID NOT NULL
                    REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, workflow_id, key)
);

-- Values that differ between this deployment and another, read in a workflow
-- as `{{ vars.NAME }}`.
--
-- Not a secret store. Everything here is readable by anyone who can edit a
-- workflow, because that is what reading `vars` means; a token belongs in
-- automation_credentials, which is encrypted.
CREATE TABLE IF NOT EXISTS public.automation_variables (
    tenant_id  UUID NOT NULL,
    key        TEXT NOT NULL,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, key)
);

-- Files a run downloaded that were too large to carry in the run itself.
--
-- The bytes are held here rather than beside the database because a hospital
-- deployment may be several servers, and a file written to one worker's disk
-- is a file the other workers cannot serve. Postgres is already the thing they
-- all share.
CREATE TABLE IF NOT EXISTS public.automation_binaries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    -- The run that produced it, so pruning a workflow's history takes its
    -- attachments. Without this link a disk fills with files nothing points
    -- at — quietly, and once per run.
    execution_id UUID NOT NULL,
    file_name    TEXT,
    mime_type    TEXT NOT NULL,
    size_bytes   BIGINT NOT NULL,
    bytes        BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_binaries_execution
    ON public.automation_binaries (tenant_id, execution_id);

ALTER TABLE public.automation_state     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_binaries  ENABLE ROW LEVEL SECURITY;

-- The same isolation the rest of automation uses. `USING` keeps reads inside
-- the tenant; `WITH CHECK` is the half that matters for writes, without which
-- a watermark could be written against another hospital's id.
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'automation_state',
        'automation_variables',
        'automation_binaries'
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
