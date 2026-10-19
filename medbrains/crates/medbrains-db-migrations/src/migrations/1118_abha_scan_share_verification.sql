-- ====================================================================
-- Migration: 1118_abha_scan_share_verification.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A profile shared through ABDM Scan & Share reaches us from the gateway,
-- whose JWT we verify — ABDM vouches for it as it does for an OTP check at
-- the desk. When staff register or link from a share, the server records an
-- `abha_verifications` row of method 'scan_share' built from the stored
-- share (never from the browser), so `link_verified_abha` accepts it like
-- any other verification and the link says how it was made.

ALTER TABLE public.abha_verifications
    DROP CONSTRAINT abha_verifications_method_check,
    ADD CONSTRAINT abha_verifications_method_check
        CHECK (method IN ('abha_number', 'mobile', 'abha_address', 'aadhaar_enrol', 'scan_share'));

ALTER TABLE public.patient_abha_links
    DROP CONSTRAINT patient_abha_links_verification_method_check,
    ADD CONSTRAINT patient_abha_links_verification_method_check
        CHECK (verification_method IN
            ('abha_aadhaar_otp', 'abha_mobile_otp', 'mobile_otp', 'abha_address_otp',
             'created_aadhaar_otp', 'scan_share'));
