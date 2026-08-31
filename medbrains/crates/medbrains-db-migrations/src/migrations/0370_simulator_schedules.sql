-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 3
-- Drops: none
-- simulator schedules — schema.
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



CREATE TABLE public.simulator_run_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    step_type text NOT NULL,
    target_id uuid,
    success boolean NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: simulator_run_steps simulator_run_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_run_steps
    ADD CONSTRAINT simulator_run_steps_pkey PRIMARY KEY (id);

CREATE INDEX idx_simulator_run_steps_run ON public.simulator_run_steps USING btree (run_id, created_at);

ALTER TABLE public.simulator_run_steps ENABLE ROW LEVEL SECURITY;

-- Name: simulator_run_steps simulator_run_steps_tenant_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY simulator_run_steps_tenant_rls ON public.simulator_run_steps USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

CREATE TABLE public.simulator_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_id uuid,
    triggered_by uuid,
    trigger_kind text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_status text DEFAULT 'auto_committed'::text NOT NULL,
    CONSTRAINT simulator_runs_approval_status_check CHECK ((approval_status = ANY (ARRAY['auto_committed'::text, 'pending_approval'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT simulator_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT simulator_runs_trigger_kind_check CHECK ((trigger_kind = ANY (ARRAY['manual'::text, 'cron'::text])))
);

-- Name: simulator_runs simulator_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_runs
    ADD CONSTRAINT simulator_runs_pkey PRIMARY KEY (id);

CREATE INDEX idx_simulator_runs_pending_approval ON public.simulator_runs USING btree (tenant_id, started_at DESC) WHERE (approval_status = 'pending_approval'::text);

CREATE INDEX idx_simulator_runs_schedule ON public.simulator_runs USING btree (schedule_id, started_at DESC) WHERE (schedule_id IS NOT NULL);

CREATE INDEX idx_simulator_runs_tenant_started ON public.simulator_runs USING btree (tenant_id, started_at DESC);

ALTER TABLE public.simulator_runs ENABLE ROW LEVEL SECURITY;

-- Name: simulator_runs simulator_runs_tenant_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY simulator_runs_tenant_rls ON public.simulator_runs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- RLS-Posture: tenant-scoped
-- Internal data simulator control plane.
-- `simulator_schedules` defines a named profile + cron expression that a
-- super-admin (or hospital-admin) can run on demand or have the scheduler
-- fire automatically. Each run produces a `simulator_runs` row with a
-- summary and per-step audit in `simulator_run_steps`. Every row downstream
-- (encounters, admissions, er_visits, lab_orders, radiology_orders,
-- pharmacy_orders) carries `is_dummy = true` from migration 0139 so
-- regulator-facing reports filter it out.
-- Tenant-scoped + RLS. cron expression is nullable until the Day-2
-- background scheduler lands; manual run-now works without one.

CREATE TABLE public.simulator_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    cron_expr text,
    profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

-- Name: simulator_schedules simulator_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_schedules
    ADD CONSTRAINT simulator_schedules_pkey PRIMARY KEY (id);

CREATE INDEX idx_simulator_schedules_enabled ON public.simulator_schedules USING btree (tenant_id, enabled, next_run_at) WHERE ((deleted_at IS NULL) AND (enabled = true));

CREATE INDEX idx_simulator_schedules_tenant ON public.simulator_schedules USING btree (tenant_id) WHERE (deleted_at IS NULL);

ALTER TABLE public.simulator_schedules ENABLE ROW LEVEL SECURITY;

-- Name: simulator_schedules simulator_schedules_tenant_rls; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY simulator_schedules_tenant_rls ON public.simulator_schedules USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: simulator_schedules simulator_schedules_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER simulator_schedules_set_updated_at BEFORE UPDATE ON public.simulator_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: simulator_run_steps simulator_run_steps_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_run_steps
    ADD CONSTRAINT simulator_run_steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.simulator_runs(id) ON DELETE CASCADE;

-- Name: simulator_runs simulator_runs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulator_runs
    ADD CONSTRAINT simulator_runs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.simulator_schedules(id) ON DELETE SET NULL;
