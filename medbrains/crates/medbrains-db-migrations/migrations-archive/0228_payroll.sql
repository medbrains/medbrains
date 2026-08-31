-- Migration: 0228_payroll.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Payroll — salary structures per employee, a payroll run per period, and the computed
-- payslips. Attendance drives loss-of-pay (LOP); India statutory heads (PF/ESI/PT) are
-- computed at generation time. Money = numeric(12,2). Tenant RLS.

CREATE TABLE IF NOT EXISTS salary_structures (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id        uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    basic              numeric(12, 2) NOT NULL DEFAULT 0,
    hra                numeric(12, 2) NOT NULL DEFAULT 0,
    other_allowances   numeric(12, 2) NOT NULL DEFAULT 0,
    monthly_tds        numeric(12, 2) NOT NULL DEFAULT 0,
    pf_applicable      boolean NOT NULL DEFAULT true,
    esi_applicable     boolean NOT NULL DEFAULT true,
    pt_applicable      boolean NOT NULL DEFAULT true,
    effective_from     date NOT NULL DEFAULT CURRENT_DATE,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, employee_id)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_month       smallint NOT NULL,
    period_year        smallint NOT NULL,
    status             text NOT NULL DEFAULT 'draft',
    working_days       smallint NOT NULL,
    employee_count     integer NOT NULL DEFAULT 0,
    total_net_pay      numeric(14, 2) NOT NULL DEFAULT 0,
    run_by             uuid,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS payslips (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_id             uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id        uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    working_days       smallint NOT NULL,
    lop_days           numeric(4, 1) NOT NULL DEFAULT 0,
    paid_days          numeric(4, 1) NOT NULL DEFAULT 0,
    gross              numeric(12, 2) NOT NULL DEFAULT 0,
    earned_gross       numeric(12, 2) NOT NULL DEFAULT 0,
    earned_basic       numeric(12, 2) NOT NULL DEFAULT 0,
    pf                 numeric(12, 2) NOT NULL DEFAULT 0,
    esi                numeric(12, 2) NOT NULL DEFAULT 0,
    pt                 numeric(12, 2) NOT NULL DEFAULT 0,
    tds                numeric(12, 2) NOT NULL DEFAULT 0,
    other_deductions   numeric(12, 2) NOT NULL DEFAULT 0,
    total_deductions   numeric(12, 2) NOT NULL DEFAULT 0,
    net_pay            numeric(12, 2) NOT NULL DEFAULT 0,
    earnings           jsonb NOT NULL DEFAULT '{}'::jsonb,
    deductions         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_structures_tenant ON salary_structures (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON payroll_runs (tenant_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips (tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips (tenant_id, employee_id);

ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY salary_structures_tenant_isolation ON salary_structures
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY payroll_runs_tenant_isolation ON payroll_runs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY payslips_tenant_isolation ON payslips
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER salary_structures_updated_at BEFORE UPDATE ON salary_structures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payroll_runs_updated_at BEFORE UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payslips_updated_at BEFORE UPDATE ON payslips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
