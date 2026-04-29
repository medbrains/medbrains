-- ====================================================================
-- Migration: 134_doctor_packages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: doctor_packages, doctor_package_inclusions,
--             patient_package_subscriptions, patient_package_consumptions
-- ====================================================================
-- Sub-Sprint B of SPRINT-doctor-activities.md.
-- Bundle pricing for chronic-care plans, post-surgical follow-ups, etc.
-- ====================================================================

-- Package template (per tenant)
CREATE TABLE doctor_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    total_price     NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    validity_days   INT NOT NULL DEFAULT 365 CHECK (validity_days > 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);
CREATE INDEX doctor_packages_active_idx
    ON doctor_packages (tenant_id, is_active);

CREATE TRIGGER doctor_packages_updated
    BEFORE UPDATE ON doctor_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE doctor_packages FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_packages');

COMMENT ON TABLE doctor_packages IS
    'Bundle pricing template — chronic care plans, follow-up bundles. SPRINT-doctor-activities.md §2.3.';

-- Inclusion line items per package
CREATE TABLE doctor_package_inclusions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    package_id                  UUID NOT NULL REFERENCES doctor_packages(id) ON DELETE CASCADE,
    inclusion_type              TEXT NOT NULL CHECK (inclusion_type IN
        ('consultation', 'lab', 'procedure', 'service')),
    consultation_specialty_id   UUID,
    consultation_doctor_id      UUID REFERENCES users(id),
    service_id                  UUID,
    test_id                     UUID,
    procedure_id                UUID,
    included_quantity           INT NOT NULL CHECK (included_quantity > 0),
    notes                       TEXT,
    sort_order                  INT NOT NULL DEFAULT 0
);
CREATE INDEX doctor_package_inclusions_pkg_idx
    ON doctor_package_inclusions (tenant_id, package_id, sort_order);

ALTER TABLE doctor_package_inclusions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_package_inclusions');

-- Patient subscriptions (purchases)
CREATE TABLE patient_package_subscriptions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    package_id               UUID NOT NULL REFERENCES doctor_packages(id),
    patient_id               UUID NOT NULL,
    purchased_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    purchased_via_invoice_id UUID,
    valid_until              TIMESTAMPTZ NOT NULL,
    total_paid               NUMERIC(12,2) NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'exhausted', 'expired', 'refunded', 'suspended')),
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patient_package_subscriptions_patient_idx
    ON patient_package_subscriptions (tenant_id, patient_id, status);
CREATE INDEX patient_package_subscriptions_expiry_idx
    ON patient_package_subscriptions (tenant_id, valid_until)
    WHERE status = 'active';

CREATE TRIGGER patient_package_subscriptions_updated
    BEFORE UPDATE ON patient_package_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE patient_package_subscriptions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('patient_package_subscriptions');

-- Per-event decrement of subscription
CREATE TABLE patient_package_consumptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id     UUID NOT NULL REFERENCES patient_package_subscriptions(id) ON DELETE CASCADE,
    inclusion_type      TEXT NOT NULL,
    consumed_visit_id   UUID,
    consumed_service_id UUID,
    consumed_test_id    UUID,
    consumed_procedure_id UUID,
    consumed_quantity   INT NOT NULL DEFAULT 1 CHECK (consumed_quantity > 0),
    consumed_by_user_id UUID REFERENCES users(id),
    consumed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes               TEXT
);
CREATE INDEX patient_package_consumptions_sub_idx
    ON patient_package_consumptions (tenant_id, subscription_id, consumed_at DESC);

ALTER TABLE patient_package_consumptions FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('patient_package_consumptions');

-- Worker grants
GRANT SELECT ON doctor_packages, doctor_package_inclusions,
                patient_package_subscriptions, patient_package_consumptions
                TO medbrains_outbox_worker;
