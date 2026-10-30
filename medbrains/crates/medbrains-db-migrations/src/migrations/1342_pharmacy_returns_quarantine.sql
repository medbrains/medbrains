-- ====================================================================
-- Migration: 1342_pharmacy_returns_quarantine.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_store_returns, pharmacy_store_return_lines,
--             pharmacy_return_quarantine, pharmacy_store_refunds
-- Drops: none
-- ====================================================================
-- Returns, by law (docs/compliance/pharmacy-returns.md; owner decision 5):
--   * A returned pack goes back to stock only when sealed, in date above the
--     shelf-life floor, not cold-chain, not controlled, its batch traceable,
--     and inside the return window. Everything else is quarantined.
--   * Quarantine ends in destruction with a record: biomedical waste (BMW
--     Rules 2016, Schedule I, Yellow (d)) handed to an authorised CBMWTF, or
--     for a controlled drug the NDPS register with a witness.
--   * Online returns (7 days; wrong, damaged, short-dated or excess) are a
--     grievance: acknowledged in 48 hours, resolved in 30 days (Consumer
--     Protection (E-Commerce) Rules 2020).
--   * Refunds go back the way the patient paid, once: one refund per cause,
--     keyed so a retry finds the first.
-- Counter returns use the same quarantine: an expired batch's return used to
-- be added back to that batch's stock.

CREATE TABLE IF NOT EXISTS public.pharmacy_store_returns (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
    store_order_id  uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    patient_id      uuid NOT NULL REFERENCES public.patients(id),
    reason          text NOT NULL CHECK (reason IN ('wrong_item', 'damaged', 'short_dated', 'excess')),
    note            text,
    status          text NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'acknowledged', 'received', 'refused')),
    -- The grievance ticket, in the hospital's complaints register.
    complaint_id    uuid REFERENCES public.comm_complaints(id),
    ack_due_at      timestamptz NOT NULL,
    resolve_due_at  timestamptz NOT NULL,
    acknowledged_at timestamptz,
    acknowledged_by uuid REFERENCES public.users(id),
    resolved_at     timestamptz,
    resolved_by     uuid REFERENCES public.users(id),
    resolution_note text,
    -- GST credit note for what was taken back (CGST Act s.34).
    credit_note_number text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    deleted_by      uuid,
    delete_reason   text
);
-- One open return per order at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_returns_open
    ON public.pharmacy_store_returns (store_order_id)
    WHERE status IN ('requested', 'acknowledged') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_returns_queue
    ON public.pharmacy_store_returns (tenant_id, status, ack_due_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_store_return_lines (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES public.tenants(id),
    return_id              uuid NOT NULL REFERENCES public.pharmacy_store_returns(id),
    catalog_item_id        uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    drug_name              text NOT NULL,
    quantity               integer NOT NULL CHECK (quantity > 0),
    unit_price             numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    pharmacy_order_item_id uuid REFERENCES public.pharmacy_order_items(id),
    batch_id               uuid REFERENCES public.pharmacy_batches(id),
    -- As the pharmacist found it on receipt.
    sealed                 boolean,
    disposition            text CHECK (disposition IN ('restocked', 'quarantined')),
    reasons                text[] NOT NULL DEFAULT '{}',
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    deleted_at             timestamptz,
    deleted_by             uuid,
    delete_reason          text
);
CREATE INDEX IF NOT EXISTS idx_store_return_lines_return
    ON public.pharmacy_store_return_lines (tenant_id, return_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_return_quarantine (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES public.tenants(id),
    source               text NOT NULL CHECK (source IN ('online', 'counter')),
    store_return_line_id uuid REFERENCES public.pharmacy_store_return_lines(id),
    pos_sale_item_id     uuid REFERENCES public.pharmacy_pos_sale_items(id),
    catalog_item_id      uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    drug_name            text NOT NULL,
    batch_id             uuid REFERENCES public.pharmacy_batches(id),
    batch_number         text,
    expiry_date          date,
    quantity             integer NOT NULL CHECK (quantity > 0),
    reasons              text[] NOT NULL CHECK (cardinality(reasons) > 0),
    -- 'bmw' (Yellow (d), via a CBMWTF) or 'ndps' (register + witness).
    route                text NOT NULL CHECK (route IN ('bmw', 'ndps')),
    status               text NOT NULL DEFAULT 'quarantined'
        CHECK (status IN ('quarantined', 'destroyed')),
    destruction_id       uuid REFERENCES public.pharmacy_destruction_log(id),
    quarantined_by       uuid REFERENCES public.users(id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz,
    deleted_by           uuid,
    delete_reason        text,
    CONSTRAINT quarantine_has_source CHECK (
        (source = 'online' AND store_return_line_id IS NOT NULL)
        OR (source = 'counter' AND pos_sale_item_id IS NOT NULL)),
    CONSTRAINT quarantine_destroyed_on_record CHECK (
        (status = 'destroyed') = (destruction_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_return_quarantine_open
    ON public.pharmacy_return_quarantine (tenant_id, created_at)
    WHERE status = 'quarantined' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pharmacy_store_refunds (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id),
    store_order_id   uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    store_return_id  uuid REFERENCES public.pharmacy_store_returns(id),
    cause            text NOT NULL CHECK (cause IN ('cancelled', 'returned')),
    amount           numeric(12,2) NOT NULL CHECK (amount > 0),
    -- Back the way it was paid: the online payment, or cash at the pharmacy.
    method           text NOT NULL CHECK (method IN ('online', 'cash')),
    payment_txn_id   uuid REFERENCES public.payment_gateway_transactions(id),
    invoice_id       uuid REFERENCES public.invoices(id),
    idempotency_key  text NOT NULL,
    status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued')),
    -- Initiated within 24 hours (research brief §7).
    due_by           timestamptz NOT NULL,
    refund_reference text,
    issued_by        uuid REFERENCES public.users(id),
    issued_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz,
    deleted_by       uuid,
    delete_reason    text,
    CONSTRAINT store_refunds_online_named CHECK (method <> 'online' OR payment_txn_id IS NOT NULL),
    CONSTRAINT store_refunds_once UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_store_refunds_pending
    ON public.pharmacy_store_refunds (tenant_id, due_by)
    WHERE status = 'pending' AND deleted_at IS NULL;

-- The destruction register, with what BMW Rules 2016 need on the record.
ALTER TABLE public.pharmacy_destruction_log
    ADD COLUMN IF NOT EXISTS bmw_category text,
    ADD COLUMN IF NOT EXISTS bmw_bag_colour text,
    ADD COLUMN IF NOT EXISTS cbmwtf_name text,
    ADD COLUMN IF NOT EXISTS cbmwtf_manifest_number text,
    ADD COLUMN IF NOT EXISTS route text CHECK (route IS NULL OR route IN ('bmw', 'ndps'));

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pharmacy_store_returns', 'pharmacy_store_return_lines',
                             'pharmacy_return_quarantine', 'pharmacy_store_refunds'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_soft_delete ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_soft_delete BEFORE DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION audit_trigger_func(''pharmacy'')', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_%1$s ON public.%1$I '
                       'USING (tenant_id = ANY (app_visible_tenants())) '
                       'WITH CHECK (tenant_id = ANY (app_visible_tenants()))', t);
    END LOOP;
END $$;
