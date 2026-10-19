-- ====================================================================
-- Migration: 1108_abha_address_verify.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- "Verify ABHA" by ABHA address (name@abdm) through ABDM's PHR APIs: a third
-- way to find the person, recorded like the other two.

ALTER TABLE public.abha_verifications
    DROP CONSTRAINT abha_verifications_method_check,
    ADD CONSTRAINT abha_verifications_method_check
        CHECK (method IN ('abha_number', 'mobile', 'abha_address', 'aadhaar_enrol'));

ALTER TABLE public.patient_abha_links
    DROP CONSTRAINT patient_abha_links_verification_method_check,
    ADD CONSTRAINT patient_abha_links_verification_method_check
        CHECK (verification_method IN
            ('abha_aadhaar_otp', 'abha_mobile_otp', 'mobile_otp', 'abha_address_otp',
             'created_aadhaar_otp'));
