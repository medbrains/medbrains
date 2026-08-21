-- RLS-Posture: tenant-scoped
-- Add is_dummy flag to root clinical activity tables so simulated/training
-- records generated for internal testing are clearly separable from live
-- production records. Default FALSE keeps existing rows live. Filtering is
-- applied at the application layer (lists, dashboards, reports), not via RLS,
-- so super_admin and QA can still inspect dummy rows when needed.

ALTER TABLE public.encounters
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.admissions
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.er_visits
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.lab_orders
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.radiology_orders
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.pharmacy_orders
    ADD COLUMN IF NOT EXISTS is_dummy boolean NOT NULL DEFAULT false;

-- Partial indexes so the common "real records only" path is index-only.
CREATE INDEX IF NOT EXISTS idx_encounters_live
    ON public.encounters (tenant_id, patient_id)
    WHERE is_dummy = false;
CREATE INDEX IF NOT EXISTS idx_admissions_live
    ON public.admissions (tenant_id, patient_id)
    WHERE is_dummy = false;
CREATE INDEX IF NOT EXISTS idx_er_visits_live
    ON public.er_visits (tenant_id, patient_id)
    WHERE is_dummy = false;
CREATE INDEX IF NOT EXISTS idx_lab_orders_live
    ON public.lab_orders (tenant_id, patient_id)
    WHERE is_dummy = false;
CREATE INDEX IF NOT EXISTS idx_radiology_orders_live
    ON public.radiology_orders (tenant_id, patient_id)
    WHERE is_dummy = false;
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_live
    ON public.pharmacy_orders (tenant_id, patient_id)
    WHERE is_dummy = false;
