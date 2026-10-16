-- ====================================================================
-- Migration: 1066_anonymous_incidents_calibration_lock.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Three patient-safety gaps (RFCs/COMPLIANCE-GAP-2026-10.md #8, #9, #10).
--
-- 1. An anonymous incident report must not name its reporter anywhere —
--    NABH's just-culture promise. Existing anonymous rows are scrubbed, the
--    NABH registers mirrored from them lose the reporter (their column is NOT
--    NULL, so the nil uuid stands for "anonymous"), the outbox events lose
--    their actor, and a CHECK keeps every future writer honest.
-- 2. One definition of "this calibration locks its equipment", used by the
--    BME screens, the daily lock sweep and the analyser ingest.
-- 3. Infant tag alerts are looked up by tag + type to stay idempotent while a
--    reader keeps firing.

-- ── 1. Anonymous incident reports ────────────────────────────────────
DO $$
BEGIN
    IF to_regclass('public.quality_incidents') IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.nabh_sentinel_event_register r
       SET reported_by = '00000000-0000-0000-0000-000000000000'
      FROM public.quality_incidents i
     WHERE r.source_module = 'quality_incidents'
       AND r.source_record_id = i.id
       AND i.is_anonymous;

    UPDATE public.nabh_falls_register r
       SET reported_by = '00000000-0000-0000-0000-000000000000'
      FROM public.quality_incidents i
     WHERE r.source_module = 'quality_incidents'
       AND r.source_record_id = i.id
       AND i.is_anonymous;

    UPDATE public.outbox_events o
       SET payload = jsonb_set(o.payload, '{actor_id}',
                               '"00000000-0000-0000-0000-000000000000"')
      FROM public.quality_incidents i
     WHERE o.event_type = 'quality.incident.reported'
       AND o.aggregate_id = i.id
       AND i.is_anonymous
       AND o.payload ? 'actor_id';

    UPDATE public.quality_incidents
       SET reported_by = NULL
     WHERE is_anonymous AND reported_by IS NOT NULL;
END $$;

ALTER TABLE public.quality_incidents
    DROP CONSTRAINT IF EXISTS quality_incidents_anonymous_has_no_reporter;
ALTER TABLE public.quality_incidents
    ADD CONSTRAINT quality_incidents_anonymous_has_no_reporter
    CHECK (NOT is_anonymous OR reported_by IS NULL);

-- ── 2. Calibration lock ──────────────────────────────────────────────
-- Why this calibration row keeps its equipment out of patient use, or NULL.
-- A manual lock wins; then out of tolerance; then overdue (exempted rows are
-- never overdue). SECURITY INVOKER, so RLS on the caller's row still applies.
CREATE OR REPLACE FUNCTION public.bme_calibration_lock_reason(c public.bme_calibrations)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN c.deleted_at IS NOT NULL THEN NULL
        WHEN c.is_locked THEN COALESCE(NULLIF(c.locked_reason, ''), 'Locked by biomedical engineering')
        WHEN c.calibration_status = 'out_of_tolerance' OR c.is_in_tolerance = false
            THEN 'Calibration out of tolerance'
        WHEN c.calibration_status = 'overdue'
            THEN 'Calibration overdue'
        WHEN c.calibration_status <> 'exempted' AND c.next_due_date < CURRENT_DATE
            THEN 'Calibration overdue since ' || to_char(c.next_due_date, 'DD Mon YYYY')
    END
$$;

-- ── 3. Tag alerts: open alert per tag + type ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_security_tag_alerts_open
    ON public.security_tag_alerts (tenant_id, tag_id, alert_type)
    WHERE NOT is_resolved AND deleted_at IS NULL;
