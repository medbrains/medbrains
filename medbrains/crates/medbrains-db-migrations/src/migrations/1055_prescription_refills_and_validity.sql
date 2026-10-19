-- ====================================================================
-- Migration: 1055_prescription_refills_and_validity.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A prescription's expiry, and refills issued as their own pharmacy queue
-- entries. Until now `repeats_allowed` existed with no screen to set it, and a
-- "repeat" re-used the original order instead of issuing anything new.

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS valid_until date;

-- Which refill a pharmacy queue entry is: NULL for the prescription itself.
ALTER TABLE pharmacy_prescriptions ADD COLUMN IF NOT EXISTS repeat_index integer
    CHECK (repeat_index IS NULL OR repeat_index > 0);

-- The refill ledger points at the queue entry the refill raised; the order
-- follows from that entry once the pharmacist approves it.
ALTER TABLE pharmacy_repeats ADD COLUMN IF NOT EXISTS rx_queue_id uuid
    REFERENCES pharmacy_prescriptions (id);
ALTER TABLE pharmacy_repeats ALTER COLUMN pharmacy_order_id DROP NOT NULL;
