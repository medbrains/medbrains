-- ====================================================================
-- Migration: 1153_referral_partner_payouts.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Referral commission stays (owner decision 2026-10-20) but behind switches
-- in doctor_payout_settings, off by default. IMC Reg 6.4.1 / NMC 2023 cl. 9
-- forbid a physician taking a commission for referring; Apex Laboratories v
-- DCIT (SC 2022) makes such payments non-deductible. Organisations are the
-- default partner; paying an individual doctor needs its own switch.
-- Existing referrers with no organisation name are individuals.

ALTER TABLE public.lab_referral_doctors
    ADD COLUMN partner_kind text NOT NULL DEFAULT 'organisation'
        CHECK (partner_kind IN ('organisation', 'individual')),
    ADD COLUMN pan text CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
    ADD COLUMN gstin text CHECK (gstin ~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]Z[0-9A-Z]$');
UPDATE public.lab_referral_doctors SET partner_kind = 'individual'
 WHERE hospital_name IS NULL OR btrim(hospital_name) = '';

-- A referral payout is now a statement in the payout engine.
ALTER TABLE public.lab_referral_payouts
    ADD COLUMN statement_id uuid REFERENCES public.incentive_calculations(id);
