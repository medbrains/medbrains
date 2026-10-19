-- ====================================================================
-- Migration: 1138_grn_posting_and_invoice_dedupe.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: goods_receipts
-- ====================================================================
-- Purchase receiving (#4861). A GRN is a D&C Rule 65 purchase record, so:
--
-- * Stock moves when the GRN is posted (completed), never while it is a
--   draft. `posted_at` is the once-only marker: every GRN that exists before
--   this migration already moved its stock when it was created, so all of
--   them are stamped posted here and completing them never moves stock twice.
-- * The same supplier invoice cannot be entered twice: one live GRN per
--   (tenant, supplier, normalised invoice number, invoice date), and one per
--   e-invoice IRN. Duplicates already in the table are kept, flagged
--   `legacy_duplicate`, and left out of the index; they are history.
-- * A line carries what an Indian stockist bill carries: MRP, free (scheme)
--   quantity, discount, GST rate, HSN, PTR. Posting carries MRP onto the
--   pharmacy batch, because MRP is per batch (DPCO revisions change labels).
-- * Each line keeps the batch_stock row it created, so two batches of one
--   item on one bill no longer overwrite each other's link.
--
-- `goods_receipts` had no writer anywhere (web, 16 mobile, 14 TV, kiosk,
-- desktop, server) and its one reader, the vendor ledger, selected columns it
-- never had. The ledger now reads goods_receipt_notes; the table goes.

-- Normalised supplier invoice number: upper case, leading zeros of the last
-- numeric group dropped, then spaces, '/', '-' and '.' removed — so
-- "inv/24-25/0045" and "INV 24-25 45" are the same bill.
CREATE OR REPLACE FUNCTION public.grn_invoice_no_norm(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT NULLIF(
        regexp_replace(
            regexp_replace(upper(btrim(raw)), '(^|[^0-9])0+([0-9]+)$', '\1\2'),
            '[[:space:]/.\-]', '', 'g'),
        '')
$$;

ALTER TABLE public.goods_receipt_notes
    ADD COLUMN IF NOT EXISTS irn text
        CHECK (irn IS NULL OR irn ~ '^[0-9a-f]{64}$'),
    ADD COLUMN IF NOT EXISTS posted_at timestamptz,
    ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS legacy_duplicate boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS invoice_no_norm text
        GENERATED ALWAYS AS (public.grn_invoice_no_norm(invoice_number)) STORED;

-- Every GRN written before this release moved its stock at creation.
UPDATE public.goods_receipt_notes
   SET posted_at = created_at, posted_by = received_by
 WHERE posted_at IS NULL;

UPDATE public.goods_receipt_notes g
   SET legacy_duplicate = true
 WHERE g.deleted_at IS NULL
   AND g.invoice_no_norm IS NOT NULL
   AND EXISTS (
        SELECT 1 FROM public.goods_receipt_notes o
         WHERE o.tenant_id = g.tenant_id
           AND o.vendor_id = g.vendor_id
           AND o.invoice_no_norm = g.invoice_no_norm
           AND o.invoice_date IS NOT DISTINCT FROM g.invoice_date
           AND o.deleted_at IS NULL
           AND (o.created_at, o.id) < (g.created_at, g.id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_supplier_invoice
    ON public.goods_receipt_notes (tenant_id, vendor_id, invoice_no_norm, invoice_date)
    NULLS NOT DISTINCT
    WHERE deleted_at IS NULL AND invoice_no_norm IS NOT NULL AND NOT legacy_duplicate;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_irn
    ON public.goods_receipt_notes (tenant_id, irn)
    WHERE deleted_at IS NULL AND irn IS NOT NULL;

ALTER TABLE public.grn_items
    ADD COLUMN IF NOT EXISTS mrp numeric(12,2) CHECK (mrp IS NULL OR mrp >= 0),
    ADD COLUMN IF NOT EXISTS ptr numeric(14,2) CHECK (ptr IS NULL OR ptr >= 0),
    ADD COLUMN IF NOT EXISTS free_quantity integer NOT NULL DEFAULT 0
        CHECK (free_quantity >= 0),
    ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),
    ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2)
        CHECK (gst_rate IS NULL OR gst_rate BETWEEN 0 AND 40),
    ADD COLUMN IF NOT EXISTS hsn_code text
        CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{4,8}$'),
    ADD COLUMN IF NOT EXISTS batch_stock_id uuid REFERENCES public.batch_stock(id);

-- MRP is per batch. The storefront work may add the same column; either
-- order of the two migrations leaves one column.
ALTER TABLE public.pharmacy_batches
    ADD COLUMN IF NOT EXISTS mrp numeric(12,2) CHECK (mrp IS NULL OR mrp >= 0);

CREATE INDEX IF NOT EXISTS idx_pharmacy_batches_grn_item
    ON public.pharmacy_batches (grn_item_id) WHERE grn_item_id IS NOT NULL;

DROP TABLE IF EXISTS public.goods_receipts;
