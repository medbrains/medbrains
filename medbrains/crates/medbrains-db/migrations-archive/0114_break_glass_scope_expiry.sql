-- Break-glass must be a scoped, time-boxed exception with review evidence.
-- This migration keeps old rows readable while making new sessions explicit.

ALTER TABLE public.break_glass_events
    ADD COLUMN IF NOT EXISTS scope_type text DEFAULT 'patient'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS scope_id uuid,
    ADD COLUMN IF NOT EXISTS requested_modules text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS phi_access_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS last_phi_accessed_at timestamp with time zone;

UPDATE public.break_glass_events
SET
    scope_type = CASE
        WHEN patient_id IS NULL THEN 'emergency_context'
        ELSE 'patient'
    END,
    scope_id = COALESCE(scope_id, patient_id, id),
    expires_at = COALESCE(expires_at, start_time + interval '4 hours'),
    requested_modules = COALESCE(requested_modules, '{}'::text[]),
    phi_access_count = COALESCE(phi_access_count, 0)
WHERE expires_at IS NULL
   OR scope_id IS NULL
   OR requested_modules IS NULL;

ALTER TABLE public.break_glass_events
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '4 hours'),
    ALTER COLUMN expires_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'break_glass_scope_type_check'
    ) THEN
        ALTER TABLE public.break_glass_events
            ADD CONSTRAINT break_glass_scope_type_check
            CHECK (scope_type IN ('patient', 'emergency_context'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'break_glass_patient_scope_check'
    ) THEN
        ALTER TABLE public.break_glass_events
            ADD CONSTRAINT break_glass_patient_scope_check
            CHECK (
                (scope_type = 'patient' AND patient_id IS NOT NULL AND scope_id = patient_id)
                OR (scope_type = 'emergency_context' AND scope_id IS NOT NULL)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'break_glass_reason_not_blank_check'
    ) THEN
        ALTER TABLE public.break_glass_events
            ADD CONSTRAINT break_glass_reason_not_blank_check
            CHECK (length(trim(reason)) >= 5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'break_glass_expiry_window_check'
    ) THEN
        ALTER TABLE public.break_glass_events
            ADD CONSTRAINT break_glass_expiry_window_check
            CHECK (expires_at > start_time AND expires_at <= start_time + interval '4 hours');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_break_glass_user_expiry
    ON public.break_glass_events (tenant_id, user_id, expires_at)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_break_glass_patient_scope
    ON public.break_glass_events (tenant_id, patient_id, expires_at)
    WHERE scope_type = 'patient';
