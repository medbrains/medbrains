-- Migration: 0236_home_progress_notes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare daily clinical progress notes (ticket #2981) written by the visiting nurse or
-- the remote physician during a home-care episode, with an optional vitals snapshot. Tenant RLS.

CREATE TABLE IF NOT EXISTS home_progress_notes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id  uuid NOT NULL,
    note_date   date NOT NULL DEFAULT CURRENT_DATE,
    author_id   uuid,
    author_role text NOT NULL DEFAULT 'nurse',
    note_text   text NOT NULL,
    vitals      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_progress_note_role_check CHECK (author_role = ANY (ARRAY[
        'nurse'::text, 'physician'::text
    ]))
);

CREATE INDEX IF NOT EXISTS idx_home_progress_patient
    ON home_progress_notes (tenant_id, patient_id, note_date DESC);

ALTER TABLE home_progress_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_progress_notes_tenant_isolation ON home_progress_notes
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_progress_notes_updated_at BEFORE UPDATE ON home_progress_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
