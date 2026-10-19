-- ====================================================================
-- Migration: 1102_abha_enrolment.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- "Create ABHA" at the desk uses the same record as "Verify ABHA": it ends
-- verified, and registration links it the same way. Creation by Aadhaar OTP
-- adds two stages — a second OTP when the person wants a mobile other than
-- their Aadhaar-linked one, and choosing an ABHA address.
--
-- The Aadhaar number is never stored, not even encrypted to ABDM:
-- `login_id_cipher` stays empty for these rows and "send again" means typing
-- it again. `created_here` counts the ABHAs this hospital created, which
-- management reports on.

ALTER TABLE public.abha_verifications
    DROP CONSTRAINT abha_verifications_method_check,
    ADD CONSTRAINT abha_verifications_method_check
        CHECK (method IN ('abha_number', 'mobile', 'aadhaar_enrol')),
    DROP CONSTRAINT abha_verifications_stage_check,
    ADD CONSTRAINT abha_verifications_stage_check
        CHECK (stage IN ('otp_sent', 'mobile_otp_sent', 'choose_account', 'choose_address', 'verified')),
    ALTER COLUMN login_id_cipher DROP NOT NULL,
    ADD COLUMN created_here boolean NOT NULL DEFAULT false,
    ADD COLUMN abha_mobile text;

ALTER TABLE public.patient_abha_links
    DROP CONSTRAINT patient_abha_links_verification_method_check,
    ADD CONSTRAINT patient_abha_links_verification_method_check
        CHECK (verification_method IN
            ('abha_aadhaar_otp', 'abha_mobile_otp', 'mobile_otp', 'created_aadhaar_otp'));
