-- Internal data simulator control plane.
--
-- `simulator_schedules` defines a named profile + cron expression that a
-- super-admin (or hospital-admin) can run on demand or have the scheduler
-- fire automatically. Each run produces a `simulator_runs` row with a
-- summary and per-step audit in `simulator_run_steps`. Every row downstream
-- (encounters, admissions, er_visits, lab_orders, radiology_orders,
-- pharmacy_orders) carries `is_dummy = true` from migration 0139 so
-- regulator-facing reports filter it out.
--
-- Tenant-scoped + RLS. cron expression is nullable until the Day-2
-- background scheduler lands; manual run-now works without one.

CREATE TABLE IF NOT EXISTS public.simulator_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    cron_expr text,
    profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT true,
    created_by uuid,
    last_run_at timestamptz,
    next_run_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_simulator_schedules_tenant
    ON public.simulator_schedules (tenant_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_simulator_schedules_enabled
    ON public.simulator_schedules (tenant_id, enabled, next_run_at)
    WHERE deleted_at IS NULL AND enabled = true;

CREATE TABLE IF NOT EXISTS public.simulator_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    schedule_id uuid REFERENCES public.simulator_schedules(id) ON DELETE SET NULL,
    triggered_by uuid,
    trigger_kind text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running',
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulator_runs_trigger_kind_check
        CHECK (trigger_kind IN ('manual', 'cron')),
    CONSTRAINT simulator_runs_status_check
        CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_simulator_runs_tenant_started
    ON public.simulator_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulator_runs_schedule
    ON public.simulator_runs (schedule_id, started_at DESC)
    WHERE schedule_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.simulator_run_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL REFERENCES public.simulator_runs(id) ON DELETE CASCADE,
    step_type text NOT NULL,
    target_id uuid,
    success boolean NOT NULL,
    error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulator_run_steps_run
    ON public.simulator_run_steps (run_id, created_at);

-- ── Row-Level Security ───────────────────────────────────────────────
ALTER TABLE public.simulator_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_run_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simulator_schedules_tenant_rls ON public.simulator_schedules;
CREATE POLICY simulator_schedules_tenant_rls ON public.simulator_schedules
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS simulator_runs_tenant_rls ON public.simulator_runs;
CREATE POLICY simulator_runs_tenant_rls ON public.simulator_runs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS simulator_run_steps_tenant_rls ON public.simulator_run_steps;
CREATE POLICY simulator_run_steps_tenant_rls ON public.simulator_run_steps
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Reuse the standard updated_at trigger.
DROP TRIGGER IF EXISTS simulator_schedules_set_updated_at ON public.simulator_schedules;
CREATE TRIGGER simulator_schedules_set_updated_at
    BEFORE UPDATE ON public.simulator_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
