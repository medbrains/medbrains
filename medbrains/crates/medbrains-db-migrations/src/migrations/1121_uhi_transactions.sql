-- ====================================================================
-- Migration: 1121_uhi_transactions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: uhi_transactions
-- Drops: none
-- ====================================================================
-- Every UHI (Beckn) transaction a patient app opened with this hospital:
-- one row per (BAP, transaction ID), moved along as the app searches,
-- selects, initialises, confirms, asks for status or cancels.
--
--   searched     a search answered with our catalogue
--   selected     a quote sent (on_select)
--   initialised  the draft order returned (on_init)
--   pending      confirmed by the patient, waiting for staff to accept
--                (ambulance, blood: a person decides, never the system)
--   confirmed    booked (teleconsultation) or accepted by staff
--   declined     staff could not take it
--   cancelled    the patient cancelled
--
-- What the order became lives in the hospital's own modules: the
-- appointment (and its video session) for a teleconsultation, the
-- ambulance trip for an accepted ambulance request. A blood request is an
-- enquiry only — blood is issued after a cross-match on the patient's
-- sample, at the bank, never from a remote order.

CREATE TABLE public.uhi_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    service text NOT NULL CHECK (service IN ('teleconsultation', 'blood_bank', 'ambulance')),
    domain text NOT NULL,
    transaction_id text NOT NULL,
    last_message_id text NOT NULL,
    last_action text NOT NULL,
    bap_id text NOT NULL,
    bap_uri text NOT NULL,
    state text NOT NULL DEFAULT 'searched'
        CHECK (state IN ('searched', 'selected', 'initialised', 'pending', 'confirmed',
                         'declined', 'cancelled')),
    customer_name text,
    customer_phone text,
    customer_abha text,
    order_details jsonb,
    payload jsonb NOT NULL,
    appointment_id uuid REFERENCES public.appointments(id),
    tele_consultation_id uuid REFERENCES public.tele_consultations(id),
    ambulance_trip_id uuid REFERENCES public.ambulance_trips(id),
    responded_by uuid REFERENCES public.users(id),
    responded_at timestamptz,
    decline_reason text,
    confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT uhi_transactions_declined_has_reason
        CHECK (state <> 'declined' OR decline_reason IS NOT NULL)
);

CREATE UNIQUE INDEX uq_uhi_transactions_txn
    ON public.uhi_transactions (tenant_id, bap_id, transaction_id) WHERE deleted_at IS NULL;
-- The staff queue: orders only, newest first.
CREATE INDEX idx_uhi_transactions_queue
    ON public.uhi_transactions (tenant_id, updated_at DESC)
    WHERE state IN ('pending', 'confirmed', 'declined', 'cancelled') AND deleted_at IS NULL;
CREATE INDEX idx_uhi_transactions_appointment
    ON public.uhi_transactions (tenant_id, appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE public.uhi_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uhi_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_uhi_transactions ON public.uhi_transactions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_uhi_transactions BEFORE UPDATE ON public.uhi_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_uhi_transactions_soft_delete BEFORE DELETE ON public.uhi_transactions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
