-- Migration: 0245_home_visits.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home visit scheduling + nurse assignment (ticket #2967): a home-care visit assigned to a nurse
-- for a date/time, with a manual visit_order for the day's route. Automated route optimization is
-- a later enhancement — visit_order lets the nurse sequence the round for now. Tenant RLS.

CREATE TABLE IF NOT EXISTS home_visits (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     uuid NOT NULL,
    nurse_id       uuid,
    scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
    scheduled_time time,
    address        text,
    purpose        text,
    status         text NOT NULL DEFAULT 'scheduled',
    visit_order    integer,
    notes          text,
    completed_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_visit_status_check CHECK (status = ANY (ARRAY[
        'scheduled'::text, 'en_route'::text, 'completed'::text, 'cancelled'::text, 'missed'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_visits_date
    ON home_visits (tenant_id, scheduled_date, visit_order);
CREATE INDEX IF NOT EXISTS idx_home_visits_nurse
    ON home_visits (tenant_id, nurse_id, scheduled_date);

ALTER TABLE home_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_visits_tenant_isolation ON home_visits
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_visits_updated_at BEFORE UPDATE ON home_visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
