-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Somebody the hospital did not reach yesterday.
--
-- Two halves: a priority for a patient coming back after their day ran out,
-- and the one-off close of every row that has been sitting open because
-- nothing ever ended a day.
--
-- ## The priority
--
-- The vocabulary had no value between `vip` and `normal`. A patient returning
-- after being sent home unseen either jumped ahead of clinical and
-- vulnerability cases, or joined the back of the queue behind every fresh
-- walk-in as though yesterday had not happened. Neither is defensible.
--
-- `carried_over` sits above `vip`, because a courtesy should not outrank a
-- failure the hospital owes, and below the vulnerability categories and every
-- clinical reason, because being owed a slot is not a clinical claim. The
-- weights are renumbered rather than squeezed: only their order is read, by
-- ORDER BY token_priority_weight(priority), so the absolute values are free.
--
-- Unknown values still sort *last*. A priority a newer server introduces must
-- never jump the queue on an older one.
--
--   0  stat                 a clinical emergency
--   1  urgent               clinically ahead of the routine list
--   2  emergency_referral   sent here by another facility, still waiting
--   3  elderly / disabled / pregnant
--   4  carried_over         waited yesterday and was not seen
--   5  vip                  a courtesy
--   6  normal, and anything this build has never heard of

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
    WHEN 'carried_over' THEN 4
    WHEN 'vip' THEN 5
    ELSE 6
  END
$$;

COMMENT ON FUNCTION public.token_priority_weight(text) IS
  'Sort weight for tokens.priority. Lower first. Unknown values sort last, '
  'never first: a priority a newer server introduced must not jump the queue '
  'on an older one.';

-- ## The backlog
--
-- Close every queue entry and token left open on a day that has already
-- ended. Strictly before the current date, so nothing touches a queue that is
-- still being worked.
--
-- These are marked, not deleted: a patient who waited and was not seen is a
-- fact the hospital should be able to count, and it is the input the wait-time
-- estimator has never had. Not one row in this database has ever carried both
-- called_at and completed_at, which is why "average consultation duration"
-- has always returned NULL and silently fallen back to a hard-coded ten
-- minutes.

-- Against each tenant's own local date, not the session's.
--
-- `CURRENT_DATE` is evaluated in the connecting session's timezone, which is
-- whatever the deploying client happened to have set. A hospital in Kolkata
-- whose migration runs from a session sitting a few hours ahead would have
-- today's queue -- the one being worked right now -- closed under it. The
-- rollover service takes the tenant's timezone for exactly this reason, and a
-- one-off backfill must not answer a different question from the job that
-- takes over from it.

UPDATE opd_queues q
   SET status = 'expired',
       updated_at = now()
  FROM tenants t
 WHERE t.id = q.tenant_id
   AND q.queue_date < (timezone(COALESCE(t.timezone, 'UTC'), now()))::date
   AND q.status IN ('waiting', 'called', 'in_consultation')
   AND q.deleted_at IS NULL;

UPDATE tokens tk
   SET status = 'expired',
       updated_at = now()
  FROM tenants t
 WHERE t.id = tk.tenant_id
   AND tk.token_date < (timezone(COALESCE(t.timezone, 'UTC'), now()))::date
   AND tk.status IN ('waiting', 'called', 'serving');
