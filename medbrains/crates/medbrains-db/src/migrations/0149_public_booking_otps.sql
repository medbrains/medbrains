-- Phone verification for public appointment booking (audit P1):
-- name+phone matching alone can book into the wrong patient record.
CREATE TABLE public.public_booking_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_public_booking_otps_phone
    ON public.public_booking_otps (tenant_id, phone, created_at DESC);

SELECT apply_tenant_rls('public.public_booking_otps');
