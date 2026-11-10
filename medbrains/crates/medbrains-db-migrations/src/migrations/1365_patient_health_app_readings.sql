-- ====================================================================
-- Migration: 1365_patient_health_app_readings.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: patient_health_data_consents
-- Drops: none
-- ====================================================================
-- Readings a patient shares from Apple Health (HealthKit) or Health
-- Connect through the patient app: blood pressure, glucose, weight, SpO2
-- and heart rate.
--
-- Each kind is shared only after the patient says yes to it, in the app,
-- per source; the answers are kept append-only (latest wins) so the record
-- shows when sharing started and stopped (DPDP Act 2023: consent per
-- purpose, withdrawable). Shared readings land in remote_vital_readings
-- as patient-reported -- read by the care team, never scored as clinical
-- observations. A sample's own id makes a repeat sync a no-op.

CREATE TABLE public.patient_health_data_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    source text NOT NULL CHECK (source IN ('healthkit', 'health_connect')),
    data_type text NOT NULL
        CHECK (data_type IN ('blood_pressure', 'glucose', 'weight', 'spo2', 'heart_rate')),
    granted boolean NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_patient_health_data_consents_latest
    ON public.patient_health_data_consents (tenant_id, patient_id, source, data_type, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE public.patient_health_data_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_health_data_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_patient_health_data_consents ON public.patient_health_data_consents
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_patient_health_data_consents
    BEFORE UPDATE ON public.patient_health_data_consents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_patient_health_data_consents_soft_delete
    BEFORE DELETE ON public.patient_health_data_consents
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_patient_health_data_consents
    AFTER INSERT OR DELETE OR UPDATE ON public.patient_health_data_consents
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');

-- Heart rate on its own (a watch, not a pulse oximeter).
ALTER TABLE public.remote_vital_readings DROP CONSTRAINT IF EXISTS remote_vital_device_check;
ALTER TABLE public.remote_vital_readings ADD CONSTRAINT remote_vital_device_check
    CHECK (device_type IN ('bp', 'glucometer', 'pulse_ox', 'thermometer', 'weight', 'heart_rate'));

ALTER TABLE public.remote_vital_readings ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_remote_vital_readings_external
    ON public.remote_vital_readings (tenant_id, patient_id, source, external_id)
    WHERE external_id IS NOT NULL;
