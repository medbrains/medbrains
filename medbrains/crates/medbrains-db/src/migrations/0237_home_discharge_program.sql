-- Migration: 0237_home_discharge_program.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare discharge program (ticket #2982): patient/family training materials handed out
-- and the discharge-readiness criteria that must be met before the home-care episode ends. One
-- checklist table with an item_type discriminator (training | criterion). Tenant RLS.

CREATE TABLE IF NOT EXISTS home_discharge_program (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id   uuid NOT NULL,
    item_type    text NOT NULL,
    title        text NOT NULL,
    description  text,
    is_complete  boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    completed_by uuid,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_discharge_item_type_check CHECK (item_type = ANY (ARRAY[
        'training'::text, 'criterion'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_discharge_patient
    ON home_discharge_program (tenant_id, patient_id, item_type);

ALTER TABLE home_discharge_program ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_discharge_program_tenant_isolation ON home_discharge_program
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_discharge_program_updated_at BEFORE UPDATE ON home_discharge_program
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
