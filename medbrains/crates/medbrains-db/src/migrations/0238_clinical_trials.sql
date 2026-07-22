-- Migration: 0238_clinical_trials.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Clinical Trials registry (ticket #2983): the trials a hospital's research department runs, with
-- sponsor / phase / indication / PI and a lifecycle status (planned → recruiting → active →
-- completed / terminated / suspended). Tenant RLS.

CREATE TABLE IF NOT EXISTS clinical_trials (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    protocol_number        text NOT NULL,
    title                  text NOT NULL,
    sponsor                text,
    phase                  text,
    status                 text NOT NULL DEFAULT 'planned',
    indication             text,
    principal_investigator text,
    target_enrollment      integer,
    start_date             date,
    end_date               date,
    notes                  text,
    is_active              boolean NOT NULL DEFAULT true,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_trials_status_check CHECK (status = ANY (ARRAY[
        'planned'::text, 'recruiting'::text, 'active'::text, 'completed'::text,
        'terminated'::text, 'suspended'::text
    ])),
    CONSTRAINT clinical_trials_protocol_unique UNIQUE (tenant_id, protocol_number)
);

CREATE INDEX IF NOT EXISTS idx_clinical_trials_status ON clinical_trials (tenant_id, status);

ALTER TABLE clinical_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinical_trials_tenant_isolation ON clinical_trials
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER clinical_trials_updated_at BEFORE UPDATE ON clinical_trials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
