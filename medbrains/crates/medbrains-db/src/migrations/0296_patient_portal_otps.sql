-- One-time codes that let a patient into their own record.
--
-- Deliberately NOT the public_booking_otps table. That code is sent to somebody
-- asking for an appointment slot; this one unlocks a person's bills, results
-- and prescriptions. Sharing one table would mean a code issued for the smaller
-- purpose grants the larger one, which is how a booking form becomes a way into
-- a stranger's chart. Different purpose, different credential.
--
-- Mirrors the booking-OTP shape otherwise: hashed, single-use, short-lived.
-- The plaintext code is never stored.

CREATE TABLE IF NOT EXISTS public.patient_portal_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    -- Counts verification attempts so a six-digit code cannot be brute-forced
    -- in the ten minutes it is alive.
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_portal_otps_pkey PRIMARY KEY (id)
);

-- The verify path looks up the live code for a phone; nothing else is queried.
CREATE INDEX IF NOT EXISTS idx_patient_portal_otps_live
    ON public.patient_portal_otps (tenant_id, phone, expires_at)
    WHERE used_at IS NULL;

ALTER TABLE public.patient_portal_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_portal_otps_tenant_isolation ON public.patient_portal_otps;
CREATE POLICY patient_portal_otps_tenant_isolation ON public.patient_portal_otps
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

COMMENT ON TABLE public.patient_portal_otps IS
    'Single-use SMS codes for patient portal sign-in. Separate from public_booking_otps on purpose: a booking code must not unlock a full record.';
