-- ====================================================================
-- Migration: 0130_encounter_camp_visit_type.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters: encounters
-- ====================================================================
-- Camp-origin OPD visits are clinical OPD encounters but must remain
-- distinguishable for camp reports, NABH outreach evidence, and patient
-- timelines. The backend already validates `visit_type = 'camp'`; this
-- aligns the database check constraint.

ALTER TABLE public.encounters
    DROP CONSTRAINT IF EXISTS encounters_visit_type_check;

ALTER TABLE public.encounters
    ADD CONSTRAINT encounters_visit_type_check
    CHECK (
        (visit_type)::text = ANY (
            ARRAY[
                'walk_in'::character varying,
                'booked'::character varying,
                'follow_up'::character varying,
                'referral'::character varying,
                'emergency'::character varying,
                'camp'::character varying
            ]::text[]
        )
    );
