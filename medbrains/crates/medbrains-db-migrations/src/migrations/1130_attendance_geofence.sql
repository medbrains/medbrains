-- ====================================================================
-- Migration: 1130_attendance_geofence.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Attendance geofencing (#4850). Each campus (facility) may carry a fence:
-- its existing latitude/longitude plus a radius. A self-service punch keeps
-- where it was made, and how it stood against the nearest fence, as
-- {lat, lng, accuracy_m, distance_m, inside, place, facility_id,
--  facility_name, flagged}. The hospital's mode (off / flag / block) lives in
-- tenant_settings (category 'attendance', key 'geofence_mode').

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS geofence_radius_m integer
        CHECK (geofence_radius_m IS NULL OR geofence_radius_m BETWEEN 25 AND 5000);

ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS check_in_location jsonb,
    ADD COLUMN IF NOT EXISTS check_out_location jsonb;

-- HR filters on this; derived so it can never disagree with the locations.
ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS geofence_flagged boolean
        GENERATED ALWAYS AS (
            COALESCE((check_in_location ->> 'flagged')::boolean, false)
            OR COALESCE((check_out_location ->> 'flagged')::boolean, false)
        ) STORED;

CREATE INDEX IF NOT EXISTS idx_attendance_records_geofence_flagged
    ON public.attendance_records (tenant_id, attendance_date)
    WHERE geofence_flagged AND deleted_at IS NULL;
