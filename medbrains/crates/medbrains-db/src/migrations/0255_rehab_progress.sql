-- Rehabilitation progress tracking (ticket #2963): therapy sessions (physiotherapy, occupational,
-- speech) for a resident with the session goal, progress note and a functional score to trend
-- recovery over time. Tenant RLS.

CREATE TABLE IF NOT EXISTS rehab_progress (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       uuid NOT NULL,
    therapy_type     text NOT NULL,
    session_date     date NOT NULL DEFAULT CURRENT_DATE,
    goal             text,
    progress_note    text,
    functional_score integer,
    therapist        uuid,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rehab_therapy_type_check CHECK (therapy_type = ANY (ARRAY[
        'physiotherapy'::text, 'occupational'::text, 'speech'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_rehab_progress_patient
    ON rehab_progress (tenant_id, patient_id, session_date DESC);

ALTER TABLE rehab_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY rehab_progress_tenant_isolation ON rehab_progress
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER rehab_progress_updated_at BEFORE UPDATE ON rehab_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
