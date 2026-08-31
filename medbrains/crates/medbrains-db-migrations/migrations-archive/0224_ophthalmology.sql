-- Migration: 0224_ophthalmology.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Ophthalmology (eye) specialty module — powers the eye_hospital edition. A comprehensive
-- eye exam per patient: visual acuity, refraction (the spectacle Rx), IOP, slit-lamp, fundus,
-- diagnosis + plan. Per-eye columns (OD = right, OS = left). Tenant RLS.

CREATE TABLE IF NOT EXISTS ophtho_exams (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id      uuid,
    -- Visual acuity (e.g. "6/6", "6/9 N6")
    visual_acuity_od  text,
    visual_acuity_os  text,
    -- Refraction / spectacle Rx (sphere & cylinder in dioptres, axis in degrees)
    sphere_od         numeric(4, 2),
    sphere_os         numeric(4, 2),
    cylinder_od       numeric(4, 2),
    cylinder_os       numeric(4, 2),
    axis_od           smallint,
    axis_os           smallint,
    -- Intraocular pressure (mmHg)
    iop_od            numeric(4, 1),
    iop_os            numeric(4, 1),
    slit_lamp         text,
    fundus            text,
    diagnosis         text,
    plan              text,
    examined_by       uuid,
    examined_at       timestamptz,
    status            text NOT NULL DEFAULT 'draft',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ophtho_exams_tenant_patient
    ON ophtho_exams (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ophtho_exams_tenant_status
    ON ophtho_exams (tenant_id, status);

ALTER TABLE ophtho_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY ophtho_exams_tenant_isolation ON ophtho_exams
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TRIGGER ophtho_exams_updated_at BEFORE UPDATE ON ophtho_exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Register the module for existing tenants (new tenants get it at onboarding), enabled for
-- the editions whose preset includes ophthalmology, disabled elsewhere.
INSERT INTO module_config (tenant_id, code, name, description, status)
SELECT
    id,
    'ophthalmology',
    'Ophthalmology',
    'Eye — refraction, IOP, slit-lamp, cataract/IOL, spectacle Rx',
    (CASE
        WHEN hospital_type IN ('eye_hospital', 'multi_specialty', 'medical_college')
            THEN 'enabled'
        ELSE 'disabled'
    END)::module_status
FROM tenants
ON CONFLICT (tenant_id, code) DO NOTHING;
