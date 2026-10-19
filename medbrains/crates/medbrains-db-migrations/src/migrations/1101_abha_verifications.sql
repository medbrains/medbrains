-- ====================================================================
-- Migration: 1101_abha_verifications.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: abha_verifications
-- Drops: none
-- ====================================================================
-- One row per "Verify ABHA" attempt at the desk: the OTP sent, the account
-- chosen, the profile ABDM returned. A patient's ABHA link is marked verified
-- only by pointing at a verified row for the same ABHA number — the browser
-- saying "verified" proves nothing.
--
-- Not stored, by design: the Aadhaar number (never asked for here), the OTP,
-- ABDM's person tokens (kept in server memory for the few minutes they live)
-- and the ABHA photo (shown to staff to confirm the person, then dropped).
-- `login_id_cipher` is the ABHA number or mobile encrypted to ABDM's public
-- key, kept only so "Resend OTP" works; nobody here can decrypt it.

CREATE TABLE public.abha_verifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    created_by uuid NOT NULL REFERENCES public.users(id),
    method text NOT NULL CHECK (method IN ('abha_number', 'mobile')),
    otp_system text NOT NULL CHECK (otp_system IN ('aadhaar', 'abdm')),
    environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
    login_id_cipher text NOT NULL,
    abdm_txn_id text NOT NULL,
    stage text NOT NULL DEFAULT 'otp_sent'
        CHECK (stage IN ('otp_sent', 'choose_account', 'verified')),
    otp_sent_at timestamptz NOT NULL DEFAULT now(),
    otp_attempts integer NOT NULL DEFAULT 0,
    accounts jsonb,
    abha_number text,
    abha_address text,
    profile jsonb,
    verified_at timestamptz,
    linked_patient_id uuid REFERENCES public.patients(id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text,
    CHECK (stage <> 'verified' OR (abha_number IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE INDEX idx_abha_verifications_number ON public.abha_verifications (tenant_id, abha_number)
    WHERE deleted_at IS NULL AND stage = 'verified';

ALTER TABLE public.abha_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abha_verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_abha_verifications ON public.abha_verifications
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_abha_verifications BEFORE UPDATE ON public.abha_verifications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_abha_verifications_soft_delete BEFORE DELETE ON public.abha_verifications
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Who confirmed the link against ABDM, how, and when. `kyc_verified` alone
-- could not say whether a person or a typo set it. KYC is a status checked at
-- a time, not a one-off flag: ABDM's incentive scheme counts a linked record
-- only if the ABHA is KYC-verified on the last day of the month.
ALTER TABLE public.patient_abha_links
    ADD COLUMN verified_at timestamptz,
    ADD COLUMN verified_by uuid REFERENCES public.users(id),
    ADD COLUMN verification_id uuid REFERENCES public.abha_verifications(id),
    ADD COLUMN verification_method text
        CHECK (verification_method IN ('abha_aadhaar_otp', 'abha_mobile_otp', 'mobile_otp')),
    ADD COLUMN kyc_status text,
    ADD COLUMN kyc_checked_at timestamptz;
