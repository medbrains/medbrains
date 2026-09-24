-- A nurse call that nobody answers has to reach somebody.
--
-- Escalation was computed on read: the ward board coloured the row amber at
-- two minutes and red at five, and that was the whole of it. Nobody was told.
-- A charge nurse learned about an unanswered call by happening to look at a
-- screen, which is not a control — it is a coincidence.
--
-- These two columns let the escalation pass remember who it has already
-- reached, so a call escalates once per tier rather than every pass.

ALTER TABLE bedside_nurse_requests
    ADD COLUMN IF NOT EXISTS escalation_level text,
    ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS escalated_to uuid REFERENCES users(id);

COMMENT ON COLUMN bedside_nurse_requests.escalation_level IS
    'Highest tier this call has been escalated to: charge_nurse, then supervisor. NULL means nobody has been told yet.';

-- The pass looks for open calls older than the threshold. Partial, because a
-- completed call is never a candidate and the open ones are the small
-- minority of the table.
CREATE INDEX IF NOT EXISTS idx_bedside_nurse_requests_open_escalation
    ON bedside_nurse_requests (tenant_id, created_at)
    WHERE completed_at IS NULL AND deleted_at IS NULL;
