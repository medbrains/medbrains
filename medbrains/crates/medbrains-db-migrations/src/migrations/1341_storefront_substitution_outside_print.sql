-- ====================================================================
-- Migration: 1341_storefront_substitution_outside_print.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: pharmacy_substitution_requests, prescription_outside_prints
-- Drops: none
-- ====================================================================
-- When an online order's medicine is out of stock (owner decision 4):
--   (a) a substitute the prescribing doctor approves — in their sign-off
--       queue, or by phone if they confirm it there within 24 hours, else
--       the line goes back — and the patient consents to. Pharmacy Practice
--       Regulations 2015 reg. 13(c): no substitution without the prescriber.
--       What was substituted lands in the existing substitution log.
--   (b) the prescription printed for an outside pharmacy, the patient's own
--       choice, recorded on the order and the prescription. No pharmacy is
--       named unless the hospital has a disclosed partner.

CREATE TABLE IF NOT EXISTS public.pharmacy_substitution_requests (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES public.tenants(id),
    store_order_id         uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    store_order_line_id    uuid NOT NULL REFERENCES public.pharmacy_store_order_lines(id),
    original_item_id       uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    substitute_item_id     uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    prescription_id        uuid REFERENCES public.prescriptions(id),
    -- The prescriber who decides.
    doctor_id              uuid NOT NULL REFERENCES public.users(id),
    requested_by           uuid NOT NULL REFERENCES public.users(id),
    reason                 text NOT NULL CHECK (length(trim(reason)) > 0),
    method                 text NOT NULL CHECK (method IN ('sign_off', 'phone')),
    -- What the prescriber said on the phone, and by when they must confirm.
    phone_note             text,
    confirm_due_at         timestamptz,
    status                 text NOT NULL CHECK (status IN
                               ('with_doctor', 'phone_pending', 'approved', 'declined',
                                'reverted', 'lapsed')),
    doctor_decided_at      timestamptz,
    doctor_note            text,
    patient_consent        text CHECK (patient_consent IN ('accepted', 'declined')),
    patient_consent_method text CHECK (patient_consent_method IN ('portal', 'phone')),
    patient_consent_at     timestamptz,
    patient_consent_note   text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    deleted_at             timestamptz,
    deleted_by             uuid,
    delete_reason          text,
    CONSTRAINT substitution_phone_noted CHECK (
        method <> 'phone' OR (phone_note IS NOT NULL AND confirm_due_at IS NOT NULL)),
    CONSTRAINT substitution_differs CHECK (original_item_id <> substitute_item_id)
);
-- One open request per line.
CREATE UNIQUE INDEX IF NOT EXISTS uq_substitution_requests_open_line
    ON public.pharmacy_substitution_requests (store_order_line_id)
    WHERE status IN ('with_doctor', 'phone_pending') AND deleted_at IS NULL;
-- The doctor's sign-off queue.
CREATE INDEX IF NOT EXISTS idx_substitution_requests_doctor
    ON public.pharmacy_substitution_requests (tenant_id, doctor_id, created_at)
    WHERE status IN ('with_doctor', 'phone_pending') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_substitution_requests_order
    ON public.pharmacy_substitution_requests (tenant_id, store_order_id)
    WHERE deleted_at IS NULL;
-- The bounded sweep of phone agreements not confirmed in time.
CREATE INDEX IF NOT EXISTS idx_substitution_requests_due
    ON public.pharmacy_substitution_requests (tenant_id, confirm_due_at)
    WHERE status = 'phone_pending' AND deleted_at IS NULL;

-- The substitute a line goes out as, while its request stands approved (or
-- agreed by phone and not yet lapsed).
ALTER TABLE public.pharmacy_store_order_lines
    ADD COLUMN IF NOT EXISTS substitute_item_id uuid REFERENCES public.pharmacy_catalog(id),
    ADD COLUMN IF NOT EXISTS substitute_name text,
    ADD COLUMN IF NOT EXISTS substitution_request_id uuid
        REFERENCES public.pharmacy_substitution_requests(id);
-- 'outside_pharmacy': the patient took the prescription for this line elsewhere.
ALTER TABLE public.pharmacy_store_order_lines
    DROP CONSTRAINT IF EXISTS pharmacy_store_order_lines_status_check;
ALTER TABLE public.pharmacy_store_order_lines ADD CONSTRAINT pharmacy_store_order_lines_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'outside_pharmacy'));

-- The existing substitution log, with both consents.
ALTER TABLE public.pharmacy_substitutions
    ADD COLUMN IF NOT EXISTS substitution_request_id uuid
        REFERENCES public.pharmacy_substitution_requests(id),
    ADD COLUMN IF NOT EXISTS prescriber_consent_method text
        CHECK (prescriber_consent_method IS NULL
               OR prescriber_consent_method IN ('sign_off', 'phone')),
    ADD COLUMN IF NOT EXISTS prescriber_consent_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS prescriber_consent_at timestamptz,
    ADD COLUMN IF NOT EXISTS patient_consent_method text
        CHECK (patient_consent_method IS NULL OR patient_consent_method IN ('portal', 'phone'));

CREATE TABLE IF NOT EXISTS public.prescription_outside_prints (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            uuid NOT NULL REFERENCES public.tenants(id),
    prescription_id      uuid REFERENCES public.prescriptions(id),
    store_order_id       uuid NOT NULL REFERENCES public.pharmacy_store_orders(id),
    -- The lines printed: name, INN, strength, form, quantity, directions.
    items                jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
    requested_by_patient boolean NOT NULL,
    printed_by           uuid REFERENCES public.users(id),
    -- The disclosed partner shown, when the hospital has one; never otherwise.
    partner              jsonb,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz,
    deleted_by           uuid,
    delete_reason        text
);
CREATE INDEX IF NOT EXISTS idx_outside_prints_prescription
    ON public.prescription_outside_prints (tenant_id, prescription_id)
    WHERE prescription_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outside_prints_order
    ON public.prescription_outside_prints (tenant_id, store_order_id) WHERE deleted_at IS NULL;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pharmacy_substitution_requests', 'prescription_outside_prints'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_soft_delete ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER trg_%1$s_soft_delete BEFORE DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I '
                       'FOR EACH ROW EXECUTE FUNCTION audit_trigger_func(''pharmacy'')', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON public.%1$I', t);
        EXECUTE format('CREATE POLICY tenant_isolation_%1$s ON public.%1$I '
                       'USING (tenant_id = ANY (app_visible_tenants())) '
                       'WITH CHECK (tenant_id = ANY (app_visible_tenants()))', t);
    END LOOP;
END $$;
