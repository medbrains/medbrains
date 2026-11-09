-- ====================================================================
-- Migration: 1425_charge_attention_unattributed_kinds.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Who may raise a leakage inbox row without a person's name on it.
--
-- A detector acts for the hospital, not for a person. The charge detectors
-- are named (1416 unbilled orders, 1421 unbilled consumption); the insurance
-- kinds of 1423 (`preauth_used_up`, `room_over_limit`) are raised by the
-- invoice trigger, the hourly sweep or the check itself, so they may be
-- unattributed too. Migrations 1416 and 1421 each redefine this constraint
-- without the `kind` clause, and 1421 may be applied after 1423, so the
-- widened definition lives here, numbered above both, as a superset of every
-- earlier one: dropped IF EXISTS and re-added whatever an earlier migration
-- left.

ALTER TABLE public.charge_attention_items
    DROP CONSTRAINT IF EXISTS charge_attention_only_detector_unattributed,
    ADD CONSTRAINT charge_attention_only_detector_unattributed
        CHECK (created_by IS NOT NULL
               OR reason IN ('unbilled_order', 'unbilled_consumption')
               OR kind <> 'charge_not_posted');
