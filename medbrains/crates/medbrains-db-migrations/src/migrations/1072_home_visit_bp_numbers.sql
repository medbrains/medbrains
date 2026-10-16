-- ====================================================================
-- Migration: 1072_home_visit_bp_numbers.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Home-visit vitals took blood pressure as one free-text "bp" key
-- ("120/80"), so nothing could flag it or chart it. The visit screen now
-- records systolic_bp and diastolic_bp as two integers, like every other
-- vitals table. This copies the numbers out of readings already written.
-- The "bp" text stays where it is: the screen reads it only when the
-- numbers are absent, and a reading that does not parse is left alone
-- rather than guessed at.

UPDATE public.home_visits
SET vitals = vitals || jsonb_build_object(
        'systolic_bp',  (regexp_match(vitals->>'bp', '^\s*(\d{2,3})\s*/\s*(\d{2,3})\s*$'))[1]::int,
        'diastolic_bp', (regexp_match(vitals->>'bp', '^\s*(\d{2,3})\s*/\s*(\d{2,3})\s*$'))[2]::int
    )
WHERE vitals ? 'bp'
  AND NOT vitals ? 'systolic_bp'
  AND vitals->>'bp' ~ '^\s*\d{2,3}\s*/\s*\d{2,3}\s*$';
