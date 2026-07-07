-- Persistent staff <-> location/station assignment (beyond the per-shift nurse_shift_assignments).
-- A nursing station is a `locations` row of the new level 'station'. staff_location_assignments
-- ties a user to any location (ward / station / floor) with a role label + primary flag +
-- effective window. Tenant RLS.

ALTER TYPE public.location_level ADD VALUE IF NOT EXISTS 'station';

CREATE TABLE IF NOT EXISTS staff_location_assignments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id        uuid NOT NULL,
    location_id    uuid NOT NULL,
    role_label     text,
    is_primary     boolean NOT NULL DEFAULT false,
    effective_from date NOT NULL DEFAULT CURRENT_DATE,
    effective_to   date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_loc_location ON staff_location_assignments (tenant_id, location_id);
CREATE INDEX IF NOT EXISTS idx_staff_loc_user ON staff_location_assignments (tenant_id, user_id);

ALTER TABLE staff_location_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_location_assignments_tenant_isolation ON staff_location_assignments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER staff_location_assignments_updated_at BEFORE UPDATE ON staff_location_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
