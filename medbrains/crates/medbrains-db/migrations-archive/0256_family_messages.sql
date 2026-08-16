-- Migration: 0256_family_messages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Family communication portal (ticket #2964): messages between the care team and a resident's
-- family — care updates pushed to the family, and visit requests / general messages from the
-- family — with a read/actioned status. Tenant RLS.

CREATE TABLE IF NOT EXISTS family_messages (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     uuid NOT NULL,
    direction      text NOT NULL DEFAULT 'to_family',
    message_type   text NOT NULL DEFAULT 'care_update',
    subject        text,
    body           text NOT NULL,
    family_contact text,
    status         text NOT NULL DEFAULT 'sent',
    posted_by      uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT family_message_direction_check CHECK (direction = ANY (ARRAY[
        'to_family'::text, 'from_family'::text
    ])),
    CONSTRAINT family_message_type_check CHECK (message_type = ANY (ARRAY[
        'care_update'::text, 'visit_request'::text, 'general'::text
    ])),
    CONSTRAINT family_message_status_check CHECK (status = ANY (ARRAY[
        'sent'::text, 'read'::text, 'actioned'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_family_messages_patient
    ON family_messages (tenant_id, patient_id, created_at DESC);

ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY family_messages_tenant_isolation ON family_messages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER family_messages_updated_at BEFORE UPDATE ON family_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
