-- ====================================================================
-- Migration: 1191_abdm_m1_find_profile_optout.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ABDM M1 certification, the P1 test cases (official M1 test sheet,
-- sandboxcms.abdm.gov.in/uploads/M1_ABHA_CREATION_AND_VERIFICATION_WITH_
-- APIS_UPDATED_V1_1_f656c93440.xlsx) and the M2 opt-out case:
--
-- Find ABHA by mobile (VRFY_ABHA_301–305, SOP §7.6.1): a search lists the
-- ABHAs on the mobile, masked, before any OTP. The desk picks one and the
-- OTP goes to it, chained to the search's transaction — kept in
-- `search_txn_id` so "Resend OTP" can repeat the request exactly. The
-- verification sits at stage 'search_results' until then.
--
-- Find ABHA by Aadhaar (VRFY_ABHA_401–405, SOP §7.2): the login is keyed by
-- the Aadhaar number itself. The number is never stored, not even
-- encrypted: `login_id_cipher` stays empty and a resend asks for it again,
-- as ABHA creation already does (migration 1101's rule).
--
-- ABDM says an ABHA is deactivated (ABDM-1031, 1216, 1308, 1407):
-- `abdm_deactivated_at` stops further linking until staff retry once the
-- patient has reactivated it in their ABHA app.
--
-- Opt-out (HIP_INIT_ABHA_OPTOUT_DEACTIVATE): the patient withdraws their
-- ABHA from this hospital, or deletes or deactivates it at the desk
-- (PROF_ABHA_605). The link is ended and soft-deleted, its HIP consents
-- deleted; who recorded it, when and why stays on the row and in audit_log.

ALTER TABLE public.abha_verifications
    DROP CONSTRAINT abha_verifications_method_check,
    ADD CONSTRAINT abha_verifications_method_check
        CHECK (method IN ('abha_number', 'mobile', 'abha_address', 'aadhaar_enrol', 'scan_share',
                          'aadhaar', 'find_mobile')),
    DROP CONSTRAINT abha_verifications_stage_check,
    ADD CONSTRAINT abha_verifications_stage_check
        CHECK (stage IN ('search_results', 'otp_sent', 'mobile_otp_sent', 'choose_account',
                         'choose_address', 'verified')),
    ADD COLUMN search_txn_id text;

ALTER TABLE public.patient_abha_links
    DROP CONSTRAINT patient_abha_links_verification_method_check,
    ADD CONSTRAINT patient_abha_links_verification_method_check
        CHECK (verification_method IN
            ('abha_aadhaar_otp', 'abha_mobile_otp', 'mobile_otp', 'abha_address_otp',
             'created_aadhaar_otp', 'scan_share', 'aadhaar_number_otp')),
    ADD COLUMN abdm_deactivated_at timestamptz,
    ADD COLUMN opted_out_at timestamptz,
    ADD COLUMN opted_out_by uuid REFERENCES public.users(id),
    ADD COLUMN opt_out_reason text
        CHECK (opt_out_reason IS NULL OR length(btrim(opt_out_reason)) > 0);

-- An ABHA belongs to one live patient here (TAGGING_UNIQUEPATIENTID_
-- UNIQUEABHANUMBER), but an ended link must not hold the number for ever:
-- after an opt-out the same ABHA, verified again, may go on the right
-- record. The uniqueness covers live links only.
ALTER TABLE public.patient_abha_links
    DROP CONSTRAINT patient_abha_links_tenant_id_abha_number_key;
CREATE UNIQUE INDEX uq_patient_abha_links_live_number
    ON public.patient_abha_links (tenant_id, abha_number) WHERE deleted_at IS NULL;
