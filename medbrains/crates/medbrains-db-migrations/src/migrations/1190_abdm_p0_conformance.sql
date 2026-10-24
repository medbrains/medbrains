-- ====================================================================
-- Migration: 1190_abdm_p0_conformance.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ABDM M1 certification (test cases CRT_ABHA_106 and VRFY_ABHA_405 in the
-- official M1 test sheet, sandboxcms.abdm.gov.in/uploads/M1_ABHA_CREATION_
-- AND_VERIFICATION_WITH_APIS_UPDATED_V1_1_f656c93440.xlsx): "Resend OTP"
-- may be used at most two times, each after 60 seconds. The count lives on
-- the verification or enrolment so the cap holds across devices and
-- retries, not just in one screen's memory. A fresh OTP stage (the mobile
-- OTP after the Aadhaar one) starts its own count.
--
-- `consent_version` records which ABDM consent (code "abha-enrollment",
-- version 1.4) the patient agreed to before an ABHA was created with their
-- Aadhaar (CRT_ABHA_102: "store who agreed and when" — who is created_by,
-- when is created_at).

ALTER TABLE public.abha_verifications
    ADD COLUMN resend_count integer NOT NULL DEFAULT 0 CHECK (resend_count >= 0);

ALTER TABLE public.abha_verifications
    ADD COLUMN consent_version text;

-- ── The HIP ID the gateway routes on ────────────────────────────────────
-- Measured on the sandbox by OHC care-abdm (MIT, docs/findings.md E1/B18):
-- `X-HIP-ID` must be the bridge SERVICE id the registry issued for the
-- campus (`<HFR facility ID>_<n>`, e.g. IN1410000232_1). Sent with the bare
-- HFR ID, the gateway answers 202 and never calls back. The service id is
-- read off the gateway's bridge-services list (Settings → ABDM → Bridge) or
-- the HFR registration answer, kept next to the HFR ID, sent on every
-- outbound call, and accepted on inbound callbacks alongside the HFR ID.
ALTER TABLE public.facilities
    ADD COLUMN abdm_hip_service_id text;

CREATE OR REPLACE FUNCTION public.app_abdm_hip_tenant(p_hip_id text)
RETURNS TABLE (tenant_id uuid, facility_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT f.tenant_id, f.id FROM public.facilities f
     WHERE (f.hfr_facility_id = upper(btrim(p_hip_id))
            OR f.abdm_hip_service_id = upper(btrim(p_hip_id)))
       AND f.deleted_at IS NULL
     LIMIT 2
$$;

COMMENT ON FUNCTION public.app_abdm_hip_tenant(text) IS
    'ABDM callbacks: the tenant and campus an X-HIP-ID (bridge service id or HFR facility ID) belongs to.';

-- ── Context notify (M2 `link/context/notify`) ───────────────────────────
-- Sent after a care context is linked, so the patient's app shows the new
-- record. ABDM needs time to index a link first: a notify 0.6 s after the
-- link is refused ABDM-1006, 50 s after it succeeds (care-abdm F9).
ALTER TABLE public.abdm_care_contexts
    ADD COLUMN notify_request_id uuid,
    ADD COLUMN notify_attempts integer NOT NULL DEFAULT 0 CHECK (notify_attempts >= 0),
    ADD COLUMN notified_at timestamptz,
    ADD COLUMN notify_error text;

-- ── ABDM's 24-hour block ────────────────────────────────────────────────
-- `ABDM-1027 You are blocked. Please try again after 24 hours.` follows the
-- ABHA address after repeated refused calls (care-abdm E14). Until then
-- nothing more is sent for that ABHA, and the screen says why.
ALTER TABLE public.patient_abha_links
    ADD COLUMN abdm_blocked_until timestamptz;
