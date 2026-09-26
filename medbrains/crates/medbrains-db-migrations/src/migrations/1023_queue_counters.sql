-- ====================================================================
-- Migration: 1023_queue_counters.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: queue_counters
-- Drops: none
-- ====================================================================
-- Which counters serve a queue, and who may call at each
-- (RFCs/modules/RFC-MODULE-token-queues.md, P2).
--
-- A counter is a station: the pharmacy's three windows, an OPD room, a camp
-- desk. They already exist as `stations`; this says which of them serve a
-- queue, so the board can say "Token P-014 — Window 2" and a desk cannot call
-- to a window that does not serve that queue.
--
-- `staff_user_ids` narrows who may call at that counter — "only Dr Rao calls
-- to Room 3". Empty means anyone who may work the queue. A queue with no rows
-- here calls exactly as before, with or without a counter.

CREATE TABLE IF NOT EXISTS queue_counters (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    queue_id        uuid NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    station_id      uuid NOT NULL REFERENCES stations(id),
    staff_user_ids  uuid[] NOT NULL DEFAULT '{}',
    UNIQUE (queue_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_counters_queue ON queue_counters (queue_id);

ALTER TABLE queue_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_queue_counters ON queue_counters;
CREATE POLICY tenant_isolation_queue_counters ON queue_counters
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
