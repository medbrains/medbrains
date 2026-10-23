-- ====================================================================
-- Migration: 1196_diagnosis_coding_switch.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: icd10_releases, icd10_catalogue
-- Drops: icd10_codes (only when empty)
-- ====================================================================
-- A hospital codes diagnoses in ICD-11, ICD-10 or both (founder decision
-- 2026-10-23), chosen in Settings → Diagnosis coding.
--
-- Licence: WHO's ICD-11 licence lets us embed ICD-11 codes and titles with
-- attribution (searched live through the WHO ICD API container). It does
-- not cover crosswalks (§1.2.4), and ICD-10 is not openly licensed for
-- commercial use. So there is no ICD-11 <-> ICD-10 mapping anywhere, and no
-- ICD-10 content ships in the repository: `icd10_catalogue` stays empty until a
-- licence holder loads their own file (WHO ClaML or code,title,chapter CSV)
-- through the importer, which records the source, version and licence note.

-- 1. The switch: tenant_settings clinical/diagnosis_coding, ICD-11 for
--    every hospital, including those created after this migration.
CREATE OR REPLACE FUNCTION seed_default_diagnosis_coding(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO tenant_settings (tenant_id, category, key, value)
  VALUES (p_tenant, 'clinical', 'diagnosis_coding', '"icd11"'::jsonb)
  ON CONFLICT (tenant_id, category, key) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION trg_seed_default_diagnosis_coding() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_diagnosis_coding(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_diagnosis_coding ON tenants;
CREATE TRIGGER trg_tenants_seed_diagnosis_coding
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_seed_default_diagnosis_coding();

SELECT seed_default_diagnosis_coding(id) FROM tenants;

-- 2. Each diagnosis names its system. The column defaulted to 'icd10' while
--    the picker searched ICD-11, so rows written without a system carry an
--    ICD-11 code labelled ICD-10 (and a writer that names no system cannot
--    be right with any single default). Every ICD-11 MMS code has a letter
--    in its second place and no ICD-10 code does, so the code's own shape
--    names its revision — no mapping involved. A trigger keeps the label
--    true for every writer; SNOMED rows are left alone.
CREATE OR REPLACE FUNCTION diagnosis_icd_system_from_code() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.icd_system IN ('icd10', 'icd11') AND NEW.icd_code IS NOT NULL THEN
    IF NEW.icd_code ~ '^[A-Za-z][0-9]' THEN
      NEW.icd_system := 'icd10';
    ELSIF NEW.icd_code ~ '^[0-9A-Za-z][A-Za-z]' THEN
      NEW.icd_system := 'icd11';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diagnoses_icd_system_from_code ON public.diagnoses;
CREATE TRIGGER trg_diagnoses_icd_system_from_code
  BEFORE INSERT OR UPDATE OF icd_code, icd_system ON public.diagnoses
  FOR EACH ROW EXECUTE FUNCTION diagnosis_icd_system_from_code();

ALTER TABLE public.diagnoses ALTER COLUMN icd_system SET DEFAULT 'icd11';
UPDATE public.diagnoses
   SET icd_system = 'icd11'
 WHERE icd_system = 'icd10'
   AND icd_code ~ '^[0-9A-Za-z][A-Za-z]';

-- 3. The ICD-10 catalogue a hospital loads under its own licence.
CREATE TABLE public.icd10_releases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    version text NOT NULL CHECK (char_length(btrim(version)) BETWEEN 1 AND 64),
    source text NOT NULL CHECK (char_length(btrim(source)) BETWEEN 1 AND 200),
    licence_note text NOT NULL CHECK (char_length(btrim(licence_note)) BETWEEN 1 AND 1000),
    file_name text CHECK (file_name IS NULL OR char_length(file_name) <= 200),
    format text NOT NULL CHECK (format IN ('claml', 'csv')),
    content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    code_count integer NOT NULL CHECK (code_count > 0),
    loaded_by uuid NOT NULL REFERENCES public.users(id),
    loaded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text
);

-- Loading the same file twice is a no-op; the latest loaded is in use.
CREATE UNIQUE INDEX uq_icd10_releases_content
    ON public.icd10_releases (tenant_id, content_sha256) WHERE deleted_at IS NULL;
CREATE INDEX idx_icd10_releases_loaded
    ON public.icd10_releases (tenant_id, loaded_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.icd10_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icd10_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_icd10_releases ON public.icd10_releases
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_icd10_releases BEFORE UPDATE ON public.icd10_releases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_icd10_releases_soft_delete BEFORE DELETE ON public.icd10_releases
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- The old global `icd10_codes` (0080) was never filled or read by a screen,
-- and one catalogue shared by every hospital would stretch one licence over
-- all of them. Dropped when empty; a database where somebody filled it by
-- hand keeps it untouched for its operator to decide.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.icd10_codes) THEN
    DROP TABLE public.icd10_codes;
  END IF;
END $$;

-- The codes in use: derived from the latest release and replaced wholesale
-- on each import, so a real DELETE (no soft-delete guardrail) — the release
-- row is the record of what was loaded, by whom.
CREATE TABLE public.icd10_catalogue (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code text NOT NULL CHECK (char_length(code) BETWEEN 3 AND 16),
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
    chapter text,
    release_id uuid NOT NULL REFERENCES public.icd10_releases(id),
    PRIMARY KEY (tenant_id, code)
);

CREATE INDEX idx_icd10_catalogue_title_trgm
    ON public.icd10_catalogue USING gin (title gin_trgm_ops);

ALTER TABLE public.icd10_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icd10_catalogue FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_icd10_catalogue ON public.icd10_catalogue
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
