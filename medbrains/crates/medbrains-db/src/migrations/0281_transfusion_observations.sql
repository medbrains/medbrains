-- Migration: 0281_transfusion_observations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Bedside transfusion monitoring (AABB / NABH hemovigilance). Acute haemolytic and severe febrile
-- reactions declare themselves in the first minutes of a transfusion, so the patient's vitals must be
-- observed at baseline, at 15 minutes, periodically during, and at completion. The transfusion record
-- itself was captured (identity/ABO/crossmatch checks) but the interval observations lived only on a
-- paper MRD form — this stores each structured observation and flags one that suggests a reaction.

CREATE TABLE IF NOT EXISTS transfusion_observations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transfusion_id     uuid NOT NULL REFERENCES transfusions(id) ON DELETE CASCADE,
    phase              text NOT NULL,               -- baseline | fifteen_min | periodic | completion
    temperature_c      double precision,
    pulse              integer,
    systolic_bp        integer,
    diastolic_bp       integer,
    respiratory_rate   integer,
    adverse_signs      boolean NOT NULL DEFAULT false,  -- rigors, urticaria, dyspnoea, back/loin pain, etc.
    reaction_suspected boolean NOT NULL DEFAULT false,  -- computed server-side from temp / adverse signs
    notes              text,
    observed_by        uuid,
    observed_at        timestamptz NOT NULL DEFAULT now(),
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT transfusion_observation_phase_check
        CHECK (phase IN ('baseline', 'fifteen_min', 'periodic', 'completion'))
);

CREATE INDEX IF NOT EXISTS idx_transfusion_observations_transfusion
    ON transfusion_observations (tenant_id, transfusion_id, observed_at);

ALTER TABLE transfusion_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfusion_observations_tenant_isolation ON transfusion_observations
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
