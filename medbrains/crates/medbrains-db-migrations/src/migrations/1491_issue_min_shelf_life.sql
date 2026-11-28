-- ====================================================================
-- Migration: 1491_issue_min_shelf_life.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Stock leaving a pharmacy store (a transfer or a store indent) was taken
-- oldest expiry first with nothing but "not expired today" in the way, so a
-- ward could be sent a batch that expires tomorrow. Every hospital now has
-- operations/issue_min_shelf_life_days, editable in Settings, Operations;
-- medbrains_db::stock::issue_fefo issues only batches with that many days
-- left and refuses, naming the earliest expiry, when none has.
--
-- 90 days is the storefront's floor for an online order
-- (medbrains_core::pharmacy_storefront::DEFAULT_MIN_SHELF_LIFE_DAYS).
-- A trigger seeds every hospital created later; the SELECT below seeds the
-- ones that exist. ON CONFLICT keeps a value a hospital already set.

CREATE OR REPLACE FUNCTION seed_default_issue_min_shelf_life(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO tenant_settings (tenant_id, category, key, value)
  VALUES (p_tenant, 'operations', 'issue_min_shelf_life_days', '90'::jsonb)
  ON CONFLICT (tenant_id, category, key) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION trg_seed_default_issue_min_shelf_life() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM seed_default_issue_min_shelf_life(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_issue_min_shelf_life ON tenants;
CREATE TRIGGER trg_tenants_seed_issue_min_shelf_life
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION trg_seed_default_issue_min_shelf_life();

SELECT seed_default_issue_min_shelf_life(id) FROM tenants;
