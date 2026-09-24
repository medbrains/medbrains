-- ====================================================================
-- Migration: 1015_code_blue_responses.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: code_blue_responses
-- Drops: none
-- ====================================================================
-- A code blue page is one-way until somebody answers it.
--
-- The activation pipeline reaches every active doctor and nurse. What it
-- cannot do is tell the person running the arrest who is actually coming,
-- and it leaves NABH's response-time measure untouched:
-- nabh_code_blue_activations.team_arrived_at has never been written by any
-- code path, so response_seconds -- a generated column that derives from it
-- -- has been null for every activation this system has recorded.
--
-- One row per person per arrest, written when they say they are responding.
-- The earliest row is the team's arrival, and the mirror is updated from it
-- in the same transaction, so the metric is produced by the response itself
-- rather than typed in afterwards from memory.
--
-- Soft-deleted rather than removed: who answered a code blue and when is
-- exactly what a resuscitation review asks.
CREATE TABLE IF NOT EXISTS code_blue_responses (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code_blue_id  uuid NOT NULL REFERENCES code_blue_events(id),
    user_id       uuid NOT NULL REFERENCES users(id),
    responded_at  timestamptz NOT NULL DEFAULT now(),
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);

-- One answer per person per arrest; a second tap is not a second responder.
CREATE UNIQUE INDEX IF NOT EXISTS idx_code_blue_responses_one_per_person
    ON code_blue_responses (tenant_id, code_blue_id, user_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_code_blue_responses_event
    ON code_blue_responses (tenant_id, code_blue_id);

ALTER TABLE code_blue_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_code_blue_responses ON code_blue_responses;
CREATE POLICY tenant_isolation_code_blue_responses ON code_blue_responses
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
