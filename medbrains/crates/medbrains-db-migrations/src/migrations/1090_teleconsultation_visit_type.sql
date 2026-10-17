-- ====================================================================
-- Migration: 1090_teleconsultation_visit_type.sql
-- RLS-Posture: not-tenant-scoped
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A video consultation is an OPD visit the patient attends remotely. It is
-- opened when the consultation starts, so notes, orders and the
-- prescription are written on it during the call, and it says it was a
-- teleconsultation (Telemedicine Practice Guidelines 2020 require the
-- prescription to show the mode).

ALTER TABLE public.encounters DROP CONSTRAINT IF EXISTS encounters_visit_type_check;
ALTER TABLE public.encounters ADD CONSTRAINT encounters_visit_type_check CHECK (
    visit_type IN ('walk_in', 'booked', 'follow_up', 'referral', 'emergency', 'camp', 'teleconsultation')
);
