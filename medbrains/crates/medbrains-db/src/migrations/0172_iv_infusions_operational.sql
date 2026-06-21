-- Promote iv_fluid_orders from a print-only stub to an operational infusion
-- record: structured rate, IV site, pump, lifecycle timestamps, and a real
-- status machine (ordered → running ⇄ paused → completed / discontinued).
-- Intake/output + fluid balance already live in ipd_intake_output; this layer
-- is just the running-infusion lifecycle the bedside nurse manages.

ALTER TABLE public.iv_fluid_orders
    ADD COLUMN IF NOT EXISTS rate_ml_per_hr numeric(10, 2),
    ADD COLUMN IF NOT EXISTS site text,
    ADD COLUMN IF NOT EXISTS pump_serial text,
    ADD COLUMN IF NOT EXISTS ordered_by uuid,
    ADD COLUMN IF NOT EXISTS started_at timestamptz,
    ADD COLUMN IF NOT EXISTS planned_end_time timestamptz,
    ADD COLUMN IF NOT EXISTS actual_end_time timestamptz,
    ADD COLUMN IF NOT EXISTS discontinued_reason text,
    ADD COLUMN IF NOT EXISTS discontinued_by uuid,
    ADD COLUMN IF NOT EXISTS discontinued_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Normalise any legacy 'active' rows to the new vocabulary.
UPDATE public.iv_fluid_orders SET status = 'running' WHERE status = 'active';

ALTER TABLE public.iv_fluid_orders ALTER COLUMN status SET DEFAULT 'ordered';

ALTER TABLE public.iv_fluid_orders DROP CONSTRAINT IF EXISTS iv_fluid_orders_status_check;
ALTER TABLE public.iv_fluid_orders
    ADD CONSTRAINT iv_fluid_orders_status_check
    CHECK (status = ANY (ARRAY[
        'ordered'::text,
        'running'::text,
        'paused'::text,
        'completed'::text,
        'discontinued'::text
    ]));

CREATE INDEX IF NOT EXISTS idx_iv_fluid_orders_admission
    ON public.iv_fluid_orders (tenant_id, admission_id, status);
