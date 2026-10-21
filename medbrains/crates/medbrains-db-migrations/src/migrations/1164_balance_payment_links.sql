-- ====================================================================
-- Migration: 1164_balance_payment_links.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: payment_links, payment_link_parts
-- Drops: none
-- ====================================================================
-- Balance payment links (#4871). A link asks for all or part of what a
-- patient owes on one or more bills; the patient may pay it in parts, and
-- the rest is taken at the counter in any mode.
--
-- payment_links: one row per link. `invoice_ids` are the bills it pays
-- (oldest first when a part is spread); `amount_paid` is what the provider
-- has taken on it so far. A link hangs on a `payment_gateway_transactions`
-- row whose `gateway_order_id` is the provider's link id, so the provider's
-- webhooks find it the way they find every other online payment.
--
-- payment_link_parts: one row per part the provider took, keyed by the
-- provider's payment id — the exactly-once decision for posting a part.
-- `posted` is what landed on the bills, `parked` what went to finance.

CREATE TABLE public.payment_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    invoice_ids uuid[] NOT NULL,
    scope text NOT NULL,
    lane text,
    amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) NOT NULL DEFAULT 0,
    accept_partial boolean NOT NULL DEFAULT true,
    min_part_amount numeric(12,2),
    status text NOT NULL DEFAULT 'pending',
    provider text NOT NULL,
    provider_link_id text,
    short_url text,
    expires_at timestamptz NOT NULL,
    channel text NOT NULL,
    sent_count integer NOT NULL DEFAULT 0,
    last_sent_at timestamptz,
    payment_transaction_id uuid REFERENCES public.payment_gateway_transactions(id),
    replaces_id uuid REFERENCES public.payment_links(id),
    end_reason text,
    error text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT payment_links_bills CHECK (cardinality(invoice_ids) BETWEEN 1 AND 200),
    CONSTRAINT payment_links_scope CHECK (scope IN ('department', 'all', 'bills')),
    CONSTRAINT payment_links_amount CHECK (amount > 0 AND amount_paid >= 0),
    CONSTRAINT payment_links_min_part CHECK (min_part_amount IS NULL OR min_part_amount >= 0),
    CONSTRAINT payment_links_status CHECK (status IN
        ('pending', 'created', 'partially_paid', 'paid', 'expired', 'cancelled', 'failed')),
    CONSTRAINT payment_links_channel CHECK (channel IN ('sms', 'whatsapp', 'copy', 'portal')),
    CONSTRAINT payment_links_sent CHECK (sent_count >= 0)
);

CREATE INDEX idx_payment_links_patient ON public.payment_links (tenant_id, patient_id, created_at DESC)
    WHERE deleted_at IS NULL;
-- "Is any of these bills on a live link?" — the overlap every new link checks.
CREATE INDEX idx_payment_links_live_bills ON public.payment_links USING gin (invoice_ids)
    WHERE status IN ('pending', 'created', 'partially_paid') AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_payment_links_txn ON public.payment_links (payment_transaction_id)
    WHERE payment_transaction_id IS NOT NULL;
CREATE INDEX idx_payment_links_replaces ON public.payment_links (replaces_id)
    WHERE replaces_id IS NOT NULL;

CREATE TABLE public.payment_link_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    link_id uuid NOT NULL REFERENCES public.payment_links(id),
    provider_payment_id text NOT NULL,
    amount numeric(12,2) NOT NULL,
    method text,
    posted numeric(12,2) NOT NULL DEFAULT 0,
    parked numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT payment_link_parts_amounts CHECK (amount > 0 AND posted >= 0 AND parked >= 0)
);

CREATE UNIQUE INDEX uq_payment_link_parts_once
    ON public.payment_link_parts (tenant_id, provider_payment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_link_parts_link ON public.payment_link_parts (link_id);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_links_tenant ON public.payment_links
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_payment_links_updated_at BEFORE UPDATE ON public.payment_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_payment_links_soft_delete BEFORE DELETE ON public.payment_links
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.payment_link_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_link_parts FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_link_parts_tenant ON public.payment_link_parts
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_payment_link_parts_updated_at BEFORE UPDATE ON public.payment_link_parts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_payment_link_parts_soft_delete BEFORE DELETE ON public.payment_link_parts
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
