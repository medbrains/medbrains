-- ====================================================================
-- Migration: 130_outbox_and_system_state.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: outbox_events, outbox_dlq, system_state, processed_webhooks
-- Drops: none
-- ====================================================================
-- Sprint A foundation per RFCs/sprints/SPRINT-A-outbox.md.
--
-- Four tables:
--   1. outbox_events       — durable async queue for external integrations
--                            (Razorpay, Twilio, ABDM, TPA, HL7, SMTP).
--   2. outbox_dlq          — terminal failures after 10 attempts.
--   3. system_state        — per-tenant operating mode (normal/degraded/read_only).
--   4. processed_webhooks  — incoming webhook idempotency guard.
--
-- Plus: BYPASSRLS DB role `medbrains_outbox_worker` for cross-tenant
-- draining; idempotency_key column ALTER on payment_gateway_transactions.
--
-- All new tables get FORCE ROW LEVEL SECURITY (catches superuser leaks)
-- in addition to the standard apply_tenant_rls() helper.
-- ====================================================================

-- ── 1. outbox_events ─────────────────────────────────────────────────

CREATE TABLE outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    aggregate_type  TEXT NOT NULL,                    -- 'payment_gateway_transaction', 'patient', etc.
    aggregate_id    UUID,
    event_type      TEXT NOT NULL,                    -- 'payment.create_order', 'sms.appointment_confirmation', etc.
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','retrying','sent','failed','dlq')),
    attempts        INT NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    last_error      TEXT,
    dlq_at          TIMESTAMPTZ,
    idempotency_key TEXT,
    claimed_at      TIMESTAMPTZ,
    claimed_by      TEXT
);

CREATE INDEX outbox_events_drain
    ON outbox_events (tenant_id, next_retry_at)
    WHERE status IN ('pending','retrying');

CREATE INDEX outbox_events_aggregate
    ON outbox_events (tenant_id, aggregate_type, aggregate_id);

CREATE UNIQUE INDEX outbox_events_idemp
    ON outbox_events (tenant_id, event_type, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Stale-claim reaper: rows still 'retrying' with claimed_at older than 10 min
CREATE INDEX outbox_events_stale_claim
    ON outbox_events (claimed_at)
    WHERE status = 'retrying' AND claimed_at IS NOT NULL;

ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('outbox_events');

-- ── 2. outbox_dlq ────────────────────────────────────────────────────

CREATE TABLE outbox_dlq (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_event_id UUID NOT NULL,
    tenant_id         UUID NOT NULL REFERENCES tenants(id),
    event_type        TEXT NOT NULL,
    payload           JSONB NOT NULL,
    attempts          INT NOT NULL,
    last_error        TEXT,
    moved_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_dlq_tenant_moved
    ON outbox_dlq (tenant_id, moved_at DESC);

CREATE INDEX idx_outbox_dlq_event_type
    ON outbox_dlq (tenant_id, event_type, moved_at DESC);

ALTER TABLE outbox_dlq FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('outbox_dlq');

-- ── 3. system_state ──────────────────────────────────────────────────

CREATE TABLE system_state (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL UNIQUE REFERENCES tenants(id),
    mode        TEXT NOT NULL DEFAULT 'normal'
                CHECK (mode IN ('normal','degraded','read_only')),
    since       TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason      TEXT,
    set_by      UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_state_tenant
    ON system_state (tenant_id);

-- Reuse the standard updated_at trigger from 001_initial.sql:367
CREATE TRIGGER system_state_updated_at
    BEFORE UPDATE ON system_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

ALTER TABLE system_state FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('system_state');

-- ── 4. processed_webhooks ────────────────────────────────────────────
-- Idempotency guard for incoming webhooks (Razorpay, Twilio status
-- callbacks, future ABDM callbacks, etc.). PK on (provider, event_id)
-- prevents duplicate processing of the same upstream event.
--
-- Razorpay sends `x-razorpay-event-id` HEADER (not body) which is unique
-- per webhook delivery — that's the canonical event_id.

CREATE TABLE processed_webhooks (
    provider     TEXT NOT NULL,                        -- 'razorpay', 'twilio', 'abdm', etc.
    event_id     TEXT NOT NULL,                        -- partner-provided unique event id
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id    UUID REFERENCES tenants(id),
    payload      JSONB,
    PRIMARY KEY (provider, event_id)
);

CREATE INDEX idx_processed_webhooks_received
    ON processed_webhooks (received_at DESC);

CREATE INDEX idx_processed_webhooks_tenant
    ON processed_webhooks (tenant_id, received_at DESC)
    WHERE tenant_id IS NOT NULL;

-- processed_webhooks intentionally NOT under tenant RLS. Webhooks arrive
-- before we know which tenant they belong to (Razorpay sends to a single
-- endpoint; we resolve tenant from gateway_order_id lookup). The dedup
-- check happens BEFORE tenant context is set. Rows are written with
-- tenant_id where resolvable, NULL otherwise.
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhooks FORCE ROW LEVEL SECURITY;
-- Permissive: anyone with a DB connection can dedup; the secret is the
-- HMAC validation upstream. Workers/handlers run with BYPASSRLS anyway.
CREATE POLICY processed_webhooks_dedup_read ON processed_webhooks
    FOR SELECT USING (true);
CREATE POLICY processed_webhooks_dedup_write ON processed_webhooks
    FOR INSERT WITH CHECK (true);

-- ── 5. payment_gateway_transactions: idempotency_key column ─────────
-- Migration 115 created the table without an idempotency_key. Sprint A
-- needs it for outbox dedup (`receipt = internal_payment_id` on Razorpay).

ALTER TABLE payment_gateway_transactions
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pgt_idempotency_key_unique
    ON payment_gateway_transactions (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Backfill: existing rows use their UUID id as idempotency_key. Future
-- rows set this in the new outbox-driven flow.
UPDATE payment_gateway_transactions
   SET idempotency_key = id::text
 WHERE idempotency_key IS NULL;

-- Add 'pending_gateway' to the existing status CHECK constraint.
-- Original status set: created|authorized|captured|failed|refunded|expired
-- New status 'pending_gateway' = queued in outbox, not yet sent to Razorpay.
ALTER TABLE payment_gateway_transactions
    DROP CONSTRAINT IF EXISTS payment_gateway_transactions_status_check;

ALTER TABLE payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_status_check
    CHECK (status IN ('pending_gateway','created','authorized','captured','failed','refunded','expired'));

-- ── 6. medbrains_outbox_worker BYPASSRLS role ────────────────────────
-- Worker drains rows across all tenants, then sets app.tenant_id per
-- event before dispatching. This is the right pattern for cross-tenant
-- background workers (Postgres-native, no extension needed).
--
-- The role's password is set out-of-band (env var or AWS Secrets Manager
-- read by the worker container at startup); the migration creates the
-- role with NOLOGIN so it must be ALTER'd to grant connection privilege.
-- Production: rotate via Secrets Manager.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains_outbox_worker') THEN
        EXECUTE 'CREATE ROLE medbrains_outbox_worker BYPASSRLS NOLOGIN';
    ELSE
        -- Idempotent: ensure BYPASSRLS even if role pre-existed
        EXECUTE 'ALTER ROLE medbrains_outbox_worker BYPASSRLS';
    END IF;
END $$;

-- Grants: worker can read/write outbox tables and set session vars.
GRANT USAGE ON SCHEMA public TO medbrains_outbox_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_events TO medbrains_outbox_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_dlq    TO medbrains_outbox_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_state  TO medbrains_outbox_worker;
GRANT SELECT, INSERT ON processed_webhooks            TO medbrains_outbox_worker;

-- Worker also needs to read tenant + payment + notification tables to
-- dispatch handlers; grant SELECT on the schema's tables for now,
-- tighten later in a follow-up migration once handler set is final.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO medbrains_outbox_worker;
GRANT INSERT, UPDATE ON payment_gateway_transactions TO medbrains_outbox_worker;
GRANT INSERT, UPDATE ON audit_log                    TO medbrains_outbox_worker;

-- Default privileges for future tables (so we don't need to update grants
-- on every new migration that adds a tenant table the worker reads).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO medbrains_outbox_worker;

-- ── 7. Documentation ────────────────────────────────────────────────

COMMENT ON TABLE outbox_events IS
    'Durable async queue for external integrations. Worker drains via FOR UPDATE SKIP LOCKED with jittered backoff. After 10 attempts → outbox_dlq. RFC: SPRINT-A-outbox.md.';

COMMENT ON TABLE outbox_dlq IS
    'Terminal failures from outbox_events after 10 retries or Permanent error. Admin UI surfaces this for manual retry / delete.';

COMMENT ON TABLE system_state IS
    'Per-tenant operating mode. read_only blocks all non-GET; degraded blocks non-allowlisted writes. Banner via state.queue_broadcaster.';

COMMENT ON TABLE processed_webhooks IS
    'Idempotency guard for incoming webhooks. PK (provider, event_id) prevents duplicate processing. NOT tenant-RLS-scoped: dedup happens before tenant context is set.';

COMMENT ON ROLE medbrains_outbox_worker IS
    'BYPASSRLS role for cross-tenant outbox draining. Worker sets app.tenant_id per event before dispatching handler. Password set via Secrets Manager out-of-band.';
