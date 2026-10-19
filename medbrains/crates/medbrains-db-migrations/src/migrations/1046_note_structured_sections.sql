-- ====================================================================
-- Migration: 1046_note_structured_sections.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The history, review of systems and examination a doctor takes are part
-- of their consultation note, as on the paper sheet: dated, authored and
-- signed with it, instead of one record every save overwrote. The
-- Consultation note type gains the three structured sections
-- (RFCs/RFC-MODULE-clinical-notes.md, phase 1b).

CREATE OR REPLACE FUNCTION consultation_note_sections()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT '[{"code":"subjective","title":"Subjective"},
             {"code":"history","title":"History"},
             {"code":"ros","title":"Review of systems"},
             {"code":"objective","title":"Objective"},
             {"code":"examination","title":"Examination"},
             {"code":"assessment","title":"Assessment"},
             {"code":"plan","title":"Plan"}]'::jsonb
$$;

UPDATE note_types SET sections = consultation_note_sections()
 WHERE code = 'consultation' AND deleted_at IS NULL;

-- Hospitals created from now on start with the same shape.
CREATE OR REPLACE FUNCTION seed_note_types(p_tenant uuid)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO note_types (tenant_id, code, name, loinc_code, category, sections, sort_order)
    SELECT p_tenant, v.code, v.name, v.loinc, v.category, v.sections::jsonb, v.sort_order
      FROM (VALUES
        ('consultation', 'Consultation', NULL, 'physician',
         consultation_note_sections()::text, 10),
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
