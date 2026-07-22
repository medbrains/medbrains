-- ====================================================================
-- Migration: 0213_radiology_critical_alerts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_critical_alerts
-- Drops: none
-- ====================================================================
-- A critical imaging finding (e.g. pneumothorax, intracranial bleed) must
-- be actively communicated to the treating physician and acknowledged —
-- NABH critical-results reporting, same as critical lab values. Labs had
-- this loop (lab_critical_alerts); radiology did not — a critical report
-- only emitted an event and otherwise sat in the chart. This adds the
-- radiology critical-alert record so the report can notify the ordering /
-- encounter doctor and capture their acknowledgement.

CREATE TABLE IF NOT EXISTS public.radiology_critical_alerts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL,
    order_id        uuid NOT NULL,
    report_id       uuid NOT NULL,
    patient_id      uuid NOT NULL,
    modality        text,
    finding         text NOT NULL,
    notified_to     uuid,
    notified_at     timestamptz,
    acknowledged_by uuid,
    acknowledged_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radiology_critical_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radiology_critical_alerts_tenant ON public.radiology_critical_alerts;
CREATE POLICY radiology_critical_alerts_tenant ON public.radiology_critical_alerts
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_radiology_critical_alerts_patient
    ON public.radiology_critical_alerts (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_radiology_critical_alerts_report
    ON public.radiology_critical_alerts (report_id);
