-- ====================================================================
-- Migration: 1345_queue_number_recycling.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Recycle token numbers, with a cool-off (RFCs/modules/RFC-MODULE-token-queues.md, P1e).
--
-- A hospital with plastic token cards, or a pharmacy that calls 1 to 99, gives
-- the same numbers out again. A number is given out again only after its last
-- holder finished at least `reuse_cooloff_minutes` ago: the patient who held
-- "P-07" moments ago may walk back to the counter holding it, and a second
-- "P-07" in the meantime is the wrong patient called or the wrong medicine
-- handed over (IPSG 1, patient identification).
--
-- `seq` still orders the queue and restarts daily; only the number on the slip
-- comes from the pool, which runs start_at .. start_at + number_pool_size - 1.

ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_reset_rule_check;
ALTER TABLE queues ADD CONSTRAINT queues_reset_rule_check
    CHECK (reset_rule IN ('daily', 'session', 'never', 'recycle'));

ALTER TABLE queues ADD COLUMN IF NOT EXISTS number_pool_size integer
    CHECK (number_pool_size BETWEEN 1 AND 9999);
-- At most a day: issuing looks back two days for holders, so a longer
-- cool-off would be silently cut short.
ALTER TABLE queues ADD COLUMN IF NOT EXISTS reuse_cooloff_minutes integer NOT NULL DEFAULT 30
    CHECK (reuse_cooloff_minutes BETWEEN 0 AND 1440);

ALTER TABLE queues DROP CONSTRAINT IF EXISTS queues_recycle_pool_check;
ALTER TABLE queues ADD CONSTRAINT queues_recycle_pool_check
    CHECK (reset_rule <> 'recycle' OR number_pool_size IS NOT NULL);

-- Who holds a number, and who held it lately: one probe per pool number.
CREATE INDEX IF NOT EXISTS idx_tokens_number_recent ON tokens (tenant_id, number, token_date);
