-- ====================================================================
-- Migration: 1029_allergy_verification.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A wrong allergy is corrected, not erased (HL7 FHIR R4
-- AllergyIntolerance.verificationStatus). A doctor marks it
-- `entered_in_error` (recorded by mistake) or `refuted` (the patient is not
-- allergic, e.g. after a penicillin challenge), with a reason; it stops
-- alerting (`is_active = false`) and stays on the chart struck through.
-- Existing allergies were never verified by anyone: `unconfirmed`.
ALTER TABLE patient_allergies
    ADD COLUMN verification_status text NOT NULL DEFAULT 'unconfirmed'
        CHECK (verification_status IN ('unconfirmed', 'confirmed', 'refuted', 'entered_in_error')),
    ADD COLUMN verification_reason text,
    ADD COLUMN verified_by uuid REFERENCES users(id),
    ADD COLUMN verified_at timestamptz;

-- A retired allergy carries its reason and who retired it.
ALTER TABLE patient_allergies
    ADD CONSTRAINT patient_allergies_retired_has_reason CHECK (
        verification_status NOT IN ('refuted', 'entered_in_error')
        OR (verification_reason IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
    );
