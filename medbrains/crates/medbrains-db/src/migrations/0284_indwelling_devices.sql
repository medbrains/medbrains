-- Per-patient invasive/indwelling device register with daily necessity review (CDC/NABH
-- CAUTI·CLABSI·VAP prevention bundles). infection_device_days already counts device-days in
-- aggregate for computing HAI RATES, but the actual PREVENTION intervention is per-patient: every
-- indwelling line/catheter/tube must have its ongoing necessity reviewed daily and be removed as soon
-- as it is no longer indicated, because each avoidable device-day carries infection risk. This tracks
-- each device, its indication, the daily review, and removal.

CREATE TABLE IF NOT EXISTS indwelling_devices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       uuid NOT NULL,
    admission_id     uuid,
    device_type      text NOT NULL,   -- central_line | urinary_catheter | ventilator | peripheral_iv | other
    site             text,
    indication       text NOT NULL,   -- clinical reason the device is in place
    inserted_at      timestamptz NOT NULL DEFAULT now(),
    inserted_by      uuid,
    last_reviewed_at timestamptz NOT NULL DEFAULT now(),
    still_indicated  boolean NOT NULL DEFAULT true,
    removed_at       timestamptz,
    removed_by       uuid,
    removal_reason   text,
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT indwelling_device_type_check
        CHECK (device_type IN ('central_line', 'urinary_catheter', 'ventilator', 'peripheral_iv', 'other'))
);

-- Active devices for a patient (the bedside list).
CREATE INDEX IF NOT EXISTS idx_indwelling_devices_patient_active
    ON indwelling_devices (tenant_id, patient_id)
    WHERE removed_at IS NULL;

-- Active devices overdue for necessity review (the safety scan).
CREATE INDEX IF NOT EXISTS idx_indwelling_devices_review
    ON indwelling_devices (tenant_id, last_reviewed_at)
    WHERE removed_at IS NULL;

ALTER TABLE indwelling_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY indwelling_devices_tenant_isolation ON indwelling_devices
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
