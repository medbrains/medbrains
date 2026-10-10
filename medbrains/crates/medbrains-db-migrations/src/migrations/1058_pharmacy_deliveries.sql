-- ====================================================================
-- Migration: 1058_pharmacy_deliveries.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_deliveries
-- Drops: none
-- ====================================================================
-- Home delivery of a pharmacy order, by the hospital's own runner or a
-- courier. Controlled drugs never go out; a drug that needs refrigeration
-- goes only with a runner (who carries a cool box), never by courier.

ALTER TABLE pharmacy_catalog ADD COLUMN IF NOT EXISTS needs_cold_chain boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS pharmacy_deliveries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id         uuid NOT NULL REFERENCES pharmacy_orders(id),
    patient_id       uuid NOT NULL REFERENCES patients(id),
    mode             text NOT NULL CHECK (mode IN ('runner', 'courier')),
    -- Where it goes, as it stood when arranged: a later change to the
    -- patient's record must not move a parcel already on the road.
    address          text NOT NULL,
    landmark         text,
    pincode          text,
    contact_phone    text NOT NULL,
    runner_id        uuid REFERENCES users(id),
    courier_name     text,
    tracking_ref     text,
    payment          text NOT NULL CHECK (payment IN ('prepaid', 'cash_on_delivery')),
    delivery_fee     numeric(10, 2) NOT NULL DEFAULT 0,
    -- What the runner collects at the door, for cash on delivery.
    amount_due       numeric(12, 2) NOT NULL DEFAULT 0,
    status           text NOT NULL DEFAULT 'arranged'
        CHECK (status IN ('arranged', 'out_for_delivery', 'delivered', 'failed', 'cancelled')),
    otp_hash         text,
    otp_attempts     integer NOT NULL DEFAULT 0,
    dispatched_at    timestamptz,
    delivered_at     timestamptz,
    delivered_by     uuid REFERENCES users(id),
    cash_collected   numeric(12, 2),
    failure_reason   text,
    arranged_by      uuid NOT NULL REFERENCES users(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    deleted_by       uuid,
    delete_reason    text,
    CHECK (mode = 'runner' OR courier_name IS NOT NULL)
);
-- One delivery under way per order; a failed or cancelled one can be
-- arranged again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacy_deliveries_live
    ON pharmacy_deliveries (tenant_id, order_id)
    WHERE status IN ('arranged', 'out_for_delivery', 'delivered') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_deliveries_status
    ON pharmacy_deliveries (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_deliveries_runner
    ON pharmacy_deliveries (tenant_id, runner_id)
    WHERE status IN ('arranged', 'out_for_delivery') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_deliveries_patient
    ON pharmacy_deliveries (tenant_id, patient_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_pharmacy_deliveries_updated_at ON pharmacy_deliveries;
CREATE TRIGGER trg_pharmacy_deliveries_updated_at
    BEFORE UPDATE ON pharmacy_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_pharmacy_deliveries_soft_delete ON pharmacy_deliveries;
CREATE TRIGGER trg_pharmacy_deliveries_soft_delete
    BEFORE DELETE ON pharmacy_deliveries
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();

ALTER TABLE pharmacy_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_pharmacy_deliveries ON pharmacy_deliveries;
CREATE POLICY tenant_isolation_pharmacy_deliveries ON pharmacy_deliveries
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
