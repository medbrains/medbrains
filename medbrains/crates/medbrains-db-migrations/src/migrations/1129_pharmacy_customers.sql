-- ====================================================================
-- Migration: 1129_pharmacy_customers.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Somebody who is not yet a patient buys medicines: online after signing in
-- with their mobile, or at the counter with a Schedule H/H1 prescription
-- from outside. They get a light record on `patients` itself — name, mobile,
-- address, a customer number from `sequences` in place of a UHID — marked
-- `pharmacy_customer`. When they register for a consultation the desk's
-- duplicate check finds the row and completes it into a full registration,
-- so their orders stay with them. Nothing clinical is made for them.

ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS pharmacy_customer boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_patients_pharmacy_customers
    ON public.patients (tenant_id, phone) WHERE pharmacy_customer;

-- A counter sale of a Schedule H or H1 drug against an outside prescription
-- (Drugs and Cosmetics Rules, Rule 65): who prescribed it, and for H1 the
-- patient's address. The patient's name and mobile are already on the sale.
ALTER TABLE public.pharmacy_pos_sales
    ADD COLUMN IF NOT EXISTS rx_prescriber_name text,
    ADD COLUMN IF NOT EXISTS rx_prescriber_registration text,
    ADD COLUMN IF NOT EXISTS rx_patient_address text;
