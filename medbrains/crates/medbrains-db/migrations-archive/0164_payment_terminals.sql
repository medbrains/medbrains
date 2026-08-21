-- Migration: 0164_payment_terminals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: payment_terminals
-- Per-billing-place registry of payment devices. A hospital runs several
-- providers + POS/QR/soundbox devices at once, each bolted to a physical
-- billing place (counter / room / location). Pay-time provider selection =
-- the active terminals mapped to the cashier's counter, not one global switch.
-- See RFCs/RFC-MODULE-payment-providers.md §2.1.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_terminals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    -- razorpay | cashfree | paytm | pinelabs
    provider text NOT NULL,
    -- online | pos | qr  (online link, POS card machine, dynamic-QR / soundbox)
    kind text NOT NULL DEFAULT 'pos',
    -- provider device id: Plutus IMEI / Paytm EDC machine id / Razorpay QR id
    terminal_code text,
    -- billing place this device is bolted to (free-text counter convention,
    -- matches payments.counter_id; optional location FK for reporting)
    counter_id text,
    location_id uuid,
    label text NOT NULL,
    -- sandbox | live  (mirrors the provider config mode)
    mode text NOT NULL DEFAULT 'sandbox',
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.payment_terminals
    ADD CONSTRAINT payment_terminals_pkey PRIMARY KEY (id);

-- One device code is unique per provider within a tenant (idempotent re-register).
ALTER TABLE ONLY public.payment_terminals
    ADD CONSTRAINT payment_terminals_tenant_provider_code_key
    UNIQUE (tenant_id, provider, terminal_code);

ALTER TABLE ONLY public.payment_terminals
    ADD CONSTRAINT payment_terminals_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES public.locations(id);

-- Pay-time lookup: active devices at a billing place.
CREATE INDEX IF NOT EXISTS idx_payment_terminals_counter
    ON public.payment_terminals (tenant_id, counter_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_terminals_provider
    ON public.payment_terminals (tenant_id, provider, is_active);

ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payment_terminals ON public.payment_terminals;
CREATE POLICY tenant_isolation_payment_terminals ON public.payment_terminals
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER payment_terminals_set_updated_at
    BEFORE UPDATE ON public.payment_terminals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
