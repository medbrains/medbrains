-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 3
-- Drops: none
-- payroll — schema.
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



CREATE TABLE public.payroll_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    period_month smallint NOT NULL,
    period_year smallint NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    working_days smallint NOT NULL,
    employee_count integer DEFAULT 0 NOT NULL,
    total_net_pay numeric(14,2) DEFAULT 0 NOT NULL,
    run_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);

-- Name: payroll_runs payroll_runs_tenant_id_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_tenant_id_period_month_period_year_key UNIQUE (tenant_id, period_month, period_year);

CREATE INDEX idx_payroll_runs_tenant ON public.payroll_runs USING btree (tenant_id, period_year, period_month);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Name: payroll_runs payroll_runs_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payroll_runs_tenant_isolation ON public.payroll_runs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: payroll_runs payroll_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.payslips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    working_days smallint NOT NULL,
    lop_days numeric(4,1) DEFAULT 0 NOT NULL,
    paid_days numeric(4,1) DEFAULT 0 NOT NULL,
    gross numeric(12,2) DEFAULT 0 NOT NULL,
    earned_gross numeric(12,2) DEFAULT 0 NOT NULL,
    earned_basic numeric(12,2) DEFAULT 0 NOT NULL,
    pf numeric(12,2) DEFAULT 0 NOT NULL,
    esi numeric(12,2) DEFAULT 0 NOT NULL,
    pt numeric(12,2) DEFAULT 0 NOT NULL,
    tds numeric(12,2) DEFAULT 0 NOT NULL,
    other_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    total_deductions numeric(12,2) DEFAULT 0 NOT NULL,
    net_pay numeric(12,2) DEFAULT 0 NOT NULL,
    earnings jsonb DEFAULT '{}'::jsonb NOT NULL,
    deductions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);

-- Name: payslips payslips_tenant_id_run_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_tenant_id_run_id_employee_id_key UNIQUE (tenant_id, run_id, employee_id);

CREATE INDEX idx_payslips_employee ON public.payslips USING btree (tenant_id, employee_id);

CREATE INDEX idx_payslips_run ON public.payslips USING btree (tenant_id, run_id);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Name: payslips payslips_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payslips_tenant_isolation ON public.payslips USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: payslips payslips_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payslips_updated_at BEFORE UPDATE ON public.payslips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0228_payroll.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Payroll — salary structures per employee, a payroll run per period, and the computed
-- payslips. Attendance drives loss-of-pay (LOP); India statutory heads (PF/ESI/PT) are
-- computed at generation time. Money = numeric(12,2). Tenant RLS.

CREATE TABLE public.salary_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    basic numeric(12,2) DEFAULT 0 NOT NULL,
    hra numeric(12,2) DEFAULT 0 NOT NULL,
    other_allowances numeric(12,2) DEFAULT 0 NOT NULL,
    monthly_tds numeric(12,2) DEFAULT 0 NOT NULL,
    pf_applicable boolean DEFAULT true NOT NULL,
    esi_applicable boolean DEFAULT true NOT NULL,
    pt_applicable boolean DEFAULT true NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: salary_structures salary_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT salary_structures_pkey PRIMARY KEY (id);

-- Name: salary_structures salary_structures_tenant_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_structures
    ADD CONSTRAINT salary_structures_tenant_id_employee_id_key UNIQUE (tenant_id, employee_id);

CREATE INDEX idx_salary_structures_tenant ON public.salary_structures USING btree (tenant_id, employee_id);

ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;

-- Name: salary_structures salary_structures_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salary_structures_tenant_isolation ON public.salary_structures USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: salary_structures salary_structures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER salary_structures_updated_at BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: payslips payslips_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
