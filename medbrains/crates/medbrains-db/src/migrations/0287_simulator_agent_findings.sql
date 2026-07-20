-- RLS-Posture: tenant-scoped
-- LLM-driven simulator: per-run findings.
--
-- The scripted simulator (migration 0140) records numeric counts in
-- `simulator_runs.summary` and per-step audit in `simulator_run_steps`.
-- The agent simulator additionally emits free-text FINDINGS — a synthetic
-- user (an LLM acting as a real role, in a real department/locale) reporting
-- what it could not do, what confused it, a permission it hit that it should
-- not have, an untranslated string, or a workflow dead-end. These are the
-- payoff of the agent runs and have no home in the typed numeric summary, so
-- they live here.
--
-- `cell` captures the factor combination the finding came from (role,
-- department, locale, persona, goal) so findings can be grouped/de-duped and
-- fed back into the self-improving loop. `step_ref` optionally points at the
-- `simulator_run_steps` row that triggered it. Tenant-scoped + RLS; cascades
-- with the run so `reject_run` purges findings alongside the synthetic rows.

CREATE TABLE IF NOT EXISTS public.simulator_run_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL REFERENCES public.simulator_runs(id) ON DELETE CASCADE,
    cell jsonb NOT NULL DEFAULT '{}'::jsonb,
    kind text NOT NULL,
    severity text NOT NULL DEFAULT 'info',
    message text NOT NULL,
    step_ref uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulator_run_findings_kind_check
        CHECK (kind IN ('usability', 'permission', 'locale', 'error', 'workflow', 'discovery')),
    CONSTRAINT simulator_run_findings_severity_check
        CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_simulator_run_findings_run
    ON public.simulator_run_findings (run_id, created_at);

ALTER TABLE public.simulator_run_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simulator_run_findings_tenant_rls ON public.simulator_run_findings;
CREATE POLICY simulator_run_findings_tenant_rls ON public.simulator_run_findings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
