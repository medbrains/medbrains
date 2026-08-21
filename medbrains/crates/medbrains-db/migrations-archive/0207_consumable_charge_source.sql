-- ====================================================================
-- Migration: 0207_consumable_charge_source.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: n/a (enum value only)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Consumables issued to a patient (gloves, cannulas, IV sets, implants,
-- dressings) were recorded in `patient_consumable_issues` + decremented
-- from `store_catalog`, but never posted to the bill — `invoice_item_id`
-- was always NULL, a revenue leak across ER / IPD / OT.
--
-- The fix wires `issue_to_patient` to `auto_charge`, which writes an
-- `invoice_items` row. Real hospital bills group disposables/consumables
-- as their own category, so they get a dedicated `charge_source` value
-- rather than being lumped under 'manual'. This makes consumable revenue
-- reportable and keeps the existing per-source bill breakup honest.

ALTER TYPE public.charge_source ADD VALUE IF NOT EXISTS 'consumable';
