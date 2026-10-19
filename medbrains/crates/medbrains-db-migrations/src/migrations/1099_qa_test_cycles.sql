-- ====================================================================
-- Migration: 1099_qa_test_cycles.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: qa_test_cycles, qa_test_results
-- Drops: none
-- ====================================================================
-- In-app test tracking (#4804). A test cycle is one round of role testing
-- ("Pre go-live round 1"); testers signed in as test_<role> mark each of
-- their role's cases Pass, Fail or Blocked in the open cycle. The cases
-- themselves are computed from the code (menu + role grants + workflows),
-- so only the results are stored. One open cycle per hospital.

CREATE TABLE qa_test_cycles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    name        text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
    opened_by   uuid REFERENCES users(id),
    opened_at   timestamptz NOT NULL DEFAULT now(),
    closed_by   uuid REFERENCES users(id),
    closed_at   timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz,
    deleted_by  uuid,
    delete_reason text
);
CREATE UNIQUE INDEX qa_test_cycles_one_open ON qa_test_cycles (tenant_id)
    WHERE closed_at IS NULL AND deleted_at IS NULL;

CREATE TABLE qa_test_results (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    cycle_id    uuid NOT NULL REFERENCES qa_test_cycles(id),
    case_id     text NOT NULL CHECK (length(case_id) <= 200),
    role        text NOT NULL,
    user_id     uuid NOT NULL REFERENCES users(id),
    -- Test accounts are shared; the person at the keyboard names themself.
    tester_name text CHECK (tester_name IS NULL OR length(tester_name) <= 80),
    result      text NOT NULL CHECK (result IN ('pass', 'fail', 'blocked')),
    note        text CHECK (note IS NULL OR length(note) <= 2000),
    screen_path text,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz,
    deleted_by  uuid,
    delete_reason text,
    -- A fail or a blocked case says why.
    CHECK (result = 'pass' OR length(trim(coalesce(note, ''))) >= 3)
);
CREATE UNIQUE INDEX qa_test_results_one_per_case ON qa_test_results (cycle_id, role, case_id)
    WHERE deleted_at IS NULL;
CREATE INDEX qa_test_results_cycle ON qa_test_results (tenant_id, cycle_id, result);

ALTER TABLE qa_test_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_test_cycles_tenant ON qa_test_cycles
    USING (tenant_id = ANY (app_visible_tenants())) WITH CHECK (tenant_id = ANY (app_visible_tenants()));
ALTER TABLE qa_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_test_results_tenant ON qa_test_results
    USING (tenant_id = ANY (app_visible_tenants())) WITH CHECK (tenant_id = ANY (app_visible_tenants()));

CREATE TRIGGER qa_test_cycles_updated_at BEFORE UPDATE ON qa_test_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER qa_test_results_updated_at BEFORE UPDATE ON qa_test_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_qa_test_cycles_soft_delete BEFORE DELETE ON qa_test_cycles
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
CREATE TRIGGER trg_qa_test_results_soft_delete BEFORE DELETE ON qa_test_results
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
