-- ====================================================================
-- Migration: 0211_er_observation_notes.sql
-- RLS-Posture: tenant-rls
-- Tenant-Column: tenant_id
-- New-Tables: er_observation_notes
-- Drops: none
-- ====================================================================
-- ER visits could be set to status 'observation' but there was no way to
-- chart the observation period — no serial vitals/notes while the patient
-- is held for monitoring before discharge or admission. This adds an ER
-- observation chart: timestamped entries (vitals + note) per visit, the
-- nursing record that justifies the eventual disposition. Append-only in
-- spirit (like resuscitation logs); the disposition decision reuses the
-- existing discharge-summary / admit_from_er flows.

CREATE TABLE IF NOT EXISTS public.er_observation_notes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL,
    er_visit_id  uuid NOT NULL REFERENCES public.er_visits(id) ON DELETE CASCADE,
    observed_at  timestamptz NOT NULL DEFAULT now(),
    pulse        integer,
    bp_systolic  integer,
    bp_diastolic integer,
    resp_rate    integer,
    spo2         integer,
    temperature  double precision,
    gcs          integer,
    pain_score   integer,
    note         text,
    recorded_by  uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.er_observation_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS er_observation_notes_tenant ON public.er_observation_notes;
CREATE POLICY er_observation_notes_tenant ON public.er_observation_notes
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_er_observation_notes_visit
    ON public.er_observation_notes (tenant_id, er_visit_id);

CREATE TRIGGER set_er_observation_notes_updated_at
    BEFORE UPDATE ON public.er_observation_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
