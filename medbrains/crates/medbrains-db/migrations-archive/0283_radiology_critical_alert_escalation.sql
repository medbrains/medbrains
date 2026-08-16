-- Migration: 0283_radiology_critical_alert_escalation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters radiology_critical_alerts, already tenant-policied.
-- Radiology critical-finding escalation (NABH critical-results reporting), mirroring the lab loop
-- (0148_critical_alert_escalation). A critical imaging finding (pneumothorax, intracranial bleed,
-- ectopic) that the ordering physician never acknowledges is as dangerous as an unacknowledged
-- critical lab value — but only lab_critical_alerts escalated. This adds the escalation columns so
-- the background escalation service can chase unacknowledged radiology alerts up the on-call chain.

ALTER TABLE public.radiology_critical_alerts
    ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS escalated_to uuid;

CREATE INDEX IF NOT EXISTS idx_radiology_critical_alerts_unacked
    ON public.radiology_critical_alerts (tenant_id, created_at)
    WHERE acknowledged_at IS NULL AND escalated_at IS NULL;
