-- Migration: 0174_verbal_orders.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters prescriptions, already tenant-policied.
-- Verbal / telephone order transcription. A nurse may take a doctor's verbal
-- or telephone order and transcribe it into a prescription; the doctor must
-- countersign within policy. Read-back is mandatory for verbal/telephone
-- orders (NABH/JCI medication-safety). doctor_id stays the *prescribing*
-- doctor; transcribed_by records the nurse who wrote it down.

ALTER TABLE public.prescriptions
    ADD COLUMN IF NOT EXISTS order_mode text NOT NULL DEFAULT 'written',
    ADD COLUMN IF NOT EXISTS transcribed_by uuid,
    ADD COLUMN IF NOT EXISTS read_back_confirmed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS countersign_due_at timestamptz;

ALTER TABLE public.prescriptions
    DROP CONSTRAINT IF EXISTS prescriptions_order_mode_check;
ALTER TABLE public.prescriptions
    ADD CONSTRAINT prescriptions_order_mode_check
    CHECK (order_mode = ANY (ARRAY['written'::text, 'verbal'::text, 'telephone'::text]));

-- Find verbal/telephone orders still awaiting countersignature.
CREATE INDEX IF NOT EXISTS idx_prescriptions_pending_countersign
    ON public.prescriptions (tenant_id, doctor_id, countersign_due_at)
    WHERE order_mode <> 'written' AND NOT is_signed;
