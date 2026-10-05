-- ====================================================================
-- Migration: 1048_ipd_notes_on_case_sheet.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- IPD progress notes join the one case sheet (RFCs/RFC-MODULE-clinical-
-- notes.md, phase 2a). They were a second store of the same thing: an
-- author, a date and SOAP text, with no signing and no lock.
--
-- 1. A note type says who writes it and where: doctors the physician
--    notes, nurses the nursing notes, dietitians theirs; a discharge note
--    belongs to an admission, a consultation to an outpatient visit.
--    Physiotherapy and social work notes have no role of their own yet,
--    so doctors write them rather than anyone at all.
-- 2. The ward's other note kinds become note types.
-- 3. Every IPD progress note moves onto its admission's case sheet, by its
--    author, on its date, its addenda under it.
-- 4. The old table is kept as ipd_progress_notes_legacy, and the name
--    ipd_progress_notes becomes a read-only view of the case sheet: the
--    MRD packet, print and the AI copilot read it unchanged, and nothing
--    can write a second copy any more.

ALTER TABLE note_types
    ADD COLUMN IF NOT EXISTS author_roles text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS encounter_kinds text[] NOT NULL DEFAULT '{opd,ipd,emergency}';

CREATE OR REPLACE FUNCTION seed_note_types(p_tenant uuid)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO note_types
        (tenant_id, code, name, loinc_code, category, sections, sort_order,
         author_roles, encounter_kinds)
    SELECT p_tenant, v.code, v.name, v.loinc, v.category, v.sections::jsonb, v.sort_order,
           v.roles::text[], v.kinds::text[]
      FROM (VALUES
        ('consultation', 'Consultation', NULL, 'physician',
         consultation_note_sections()::text, 10, '{doctor}', '{opd,emergency}'),
        ('consult_opinion', 'Consult opinion', '11488-4', 'physician',
         '[{"code":"findings","title":"Findings"},{"code":"impression","title":"Impression"},{"code":"recommendations","title":"Recommendations"}]',
         20, '{doctor}', '{opd,ipd,emergency}'),
        ('history_physical', 'History and physical', '34117-2', 'physician',
         '[{"code":"subjective","title":"History"},{"code":"objective","title":"Examination"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]',
         30, '{doctor}', '{opd,ipd,emergency}'),
        ('progress', 'Progress note', '11506-3', 'physician',
         '[{"code":"subjective","title":"Subjective"},{"code":"objective","title":"Objective"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]',
         40, '{doctor}', '{opd,ipd,emergency}'),
        ('procedure', 'Procedure note', '28570-0', 'physician',
         '[{"code":"indication","title":"Indication"},{"code":"procedure","title":"Procedure"},{"code":"findings","title":"Findings"},{"code":"plan","title":"Post-procedure plan"}]',
         50, '{doctor}', '{opd,ipd,emergency}'),
        ('nursing', 'Nursing note', NULL, 'nursing',
         '[{"code":"observation","title":"Observation"},{"code":"care_given","title":"Care given"},{"code":"plan","title":"Plan"}]',
         60, '{nurse}', '{opd,ipd,emergency}'),
        ('dietitian', 'Dietitian note', NULL, 'allied',
         '[{"code":"assessment","title":"Nutritional assessment"},{"code":"plan","title":"Diet plan"}]',
         70, '{dietitian}', '{ipd,opd}'),
        ('physiotherapy', 'Physiotherapy note', NULL, 'allied',
         '[{"code":"assessment","title":"Assessment"},{"code":"treatment","title":"Treatment given"},{"code":"plan","title":"Plan"}]',
         80, '{doctor}', '{ipd,opd}'),
        ('social_work', 'Social work note', NULL, 'allied',
         '[{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]',
         90, '{doctor}', '{ipd,opd}'),
        ('discharge_note', 'Discharge note', NULL, 'physician',
         '[{"code":"summary","title":"Course in hospital"},{"code":"condition","title":"Condition at discharge"},{"code":"plan","title":"Advice on discharge"}]',
         100, '{doctor}', '{ipd}')
      ) AS v(code, name, loinc, category, sections, sort_order, roles, kinds)
     WHERE NOT EXISTS (
        SELECT 1 FROM note_types t
         WHERE t.tenant_id = p_tenant AND t.code = v.code AND t.deleted_at IS NULL);
$$;

-- The types each hospital already has learn who writes them and where.
UPDATE note_types SET author_roles = '{doctor}', encounter_kinds = '{opd,emergency}'
 WHERE code = 'consultation';
UPDATE note_types SET author_roles = '{doctor}'
 WHERE code IN ('consult_opinion', 'history_physical', 'progress', 'procedure');
UPDATE note_types SET author_roles = '{nurse}' WHERE code = 'nursing';

DO $$
DECLARE t uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants) THEN
        FOR t IN SELECT id FROM tenants LOOP
            PERFORM seed_note_types(t);
        END LOOP;
    END IF;
END $$;

-- Ward note kinds to note types.
CREATE OR REPLACE FUNCTION ipd_note_type_code(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE t
        WHEN 'doctor_round' THEN 'progress'
        WHEN 'nursing_note' THEN 'nursing'
        WHEN 'specialist_opinion' THEN 'consult_opinion'
        WHEN 'dietitian_note' THEN 'dietitian'
        WHEN 'physiotherapy_note' THEN 'physiotherapy'
        WHEN 'social_worker_note' THEN 'social_work'
        WHEN 'discharge_note' THEN 'discharge_note'
        ELSE 'progress'
    END
$$;

-- Notes first, then their addenda, so every addendum's note is already there.
INSERT INTO clinical_notes
    (id, tenant_id, patient_id, encounter_id, note_type_id, service_department_id,
     author_id, author_role, status, service_at, signed_at, locked_at, amends_note_id,
     migrated_from, created_at, deleted_at, deleted_by, delete_reason)
SELECT p.id, p.tenant_id, e.patient_id, a.encounter_id, nt.id, e.department_id,
       p.author_id, coalesce(u.role::text, 'doctor'), 'signed',
       p.note_date::timestamptz + (p.created_at::time), p.created_at, p.created_at,
       CASE WHEN p.is_addendum THEN p.parent_note_id END,
       'ipd_progress_notes', p.created_at, p.deleted_at, p.deleted_by, p.delete_reason
  FROM ipd_progress_notes p
  JOIN admissions a ON a.id = p.admission_id
  JOIN encounters e ON e.id = a.encounter_id
  JOIN note_types nt ON nt.tenant_id = p.tenant_id AND nt.deleted_at IS NULL
                    AND nt.code = ipd_note_type_code(p.note_type::text)
  LEFT JOIN users u ON u.id = p.author_id
 WHERE NOT EXISTS (SELECT 1 FROM clinical_notes n WHERE n.id = p.id)
 ORDER BY p.is_addendum, p.created_at;

INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by, saved_at, frozen)
SELECT p.tenant_id, p.id, 1,
       CASE WHEN p.is_addendum THEN
         jsonb_build_array(jsonb_build_object('code', 'addendum', 'title', 'Addendum',
           'text', concat_ws(E'\n', p.subjective, p.objective, p.assessment, p.plan)))
       ELSE jsonb_build_array(
         jsonb_build_object('code', 'subjective', 'title', 'Subjective', 'text', coalesce(p.subjective, '')),
         jsonb_build_object('code', 'objective', 'title', 'Objective', 'text', coalesce(p.objective, '')),
         jsonb_build_object('code', 'assessment', 'title', 'Assessment', 'text', coalesce(p.assessment, '')),
         jsonb_build_object('code', 'plan', 'title', 'Plan', 'text', coalesce(p.plan, '')))
       END,
       p.author_id, p.created_at, true
  FROM ipd_progress_notes p
  JOIN clinical_notes n ON n.id = p.id AND n.migrated_from = 'ipd_progress_notes'
 WHERE NOT EXISTS (SELECT 1 FROM note_versions v WHERE v.note_id = p.id);

-- A section's text as a reader sees it, markup stripped.
CREATE OR REPLACE FUNCTION note_section_plain(sections jsonb, section_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT nullif(trim(regexp_replace(
             regexp_replace(s->>'text', '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), '')
      FROM jsonb_array_elements(sections) s
     WHERE s->>'code' = section_code
     LIMIT 1
$$;

ALTER TABLE ipd_progress_notes RENAME TO ipd_progress_notes_legacy;

-- The ward's progress notes as the case sheet holds them: signed notes on
-- admissions, newest version, text without the editor's markup. Read-only;
-- the case sheet is where notes are written.
CREATE VIEW ipd_progress_notes WITH (security_invoker = true) AS
SELECT n.id, n.tenant_id, a.id AS admission_id, n.encounter_id,
       (CASE t.code
          WHEN 'nursing' THEN 'nursing_note'
          WHEN 'consult_opinion' THEN 'specialist_opinion'
          WHEN 'dietitian' THEN 'dietitian_note'
          WHEN 'physiotherapy' THEN 'physiotherapy_note'
          WHEN 'social_work' THEN 'social_worker_note'
          WHEN 'discharge_note' THEN 'discharge_note'
          ELSE 'doctor_round'
        END)::progress_note_type AS note_type,
       n.author_id, n.service_at::date AS note_date,
       note_section_plain(v.sections, 'subjective') AS subjective,
       note_section_plain(v.sections, 'objective') AS objective,
       note_section_plain(v.sections, 'assessment') AS assessment,
       coalesce(note_section_plain(v.sections, 'plan'),
                note_section_plain(v.sections, 'addendum')) AS plan,
       n.amends_note_id IS NOT NULL AS is_addendum,
       n.amends_note_id AS parent_note_id,
       n.created_at, n.updated_at,
       coalesce(n.deleted_at, n.entered_in_error_at) AS deleted_at,
       coalesce(n.deleted_by, n.entered_in_error_by) AS deleted_by,
       coalesce(n.delete_reason, n.entered_in_error_reason) AS delete_reason
  FROM clinical_notes n
  JOIN note_types t ON t.id = n.note_type_id
  JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version
  JOIN admissions a ON a.encounter_id = n.encounter_id
 WHERE n.status IN ('signed', 'entered_in_error');
