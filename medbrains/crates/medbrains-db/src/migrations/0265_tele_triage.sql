-- Tele-triage (innovation): a structured pre-consultation intake for a tele-consult that a
-- deterministic, explainable engine grades into an acuity band with red-flags + a recommended
-- timeframe. Transparent (reasoning captured), not a black-box model — clinician-safe decision
-- support that lets the doctor see emergent patients first. One row per consultation. Tenant RLS.

CREATE TABLE IF NOT EXISTS tele_triage (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    consultation_id       uuid NOT NULL REFERENCES tele_consultations(id) ON DELETE CASCADE,
    patient_id            uuid NOT NULL,
    chief_complaint       text,
    symptoms              text[] NOT NULL DEFAULT '{}',
    duration_hours        integer,
    severity              integer,
    vitals                jsonb NOT NULL DEFAULT '{}'::jsonb,
    acuity                text NOT NULL DEFAULT 'routine',
    red_flags             text[] NOT NULL DEFAULT '{}',
    recommended_timeframe text,
    reasoning             jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by            uuid,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tele_triage_consult_unique UNIQUE (tenant_id, consultation_id),
    CONSTRAINT tele_triage_acuity_check CHECK (acuity = ANY (ARRAY[
        'routine'::text, 'urgent'::text, 'emergent'::text
    ])),
    CONSTRAINT tele_triage_severity_check CHECK (severity IS NULL OR severity BETWEEN 0 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_tele_triage_acuity
    ON tele_triage (tenant_id, acuity, created_at DESC);

ALTER TABLE tele_triage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tele_triage_tenant_isolation ON tele_triage
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER tele_triage_updated_at BEFORE UPDATE ON tele_triage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
