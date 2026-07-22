-- Migration: 0173_shift_sessions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters attendance_records, already tenant-policied.
-- Shift sessions on top of attendance: a staff member starts their shift,
-- can extend ("snooze" / double shift), pause and resume later, and end it.
-- Duty-hours fatigue is evaluated advisory-only and acknowledged in place.
-- All lives on attendance_records so worked-hours stay one source of truth.

ALTER TABLE public.attendance_records
    ADD COLUMN IF NOT EXISTS planned_end timestamptz,
    ADD COLUMN IF NOT EXISTS extended_until timestamptz,
    ADD COLUMN IF NOT EXISTS extension_reason text,
    ADD COLUMN IF NOT EXISTS paused_at timestamptz,
    ADD COLUMN IF NOT EXISTS paused_minutes integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS session_status text NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS fatigue_ack_at timestamptz,
    ADD COLUMN IF NOT EXISTS fatigue_ack_reason text,
    ADD COLUMN IF NOT EXISTS fatigue_flags text[];

ALTER TABLE public.attendance_records
    DROP CONSTRAINT IF EXISTS attendance_records_session_status_check;
ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_records_session_status_check
    CHECK (session_status = ANY (ARRAY[
        'off'::text,
        'on_duty'::text,
        'paused'::text,
        'ended'::text
    ]));

-- At most one open (on_duty/paused) session per employee at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_open_session
    ON public.attendance_records (tenant_id, employee_id)
    WHERE session_status IN ('on_duty', 'paused');
