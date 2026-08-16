-- Migration: 0247_remote_vital_readings.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Remote vital monitoring (ticket #2969): readings streamed from a home patient's connected devices
-- (BP cuff, glucometer, pulse oximeter, thermometer, scale). Bluetooth pairing + read happens in the
-- mobile app; this stores the reading (flexible jsonb) and whether it breached a safe range. Tenant RLS.

CREATE TABLE IF NOT EXISTS remote_vital_readings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id  uuid NOT NULL,
    device_type text NOT NULL,
    reading     jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_flagged  boolean NOT NULL DEFAULT false,
    measured_at timestamptz NOT NULL DEFAULT now(),
    source      text NOT NULL DEFAULT 'device',
    recorded_by uuid,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT remote_vital_device_check CHECK (device_type = ANY (ARRAY[
        'bp'::text, 'glucometer'::text, 'pulse_ox'::text, 'thermometer'::text, 'weight'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_remote_vitals_patient
    ON remote_vital_readings (tenant_id, patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_vitals_flagged
    ON remote_vital_readings (tenant_id, patient_id) WHERE is_flagged = true;

ALTER TABLE remote_vital_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY remote_vital_readings_tenant_isolation ON remote_vital_readings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
