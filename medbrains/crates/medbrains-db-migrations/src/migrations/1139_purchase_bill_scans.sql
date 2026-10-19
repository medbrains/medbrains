-- ====================================================================
-- Migration: 1139_purchase_bill_scans.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: purchase_bill_scans, grn_scan_corrections, supplier_item_aliases
-- Drops: none
-- ====================================================================
-- Scan a supplier bill into a draft GRN (#4861). The case-sheet scan pattern
-- (upload → parsing → worker posts a draft → human review → commit) with its
-- four weaknesses fixed:
--   (a) the worker holds its own machine permission, procurement.grn.scan_worker;
--   (b) a worker claims a scan under a lease (claimed_by / claimed_until,
--       FOR UPDATE SKIP LOCKED), so two workers never read the same bill;
--   (c) extracted_json is what the reader produced and is never overwritten —
--       the reviewer edits draft_json, and every changed field is kept in
--       grn_scan_corrections as (field, original, final, confidence, user);
--   (d) the worker contract is the parse-result payload, documented in
--       crates/medbrains-materials/src/grn_scan_contract.rs.
-- Extraction is only ever a draft: field accuracy on scanned invoices is
-- ~82-93% at best, so nothing posts stock until a person commits.

CREATE TABLE public.purchase_bill_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    vendor_id uuid REFERENCES public.vendors(id),
    po_id uuid REFERENCES public.purchase_orders(id),
    store_location_id uuid REFERENCES public.store_locations(id),
    file_key text NOT NULL,
    file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
    mime_type text,
    status text NOT NULL DEFAULT 'uploaded' CHECK (status IN
        ('uploaded', 'parsing', 'parsed', 'reviewing', 'committed', 'failed', 'discarded')),
    claimed_by uuid REFERENCES public.users(id),
    claimed_until timestamptz,
    worker text,
    extracted_json jsonb,
    overall_confidence numeric(5,4)
        CHECK (overall_confidence IS NULL OR overall_confidence BETWEEN 0 AND 1),
    parse_error text,
    einvoice jsonb,
    irn text CHECK (irn IS NULL OR irn ~ '^[0-9a-f]{64}$'),
    draft_json jsonb,
    grn_id uuid REFERENCES public.goods_receipt_notes(id),
    fields_total integer,
    fields_corrected integer,
    lines_total integer,
    lines_auto_matched integer,
    lines_rematched integer,
    uploaded_by uuid NOT NULL REFERENCES public.users(id),
    committed_by uuid REFERENCES public.users(id),
    committed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

-- The same file uploaded twice is the same bill.
CREATE UNIQUE INDEX uq_purchase_bill_scans_file
    ON public.purchase_bill_scans (tenant_id, file_sha256)
    WHERE deleted_at IS NULL AND status <> 'discarded';
-- The worker's queue.
CREATE INDEX idx_purchase_bill_scans_queue
    ON public.purchase_bill_scans (status, created_at)
    WHERE status = 'parsing' AND deleted_at IS NULL;
CREATE INDEX idx_purchase_bill_scans_tenant
    ON public.purchase_bill_scans (tenant_id, created_at DESC);
CREATE INDEX idx_purchase_bill_scans_vendor
    ON public.purchase_bill_scans (tenant_id, vendor_id) WHERE status = 'committed';

ALTER TABLE public.purchase_bill_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bill_scans FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_bill_scans_tenant ON public.purchase_bill_scans
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_purchase_bill_scans_updated_at BEFORE UPDATE ON public.purchase_bill_scans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_purchase_bill_scans_soft_delete BEFORE DELETE ON public.purchase_bill_scans
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Original vs final, one row per field a reviewer changed. Per-supplier
-- accuracy is read from here and from the scan's field counts.
CREATE TABLE public.grn_scan_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    scan_id uuid NOT NULL REFERENCES public.purchase_bill_scans(id),
    vendor_id uuid REFERENCES public.vendors(id),
    field_path text NOT NULL,
    original_value text,
    final_value text,
    confidence numeric(5,4),
    corrected_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_grn_scan_corrections_scan ON public.grn_scan_corrections (scan_id);
CREATE INDEX idx_grn_scan_corrections_vendor
    ON public.grn_scan_corrections (tenant_id, vendor_id);

ALTER TABLE public.grn_scan_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_scan_corrections FORCE ROW LEVEL SECURITY;
CREATE POLICY grn_scan_corrections_tenant ON public.grn_scan_corrections
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_grn_scan_corrections_updated_at BEFORE UPDATE ON public.grn_scan_corrections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_grn_scan_corrections_soft_delete BEFORE DELETE ON public.grn_scan_corrections
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- A supplier's product name, normalised: lower case, runs of anything that
-- is not a letter or digit collapsed to one space.
CREATE OR REPLACE FUNCTION public.supplier_item_name_norm(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT NULLIF(btrim(regexp_replace(lower(raw), '[^a-z0-9]+', ' ', 'g')), '')
$$;

-- "Map once" (GoFrugal / MocDoc pattern): what a supplier calls an item,
-- remembered when a reviewer confirms the match. Only a confirmed alias ever
-- fills a line by itself; a fuzzy suggestion never does.
CREATE TABLE public.supplier_item_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    vendor_id uuid NOT NULL REFERENCES public.vendors(id),
    supplier_name_norm text NOT NULL,
    supplier_code text,
    catalog_item_id uuid NOT NULL REFERENCES public.store_catalog(id),
    times_used integer NOT NULL DEFAULT 1 CHECK (times_used >= 0),
    confirmed_by uuid NOT NULL REFERENCES public.users(id),
    last_used_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_supplier_item_aliases
    ON public.supplier_item_aliases (tenant_id, vendor_id, supplier_name_norm)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_item_aliases_item
    ON public.supplier_item_aliases (catalog_item_id);

ALTER TABLE public.supplier_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_item_aliases FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_item_aliases_tenant ON public.supplier_item_aliases
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_supplier_item_aliases_updated_at BEFORE UPDATE ON public.supplier_item_aliases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_supplier_item_aliases_soft_delete BEFORE DELETE ON public.supplier_item_aliases
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Fuzzy item matching reads the catalogue by trigram.
CREATE INDEX IF NOT EXISTS idx_store_catalog_name_trgm
    ON public.store_catalog USING gin (lower(name) gin_trgm_ops)
    WHERE deleted_at IS NULL;
