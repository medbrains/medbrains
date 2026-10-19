-- ====================================================================
-- Migration: 1124_uhi_payments_and_services.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- UHI provider, second slice:
--
-- * Two more services: physical consultation (a normal OPD appointment) and
--   lab tests (a request lab staff accept before any order exists).
-- * Paying online (UHI's ON-ORDER payment). A teleconsultation paid online is
--   held — a real appointment in `scheduled` — until the payment provider's
--   webhook says it is paid; an unpaid hold expires. The money is recorded
--   against the patient's bill when it arrives, never before.
--
--   awaiting_payment  booked and held; the payment link has been sent
--   expired           the hold ran out unpaid; the appointment is cancelled
--
-- * Which lab tests a patient may book from an app: a flag on the catalogue,
--   off by default, set on the lab catalogue screen.
-- * Speciality search matches department names; indexed.

ALTER TABLE public.uhi_subscriptions DROP CONSTRAINT uhi_subscriptions_services_check;
ALTER TABLE public.uhi_subscriptions ADD CONSTRAINT uhi_subscriptions_services_check
    CHECK (services <@ ARRAY['teleconsultation', 'physical_consultation', 'lab_tests',
                             'blood_bank', 'ambulance']::text[]);

ALTER TABLE public.uhi_transactions DROP CONSTRAINT uhi_transactions_service_check;
ALTER TABLE public.uhi_transactions ADD CONSTRAINT uhi_transactions_service_check
    CHECK (service IN ('teleconsultation', 'physical_consultation', 'lab_tests',
                       'blood_bank', 'ambulance'));

ALTER TABLE public.uhi_transactions DROP CONSTRAINT uhi_transactions_state_check;
ALTER TABLE public.uhi_transactions ADD CONSTRAINT uhi_transactions_state_check
    CHECK (state IN ('searched', 'selected', 'initialised', 'awaiting_payment', 'pending',
                     'confirmed', 'declined', 'cancelled', 'expired'));

ALTER TABLE public.uhi_transactions
    ADD COLUMN payment_type text CHECK (payment_type IN ('ON-ORDER', 'ON-FULFILLMENT')),
    ADD COLUMN payment_status text CHECK (payment_status IN ('NOT-PAID', 'PAID')),
    ADD COLUMN amount numeric(12,2) CHECK (amount >= 0),
    ADD COLUMN payment_uri text,
    ADD COLUMN payment_transaction_id uuid REFERENCES public.payment_gateway_transactions(id),
    ADD COLUMN invoice_id uuid REFERENCES public.invoices(id),
    ADD COLUMN hold_expires_at timestamptz,
    ADD COLUMN lab_order_ids uuid[] NOT NULL DEFAULT '{}',
    ADD CONSTRAINT uhi_transactions_hold_expires
        CHECK (state <> 'awaiting_payment' OR hold_expires_at IS NOT NULL);

-- The staff queue now shows held and expired bookings too.
DROP INDEX public.idx_uhi_transactions_queue;
CREATE INDEX idx_uhi_transactions_queue
    ON public.uhi_transactions (tenant_id, updated_at DESC)
    WHERE state IN ('awaiting_payment', 'pending', 'confirmed', 'declined', 'cancelled', 'expired')
      AND deleted_at IS NULL;
-- The read-time sweep that expires unpaid holds.
CREATE INDEX idx_uhi_transactions_holds
    ON public.uhi_transactions (tenant_id, hold_expires_at)
    WHERE state = 'awaiting_payment' AND deleted_at IS NULL;
-- The payment webhook finds its booking by the gateway transaction.
CREATE UNIQUE INDEX uq_uhi_transactions_payment
    ON public.uhi_transactions (payment_transaction_id)
    WHERE payment_transaction_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.lab_test_catalog
    ADD COLUMN is_patient_orderable boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.lab_test_catalog.is_patient_orderable IS
    'A patient may ask for this test from a patient app (UHI); lab staff still accept each request.';
CREATE INDEX idx_lab_test_catalog_patient_orderable
    ON public.lab_test_catalog (tenant_id, name)
    WHERE is_patient_orderable AND is_active AND deleted_at IS NULL;

CREATE INDEX idx_departments_tenant_lower_name
    ON public.departments (tenant_id, lower(name)) WHERE deleted_at IS NULL;
