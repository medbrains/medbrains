-- Migration: 0264_tele_chat_messages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Telemedicine chat fallback (ticket #2948): text messages within a tele-consultation for when
-- video isn't possible (poor connectivity) or as an adjunct to the call. Tenant RLS.

CREATE TABLE IF NOT EXISTS tele_chat_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    consultation_id uuid NOT NULL REFERENCES tele_consultations(id) ON DELETE CASCADE,
    sender_role     text NOT NULL DEFAULT 'doctor',
    sender_id       uuid,
    body            text NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tele_chat_role_check CHECK (sender_role = ANY (ARRAY[
        'doctor'::text, 'patient'::text, 'system'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_tele_chat_consultation
    ON tele_chat_messages (tenant_id, consultation_id, sent_at);

ALTER TABLE tele_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tele_chat_messages_tenant_isolation ON tele_chat_messages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
