-- ====================================================================
-- Migration: 1019_patient_contact_consents.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: patient_contact_consents
-- Drops: none
-- ====================================================================
-- May the hospital message this patient on WhatsApp, or by email?
--
-- Registration recorded neither, so no welcome message, reminder or report
-- could lawfully go to either channel: WhatsApp's business policy and the
-- DPDP Act 2023 both need the patient's own yes, and a record of who took it
-- and when. An SMS carrying the patient's UHID is a service message and needs
-- no opt-in, so it is not tracked here.
--
-- Append-only: a change of mind is a new row, never an edit, so the history
-- of what the patient agreed to and when is what an audit reads. The current
-- answer is the newest row per patient and channel.

CREATE TABLE IF NOT EXISTS patient_contact_consents (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    patient_id   uuid NOT NULL REFERENCES patients(id),
    channel      text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    granted      boolean NOT NULL,
    source       text NOT NULL CHECK (source IN ('registration', 'patient_update', 'portal')),
    recorded_by  uuid REFERENCES users(id),
    recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_contact_consents_latest
    ON patient_contact_consents (tenant_id, patient_id, channel, recorded_at DESC);

ALTER TABLE patient_contact_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_patient_contact_consents ON patient_contact_consents;
CREATE POLICY tenant_isolation_patient_contact_consents ON patient_contact_consents
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
