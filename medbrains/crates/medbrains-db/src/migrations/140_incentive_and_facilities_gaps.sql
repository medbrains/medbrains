-- ====================================================================
-- Migration: 140_incentive_and_facilities_gaps.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: incentive_plans, incentive_plan_rules,
--             doctor_incentive_assignments, incentive_calculations,
--             work_orders, equipment, calibrations,
--             leave_applications, training_attendance, tds_certificates
-- Drops: none
-- ====================================================================
-- HR/incentive + facilities (BME) + HR-ops tables surfaced by smoke
-- as 5xx (relation does not exist). Shapes derived from TS types and
-- handler SQL.
-- ====================================================================

-- ── HR: Incentives (4 tables) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS incentive_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    plan_name           TEXT NOT NULL,
    plan_code           TEXT NOT NULL,
    description         TEXT,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    calculation_basis   TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, plan_code)
);
ALTER TABLE incentive_plans FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('incentive_plans');

CREATE TABLE IF NOT EXISTS incentive_plan_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES incentive_plans(id) ON DELETE CASCADE,
    rule_name       TEXT NOT NULL,
    service_type    TEXT,
    department_id   UUID REFERENCES departments(id),
    min_threshold   NUMERIC(14,2),
    max_threshold   NUMERIC(14,2),
    percentage      NUMERIC(7,2),
    fixed_amount    NUMERIC(14,2),
    multiplier      NUMERIC(7,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incentive_rules_plan ON incentive_plan_rules(plan_id);

CREATE TABLE IF NOT EXISTS doctor_incentive_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    doctor_id           UUID NOT NULL REFERENCES users(id),
    plan_id             UUID NOT NULL REFERENCES incentive_plans(id),
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    custom_percentage   NUMERIC(7,2),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doctor_incentive_doc ON doctor_incentive_assignments(tenant_id, doctor_id);
ALTER TABLE doctor_incentive_assignments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_incentive_assignments');

CREATE TABLE IF NOT EXISTS incentive_calculations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    doctor_id           UUID NOT NULL REFERENCES users(id),
    plan_id             UUID NOT NULL REFERENCES incentive_plans(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    gross_revenue       NUMERIC(14,2),
    eligible_revenue    NUMERIC(14,2),
    incentive_amount    NUMERIC(14,2),
    deductions          NUMERIC(14,2),
    net_payable         NUMERIC(14,2),
    status              TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    payment_reference   TEXT,
    calculation_details JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incentive_calcs_doctor ON incentive_calculations(tenant_id, doctor_id, period_start DESC);
ALTER TABLE incentive_calculations FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('incentive_calculations');

-- ── BME / Facilities (3 tables) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    asset_tag           TEXT,
    name                TEXT NOT NULL,
    category            TEXT,
    manufacturer        TEXT,
    model               TEXT,
    serial_number       TEXT,
    department_id       UUID REFERENCES departments(id),
    location_id         UUID REFERENCES locations(id),
    status              TEXT,
    purchase_date       DATE,
    warranty_until      DATE,
    cost                NUMERIC(14,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE equipment FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('equipment');

CREATE TABLE IF NOT EXISTS calibrations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    equipment_id        UUID REFERENCES equipment(id) ON DELETE CASCADE,
    calibration_date    DATE NOT NULL,
    next_due_date       DATE,
    performed_by        UUID REFERENCES users(id),
    vendor              TEXT,
    certificate_number  TEXT,
    result              TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calibrations_equipment ON calibrations(tenant_id, equipment_id, calibration_date DESC);
ALTER TABLE calibrations FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('calibrations');

CREATE TABLE IF NOT EXISTS work_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    work_order_number   TEXT,
    equipment_id        UUID REFERENCES equipment(id),
    category            TEXT,
    priority            TEXT,
    status              TEXT NOT NULL DEFAULT 'open',
    description         TEXT NOT NULL,
    requested_by        UUID REFERENCES users(id),
    assigned_to         UUID REFERENCES users(id),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    cost                NUMERIC(14,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(tenant_id, status);
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('work_orders');

-- ── HR ops (3 tables) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    employee_id     UUID NOT NULL REFERENCES users(id),
    leave_type      TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    days            NUMERIC(4,1),
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_applications(tenant_id, employee_id, start_date DESC);
ALTER TABLE leave_applications FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('leave_applications');

CREATE TABLE IF NOT EXISTS training_attendance (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    employee_id     UUID NOT NULL REFERENCES users(id),
    training_name   TEXT NOT NULL,
    training_date   DATE NOT NULL,
    duration_hours  NUMERIC(5,2),
    location        TEXT,
    trainer         TEXT,
    certificate_url TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_emp ON training_attendance(tenant_id, employee_id, training_date DESC);
ALTER TABLE training_attendance FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('training_attendance');

CREATE TABLE IF NOT EXISTS tds_certificates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    employee_id         UUID REFERENCES users(id),
    vendor_id           UUID,
    financial_year      TEXT NOT NULL,
    quarter             TEXT,
    certificate_number  TEXT,
    section             TEXT,
    gross_amount        NUMERIC(14,2),
    tds_amount          NUMERIC(14,2),
    deposited_at        TIMESTAMPTZ,
    issued_at           TIMESTAMPTZ,
    pdf_url             TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tds_certificates FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('tds_certificates');
