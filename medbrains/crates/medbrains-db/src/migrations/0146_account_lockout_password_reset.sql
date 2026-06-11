-- Account lockout + self-service password reset (audit P0 #6/#7).
-- phone: needed for SMS OTP delivery (also used by on-call alert routing later).

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone;

CREATE TABLE public.password_reset_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_password_reset_otps_user
    ON public.password_reset_otps (user_id, created_at DESC);

SELECT apply_tenant_rls('public.password_reset_otps');
