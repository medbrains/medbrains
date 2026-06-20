-- ============================================================
-- MedBrains schema — payment_webhook_exceptions
-- Reverse-reconciliation safety net: when an inbound gateway webhook (the
-- money already moved) cannot be matched back to a txn — unknown order ref,
-- amount mismatch, or signature failure — it lands here for a human instead
-- of being silently dropped. Revenue is never lost to a missed match.
-- See RFCs/RFC-MODULE-payment-providers.md §6.
--
-- Cross-tenant ops table (like processed_webhooks): an unmatched credit often
-- has no resolvable tenant, so no RLS — access is gated at the route by a
-- high billing permission.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,                       -- null when the order couldn't be matched
    provider text NOT NULL,               -- razorpay | cashfree | pinelabs | ...
    order_ref text,                       -- gateway order id from the payload
    reason text NOT NULL,                 -- unknown_order | amount_mismatch | signature_failed
    amount numeric(12,2),
    raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'open',  -- open | resolved | ignored
    notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.payment_webhook_exceptions
    ADD CONSTRAINT payment_webhook_exceptions_pkey PRIMARY KEY (id);

-- Ops worklist: open exceptions, newest first.
CREATE INDEX IF NOT EXISTS idx_payment_webhook_exceptions_open
    ON public.payment_webhook_exceptions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_exceptions_order
    ON public.payment_webhook_exceptions (provider, order_ref);
