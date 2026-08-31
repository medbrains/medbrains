-- Migration: 0270_vte_risk_assessment.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- VTE (venous thromboembolism) risk assessment — a leading cause of PREVENTABLE inpatient death and
-- a core NABH/JCI safety measure. Uses the Padua Prediction Score for medical inpatients: score >= 4
-- is high risk and warrants pharmacological thromboprophylaxis unless a bleeding risk contraindicates
-- it. The score is computed server-side from the documented risk factors.

CREATE TABLE IF NOT EXISTS vte_risk_assessments (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id              uuid NOT NULL,
    admission_id            uuid,
    -- Padua factors (weights in comments)
    active_cancer           boolean NOT NULL DEFAULT false, -- 3
    previous_vte            boolean NOT NULL DEFAULT false, -- 3
    reduced_mobility        boolean NOT NULL DEFAULT false, -- 3
    thrombophilia           boolean NOT NULL DEFAULT false, -- 3
    recent_trauma_surgery   boolean NOT NULL DEFAULT false, -- 2
    age_over_70             boolean NOT NULL DEFAULT false, -- 1
    cardiac_resp_failure    boolean NOT NULL DEFAULT false, -- 1
    acute_mi_stroke         boolean NOT NULL DEFAULT false, -- 1
    acute_infection_rheum   boolean NOT NULL DEFAULT false, -- 1
    obesity                 boolean NOT NULL DEFAULT false, -- 1
    hormonal_treatment      boolean NOT NULL DEFAULT false, -- 1
    -- Computed
    score                   integer NOT NULL,
    high_risk               boolean NOT NULL,
    prophylaxis_recommended boolean NOT NULL,
    -- Clinician decision
    has_bleeding_risk       boolean NOT NULL DEFAULT false,
    prophylaxis_type        text,   -- pharmacological | mechanical | none
    notes                   text,
    assessed_by             uuid,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vte_prophylaxis_type_check CHECK (prophylaxis_type IS NULL OR prophylaxis_type = ANY (ARRAY[
        'pharmacological'::text, 'mechanical'::text, 'none'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_vte_patient ON vte_risk_assessments (tenant_id, patient_id, created_at DESC);

ALTER TABLE vte_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY vte_risk_assessments_tenant_isolation ON vte_risk_assessments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
