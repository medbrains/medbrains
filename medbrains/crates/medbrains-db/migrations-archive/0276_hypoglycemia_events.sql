-- Migration: 0276_hypoglycemia_events.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Inpatient hypoglycaemia management (ADA / NABH endocrinology safety). Hypoglycaemia (blood glucose
-- < 70 mg/dL) is the most common serious harm from insulin/sulfonylureas and, untreated, causes
-- seizures, coma and death. The protocol: classify severity, treat (15-20 g oral carbohydrate if
-- conscious; IV dextrose / IM glucagon if severe or unable to swallow), then RECHECK glucose in 15
-- minutes and repeat until recovered. NABH tracks "hypoglycaemia target achieved" (recovery on recheck)
-- but had no capture behind it — this records each event and whether it resolved.

CREATE TABLE IF NOT EXISTS hypoglycemia_events (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id        uuid NOT NULL,
    admission_id      uuid,
    glucose_value     double precision NOT NULL,   -- initial capillary/venous glucose, mg/dL
    conscious         boolean NOT NULL DEFAULT true,
    severity          text NOT NULL,               -- none | moderate | severe (computed)
    treatment         text,                        -- oral_carbs | iv_dextrose | im_glucagon | none
    treatment_given_at timestamptz,
    recheck_glucose   double precision,            -- glucose on 15-minute recheck
    recheck_at        timestamptz,
    resolved          boolean NOT NULL DEFAULT false,  -- recheck glucose >= 70
    notes             text,
    recorded_by       uuid,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT hypoglycemia_severity_check CHECK (severity IN ('none', 'moderate', 'severe')),
    CONSTRAINT hypoglycemia_treatment_check
        CHECK (treatment IS NULL OR treatment IN ('oral_carbs', 'iv_dextrose', 'im_glucagon', 'none'))
);

CREATE INDEX IF NOT EXISTS idx_hypoglycemia_patient
    ON hypoglycemia_events (tenant_id, patient_id, created_at DESC);

ALTER TABLE hypoglycemia_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY hypoglycemia_events_tenant_isolation ON hypoglycemia_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
