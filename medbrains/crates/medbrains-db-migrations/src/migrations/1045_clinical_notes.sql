-- ====================================================================
-- Migration: 1045_clinical_notes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: note_types, clinical_notes, note_versions, note_signatures
-- Drops: none
-- ====================================================================
-- One case sheet for every setting (RFCs/RFC-MODULE-clinical-notes.md).
--
-- On paper a visit is a sheet of entries, each signed, dated and timed by
-- its author; a mistake is struck through, never erased. The OPD note was one
-- row every save overwrote, so nobody could say who wrote what, when. A note
-- is now its author's entry: a draft that autosaves, then signed and frozen;
-- a revision within the hospital's grace period keeps the old version, after
-- that only an addendum; a note written in error is marked, never removed.
-- Epic, Oracle Health and FHIR (Composition) all work this way.

CREATE TABLE IF NOT EXISTS note_types (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code          text NOT NULL,
    name          text NOT NULL,
    loinc_code    text,
    category      text NOT NULL CHECK (category IN ('physician', 'nursing', 'allied')),
    -- [{"code": "subjective", "title": "Subjective"}, ...]
    sections      jsonb NOT NULL,
    is_active     boolean NOT NULL DEFAULT true,
    sort_order    integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_types_code
    ON note_types (tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS clinical_notes (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id             uuid NOT NULL REFERENCES patients(id),
    encounter_id           uuid NOT NULL REFERENCES encounters(id),
    note_type_id           uuid NOT NULL REFERENCES note_types(id),
    service_department_id  uuid REFERENCES departments(id),
    author_id              uuid NOT NULL REFERENCES users(id),
    author_role            text NOT NULL,
    status                 text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'signed', 'entered_in_error')),
    -- When the care happened, which a late entry differs from.
    service_at             timestamptz NOT NULL DEFAULT now(),
    signed_at              timestamptz,
    -- Signed + the hospital's grace: after this only an addendum changes it.
    locked_at              timestamptz,
    late_entry_reason      text,
    current_version        integer NOT NULL DEFAULT 1,
    -- An addendum points at the note it adds to.
    amends_note_id         uuid REFERENCES clinical_notes(id),
    referral_id            uuid REFERENCES referrals(id),
    -- Carried over from a store that had no signing (e.g. 'consultations').
    migrated_from          text,
    entered_in_error_at    timestamptz,
    entered_in_error_by    uuid REFERENCES users(id),
    entered_in_error_reason text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    deleted_at             timestamptz,
    deleted_by             uuid,
    delete_reason          text
);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter
    ON clinical_notes (tenant_id, encounter_id, service_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient
    ON clinical_notes (tenant_id, patient_id, service_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_author_drafts
    ON clinical_notes (tenant_id, author_id) WHERE status = 'draft' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_amends
    ON clinical_notes (amends_note_id) WHERE amends_note_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS note_versions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_id       uuid NOT NULL REFERENCES clinical_notes(id),
    version       integer NOT NULL,
    -- [{"code": "subjective", "title": "Subjective", "text": "<p>…</p>"}, ...]
    sections      jsonb NOT NULL DEFAULT '[]'::jsonb,
    saved_by      uuid NOT NULL REFERENCES users(id),
    saved_at      timestamptz NOT NULL DEFAULT now(),
    content_hash  text,
    frozen        boolean NOT NULL DEFAULT false,
    UNIQUE (note_id, version)
);

CREATE TABLE IF NOT EXISTS note_signatures (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_id          uuid NOT NULL REFERENCES clinical_notes(id),
    version          integer NOT NULL,
    signer_id        uuid NOT NULL REFERENCES users(id),
    mode             text NOT NULL CHECK (mode IN ('author', 'cosign', 'attest')),
    signed_at        timestamptz NOT NULL DEFAULT now(),
    content_hash     text NOT NULL,
    attestation_text text,
    -- The cryptographic signature, when the hospital requires one.
    signed_record_id uuid REFERENCES signed_records(id)
);
CREATE INDEX IF NOT EXISTS idx_note_signatures_note ON note_signatures (note_id);

-- A signed version is the record: it cannot change, and no note or
-- signature is ever deleted (a mistake is marked entered-in-error).
CREATE OR REPLACE FUNCTION note_versions_frozen_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'clinical note versions are never deleted';
    END IF;
    IF OLD.frozen THEN
        RAISE EXCEPTION 'a signed note version cannot be changed; write an addendum';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_note_versions_frozen ON note_versions;
CREATE TRIGGER trg_note_versions_frozen
    BEFORE UPDATE OR DELETE ON note_versions
    FOR EACH ROW EXECUTE FUNCTION note_versions_frozen_guard();

CREATE OR REPLACE FUNCTION clinical_notes_no_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% rows are never deleted', TG_TABLE_NAME;
END;
$$;
DROP TRIGGER IF EXISTS trg_clinical_notes_no_delete ON clinical_notes;
CREATE TRIGGER trg_clinical_notes_no_delete
    BEFORE DELETE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION clinical_notes_no_delete();
DROP TRIGGER IF EXISTS trg_note_signatures_no_delete ON note_signatures;
CREATE TRIGGER trg_note_signatures_no_delete
    BEFORE DELETE OR UPDATE ON note_signatures
    FOR EACH ROW EXECUTE FUNCTION clinical_notes_no_delete();

DROP TRIGGER IF EXISTS trg_clinical_notes_updated_at ON clinical_notes;
CREATE TRIGGER trg_clinical_notes_updated_at
    BEFORE UPDATE ON clinical_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_note_types_updated_at ON note_types;
CREATE TRIGGER trg_note_types_updated_at
    BEFORE UPDATE ON note_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE note_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_note_types ON note_types;
CREATE POLICY tenant_isolation_note_types ON note_types
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_clinical_notes ON clinical_notes;
CREATE POLICY tenant_isolation_clinical_notes ON clinical_notes
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_note_versions ON note_versions;
CREATE POLICY tenant_isolation_note_versions ON note_versions
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
ALTER TABLE note_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_note_signatures ON note_signatures;
CREATE POLICY tenant_isolation_note_signatures ON note_signatures
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- The note types every hospital starts with. LOINC where the code is
-- confirmed (US Core clinical note types); a hospital adds its own.
CREATE OR REPLACE FUNCTION seed_note_types(p_tenant uuid)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO note_types (tenant_id, code, name, loinc_code, category, sections, sort_order)
    SELECT p_tenant, v.code, v.name, v.loinc, v.category, v.sections::jsonb, v.sort_order
      FROM (VALUES
        ('consultation', 'Consultation', NULL, 'physician',
         '[{"code":"subjective","title":"Subjective"},{"code":"objective","title":"Objective"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]', 10),
        ('consult_opinion', 'Consult opinion', '11488-4', 'physician',
         '[{"code":"findings","title":"Findings"},{"code":"impression","title":"Impression"},{"code":"recommendations","title":"Recommendations"}]', 20),
        ('history_physical', 'History and physical', '34117-2', 'physician',
         '[{"code":"subjective","title":"History"},{"code":"objective","title":"Examination"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]', 30),
        ('progress', 'Progress note', '11506-3', 'physician',
         '[{"code":"subjective","title":"Subjective"},{"code":"objective","title":"Objective"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]', 40),
        ('procedure', 'Procedure note', '28570-0', 'physician',
         '[{"code":"indication","title":"Indication"},{"code":"procedure","title":"Procedure"},{"code":"findings","title":"Findings"},{"code":"plan","title":"Post-procedure plan"}]', 50),
        ('nursing', 'Nursing note', NULL, 'nursing',
         '[{"code":"observation","title":"Observation"},{"code":"care_given","title":"Care given"},{"code":"plan","title":"Plan"}]', 60)
      ) AS v(code, name, loinc, category, sections, sort_order)
     WHERE NOT EXISTS (
        SELECT 1 FROM note_types t
         WHERE t.tenant_id = p_tenant AND t.code = v.code AND t.deleted_at IS NULL);
$$;

DO $$
DECLARE t uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants) THEN
        FOR t IN SELECT id FROM tenants LOOP
            PERFORM seed_note_types(t);
        END LOOP;
    END IF;
END $$;

-- Existing OPD notes become Consultation notes by the doctor who wrote
-- them, at the time they wrote them. They were never signed, and say so:
-- `migrated_from` marks them, and the screen reads "Recorded", not "Signed".
INSERT INTO clinical_notes
    (id, tenant_id, patient_id, encounter_id, note_type_id, service_department_id,
     author_id, author_role, status, service_at, signed_at, locked_at, migrated_from,
     created_at)
SELECT c.id, c.tenant_id, e.patient_id, c.encounter_id, nt.id, e.department_id,
       c.doctor_id, 'doctor', 'signed', c.created_at, c.updated_at, c.updated_at,
       'consultations', c.created_at
  FROM consultations c
  JOIN encounters e ON e.id = c.encounter_id
  JOIN note_types nt ON nt.tenant_id = c.tenant_id AND nt.code = 'consultation'
                    AND nt.deleted_at IS NULL
 WHERE c.deleted_at IS NULL
   AND c.doctor_id IS NOT NULL
   AND concat_ws('', c.chief_complaint, c.examination, c.history, c.plan) <> ''
   AND NOT EXISTS (SELECT 1 FROM clinical_notes n WHERE n.id = c.id);

INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by, saved_at, frozen)
SELECT c.tenant_id, c.id, 1,
       jsonb_build_array(
         jsonb_build_object('code', 'subjective', 'title', 'Subjective', 'text', coalesce(c.chief_complaint, '')),
         jsonb_build_object('code', 'objective', 'title', 'Objective', 'text', coalesce(c.examination, '')),
         jsonb_build_object('code', 'assessment', 'title', 'Assessment', 'text', coalesce(c.history, '')),
         jsonb_build_object('code', 'plan', 'title', 'Plan', 'text', coalesce(c.plan, ''))),
       c.doctor_id, c.updated_at, true
  FROM consultations c
  JOIN clinical_notes n ON n.id = c.id AND n.migrated_from = 'consultations'
 WHERE NOT EXISTS (SELECT 1 FROM note_versions v WHERE v.note_id = c.id);
