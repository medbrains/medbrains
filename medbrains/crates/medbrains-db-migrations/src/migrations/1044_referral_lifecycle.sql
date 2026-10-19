-- ====================================================================
-- Migration: 1044_referral_lifecycle.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A referral had a status nothing ever changed, and accepting one put the
-- patient in nobody's queue. A visit now holds one queue row per doctor who
-- sees the patient: the doctor it was registered to ('primary'), a doctor
-- who accepted a referral for an opinion ('cross_consult'), and the
-- referring doctor again once the opinion is in ('returned'). Only the
-- primary row closes the visit and its bill. RFC-MODULE-opd-referral-journey.

ALTER TABLE opd_queues
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'primary'
        CHECK (kind IN ('primary', 'cross_consult', 'returned')),
    ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES referrals(id);

CREATE INDEX IF NOT EXISTS idx_opd_queues_referral
    ON opd_queues (referral_id) WHERE referral_id IS NOT NULL;

ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- A patient back from a colleague's opinion has already waited once: they
-- go ahead of new arrivals, level with somebody carried over from a day
-- their turn never came.
CREATE OR REPLACE FUNCTION token_priority_weight(priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE priority
    WHEN 'stat' THEN 0
    WHEN 'urgent' THEN 1
    WHEN 'emergency_referral' THEN 2
    WHEN 'elderly' THEN 3
    WHEN 'disabled' THEN 3
    WHEN 'pregnant' THEN 3
    WHEN 'carried_over' THEN 4
    WHEN 'returned' THEN 4
    WHEN 'vip' THEN 5
    ELSE 6
  END
$$;
