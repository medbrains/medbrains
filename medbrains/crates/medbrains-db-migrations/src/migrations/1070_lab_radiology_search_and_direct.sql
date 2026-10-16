-- ====================================================================
-- Migration: 1070_lab_radiology_search_and_direct.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_exams
-- Drops: none
-- ====================================================================
-- 1. Test search finds what people type. The bench and clinicians order
--    "LFT", "RFT", "hemogram"; the catalogue held only a code and a name,
--    so the short name every requisition uses found nothing.
-- 2. A walk-in at the lab counter (self-referred, or carrying an outside
--    prescription) records who referred them. ordering_doctor_id (users)
--    and referral_doctor_id (lab_referral_doctors) already exist; self-
--    referral is stated, not inferred from two NULLs.
-- 3. The radiology exam catalogue: what is actually ordered and billed
--    ("CT Brain Plain", "USG Abdomen"), each under one modality. Prices
--    stay in charge_master; an exam names its charge code.
-- 4. Patient lookup by name, UHID or phone fragment can use an index.

-- lab: short names/abbreviations the bench and clinicians type ("LFT", "RFT", "hemogram")
ALTER TABLE lab_test_catalog ADD COLUMN IF NOT EXISTS synonyms text[] NOT NULL DEFAULT '{}';
UPDATE lab_test_catalog c SET synonyms = s.syn
FROM (VALUES
  ('CBC',          ARRAY['hemogram','haemogram','CBP','complete blood picture','FBC']),
  ('PROF_HEMO',    ARRAY['hemogram','haemogram']),
  ('PROF_LFT',     ARRAY['LFT','liver function']),
  ('PROF_KFT',     ARRAY['KFT','RFT','renal function','kidney function']),
  ('PROF_THYROID', ARRAY['TFT','thyroid function']),
  ('PROF_LIPID',   ARRAY['lipid','cholesterol']),
  ('PROF_DIAB',    ARRAY['diabetes','sugar profile']),
  ('FBS',          ARRAY['fasting glucose','fasting sugar','FPG']),
  ('PPBS',         ARRAY['post meal sugar','PP sugar','PPG']),
  ('RBS',          ARRAY['random glucose','random sugar','GRBS']),
  ('HBA1C',        ARRAY['A1c','glycated','glycosylated']),
  ('SGPT',         ARRAY['ALT']),
  ('SGOT',         ARRAY['AST'])
) AS s(code, syn)
WHERE c.code = s.code AND c.synonyms = '{}';

-- lab: a walk-in's referring doctor. ordering_doctor_id already exists (users);
-- referral_doctor_id already exists (lab_referral_doctors). Self-referral is explicit:
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS is_self_referred boolean NOT NULL DEFAULT false;

-- radiology: the exam catalogue — what is actually ordered and billed
CREATE TABLE IF NOT EXISTS radiology_exams (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    modality_id         uuid NOT NULL REFERENCES radiology_modalities(id),
    code                text NOT NULL,
    name                text NOT NULL,
    body_part           text,
    body_part_code      text,
    laterality_required boolean NOT NULL DEFAULT false,
    contrast            text NOT NULL DEFAULT 'none'
        CHECK (contrast IN ('none', 'with', 'without', 'with_and_without')),
    synonyms            text[] NOT NULL DEFAULT '{}',
    charge_code         text,
    preparation         text,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    deleted_by          uuid,
    delete_reason       text
);
CREATE UNIQUE INDEX IF NOT EXISTS radiology_exams_tenant_code
    ON radiology_exams (tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_radiology_exams_modality
    ON radiology_exams (tenant_id, modality_id) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_radiology_exams_updated_at ON radiology_exams;
CREATE TRIGGER trg_radiology_exams_updated_at BEFORE UPDATE ON radiology_exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_radiology_exams_soft_delete ON radiology_exams;
CREATE TRIGGER trg_radiology_exams_soft_delete BEFORE DELETE ON radiology_exams
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_radiology_exams ON radiology_exams;
CREATE TRIGGER audit_radiology_exams
    AFTER INSERT OR DELETE OR UPDATE ON radiology_exams
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('radiology');
ALTER TABLE radiology_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_exams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_radiology_exams ON radiology_exams;
CREATE POLICY tenant_isolation_radiology_exams ON radiology_exams
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS exam_id uuid REFERENCES radiology_exams(id);

CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm
    ON patients USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_uhid_trgm ON patients USING gin (uhid gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm ON patients USING gin (phone gin_trgm_ops);
