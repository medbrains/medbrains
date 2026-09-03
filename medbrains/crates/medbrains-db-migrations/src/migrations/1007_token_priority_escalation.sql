-- Let a person escalate a waiting patient, and record who and why.
--
-- Promotion already existed, but only as a side effect: re-issuing a token for
-- a patient who already holds one lifts it if the new reason is more urgent —
-- a STAT lab order raised for someone queued for a routine collection. That
-- covers the case where a clinical order happens to be raised. It does not
-- cover the case that actually kills people: a patient deteriorating in the
-- waiting room, seen by a nurse walking past, with no order to raise.
--
-- At a camp there is one waiting area and no triage station. The person who
-- notices is the person at the desk, and until now they had no way to act on
-- it except to hope somebody ordered something.
--
-- Escalation is recorded on the token rather than only in the audit log
-- because the board and console have to show it. A patient moved up for a
-- reason nobody at the desk witnessed looks like a queue-jump, and the desk is
-- who has to explain it — the same reason the priority badge already carries
-- its own tooltip.

ALTER TABLE tokens
    ADD COLUMN IF NOT EXISTS priority_changed_by  uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS priority_changed_at  timestamptz,
    ADD COLUMN IF NOT EXISTS priority_reason      text;

COMMENT ON COLUMN tokens.priority_reason IS
  'Why this token was escalated, in the words of whoever escalated it. Shown '
  'on the board so a patient moved up does not read as a queue-jump.';
