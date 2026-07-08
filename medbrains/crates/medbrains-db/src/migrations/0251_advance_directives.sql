-- Advance directive / DNR management (ticket #2973): a patient's advance directives (living will,
-- DNR, durable power of attorney, MOLST, organ donation) with family-consent tracking and a
-- lifecycle (active -> revoked / superseded). Tenant RLS.

CREATE TABLE IF NOT EXISTS advance_directives (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id             uuid NOT NULL,
    directive_type         text NOT NULL,
    content                text,
    effective_date         date NOT NULL DEFAULT CURRENT_DATE,
    status                 text NOT NULL DEFAULT 'active',
    family_consent_obtained boolean NOT NULL DEFAULT false,
    family_member_name     text,
    family_relationship    text,
    witnessed_by           text,
    document_url           text,
    recorded_by            uuid,
    revoked_at             timestamptz,
    revoke_reason          text,
    notes                  text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT advance_directive_type_check CHECK (directive_type = ANY (ARRAY[
        'living_will'::text, 'dnr'::text, 'dpoa'::text, 'molst'::text, 'organ_donation'::text
    ])),
    CONSTRAINT advance_directive_status_check CHECK (status = ANY (ARRAY[
        'active'::text, 'revoked'::text, 'superseded'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_advance_directives_patient
    ON advance_directives (tenant_id, patient_id, status);

ALTER TABLE advance_directives ENABLE ROW LEVEL SECURITY;
CREATE POLICY advance_directives_tenant_isolation ON advance_directives
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER advance_directives_updated_at BEFORE UPDATE ON advance_directives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
