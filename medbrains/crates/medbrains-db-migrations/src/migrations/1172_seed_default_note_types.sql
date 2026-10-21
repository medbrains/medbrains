-- Every hospital gets the default clinical note types (#4906).
--
-- 1045-1053 inserted them for the tenants that existed when they ran, and a
-- migration runs once: every hospital created afterwards (self-signup, a fresh
-- install whose first tenant the seed makes after migrations) had none, so no
-- clinician there could write a note. One function, called by a trigger on
-- every new tenant and once below for the ones already missing them.
--
-- NOT EXISTS counts soft-deleted rows too: a type a hospital retired stays
-- retired. SECURITY DEFINER because the new tenant's context is not set when
-- its row is inserted; note_types does not FORCE row-level security, so the
-- owner may write it.

CREATE OR REPLACE FUNCTION seed_default_note_types(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO note_types
    (tenant_id, code, name, loinc_code, category, sections, sort_order, author_roles, encounter_kinds)
  SELECT p_tenant, v.code, v.name, v.loinc_code, v.category, v.sections, v.sort_order,
         v.author_roles, v.encounter_kinds
    FROM (VALUES
    ('consultation', 'Consultation', '34108-1', 'physician', '[{"code": "subjective", "title": "Subjective"}, {"code": "history", "title": "History"}, {"code": "ros", "title": "Review of systems"}, {"code": "objective", "title": "Objective"}, {"code": "examination", "title": "Examination"}, {"code": "assessment", "title": "Assessment"}, {"code": "plan", "title": "Plan"}]'::jsonb, 10, '{doctor}'::text[], '{opd,emergency}'::text[]),
    ('consult_opinion', 'Consult opinion', '11488-4', 'physician', '[{"code": "findings", "title": "Findings"}, {"code": "impression", "title": "Impression"}, {"code": "recommendations", "title": "Recommendations"}]'::jsonb, 20, '{doctor}'::text[], '{opd,ipd,emergency}'::text[]),
    ('history_physical', 'History and physical', '34117-2', 'physician', '[{"code": "subjective", "title": "History"}, {"code": "objective", "title": "Examination"}, {"code": "assessment", "title": "Assessment"}, {"code": "plan", "title": "Plan"}]'::jsonb, 30, '{doctor}'::text[], '{opd,ipd,emergency}'::text[]),
    ('progress', 'Progress note', '11506-3', 'physician', '[{"code": "subjective", "title": "Subjective"}, {"code": "objective", "title": "Objective"}, {"code": "assessment", "title": "Assessment"}, {"code": "plan", "title": "Plan"}]'::jsonb, 40, '{doctor}'::text[], '{opd,ipd,emergency,home_health}'::text[]),
    ('procedure', 'Procedure note', '28570-0', 'physician', '[{"code": "indication", "title": "Indication"}, {"code": "procedure", "title": "Procedure"}, {"code": "findings", "title": "Findings"}, {"code": "plan", "title": "Post-procedure plan"}]'::jsonb, 50, '{doctor}'::text[], '{opd,ipd,emergency}'::text[]),
    ('nursing', 'Nursing note', '34746-8', 'nursing', '[{"code": "observation", "title": "Observation"}, {"code": "care_given", "title": "Care given"}, {"code": "plan", "title": "Plan"}]'::jsonb, 60, '{nurse}'::text[], '{opd,ipd,emergency,home_health}'::text[]),
    ('dietitian', 'Dietitian note', NULL, 'allied', '[{"code": "assessment", "title": "Nutritional assessment"}, {"code": "plan", "title": "Diet plan"}]'::jsonb, 70, '{dietitian}'::text[], '{ipd,opd,home_health}'::text[]),
    ('physiotherapy', 'Physiotherapy note', NULL, 'allied', '[{"code": "assessment", "title": "Assessment"}, {"code": "treatment", "title": "Treatment given"}, {"code": "plan", "title": "Plan"}]'::jsonb, 80, '{doctor}'::text[], '{ipd,opd,home_health}'::text[]),
    ('social_work', 'Social work note', NULL, 'allied', '[{"code": "assessment", "title": "Assessment"}, {"code": "plan", "title": "Plan"}]'::jsonb, 90, '{doctor}'::text[], '{ipd,opd}'::text[]),
    ('discharge_note', 'Discharge note', NULL, 'physician', '[{"code": "summary", "title": "Course in hospital"}, {"code": "condition", "title": "Condition at discharge"}, {"code": "plan", "title": "Advice on discharge"}]'::jsonb, 100, '{doctor}'::text[], '{ipd}'::text[])

    ) AS v(code, name, loinc_code, category, sections, sort_order, author_roles, encounter_kinds)
   WHERE NOT EXISTS (SELECT 1 FROM note_types n WHERE n.tenant_id = p_tenant AND n.code = v.code)
  ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION trg_seed_default_note_types() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_note_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_note_types ON tenants;
CREATE TRIGGER trg_tenants_seed_note_types
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_seed_default_note_types();

SELECT seed_default_note_types(id) FROM tenants;
