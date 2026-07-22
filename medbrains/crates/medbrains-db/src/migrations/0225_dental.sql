-- Migration: 0225_dental.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Dental specialty module — powers the dental_college edition. A dental exam (the visit)
-- with tooth-wise chart entries (FDI numbering: 11-18, 21-28, 31-38, 41-48; deciduous
-- 51-85). Each entry records a tooth's condition + surface + planned treatment. Tenant RLS.

CREATE TABLE IF NOT EXISTS dental_exams (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id      uuid,
    chief_complaint   text,
    diagnosis         text,
    treatment_plan    text,
    examined_by       uuid,
    examined_at       timestamptz,
    status            text NOT NULL DEFAULT 'draft',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dental_exams_tenant_patient
    ON dental_exams (tenant_id, patient_id);

CREATE TABLE IF NOT EXISTS dental_chart_entries (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    exam_id           uuid NOT NULL REFERENCES dental_exams(id) ON DELETE CASCADE,
    -- FDI two-digit tooth number, e.g. "11" (upper-right central incisor)
    tooth_number      text NOT NULL,
    -- caries | filled | missing | crown | root_canal | implant | extraction_needed | healthy | other
    condition         text NOT NULL,
    -- mesial | distal | occlusal | buccal | lingual (nullable — whole-tooth conditions)
    surface           text,
    treatment_planned text,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dental_chart_entries_exam
    ON dental_chart_entries (tenant_id, exam_id);

ALTER TABLE dental_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_chart_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY dental_exams_tenant_isolation ON dental_exams
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY dental_chart_entries_tenant_isolation ON dental_chart_entries
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER dental_exams_updated_at BEFORE UPDATE ON dental_exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER dental_chart_entries_updated_at BEFORE UPDATE ON dental_chart_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register the module for existing tenants; enabled for the editions whose preset includes
-- dental, disabled elsewhere.
INSERT INTO module_config (tenant_id, code, name, description, status)
SELECT
    id,
    'dental',
    'Dental',
    'Tooth-wise charting, procedures, orthodontics, periodontal',
    (CASE
        WHEN hospital_type IN ('dental_college', 'multi_specialty', 'medical_college')
            THEN 'enabled'
        ELSE 'disabled'
    END)::module_status
FROM tenants
ON CONFLICT (tenant_id, code) DO NOTHING;
