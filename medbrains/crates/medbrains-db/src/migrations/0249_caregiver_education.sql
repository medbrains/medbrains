-- Caregiver education documentation (ticket #2971): records a teaching session given to a home
-- patient's family caregiver — the topic, materials handed over, and whether understanding was
-- confirmed (teach-back). Tenant RLS.

CREATE TABLE IF NOT EXISTS caregiver_education (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id             uuid NOT NULL,
    caregiver_name         text NOT NULL,
    relationship           text,
    topic                  text NOT NULL,
    materials_provided     text,
    understanding_confirmed boolean NOT NULL DEFAULT false,
    session_date           date NOT NULL DEFAULT CURRENT_DATE,
    educated_by            uuid,
    notes                  text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_education_patient
    ON caregiver_education (tenant_id, patient_id, session_date DESC);

ALTER TABLE caregiver_education ENABLE ROW LEVEL SECURITY;
CREATE POLICY caregiver_education_tenant_isolation ON caregiver_education
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER caregiver_education_updated_at BEFORE UPDATE ON caregiver_education
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
