-- ====================================================================
-- Migration: 1419_ai_dictation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: dictation_sessions, dictation_audio, dictation_content, ai_suggestion_outcomes
-- Drops: none
-- ====================================================================
-- AI notes from dictation, slice 1 (RFCs/modules/RFC-MODULE-ai-dictation.md).
--
-- A doctor dictates on their own OPD visit. The recording is transcribed on
-- the hospital's machine, a local model drafts the consultation note from the
-- transcript, and the doctor accepts, edits or rejects each section. Nothing
-- is filed automatically: the accepted text is saved through the normal
-- clinical-notes draft and sign path.
--
-- What the patient said never reaches the audit log. The audit trigger copies
-- a whole row into `audit_log` for good, so only the metadata table carries one:
--
-- dictation_sessions: one recording's metadata, audited: status, adapter,
--   model, sizes and times. `started_at` is when the doctor began speaking and
--   `saved_at` when the reviewed draft reached the note: their difference is
--   the time a dictated note took, for the KPI.
-- dictation_audio: the recording. No audit trigger, no soft delete: deleted
--   (a real DELETE) at save, at rejection, or by the purge 24 hours after an
--   abandoned recording.
-- dictation_content: the transcript and the draft. No audit trigger, no soft
--   delete. Kept with a saved note as its provenance; deleted when the doctor
--   rejects everything, and by the purge for anything unsaved after 24 hours.
-- ai_suggestion_outcomes: AI-governance records. Every suggestion the model
--   made and what the clinician did with it: accepted as written, edited (with
--   the size of the edit) or rejected. It holds suggestion text, so it has no
--   audit trigger either; rows are written once and never updated.

CREATE TABLE public.dictation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    encounter_id uuid NOT NULL REFERENCES public.encounters(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    doctor_id uuid NOT NULL REFERENCES public.users(id),
    source text NOT NULL CHECK (source IN ('recorded', 'uploaded')),
    audio_bytes integer NOT NULL CHECK (audio_bytes > 0),
    -- As the browser reported it: used for the KPI only, never as a bound
    -- (the server bounds the upload by its size).
    duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 0 AND 600000),
    status text NOT NULL DEFAULT 'processing' CHECK (status IN
        ('processing', 'stt_failed', 'no_speech', 'llm_failed', 'drafted', 'saved', 'rejected',
         'abandoned')),
    -- A failure class (`stt_unreachable`, `llm_timeout`, ...), never error text.
    failure text CHECK (failure IS NULL OR failure ~ '^[a-z_]{3,40}$'),
    stt_adapter text CHECK (stt_adapter IN ('local', 'cloud')),
    llm_model text,
    transcript_chars integer CHECK (transcript_chars IS NULL OR transcript_chars >= 0),
    note_id uuid REFERENCES public.clinical_notes(id),
    started_at timestamptz NOT NULL,
    saved_at timestamptz,
    audio_deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT dictation_saved_has_note
        CHECK (status <> 'saved' OR (note_id IS NOT NULL AND saved_at IS NOT NULL))
);

CREATE INDEX idx_dictation_sessions_encounter
    ON public.dictation_sessions (tenant_id, encounter_id, created_at DESC)
    WHERE deleted_at IS NULL;
-- The purge pass looks for sessions older than 24 hours still holding data.
CREATE INDEX idx_dictation_sessions_created
    ON public.dictation_sessions (created_at);
-- One dictation at a time per doctor: a second while one is being processed
-- is refused rather than queued behind it.
CREATE UNIQUE INDEX uq_dictation_one_processing_per_doctor
    ON public.dictation_sessions (tenant_id, doctor_id)
    WHERE status = 'processing';

ALTER TABLE public.dictation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dictation_sessions ON public.dictation_sessions
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER set_updated_at_dictation_sessions BEFORE UPDATE ON public.dictation_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_dictation_sessions_soft_delete BEFORE DELETE ON public.dictation_sessions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_dictation_sessions AFTER INSERT OR UPDATE OR DELETE
    ON public.dictation_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('opd');

-- No audit trigger and no soft delete, on purpose: the recording must leave
-- the database when it is deleted, not linger in a tombstone or an audit row.
CREATE TABLE public.dictation_audio (
    session_id uuid NOT NULL PRIMARY KEY REFERENCES public.dictation_sessions(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    content_type text NOT NULL CHECK (content_type ~ '^audio/[a-z0-9.+-]{1,40}$'),
    -- 24 MiB, the server's upload limit.
    audio bytea NOT NULL CHECK (octet_length(audio) BETWEEN 1 AND 25165824),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dictation_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_audio FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dictation_audio ON public.dictation_audio
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- The words: no audit trigger and no soft delete, for the same reason.
CREATE TABLE public.dictation_content (
    session_id uuid NOT NULL PRIMARY KEY REFERENCES public.dictation_sessions(id),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    transcript text NOT NULL CHECK (length(transcript) <= 100000),
    draft jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dictation_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictation_content FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_dictation_content ON public.dictation_content
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER set_updated_at_dictation_content BEFORE UPDATE ON public.dictation_content
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ai_suggestion_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    feature text NOT NULL CHECK (feature ~ '^[a-z_]{3,40}$'),
    -- The record the suggestion was made in (a dictation session).
    source_id uuid NOT NULL,
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    -- `section` (a note section) or `medicine` (a drafted prescription line).
    kind text NOT NULL CHECK (kind IN ('section', 'medicine')),
    -- The section code, or the medicine's position in the draft.
    item_key text NOT NULL CHECK (length(btrim(item_key)) BETWEEN 1 AND 80),
    model text,
    suggested text NOT NULL,
    final_text text,
    outcome text NOT NULL CHECK (outcome IN ('accepted', 'edited', 'rejected')),
    -- Words changed between the suggestion and what the clinician kept, and
    -- that as a share of the suggestion (0 = taken as written).
    edit_distance integer NOT NULL DEFAULT 0 CHECK (edit_distance >= 0),
    edit_ratio numeric(6, 4) NOT NULL DEFAULT 0 CHECK (edit_ratio >= 0),
    decided_by uuid NOT NULL REFERENCES public.users(id),
    decided_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT ai_outcome_kept_text
        CHECK (outcome = 'rejected' OR final_text IS NOT NULL)
);

-- One decision per suggestion: a retried review does not count twice.
CREATE UNIQUE INDEX uq_ai_suggestion_outcome_item
    ON public.ai_suggestion_outcomes (tenant_id, feature, source_id, kind, item_key)
    WHERE deleted_at IS NULL;

ALTER TABLE public.ai_suggestion_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestion_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_suggestion_outcomes ON public.ai_suggestion_outcomes
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER set_updated_at_ai_suggestion_outcomes BEFORE UPDATE ON public.ai_suggestion_outcomes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ai_suggestion_outcomes_soft_delete BEFORE DELETE ON public.ai_suggestion_outcomes
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
