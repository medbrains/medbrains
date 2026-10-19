-- ====================================================================
-- Migration: 1126_patient_delivery_choice.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A patient asking for a refill chooses pickup or home delivery. The choice
-- rides on the refill request until the pharmacist approves it; then it
-- becomes a row in pharmacy_deliveries — at once for pay-on-delivery, after
-- the payment link is paid for pay-now. Both tables already carry RLS,
-- update_updated_at and the soft-delete guard; this only adds columns.

ALTER TABLE prescription_refill_requests
    ADD COLUMN IF NOT EXISTS fulfilment text NOT NULL DEFAULT 'pickup'
        CHECK (fulfilment IN ('pickup', 'delivery')),
    -- Where it goes, as the patient gave it.
    ADD COLUMN IF NOT EXISTS delivery_address text,
    ADD COLUMN IF NOT EXISTS delivery_landmark text,
    ADD COLUMN IF NOT EXISTS delivery_pincode text,
    ADD COLUMN IF NOT EXISTS delivery_phone text,
    ADD COLUMN IF NOT EXISTS delivery_slot text
        CHECK (delivery_slot IN ('morning', 'afternoon', 'evening')),
    ADD COLUMN IF NOT EXISTS delivery_payment text
        CHECK (delivery_payment IN ('prepaid', 'cash_on_delivery')),
    -- The pay-now link, once the bill exists.
    ADD COLUMN IF NOT EXISTS payment_txn_id uuid REFERENCES payment_gateway_transactions(id),
    -- Why the pharmacy could not send it after all; the patient collects.
    ADD COLUMN IF NOT EXISTS delivery_note text;

ALTER TABLE prescription_refill_requests DROP CONSTRAINT IF EXISTS refill_requests_delivery_complete;
ALTER TABLE prescription_refill_requests ADD CONSTRAINT refill_requests_delivery_complete
    CHECK (fulfilment = 'pickup'
           OR (delivery_address IS NOT NULL AND delivery_phone IS NOT NULL
               AND delivery_payment IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_refill_requests_rx_queue
    ON prescription_refill_requests (tenant_id, rx_queue_id)
    WHERE fulfilment = 'delivery' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refill_requests_payment
    ON prescription_refill_requests (payment_txn_id)
    WHERE payment_txn_id IS NOT NULL;

ALTER TABLE pharmacy_deliveries
    ADD COLUMN IF NOT EXISTS refill_request_id uuid REFERENCES prescription_refill_requests(id),
    ADD COLUMN IF NOT EXISTS preferred_slot text,
    -- The handover code, kept so the patient's app can show it; the hash
    -- still decides at the door. Cleared once the parcel is handed over.
    ADD COLUMN IF NOT EXISTS patient_code text;
-- A delivery the patient arranged and paid for online has no staff author.
ALTER TABLE pharmacy_deliveries ALTER COLUMN arranged_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacy_deliveries_refill_request
    ON pharmacy_deliveries (tenant_id, refill_request_id)
    WHERE refill_request_id IS NOT NULL;
