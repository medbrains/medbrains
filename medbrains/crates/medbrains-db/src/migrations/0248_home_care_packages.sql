-- Home care billing (ticket #2970): package-based billing — a prepaid bundle of N home-care visits.
-- Purchase auto-charges the price to the patient (reusing the billing auto_charge seam); each visit
-- consumed decrements the balance. Visit-based billing reuses auto_charge per visit (no table).
-- Tenant RLS.

CREATE TABLE IF NOT EXISTS home_care_packages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id   uuid NOT NULL,
    name         text NOT NULL,
    total_visits integer NOT NULL,
    used_visits  integer NOT NULL DEFAULT 0,
    price        numeric(12, 2) NOT NULL DEFAULT 0,
    status       text NOT NULL DEFAULT 'active',
    invoice_id   uuid,
    purchased_at timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT home_care_package_status_check CHECK (status = ANY (ARRAY[
        'active'::text, 'completed'::text, 'cancelled'::text
    ])),
    CONSTRAINT home_care_package_visits_check CHECK (total_visits > 0)
);

CREATE INDEX IF NOT EXISTS idx_home_care_packages_patient
    ON home_care_packages (tenant_id, patient_id, status);

ALTER TABLE home_care_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY home_care_packages_tenant_isolation ON home_care_packages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE TRIGGER home_care_packages_updated_at BEFORE UPDATE ON home_care_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
