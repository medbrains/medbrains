-- Bulk formulary import needs an idempotent upsert target (audit P1
-- onboarding blocker). Older duplicate codes are deactivated (never
-- deleted — dispense history may reference them), then active rows get
-- a partial unique index.
UPDATE public.pharmacy_catalog a
SET is_active = false
WHERE a.is_active
  AND EXISTS (
    SELECT 1 FROM public.pharmacy_catalog b
    WHERE b.tenant_id = a.tenant_id
      AND b.code = a.code
      AND b.is_active
      AND (b.created_at, b.id) > (a.created_at, a.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_catalog_tenant_code_active
    ON public.pharmacy_catalog (tenant_id, code)
    WHERE is_active;
