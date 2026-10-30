-- Migration: 1385_hrms_humanex.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: hrms_sync_state, hrms_sync_exceptions
-- Drops: none
--
-- RFC-HRMS-INTEGRATIONS P1: link MedBrains HR tables to an external HRMS
-- (Humanex). Rows pulled from the HRMS carry external_source/external_ref;
-- tables without a natural business key get a unique (tenant, source, ref)
-- index so the pull is an idempotent upsert.

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['employees', 'designations', 'departments', 'employee_credentials',
        'shift_definitions', 'duty_rosters', 'on_call_schedules', 'leave_requests',
        'leave_balances', 'attendance_records']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS external_source text,
                        ADD COLUMN IF NOT EXISTS external_ref text,
                        ADD COLUMN IF NOT EXISTS external_synced_at timestamptz', t);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_credentials_external
    ON employee_credentials (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_on_call_schedules_external
    ON on_call_schedules (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_requests_external
    ON leave_requests (tenant_id, external_source, external_ref) WHERE external_ref IS NOT NULL;

-- Per (tenant, entity) pull cursor + last outcome.
CREATE TABLE IF NOT EXISTS hrms_sync_state (
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider    text NOT NULL,
    entity      text NOT NULL,
    cursor      text,
    last_run_at timestamptz,
    last_status text,
    last_error  text,
    upserted    int NOT NULL DEFAULT 0,
    failed      int NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, provider, entity)
);

-- Rows the pull could not apply (bad enum value, missing master, …).
CREATE TABLE IF NOT EXISTS hrms_sync_exceptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider   text NOT NULL,
    entity     text NOT NULL,
    record_key text,
    error      text NOT NULL,
    payload    jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hrms_sync_exceptions_recent
    ON hrms_sync_exceptions (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_hrms_sync_state_updated_at ON hrms_sync_state;
CREATE TRIGGER trg_hrms_sync_state_updated_at BEFORE UPDATE ON hrms_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE hrms_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_hrms_sync_state ON hrms_sync_state;
CREATE POLICY tenant_isolation_hrms_sync_state ON hrms_sync_state
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

ALTER TABLE hrms_sync_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_hrms_sync_exceptions ON hrms_sync_exceptions;
CREATE POLICY tenant_isolation_hrms_sync_exceptions ON hrms_sync_exceptions
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
