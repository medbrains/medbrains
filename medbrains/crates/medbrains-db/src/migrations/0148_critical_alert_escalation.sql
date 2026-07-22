-- Migration: 0148_critical_alert_escalation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters and indexes lab_critical_alerts, already tenant-policied.
-- Critical-value escalation tracking (audit P0 #16 / NABH critical
-- value reporting): unacknowledged alerts escalate after a window.
ALTER TABLE public.lab_critical_alerts
    ADD COLUMN IF NOT EXISTS escalated_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS escalated_to uuid;

CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_unacked
    ON public.lab_critical_alerts (tenant_id, created_at)
    WHERE acknowledged_at IS NULL AND escalated_at IS NULL;
