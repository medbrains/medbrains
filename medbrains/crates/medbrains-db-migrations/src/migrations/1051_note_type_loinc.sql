-- ====================================================================
-- Migration: 1051_note_type_loinc.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A note exported as a FHIR Composition carries its LOINC document type
-- (RFCs/RFC-MODULE-clinical-notes.md, phase 4). The two commonest notes had
-- none: the OPD consultation is an Outpatient Note (34108-1) and the
-- nursing note a Nurse Note (34746-8). The other types without one export
-- by name until a code is chosen for them.

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
         40, '{doctor}', '{opd,ipd,emergency}'),
        ('procedure', 'Procedure note', '28570-0', 'physician',
         '[{"code":"indication","title":"Indication"},{"code":"procedure","title":"Procedure"},{"code":"findings","title":"Findings"},{"code":"plan","title":"Post-procedure plan"}]',
         50, '{doctor}', '{opd,ipd,emergency}'),
        ('nursing', 'Nursing note', '34746-8', 'nursing',
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

UPDATE note_types SET loinc_code = '34108-1'
 WHERE code = 'consultation' AND loinc_code IS NULL;
UPDATE note_types SET loinc_code = '34746-8'
 WHERE code = 'nursing' AND loinc_code IS NULL;
