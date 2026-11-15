-- ====================================================================
-- Migration: 1461_uhi_slot_ids_holds_and_pin.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: uhi_slot_ids
-- Drops: none
-- ====================================================================
-- UHI physical consultation, as NHA's current docs describe it
-- (docs.abdm.gov.in/docs/uhi/v1/services/consultation; #5702, #5704).
--
-- * Slot IDs. A slot was named `{doctor}|{date}|{HH:MM}`; UHI names it by a
--   UUID, sent as the fulfilment id and in the `@abdm/gov.in/slot_id` tag.
--   `uhi_slot_ids` maps each UUID to the doctor and time it stands for, so the
--   same slot keeps the same UUID across searches.
-- * The 15-minute hold. `init` holds the slot for the transaction
--   (`slot_id`, `slot_held_until`); other searches see it taken until the
--   hold runs out or `confirm` turns it into the appointment. Nothing sweeps:
--   a lapsed hold simply stops counting.
-- * The PIN. `on_confirm` gives the patient a 4-digit PIN to show at the
--   desk. Only its argon2 hash is kept (`pin_hash`); the desk checks the
--   PIN the patient shows against it, at most five wrong tries.
-- * A doctor no-show the patient's app reports (`on_update`,
--   `DOCTOR_NO_SHOW`) is kept as a time, so staff see it.

CREATE TABLE public.uhi_slot_ids (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    doctor_id uuid NOT NULL REFERENCES public.users(id),
    slot_date date NOT NULL,
    slot_start time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_uhi_slot_ids_slot
    ON public.uhi_slot_ids (tenant_id, doctor_id, slot_date, slot_start);

ALTER TABLE public.uhi_slot_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uhi_slot_ids FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_uhi_slot_ids ON public.uhi_slot_ids
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE public.uhi_transactions
    ADD COLUMN slot_id uuid REFERENCES public.uhi_slot_ids(id),
    ADD COLUMN slot_held_until timestamptz,
    ADD COLUMN pin_hash text,
    ADD COLUMN pin_failed_attempts integer NOT NULL DEFAULT 0
        CHECK (pin_failed_attempts >= 0),
    ADD COLUMN pin_verified_at timestamptz,
    ADD COLUMN pin_verified_by uuid REFERENCES public.users(id),
    ADD COLUMN doctor_no_show_at timestamptz,
    ADD CONSTRAINT uhi_transactions_hold_names_slot
        CHECK (slot_held_until IS NULL OR slot_id IS NOT NULL);

-- Live holds, counted against a slot's capacity on every search.
CREATE INDEX idx_uhi_transactions_slot_holds
    ON public.uhi_transactions (tenant_id, slot_id, slot_held_until)
    WHERE slot_id IS NOT NULL AND appointment_id IS NULL AND deleted_at IS NULL;
