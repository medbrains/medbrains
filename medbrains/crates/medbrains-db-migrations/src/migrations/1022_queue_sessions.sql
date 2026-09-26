-- ====================================================================
-- Migration: 1022_queue_sessions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: queue_sessions
-- Drops: none
-- ====================================================================
-- When a queue gives out tokens (RFCs/modules/RFC-MODULE-token-queues.md, P1c).
--
-- An Indian OPD commonly runs a morning and an evening session, a camp runs
-- 09:00 to 15:00, and a staff clinic opens on Wednesdays only. A queue with no
-- rows here gives out tokens all day, exactly as before.
--
-- Sessions govern issuing, not serving: a doctor finishing the morning list
-- after 13:00 is normal, so a closed session never touches waiting tokens.
-- Tokens can be given out `early_issue_minutes` before a session opens,
-- because patients line up before the OPD does and are served in arrival order.
--
-- A session ends on the day it starts: an overnight queue is not supported yet.

CREATE TABLE IF NOT EXISTS queue_sessions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    queue_id    uuid NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    label       text NOT NULL CHECK (length(trim(label)) > 0),
    -- ISO weekdays, 1 = Monday .. 7 = Sunday; empty means every day.
    days        smallint[] NOT NULL DEFAULT '{}' CHECK (days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
    opens       time NOT NULL,
    closes      time NOT NULL,
    -- Replaces the queue's prefix in this session, so a queue that restarts its
    -- numbers each session never gives two waiting patients the same number.
    prefix      text CHECK (prefix ~ '^[A-Z0-9]{1,6}$'),
    CHECK (closes > opens)
);

CREATE INDEX IF NOT EXISTS idx_queue_sessions_queue ON queue_sessions (queue_id);

ALTER TABLE queue_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_queue_sessions ON queue_sessions;
CREATE POLICY tenant_isolation_queue_sessions ON queue_sessions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE queues ADD COLUMN IF NOT EXISTS early_issue_minutes smallint NOT NULL DEFAULT 60
    CHECK (early_issue_minutes BETWEEN 0 AND 240);

ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_reset_rule_check;
ALTER TABLE queues ADD CONSTRAINT queues_reset_rule_check
    CHECK (reset_rule IN ('daily', 'session', 'never'));

-- The numbering period a queue token belongs to, on the hospital's own clock:
-- its local date for a daily queue, date and session start for a session
-- queue, 'all' for a queue that never restarts. Kept on the token so editing
-- a session's hours mid-day does not restart today's numbers.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS period_key text;

UPDATE tokens t
   SET period_key = CASE q.reset_rule WHEN 'never' THEN 'all' ELSE t.token_date::text END
  FROM queues q
 WHERE q.id = t.queue_id AND t.period_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_queue_period ON tokens (queue_id, period_key)
    WHERE queue_id IS NOT NULL;
