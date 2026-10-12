-- ====================================================================
-- Migration: 1059_patient_acquisition.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: patient_acquisition
-- Drops: none
-- ====================================================================
-- Which campaign a patient came through.
--
-- Campaigns already existed, but only an enquiry converted into a patient
-- carried one: a walk-in who saw the hoarding and registered at the desk was
-- linked to nothing, so a campaign's visits and revenue could not be counted.
-- One row per patient, written at registration, by a campaign link, by an
-- enquiry's conversion, or corrected later (audited).

-- A short code printed on an ad or put in a link (?c=DIWALI25).
ALTER TABLE mkt_campaigns ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS mkt_campaigns_tenant_code
    ON mkt_campaigns (tenant_id, upper(code)) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS patient_acquisition (
    patient_id    uuid PRIMARY KEY REFERENCES patients(id),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id   uuid REFERENCES mkt_campaigns(id) ON DELETE SET NULL,
    captured_via  text NOT NULL
        CHECK (captured_via IN ('registration', 'link', 'enquiry', 'correction')),
    captured_by   uuid REFERENCES users(id),
    captured_at   timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);
CREATE INDEX IF NOT EXISTS idx_patient_acquisition_campaign
    ON patient_acquisition (tenant_id, campaign_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_patient_acquisition_updated_at ON patient_acquisition;
CREATE TRIGGER trg_patient_acquisition_updated_at
    BEFORE UPDATE ON patient_acquisition
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_patient_acquisition_soft_delete ON patient_acquisition;
CREATE TRIGGER trg_patient_acquisition_soft_delete
    BEFORE DELETE ON patient_acquisition
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();

ALTER TABLE patient_acquisition ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_patient_acquisition ON patient_acquisition;
CREATE POLICY tenant_isolation_patient_acquisition ON patient_acquisition
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- Enquiries already converted to patients keep their campaign.
INSERT INTO patient_acquisition (patient_id, tenant_id, campaign_id, captured_via)
SELECT DISTINCT ON (c.patient_id) c.patient_id, c.tenant_id, c.campaign_id, 'enquiry'
  FROM mkt_contacts c
  JOIN patients p ON p.id = c.patient_id AND p.tenant_id = c.tenant_id
 WHERE c.patient_id IS NOT NULL AND c.campaign_id IS NOT NULL
 ORDER BY c.patient_id, c.created_at
ON CONFLICT (patient_id) DO NOTHING;
