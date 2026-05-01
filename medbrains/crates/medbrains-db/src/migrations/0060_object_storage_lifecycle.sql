-- ════════════════════════════════════════════════════════════════
-- 0060 — Object storage lifecycle (hot / cold / archive)
-- ════════════════════════════════════════════════════════════════
--
-- Three tiers per the NABH 7-year retention rule + DPDP right-to-
-- erasure:
--
--   hot     — frequently read; fast disk; LocalFs or RustFS or AWS S3
--   cold    — rarely read; cheaper disk; same ObjectStore but
--             compressed; restore is instant
--   archive — long-term; AWS Glacier / external HDD; restore is
--             3-12h
--
-- Per-document-category lifecycle policies in `object_storage_policies`.
-- The `medbrains-archive` binary sweeps records eligible for tier
-- transition and updates `storage_tier` + `tier_key` accordingly.

DO $$ BEGIN
  CREATE TYPE storage_tier AS ENUM ('hot', 'cold', 'archive', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS object_storage_policies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_category        TEXT NOT NULL,
  hot_to_cold_days         INT,
  cold_to_archive_days     INT,
  archive_to_delete_days   INT,
  retention_years          INT NOT NULL,
  description              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_category)
);

CREATE INDEX IF NOT EXISTS idx_object_storage_policies_tenant
  ON object_storage_policies(tenant_id);

ALTER TABLE object_storage_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY object_storage_policies_tenant_isolation
  ON object_storage_policies
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP TRIGGER IF EXISTS object_storage_policies_updated_at ON object_storage_policies;
CREATE TRIGGER object_storage_policies_updated_at
  BEFORE UPDATE ON object_storage_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- Tier columns on patient_documents — the largest blob table.
-- Other document tables (mrd_records, lab_attachments, etc.) get
-- the same columns added in their own migrations; this one focuses
-- on the most-used path.

ALTER TABLE patient_documents
  ADD COLUMN IF NOT EXISTS storage_tier storage_tier NOT NULL DEFAULT 'hot',
  ADD COLUMN IF NOT EXISTS tier_key TEXT,
  ADD COLUMN IF NOT EXISTS last_tier_transition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_delete_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_patient_documents_tier_sweep
  ON patient_documents(storage_tier, last_tier_transition_at)
  WHERE storage_tier IN ('hot', 'cold');


-- Audit row for every tier transition. Tamper-evident via
-- previous_hash chaining (mirrors audit_log pattern).

CREATE TABLE IF NOT EXISTS object_storage_transitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id         UUID NOT NULL,
  document_table      TEXT NOT NULL,
  from_tier           storage_tier NOT NULL,
  to_tier             storage_tier NOT NULL,
  from_key            TEXT,
  to_key              TEXT,
  byte_size           BIGINT,
  triggered_by        TEXT NOT NULL DEFAULT 'medbrains-archive',
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_hash       TEXT,
  hash                TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_object_storage_transitions_tenant
  ON object_storage_transitions(tenant_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_object_storage_transitions_doc
  ON object_storage_transitions(document_id);

ALTER TABLE object_storage_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY object_storage_transitions_tenant_isolation
  ON object_storage_transitions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);


-- Seed sensible defaults for the most common document categories.
-- Tenants override per-row via the admin UI.
INSERT INTO object_storage_policies (
  tenant_id, document_category,
  hot_to_cold_days, cold_to_archive_days, archive_to_delete_days,
  retention_years, description
)
SELECT t.id, x.cat,
       x.h2c, x.c2a, x.a2d,
       x.years, x.note
FROM tenants t
CROSS JOIN (VALUES
  ('lab_report',        180,  730, NULL, 7,  'NABH 7-year retention'),
  ('discharge_summary', 365,  NULL, NULL, 7, 'Hot for first year then cold'),
  ('dicom_image',       90,   365,  NULL, 7, 'DICOM moves to cold quickly; large files'),
  ('prescription',      365,  NULL, NULL, 7, 'Re-fill lookups frequent first year'),
  ('consent_form',      NULL, NULL, NULL, 99, 'Lifetime — never tier or delete'),
  ('id_proof',          NULL, NULL, NULL, 99, 'Aadhaar / ABHA snapshot — lifetime'),
  ('insurance_card',    365,  NULL, 1825, 5, 'Move to archive after 1y, delete after 5y'),
  ('billing_invoice',   180,  730,  2555, 7, 'GST 7-year requirement'),
  ('mlc_report',        NULL, NULL, NULL, 99, 'Medico-legal — lifetime')
) AS x(cat, h2c, c2a, a2d, years, note)
ON CONFLICT (tenant_id, document_category) DO NOTHING;
