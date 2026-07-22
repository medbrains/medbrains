-- Migration: 0253_mds_assessments.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Long-Term Care: Minimum Data Set (MDS) assessment (ticket #2961). The standardized comprehensive
-- assessment for a long-stay resident — cognition, mood, function (ADLs), continence, nutrition —
-- done at admission and then quarterly / annually / on significant change. Summary domains are
-- columns; the full item set lives in `sections` jsonb. Tenant RLS.

CREATE TABLE IF NOT EXISTS mds_assessments (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id           uuid NOT NULL,
    assessment_type      text NOT NULL DEFAULT 'admission',
    assessment_date      date NOT NULL DEFAULT CURRENT_DATE,
    cognitive_status     text,
    mood_score           integer,
    adl_dependency_score integer,
    continence_status    text,
    nutrition_notes      text,
    sections             jsonb NOT NULL DEFAULT '{}'::jsonb,
    status               text NOT NULL DEFAULT 'draft',
    assessed_by          uuid,
    completed_at         timestamptz,
    notes                text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mds_assessment_type_check CHECK (assessment_type = ANY (ARRAY[
        'admission'::text, 'quarterly'::text, 'annual'::text, 'significant_change'::text,
        'discharge'::text
    ])),
    CONSTRAINT mds_assessment_status_check CHECK (status = ANY (ARRAY[
        'draft'::text, 'completed'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_mds_assessments_patient
    ON mds_assessments (tenant_id, patient_id, assessment_date DESC);

ALTER TABLE mds_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY mds_assessments_tenant_isolation ON mds_assessments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER mds_assessments_updated_at BEFORE UPDATE ON mds_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
