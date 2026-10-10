-- ====================================================================
-- Migration: 1056_patient_refill_requests.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: prescription_refill_requests
-- Drops: none
-- ====================================================================
-- Patients ask for a refill from the portal and the patient apps.
--
-- Each formulary drug says who may let a refill through on request: the
-- pharmacy, the prescribing doctor, or nobody (a new visit). Controlled
-- drugs are never refilled whatever this says.

ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS refill_policy text NOT NULL
    DEFAULT 'doctor_approval'
    CHECK (refill_policy IN ('pharmacy', 'doctor_approval', 'never'));

CREATE TABLE IF NOT EXISTS prescription_refill_requests (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
    patient_id       uuid NOT NULL REFERENCES patients(id),
    -- The prescriber, who decides it when it needs a doctor.
    doctor_id        uuid NOT NULL REFERENCES users(id),
    status           text NOT NULL
        CHECK (status IN ('with_doctor', 'sent_to_pharmacy', 'declined')),
    patient_note     text,
    decision_note    text,
    decided_by       uuid REFERENCES users(id),
    decided_at       timestamptz,
    -- The pharmacy queue entry the refill became.
    rx_queue_id      uuid REFERENCES pharmacy_prescriptions(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    deleted_by       uuid,
    delete_reason    text
);
-- One open request per prescription.
CREATE UNIQUE INDEX IF NOT EXISTS idx_refill_requests_open
    ON prescription_refill_requests (tenant_id, prescription_id)
    WHERE status = 'with_doctor' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refill_requests_doctor
    ON prescription_refill_requests (tenant_id, doctor_id)
    WHERE status = 'with_doctor' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refill_requests_patient
    ON prescription_refill_requests (tenant_id, patient_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_refill_requests_updated_at ON prescription_refill_requests;
CREATE TRIGGER trg_refill_requests_updated_at
    BEFORE UPDATE ON prescription_refill_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_refill_requests_soft_delete ON prescription_refill_requests;
CREATE TRIGGER trg_refill_requests_soft_delete
    BEFORE DELETE ON prescription_refill_requests
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();

ALTER TABLE prescription_refill_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_prescription_refill_requests ON prescription_refill_requests;
CREATE POLICY tenant_isolation_prescription_refill_requests ON prescription_refill_requests
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- A refill a patient asked for, sent straight to the pharmacy, has no staff
-- member behind it until the pharmacist reviews the queue entry.
ALTER TABLE pharmacy_repeats ALTER COLUMN dispensed_by DROP NOT NULL;
