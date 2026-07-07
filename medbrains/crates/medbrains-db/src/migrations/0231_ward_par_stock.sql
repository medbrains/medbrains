-- Ward / floor PAR (imprest) stock. Wards hold a par level of drugs; the pharmacy tops them
-- up to par (replenish), nurses consume against ward stock. ward_par_levels = the target per
-- ward × drug; ward_stock = current on-hand per ward × drug. Replenish decrements the
-- pharmacy_catalog aggregate; consume decrements ward_stock. Tenant RLS.

CREATE TABLE IF NOT EXISTS ward_par_levels (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id   uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    par_qty         integer NOT NULL DEFAULT 0,
    min_qty         integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, department_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS ward_stock (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id   uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    quantity        integer NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, department_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ward_par_dept ON ward_par_levels (tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_ward_stock_dept ON ward_stock (tenant_id, department_id);

ALTER TABLE ward_par_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY ward_par_levels_tenant_isolation ON ward_par_levels
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY ward_stock_tenant_isolation ON ward_stock
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER ward_par_levels_updated_at BEFORE UPDATE ON ward_par_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ward_stock_updated_at BEFORE UPDATE ON ward_stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
