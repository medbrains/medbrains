-- Migration: 0181_document_ingestion.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Reverse print / document ingestion. Printing is digital → paper
-- (print_case_sheet_packet). This is the reverse: scanned paper is uploaded,
-- barcode-linked back to its MRD record (or case-sheet packet), optionally
-- OCR'd, and filed — so the record round-trips both ways. Bulk-friendly via
-- batches. The extracted_text column is populated by an OCR worker or manually
-- (the OCR engine itself is a pluggable follow-up).

CREATE TABLE IF NOT EXISTS public.document_ingestion_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    label text NOT NULL,
    status text NOT NULL DEFAULT 'open',     -- open | closed
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_ingestion_batches_status_check
        CHECK (status = ANY (ARRAY['open'::text, 'closed'::text]))
);

ALTER TABLE public.document_ingestion_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_document_ingestion_batches ON public.document_ingestion_batches;
CREATE POLICY tenant_isolation_document_ingestion_batches ON public.document_ingestion_batches
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE TABLE IF NOT EXISTS public.document_ingestion_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    file_url text NOT NULL,
    original_filename text NOT NULL,
    mime_type text,
    barcode text,
    linked_medical_record_id uuid,
    linked_packet_id uuid,
    extracted_text text,
    status text NOT NULL DEFAULT 'uploaded',  -- uploaded | linked | filed
    notes text,
    uploaded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_ingestion_items_status_check
        CHECK (status = ANY (ARRAY['uploaded'::text, 'linked'::text, 'filed'::text]))
);

ALTER TABLE public.document_ingestion_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_document_ingestion_items ON public.document_ingestion_items;
CREATE POLICY tenant_isolation_document_ingestion_items ON public.document_ingestion_items
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE INDEX IF NOT EXISTS idx_document_ingestion_items_batch
    ON public.document_ingestion_items USING btree (tenant_id, batch_id, created_at DESC);
