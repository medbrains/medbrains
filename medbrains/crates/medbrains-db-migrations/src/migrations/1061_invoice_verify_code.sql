-- ====================================================================
-- Migration: 1061_invoice_verify_code.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A printed bill carries a QR that anyone can scan to check it is genuine:
-- the invoice number alone would let a stranger walk the sequence, so the
-- link also carries this per-invoice code, which only the printed bill has.
-- Every existing invoice gets its own (a volatile default fills each row).

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS verify_code text NOT NULL DEFAULT encode(gen_random_bytes(9), 'hex');

-- Looked up only by (invoice_number, verify_code); never listed.
CREATE OR REPLACE FUNCTION public.app_verify_invoice(p_number text, p_code text)
RETURNS TABLE (
    hospital_name  text,
    invoice_number text,
    invoice_date   date,
    total_amount   numeric,
    paid_amount    numeric,
    status         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT t.name, i.invoice_number, COALESCE(i.issued_at, i.created_at)::date,
           i.total_amount, i.paid_amount, i.status::text
      FROM public.invoices i
      JOIN public.tenants t ON t.id = i.tenant_id
     WHERE i.invoice_number = p_number
       AND i.verify_code = p_code
       AND i.deleted_at IS NULL
     LIMIT 1;
$$;

COMMENT ON FUNCTION public.app_verify_invoice(text, text) IS
    'Public bill check: confirms an invoice by its number and the code printed '
    'on it. Returns no patient detail. Runs without a tenant: the code is the key.';
