-- Migration: 0278_antibiotic_timeout_review.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters antibiotic_stewardship_requests, already tenant-policied.
-- Antimicrobial stewardship 48-72h "antibiotic time-out" (AMS / NABH). After ~48-72h of empiric
-- antibiotics — once cultures and sensitivities return — the team must review and document a decision:
-- continue, de-escalate to a narrower agent, stop, switch IV to oral, or change. This day-3 review is a
-- core stewardship measure that reduces resistance, C. difficile and cost; the module had only the
-- initial approval review, not the time-out. These columns capture that decision (the "due" time is
-- derived from requested_at + 72h, so no scheduling column is needed).

ALTER TABLE antibiotic_stewardship_requests
    ADD COLUMN IF NOT EXISTS timeout_decision    text,
    ADD COLUMN IF NOT EXISTS timeout_decision_at timestamptz,
    ADD COLUMN IF NOT EXISTS timeout_reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS timeout_notes       text;

ALTER TABLE antibiotic_stewardship_requests
    ADD CONSTRAINT antibiotic_timeout_decision_check
    CHECK (timeout_decision IS NULL OR timeout_decision IN
        ('continue', 'de_escalate', 'stop', 'switch_oral', 'change'));
