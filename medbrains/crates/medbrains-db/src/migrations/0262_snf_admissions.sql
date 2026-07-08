-- Skilled Nursing Facility (SNF) admission from discharge (ticket #2960): admits a patient to the
-- SNF — most often on hospital discharge — carrying over the care plan and level of care. Tenant RLS.

CREATE TABLE IF NOT EXISTS snf_admissions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL,
    admission_date    date NOT NULL DEFAULT CURRENT_DATE,
    source            text NOT NULL DEFAULT 'hospital_discharge',
    level_of_care     text NOT NULL DEFAULT 'skilled_nursing',
    primary_diagnosis text,
    care_plan         text,
    expected_los_days integer,
    status            text NOT NULL DEFAULT 'admitted',
    discharge_date    date,
    admitted_by       uuid,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT snf_source_check CHECK (source = ANY (ARRAY[
        'hospital_discharge'::text, 'direct'::text, 'transfer'::text
    ])),
    CONSTRAINT snf_level_check CHECK (level_of_care = ANY (ARRAY[
        'skilled_nursing'::text, 'rehab'::text, 'long_term'::text
    ])),
    CONSTRAINT snf_status_check CHECK (status = ANY (ARRAY[
        'admitted'::text, 'discharged'::text, 'transferred'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_snf_admissions_patient
    ON snf_admissions (tenant_id, patient_id, status);

ALTER TABLE snf_admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY snf_admissions_tenant_isolation ON snf_admissions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER snf_admissions_updated_at BEFORE UPDATE ON snf_admissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
