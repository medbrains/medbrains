-- Migration: 0259_health_packages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Health packages / promotions (ticket #2953): pre-priced health check-up / service packages a
-- hospital markets to patients (e.g. "Master Health Check"), optionally promoted with a validity.
-- Booking a package auto-charges its price (reusing the billing seam); the resulting invoice is
-- what the patient pays online via the existing payment providers. Tenant RLS.

CREATE TABLE IF NOT EXISTS health_packages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    price       numeric(12, 2) NOT NULL DEFAULT 0,
    includes    text,
    category    text,
    is_active   boolean NOT NULL DEFAULT true,
    is_promoted boolean NOT NULL DEFAULT false,
    valid_until date,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_packages_active
    ON health_packages (tenant_id, is_active, is_promoted);

ALTER TABLE health_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_packages_tenant_isolation ON health_packages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER health_packages_updated_at BEFORE UPDATE ON health_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- A patient's booking of a package; the booking id is the auto_charge source_id (idempotent per
-- booking), and invoice_id points at the payable invoice the patient settles online.
CREATE TABLE IF NOT EXISTS health_package_bookings (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    package_id uuid NOT NULL REFERENCES health_packages(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL,
    invoice_id uuid,
    booked_by  uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_package_bookings_pkg
    ON health_package_bookings (tenant_id, package_id, created_at DESC);

ALTER TABLE health_package_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_package_bookings_tenant_isolation ON health_package_bookings
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
