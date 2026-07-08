-- Hospice enrollment (ticket #2972): enrolls a patient in the hospice / palliative program with a
-- terminal diagnosis, a documented prognosis, a comfort-care plan, and DNR status. Tenant RLS.

CREATE TABLE IF NOT EXISTS hospice_enrollments (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         uuid NOT NULL,
    enrolled_date      date NOT NULL DEFAULT CURRENT_DATE,
    terminal_diagnosis text,
    prognosis          text,
    comfort_care_plan  text,
    dnr_confirmed      boolean NOT NULL DEFAULT false,
    primary_caregiver  text,
    status             text NOT NULL DEFAULT 'active',
    discharge_date     date,
    notes              text,
    enrolled_by        uuid,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT hospice_status_check CHECK (status = ANY (ARRAY[
        'active'::text, 'discharged'::text, 'deceased'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_hospice_patient
    ON hospice_enrollments (tenant_id, patient_id, status);

ALTER TABLE hospice_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY hospice_enrollments_tenant_isolation ON hospice_enrollments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER hospice_enrollments_updated_at BEFORE UPDATE ON hospice_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
