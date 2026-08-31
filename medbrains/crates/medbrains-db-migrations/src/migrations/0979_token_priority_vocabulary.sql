-- RLS-Posture: not-tenant-scoped
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- One priority vocabulary for the unified token queue, and one place that
-- decides what it means.
--
-- OPD check-in used to write three parallel queues, and two of them recorded
-- priority differently. `queue_tokens` carried the kiosk's categories --
-- elderly, disabled, pregnant, vip, emergency_referral -- which is what the
-- token-category rules in the spec are about, and are the reason a hospital
-- puts a priority button on a kiosk at all. `tokens`, the queue everything is
-- moving onto, knew only normal, urgent and stat. Migrating without this would
-- have quietly dropped the categories: the kiosk would go on offering the
-- button and the queue would go on ignoring it.
--
-- The ordering weight is a function rather than a CASE expression copied into
-- each query. It was already copied five times in `medbrains-tokens` alone --
-- into call-next, the board, the requeue arithmetic, and twice into the
-- "how many are ahead of me" subquery -- and a vocabulary that grows is
-- exactly the thing that gets added to four of five copies.
--
-- Lower sorts first.
--
--   0  stat                a clinical emergency
--   1  urgent              clinically ahead of the routine list
--   2  emergency_referral  sent here by another facility, still waiting
--   3  elderly / disabled / pregnant
--                          the vulnerability categories, equal to each other
--                          so they keep their arrival order between them
--   4  vip                 a courtesy, and so behind every clinical or
--                          vulnerability reason
--   5  normal              and anything this build has never heard of, which
--                          must not silently sort to the front

CREATE OR REPLACE FUNCTION public.token_priority_weight(priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE priority
    WHEN 'stat' THEN 0
    WHEN 'urgent' THEN 1
    WHEN 'emergency_referral' THEN 2
    WHEN 'elderly' THEN 3
    WHEN 'disabled' THEN 3
    WHEN 'pregnant' THEN 3
    WHEN 'vip' THEN 4
    ELSE 5
  END
$$;

COMMENT ON FUNCTION public.token_priority_weight(text) IS
  'Sort weight for tokens.priority. Lower first. Unknown values sort last, '
  'never first: a priority a newer server introduced must not jump the queue '
  'on an older one.';
