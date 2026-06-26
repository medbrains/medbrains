-- ====================================================================
-- Migration: 0214_verbal_order_escalation.sql
-- RLS-Posture: tenant-rls (alters existing tenant-scoped table)
-- Tenant-Column: tenant_id (existing on prescriptions)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Verbal/telephone medication orders must be countersigned by the
-- prescriber within policy (default 24h, NABH/JCI medication safety). The
-- countersign-due tracking (0174) and the closing signature exist, but an
-- overdue order was only a passive badge on the prescriber's own page. This
-- adds escalation bookkeeping so a background pass can actively chase an
-- overdue countersignature (notify the ordering doctor + their supervisor)
-- exactly once — mirroring lab_critical_alerts.escalated_at/_to.

ALTER TABLE public.prescriptions
    ADD COLUMN IF NOT EXISTS countersign_escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS countersign_escalated_to  uuid;

-- Drive the escalation pass: verbal/telephone orders past their countersign
-- deadline, not yet signed, not yet escalated.
CREATE INDEX IF NOT EXISTS idx_prescriptions_countersign_escalation
    ON public.prescriptions (tenant_id, countersign_due_at)
    WHERE order_mode <> 'written'
      AND NOT is_signed
      AND countersign_escalated_at IS NULL;
