-- TOTP MFA (audit P0 #5 — HIPAA/NIST authentication for staff).
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS mfa_secret text,
    ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS mfa_recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
