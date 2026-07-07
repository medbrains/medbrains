-- Oncology depth (B3) — extends the existing chemo/tumor-board oncology (specialty_other
-- module) with cancer TNM staging + radiation-therapy sessions. Tenant RLS. No new
-- module_config row: these belong to the already-registered `specialty_other` module.

CREATE TABLE IF NOT EXISTS cancer_stagings (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    primary_site      text NOT NULL,
    histology         text,
    t_stage           text,
    n_stage           text,
    m_stage           text,
    overall_stage     text,
    staged_by         uuid,
    staged_at         timestamptz,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancer_stagings_tenant_patient
    ON cancer_stagings (tenant_id, patient_id);

CREATE TABLE IF NOT EXISTS radiation_sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    site              text NOT NULL,
    technique         text,
    total_dose_gy     numeric(6, 2),
    fractions         integer,
    session_number    integer,
    delivered_by      uuid,
    delivered_at      timestamptz,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radiation_sessions_tenant_patient
    ON radiation_sessions (tenant_id, patient_id);

ALTER TABLE cancer_stagings ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cancer_stagings_tenant_isolation ON cancer_stagings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY radiation_sessions_tenant_isolation ON radiation_sessions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER cancer_stagings_updated_at BEFORE UPDATE ON cancer_stagings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER radiation_sessions_updated_at BEFORE UPDATE ON radiation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
