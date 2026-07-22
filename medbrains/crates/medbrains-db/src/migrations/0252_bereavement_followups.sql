-- Migration: 0252_bereavement_followups.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Bereavement support coordination (ticket #2974): after a hospice patient's death, scheduled
-- follow-up contacts with the bereaved family (call, home visit, support group, condolence letter)
-- and their completion status. Tenant RLS.

CREATE TABLE IF NOT EXISTS bereavement_followups (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          uuid NOT NULL,
    family_contact_name text NOT NULL,
    relationship        text,
    contact_type        text NOT NULL DEFAULT 'call',
    scheduled_date      date NOT NULL DEFAULT CURRENT_DATE,
    status              text NOT NULL DEFAULT 'scheduled',
    completed_at        timestamptz,
    coordinator         uuid,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bereavement_contact_type_check CHECK (contact_type = ANY (ARRAY[
        'call'::text, 'visit'::text, 'support_group'::text, 'letter'::text, 'other'::text
    ])),
    CONSTRAINT bereavement_status_check CHECK (status = ANY (ARRAY[
        'scheduled'::text, 'completed'::text, 'declined'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_bereavement_patient
    ON bereavement_followups (tenant_id, patient_id, scheduled_date);

ALTER TABLE bereavement_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY bereavement_followups_tenant_isolation ON bereavement_followups
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER bereavement_followups_updated_at BEFORE UPDATE ON bereavement_followups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
