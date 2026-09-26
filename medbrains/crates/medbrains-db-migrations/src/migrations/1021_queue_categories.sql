-- ====================================================================
-- Migration: 1021_queue_categories.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: queue_categories
-- Drops: none
-- ====================================================================
-- Which priority categories a queue offers, what the desk calls them, and in
-- what order they are called (RFCs/modules/RFC-MODULE-token-queues.md, P1b).
--
-- The order was one hard-coded CASE for every queue in every hospital. A camp
-- wants "senior citizens" and nothing else; a staff clinic wants "staff"; a
-- pharmacy counter wants no VIP lane at all.
--
-- The clinical tiers are not configurable and are not stored here: stat (0),
-- urgent (1) and emergency referral (2) are always first, in every queue. A
-- configured category ranks 3 to 9, so no hospital can put a courtesy lane
-- ahead of an emergency. The server also refuses ranking elderly, disabled or
-- pregnant below normal.
--
-- A queue with no rows here keeps the built-in order exactly.

CREATE TABLE IF NOT EXISTS queue_categories (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id),
    queue_id          uuid NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    code              text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{0,31}$'),
    label             text NOT NULL CHECK (length(trim(label)) > 0),
    rank              smallint NOT NULL CHECK (rank BETWEEN 3 AND 9),
    kiosk_selectable  boolean NOT NULL DEFAULT false,
    is_active         boolean NOT NULL DEFAULT true,
    UNIQUE (queue_id, code),
    CHECK (code NOT IN ('stat', 'urgent', 'emergency_referral'))
);

ALTER TABLE queue_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_queue_categories ON queue_categories;
CREATE POLICY tenant_isolation_queue_categories ON queue_categories
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- The call order for a token: its queue's configured rank when it has one,
-- aged one step per 30 minutes and floored at 3 so waiting never overtakes a
-- clinical tier; otherwise the built-in weight, unchanged.
CREATE OR REPLACE FUNCTION token_queue_weight(
    queue_id      uuid,
    priority      text,
    waiting_since timestamptz
) RETURNS integer
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  SELECT COALESCE(
    (SELECT GREATEST(3, c.rank - FLOOR(EXTRACT(EPOCH FROM (now() - waiting_since)) / 1800)::int)
       FROM queue_categories c
      WHERE c.queue_id = token_queue_weight.queue_id
        AND c.code = token_queue_weight.priority
        AND c.is_active),
    token_effective_weight(priority, waiting_since)
  )
$$;

COMMENT ON FUNCTION token_queue_weight(uuid, text, timestamptz) IS
  'Call order for a token: its queue''s configured category rank (3-9, aged, '
  'floored at 3), or the built-in token_effective_weight when none applies.';

-- The desk's name for a token's lane, when its queue configured one; NULL
-- means the built-in vocabulary applies and the client labels it.
CREATE OR REPLACE FUNCTION token_priority_label(queue_id uuid, priority text)
RETURNS text
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  SELECT c.label FROM queue_categories c
   WHERE c.queue_id = token_priority_label.queue_id
     AND c.code = token_priority_label.priority
$$;
