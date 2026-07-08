-- Protocol-driven visit schedule + procedure tracking (ticket #2986): each enrolled patient has a
-- schedule of protocol visits (e.g. Screening, Day 0, Day 28) with the procedures to perform and a
-- completion status. Tenant RLS.

CREATE TABLE IF NOT EXISTS trial_visits (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trial_id       uuid NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    patient_id     uuid NOT NULL,
    visit_name     text NOT NULL,
    scheduled_date date NOT NULL,
    status         text NOT NULL DEFAULT 'scheduled',
    procedures     text,
    completed_at   timestamptz,
    completed_by   uuid,
    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trial_visit_status_check CHECK (status = ANY (ARRAY[
        'scheduled'::text, 'completed'::text, 'missed'::text, 'rescheduled'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_trial_visits_trial
    ON trial_visits (tenant_id, trial_id, scheduled_date);

ALTER TABLE trial_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_visits_tenant_isolation ON trial_visits
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER trial_visits_updated_at BEFORE UPDATE ON trial_visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
