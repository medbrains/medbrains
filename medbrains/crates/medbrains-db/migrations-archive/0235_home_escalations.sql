-- Migration: 0235_home_escalations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare emergency escalation protocol (ticket #2980). When a home patient's vitals
-- breach a safety threshold, an escalation is raised (by the monitoring device / visiting nurse),
-- which can request an ambulance and is then resolved. The vital snapshot that triggered it is
-- captured for the responding crew. Tenant RLS.

CREATE TABLE IF NOT EXISTS home_escalations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    uuid NOT NULL,
    reason        text NOT NULL,
    vital_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    severity      text NOT NULL DEFAULT 'high',
    status        text NOT NULL DEFAULT 'raised',
    raised_by     uuid,
    resolved_by   uuid,
    resolved_at   timestamptz,
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_escalation_severity_check CHECK (severity = ANY (ARRAY[
        'low'::text, 'medium'::text, 'high'::text, 'critical'::text
    ])),
    CONSTRAINT home_escalation_status_check CHECK (status = ANY (ARRAY[
        'raised'::text, 'ambulance_requested'::text, 'resolved'::text, 'cancelled'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_escalations_patient
    ON home_escalations (tenant_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_home_escalations_open
    ON home_escalations (tenant_id, status) WHERE status IN ('raised', 'ambulance_requested');

ALTER TABLE home_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_escalations_tenant_isolation ON home_escalations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_escalations_updated_at BEFORE UPDATE ON home_escalations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
