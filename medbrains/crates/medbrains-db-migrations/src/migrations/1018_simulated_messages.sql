-- ====================================================================
-- Migration: 1018_simulated_messages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: simulated_messages
-- Drops: none
-- ====================================================================
-- What a patient's phone would have received, on deployments that must not
-- send anything.
--
-- Without provider credentials the SMS, WhatsApp and email handlers answered
-- `{stub: true}` and threw the message away, so nobody could see what a patient
-- is sent at registration, when a token is called, or what a charge nurse gets
-- when a call goes unanswered. With the message simulator on (dev and test only;
-- the server refuses to start with it in production) the handlers write the
-- fully rendered message here instead of calling the provider.
--
-- Rows hold real names and numbers from that database, so the table is
-- tenant-scoped like any other.

CREATE TABLE IF NOT EXISTS simulated_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    channel         text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
    recipient       text NOT NULL,
    event_type      text NOT NULL,
    subject         text,
    body            text NOT NULL,
    attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
    template_id     text,
    outbox_event_id uuid,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulated_messages_recipient
    ON simulated_messages (tenant_id, recipient, created_at DESC);

ALTER TABLE simulated_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_simulated_messages ON simulated_messages;
CREATE POLICY tenant_isolation_simulated_messages ON simulated_messages
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
