-- Surviving Sepsis Campaign "Hour-1 bundle" tracker. Sepsis is a time-critical emergency: the five
-- bundle elements must be delivered within one hour of sepsis recognition, and every hour of delay in
-- antibiotics raises mortality. NABH tracks Hour-1-bundle compliance (KPI NABH_DEPT_10) but there was
-- no capture behind it — this records each element's completion time and whether it was on-time, so the
-- compliance percentage is real. Recognition-to-element timing is computed server-side.

CREATE TABLE IF NOT EXISTS sepsis_hour1_bundles (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id          uuid NOT NULL,
    admission_id        uuid,
    -- The clock starts at sepsis recognition (e.g. qSOFA >= 2 with suspected infection).
    recognised_at       timestamptz NOT NULL,
    -- Fluids + vasopressors are only bundle-required when the patient is hypotensive or lactate >= 4.
    fluids_indicated    boolean NOT NULL DEFAULT false,
    initial_lactate     double precision,
    -- Element completion timestamps (NULL = not yet done)
    lactate_measured_at timestamptz,
    blood_cultures_at   timestamptz,
    antibiotics_at      timestamptz,
    fluids_started_at   timestamptz,
    vasopressors_at     timestamptz,
    -- Server-computed: all required elements delivered within one hour of recognition.
    bundle_compliant    boolean NOT NULL DEFAULT false,
    notes               text,
    recorded_by         uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sepsis_bundle_patient
    ON sepsis_hour1_bundles (tenant_id, patient_id, recognised_at DESC);

ALTER TABLE sepsis_hour1_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY sepsis_hour1_bundles_tenant_isolation ON sepsis_hour1_bundles
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
