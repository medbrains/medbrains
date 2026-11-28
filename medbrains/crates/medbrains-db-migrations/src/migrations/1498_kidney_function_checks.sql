-- ====================================================================
-- Migration: 1498_kidney_function_checks.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- How recent an eGFR must be for renal dosing and contrast (7 days inpatient,
-- 30 outpatient: ACR institutional practice) and the contrast hold (eGFR 30,
-- ACR-NKF 2020; 45 selectable, ESUR/KDIGO), per hospital. Read by
-- medbrains-health-services kidney_settings.rs; edited in Settings.

CREATE OR REPLACE FUNCTION seed_default_kidney_function_checks(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO tenant_settings (tenant_id, category, key, value)
  VALUES (
    p_tenant, 'clinical', 'kidney_function_checks',
    '{"egfr_inpatient_days": 7, "egfr_outpatient_days": 30, "contrast_egfr_threshold": 30}'::jsonb
  )
  ON CONFLICT (tenant_id, category, key) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION trg_seed_default_kidney_function_checks() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_kidney_function_checks(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_kidney_function_checks ON tenants;
CREATE TRIGGER trg_tenants_seed_kidney_function_checks
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_seed_default_kidney_function_checks();

SELECT seed_default_kidney_function_checks(id) FROM tenants;
