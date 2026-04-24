-- 107_printing_completion.sql — Multi-entity branding + academic enum values
-- NOTE: Template seeding moved to 108 (enum values must be committed first)

-- ══════════════════════════════════════════════════════════
--  Multi-Entity Branding
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brand_entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    short_name      TEXT,
    logo_url        TEXT,
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    registration_no TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, code)
);

ALTER TABLE brand_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_entities_tenant ON brand_entities
    USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_brand_entities_tenant ON brand_entities(tenant_id);

DO $$ BEGIN
    EXECUTE 'CREATE TRIGGER trg_brand_entities_updated_at BEFORE UPDATE ON brand_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS brand_entity_id UUID REFERENCES brand_entities(id);

-- Add academic enum values (committed in THIS migration, used in 108)
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'pg_logbook';
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'intern_logbook';
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'assessment';
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'certificate';
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'research_form';
ALTER TYPE document_template_category ADD VALUE IF NOT EXISTS 'hostel_form';
