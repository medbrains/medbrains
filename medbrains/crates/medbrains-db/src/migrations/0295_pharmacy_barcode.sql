-- Pack barcode for pharmacy stock, so a phone can identify a product.
--
-- Nothing in the pharmacy tables carried a barcode, which meant a storekeeper
-- receiving stock, or a pharmacist checking a strip against a prescription, had
-- to read the product name off the pack and find it in a list. That is slow at
-- a counter and it is how a look-alike drug gets picked.
--
-- The barcode belongs on the CATALOG item, not the batch. An Indian pharma pack
-- carries a GTIN/EAN-13 identifying the PRODUCT; batch number and expiry are
-- printed as human-readable text beside it, not encoded in that same symbol.
-- So scanning tells you WHICH DRUG, and batch/expiry stay captured per batch as
-- they already are.
--
-- Nullable, because most of a live catalogue will have no barcode recorded on
-- day one and a NOT NULL here would block every existing row.

ALTER TABLE public.pharmacy_catalog
    ADD COLUMN IF NOT EXISTS barcode text;

-- Two packs of the same product share a GTIN, so uniqueness is per tenant and
-- per code, not global. Partial, because "no barcode recorded" is the common
-- case and many nulls must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_catalog_barcode
    ON public.pharmacy_catalog (tenant_id, barcode)
    WHERE barcode IS NOT NULL;

COMMENT ON COLUMN public.pharmacy_catalog.barcode IS
    'GTIN/EAN-13 or other pack barcode identifying the product. Batch and expiry are not encoded here — they live on pharmacy_batches.';
