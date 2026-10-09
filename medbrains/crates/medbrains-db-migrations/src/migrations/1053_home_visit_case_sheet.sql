-- ====================================================================
-- Migration: 1053_home_visit_case_sheet.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Home care joins the one case sheet (RFCs/RFC-MODULE-clinical-notes.md;
-- product decision 2026-10-09: one visit per home visit, as Epic and Cerner
-- model home health).
--
-- 1. Every home visit is a home_health encounter; existing visits get one.
-- 2. Nursing, progress, dietitian and physiotherapy notes may be written on
--    a home visit.
-- 3. The old home progress notes — free text, unsigned, not tied to a
--    visit — move onto the case sheet as recorded notes by their authors
--    and dates, on that day's home visit (or a visit made for the day).
--    A note with no author stays behind: it is not attributed by guess.
--    The table is kept as home_progress_notes_legacy.

ALTER TABLE home_visits ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES encounters(id);
CREATE INDEX IF NOT EXISTS idx_home_visits_encounter ON home_visits (encounter_id);

WITH v AS MATERIALIZED (
    SELECT id AS visit_id, gen_random_uuid() AS enc_id, tenant_id, patient_id,
           scheduled_date, status
      FROM home_visits WHERE encounter_id IS NULL
), made AS (
    INSERT INTO encounters (id, tenant_id, patient_id, encounter_type, status, encounter_date)
    SELECT enc_id, tenant_id, patient_id, 'home_health',
           (CASE status WHEN 'completed' THEN 'completed'
                        WHEN 'cancelled' THEN 'cancelled'
                        WHEN 'missed' THEN 'cancelled'
                        ELSE 'open' END)::encounter_status,
           scheduled_date
      FROM v
    RETURNING id
)
UPDATE home_visits h SET encounter_id = v.enc_id
  FROM v WHERE h.id = v.visit_id AND v.enc_id IN (SELECT id FROM made);

UPDATE note_types SET encounter_kinds = array_append(encounter_kinds, 'home_health')
 WHERE code IN ('progress', 'nursing', 'dietitian', 'physiotherapy')
   AND NOT ('home_health' = ANY (encounter_kinds));

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
        ('consultation', 'Consultation', '34108-1', 'physician',
         consultation_note_sections()::text, 10, '{doctor}', '{opd,emergency}'),
        ('consult_opinion', 'Consult opinion', '11488-4', 'physician',
         '[{"code":"findings","title":"Findings"},{"code":"impression","title":"Impression"},{"code":"recommendations","title":"Recommendations"}]',
         20, '{doctor}', '{opd,ipd,emergency}'),
        ('history_physical', 'History and physical', '34117-2', 'physician',
         '[{"code":"subjective","title":"History"},{"code":"objective","title":"Examination"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]',
         30, '{doctor}', '{opd,ipd,emergency}'),
        ('progress', 'Progress note', '11506-3', 'physician',
         '[{"code":"subjective","title":"Subjective"},{"code":"objective","title":"Objective"},{"code":"assessment","title":"Assessment"},{"code":"plan","title":"Plan"}]',
         40, '{doctor}', '{opd,ipd,emergency,home_health}'),
        ('procedure', 'Procedure note', '28570-0', 'physician',
         '[{"code":"indication","title":"Indication"},{"code":"procedure","title":"Procedure"},{"code":"findings","title":"Findings"},{"code":"plan","title":"Post-procedure plan"}]',
         50, '{doctor}', '{opd,ipd,emergency}'),
        ('nursing', 'Nursing note', '34746-8', 'nursing',
         '[{"code":"observation","title":"Observation"},{"code":"care_given","title":"Care given"},{"code":"plan","title":"Plan"}]',
         60, '{nurse}', '{opd,ipd,emergency,home_health}'),
        ('dietitian', 'Dietitian note', NULL, 'allied',
         '[{"code":"assessment","title":"Nutritional assessment"},{"code":"plan","title":"Diet plan"}]',
         70, '{dietitian}', '{ipd,opd,home_health}'),
        ('physiotherapy', 'Physiotherapy note', NULL, 'allied',
         '[{"code":"assessment","title":"Assessment"},{"code":"treatment","title":"Treatment given"},{"code":"plan","title":"Plan"}]',
         80, '{doctor}', '{ipd,opd,home_health}'),
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

-- Days with notes but no home visit get a completed home visit encounter.
WITH days AS (
    SELECT DISTINCT p.tenant_id, p.patient_id, p.note_date
      FROM home_progress_notes p
     WHERE p.author_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM home_visits h
                        WHERE h.tenant_id = p.tenant_id AND h.patient_id = p.patient_id
                          AND h.scheduled_date = p.note_date AND h.encounter_id IS NOT NULL)
)
INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, encounter_date, attributes)
SELECT tenant_id, patient_id, 'home_health', 'completed', note_date,
       jsonb_build_object('source', 'home_progress_notes')
  FROM days;

INSERT INTO clinical_notes
    (id, tenant_id, patient_id, encounter_id, note_type_id, author_id, author_role,
     status, service_at, signed_at, locked_at, migrated_from, created_at)
SELECT p.id, p.tenant_id, p.patient_id,
       coalesce(
         (SELECT h.encounter_id FROM home_visits h
           WHERE h.tenant_id = p.tenant_id AND h.patient_id = p.patient_id
             AND h.scheduled_date = p.note_date AND h.encounter_id IS NOT NULL
           ORDER BY h.created_at LIMIT 1),
         (SELECT e.id FROM encounters e
           WHERE e.tenant_id = p.tenant_id AND e.patient_id = p.patient_id
             AND e.encounter_type = 'home_health' AND e.encounter_date = p.note_date
           ORDER BY e.created_at LIMIT 1)),
       nt.id, p.author_id, coalesce(u.role::text, p.author_role), 'signed',
       p.note_date::timestamptz + (p.created_at::time), p.created_at, p.created_at,
       'home_progress_notes', p.created_at
  FROM home_progress_notes p
  JOIN note_types nt ON nt.tenant_id = p.tenant_id AND nt.deleted_at IS NULL
                    AND nt.code = (CASE p.author_role WHEN 'physician' THEN 'progress' ELSE 'nursing' END)
  LEFT JOIN users u ON u.id = p.author_id
 WHERE p.author_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM clinical_notes n WHERE n.id = p.id);

INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by, saved_at, frozen)
SELECT p.tenant_id, p.id, 1,
       jsonb_build_array(jsonb_build_object(
         'code', CASE p.author_role WHEN 'physician' THEN 'subjective' ELSE 'observation' END,
         'title', CASE p.author_role WHEN 'physician' THEN 'Subjective' ELSE 'Observation' END,
         'text', p.note_text)),
       p.author_id, p.created_at, true
  FROM home_progress_notes p
  JOIN clinical_notes n ON n.id = p.id AND n.migrated_from = 'home_progress_notes'
 WHERE NOT EXISTS (SELECT 1 FROM note_versions v WHERE v.note_id = p.id);

ALTER TABLE home_progress_notes RENAME TO home_progress_notes_legacy;
