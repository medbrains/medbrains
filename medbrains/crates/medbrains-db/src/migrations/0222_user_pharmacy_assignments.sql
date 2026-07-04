-- Multi-pharmacy staff scoping (MP3). Which pharmacy locations a user works at, so
-- their stock view + dispensing can default/scope to their pharmacy. A user may
-- cover several; is_default marks their home pharmacy. Tenant-scoped RLS.

CREATE TABLE IF NOT EXISTS user_pharmacy_assignments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_location_id uuid NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
    is_default        boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, store_location_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pharmacy_assignments_user
    ON user_pharmacy_assignments (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_pharmacy_assignments_location
    ON user_pharmacy_assignments (tenant_id, store_location_id);

ALTER TABLE user_pharmacy_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_pharmacy_assignments_tenant_isolation ON user_pharmacy_assignments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
