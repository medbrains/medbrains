-- Readmission risk scoring (ticket #2965): a LACE-style index for a patient — Length of stay,
-- Acuity of admission, Comorbidity burden, Emergency-department visits — summed to a total score
-- and banded into low / moderate / high readmission risk. Tenant RLS.

CREATE TABLE IF NOT EXISTS readmission_risk_assessments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL,
    length_of_stay    integer NOT NULL DEFAULT 0,
    acuity_score      integer NOT NULL DEFAULT 0,
    comorbidity_score integer NOT NULL DEFAULT 0,
    ed_visits         integer NOT NULL DEFAULT 0,
    total_score       integer NOT NULL DEFAULT 0,
    risk_level        text NOT NULL DEFAULT 'low',
    notes             text,
    assessed_by       uuid,
    assessed_at       date NOT NULL DEFAULT CURRENT_DATE,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT readmission_risk_level_check CHECK (risk_level = ANY (ARRAY[
        'low'::text, 'moderate'::text, 'high'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_readmission_risk_patient
    ON readmission_risk_assessments (tenant_id, patient_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_readmission_risk_high
    ON readmission_risk_assessments (tenant_id, risk_level) WHERE risk_level = 'high';

ALTER TABLE readmission_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY readmission_risk_assessments_tenant_isolation ON readmission_risk_assessments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER readmission_risk_assessments_updated_at BEFORE UPDATE ON readmission_risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
