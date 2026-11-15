-- ====================================================================
-- Migration: 1462_hfr_onboarding_tracking.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ABDM M4: HFR's official onboarding is four calls tied together by the
-- trackingId HFR issues on the first basic-information save (#5716).
--
-- facilities.hfr_tracking_id  the trackingId of the campus's HFR record; an
--                             update re-sends the steps with it.
-- abdm_hfr_registrations      one row per call: step (basic, additional,
--                             detailed, submit), the trackingId it carried,
--                             and status 'saved' for a step HFR accepted.
--                             The latest saved row per step is the draft the
--                             screen resumes from.
--
-- Both tables already carry tenant RLS and the soft-delete guardrail.

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS hfr_tracking_id text;

ALTER TABLE public.abdm_hfr_registrations
    ADD COLUMN IF NOT EXISTS tracking_id text,
    ADD COLUMN IF NOT EXISTS step text;

ALTER TABLE public.abdm_hfr_registrations
    DROP CONSTRAINT IF EXISTS abdm_hfr_registrations_status_check;
ALTER TABLE public.abdm_hfr_registrations
    ADD CONSTRAINT abdm_hfr_registrations_status_check
    CHECK (status IN ('queued', 'submitted', 'approved', 'rejected', 'failed', 'saved'));

DO $$ BEGIN
    ALTER TABLE public.abdm_hfr_registrations ADD CONSTRAINT abdm_hfr_registrations_step_check
        CHECK (step IS NULL OR step IN ('basic', 'additional', 'detailed', 'submit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_abdm_hfr_registrations_facility_step
    ON public.abdm_hfr_registrations (facility_id, step, submitted_at DESC)
    WHERE deleted_at IS NULL;
