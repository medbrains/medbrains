-- Ageing for the token queue, so a routine patient cannot starve.
--
-- `call_next` ordered strictly by priority weight then arrival:
--
--     ORDER BY token_priority_weight(priority), seq
--
-- which means a `normal` token is called only when nothing higher-priority is
-- waiting. At a camp that is not a corner case — elderly, pregnant and
-- disabled patients arrive continuously all morning, and every one of them
-- outranks the person who arrived first. They wait until the stream stops.
-- Some go home.
--
-- Ageing gives a waiting token one step of priority per 30 minutes, floored so
-- it can never overtake a clinical emergency:
--
--     0 stat · 1 urgent · 2 emergency_referral   never age, never overtaken
--     3 elderly/disabled/pregnant                the floor an aged token reaches
--     4 carried_over · 5 vip · 6 normal          age upward
--
-- So a normal patient waiting 30 minutes passes vip, at 60 passes
-- carried_over, and at 90 stands level with vulnerability — where arrival
-- order decides, which is the fair tiebreak. They never precede an emergency,
-- however long they have waited. That is the line that matters: this is a
-- fairness fix, not a triage change.

CREATE OR REPLACE FUNCTION token_effective_weight(
    priority      text,
    waiting_since timestamptz
) RETURNS integer
LANGUAGE sql
-- STABLE, not IMMUTABLE: it reads now(). Postgres will not let this be used in
-- an index, which is correct — the value changes every minute by design.
STABLE PARALLEL SAFE
AS $$
  SELECT GREATEST(
    -- Clinical emergencies keep their own weight (the GREATEST picks it,
    -- since any bonus only makes the second term smaller). Everything else
    -- floors at 3.
    CASE WHEN token_priority_weight(priority) <= 2
         THEN token_priority_weight(priority)
         ELSE 3
    END,
    token_priority_weight(priority)
      - FLOOR(EXTRACT(EPOCH FROM (now() - waiting_since)) / 1800)::int
  )
$$;

COMMENT ON FUNCTION token_effective_weight(text, timestamptz) IS
  'Priority weight aged by waiting time: one step per 30 minutes, floored at 3 '
  'so an aged token never precedes stat, urgent or emergency_referral.';
