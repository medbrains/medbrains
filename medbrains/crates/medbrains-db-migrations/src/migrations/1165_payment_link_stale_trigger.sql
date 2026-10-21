-- ====================================================================
-- Migration: 1165_payment_link_stale_trigger.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A live payment link (#4871) must never ask for more than its bills still
-- owe. Whatever moves a bill's balance — cash at the counter, a concession,
-- a refund, a cancelled bill — moves it on `invoices`, so the check lives
-- there: when a live link now asks for more than its bills owe, queue
-- `payment.balance_link.refresh` once for it. The outbox handler cancels the
-- link at the provider and, if anything is still owed, sends a new one.
--
-- A link's own parts are counted on the link before they post, so paying a
-- link never makes it look stale.

CREATE OR REPLACE FUNCTION public.payment_link_queue_if_stale(p_link uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.outbox_events
        (tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key)
    SELECT l.tenant_id, 'payment_link', l.id, 'payment.balance_link.refresh',
           jsonb_build_object('link_id', l.id), 'refresh:' || l.id::text
      FROM public.payment_links l
     WHERE l.id = p_link
       AND l.status IN ('created', 'partially_paid')
       AND l.deleted_at IS NULL
       AND l.amount - l.amount_paid > (
           SELECT COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)
             FROM public.invoices i
            WHERE i.tenant_id = l.tenant_id AND i.id = ANY (l.invoice_ids)
              AND i.deleted_at IS NULL AND i.status IN ('issued', 'partially_paid'))
    ON CONFLICT (tenant_id, event_type, idempotency_key)
        WHERE idempotency_key IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_links_after_invoice_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.payment_link_queue_if_stale(l.id)
       FROM public.payment_links l
      WHERE l.tenant_id = NEW.tenant_id
        AND l.invoice_ids @> ARRAY[NEW.id]
        AND l.status IN ('created', 'partially_paid')
        AND l.deleted_at IS NULL;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoices_payment_link_stale
    AFTER UPDATE OF total_amount, paid_amount, status ON public.invoices
    FOR EACH ROW
    WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount
          OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount
          OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.payment_links_after_invoice_change();
