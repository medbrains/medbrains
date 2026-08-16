-- RLS-Posture: tenant-scoped
-- Keep camp billing financially traceable when camp services or medicines are
-- free, partially sponsored, discounted, or taxable.

ALTER TABLE public.camp_billing_records
    ADD COLUMN IF NOT EXISTS tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS sponsor_covered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS source_module text,
    ADD COLUMN IF NOT EXISTS source_entity_id uuid;

UPDATE public.camp_billing_records
SET total_amount = charged_amount
WHERE total_amount = 0
  AND charged_amount > 0;

CREATE INDEX IF NOT EXISTS idx_camp_billing_records_source
    ON public.camp_billing_records (tenant_id, source_module, source_entity_id)
    WHERE source_module IS NOT NULL AND source_entity_id IS NOT NULL;
