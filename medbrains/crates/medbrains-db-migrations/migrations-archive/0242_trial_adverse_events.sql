-- Migration: 0242_trial_adverse_events.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Adverse event + SAE reporting for clinical trials (ticket #2987): safety events during a trial,
-- flagged serious (SAE) with severity, relatedness to the investigational product, and outcome.
-- Tenant RLS.

CREATE TABLE IF NOT EXISTS trial_adverse_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trial_id      uuid NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
    patient_id    uuid NOT NULL,
    event_term    text NOT NULL,
    onset_date    date,
    severity      text NOT NULL DEFAULT 'mild',
    is_serious    boolean NOT NULL DEFAULT false,
    relatedness   text NOT NULL DEFAULT 'unassessed',
    outcome       text NOT NULL DEFAULT 'ongoing',
    reported_date date NOT NULL DEFAULT CURRENT_DATE,
    reported_by   uuid,
    description   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT trial_ae_severity_check CHECK (severity = ANY (ARRAY[
        'mild'::text, 'moderate'::text, 'severe'::text
    ])),
    CONSTRAINT trial_ae_relatedness_check CHECK (relatedness = ANY (ARRAY[
        'unassessed'::text, 'unrelated'::text, 'possible'::text, 'probable'::text, 'definite'::text
    ])),
    CONSTRAINT trial_ae_outcome_check CHECK (outcome = ANY (ARRAY[
        'recovered'::text, 'recovering'::text, 'ongoing'::text, 'fatal'::text, 'unknown'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_trial_ae_trial
    ON trial_adverse_events (tenant_id, trial_id, reported_date DESC);
CREATE INDEX IF NOT EXISTS idx_trial_ae_serious
    ON trial_adverse_events (tenant_id, trial_id) WHERE is_serious = true;

ALTER TABLE trial_adverse_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY trial_adverse_events_tenant_isolation ON trial_adverse_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER trial_adverse_events_updated_at BEFORE UPDATE ON trial_adverse_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
