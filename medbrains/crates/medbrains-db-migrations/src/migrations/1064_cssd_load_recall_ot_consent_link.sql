-- ====================================================================
-- Migration: 1064_cssd_load_recall_ot_consent_link.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ot_emergency_consent_certifications
-- Drops: none
-- ====================================================================
-- CSSD: a sterilisation load can be recalled as a whole. Once recalled,
-- no pack from it may be issued, and every issuance already made from it
-- is flagged so the packs can be fetched back (RFCs/COMPLIANCE-GAP-2026-10.md #4).
--
-- OT: a surgical / anaesthesia consent is tied to the booking it covers.
-- "Any signed consent for the patient" let a cataract consent clear a
-- knee replacement (COMPLIANCE-GAP #5).

ALTER TABLE public.cssd_sterilization_loads
    ADD COLUMN IF NOT EXISTS recalled_at   timestamptz,
    ADD COLUMN IF NOT EXISTS recalled_by   uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS recall_reason text;

-- "Where did the packs of this load go" — issuances by load item.
CREATE INDEX IF NOT EXISTS idx_cssd_issuances_load_item
    ON public.cssd_issuances (load_item_id)
    WHERE load_item_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.procedure_consents
    ADD COLUMN IF NOT EXISTS ot_booking_id uuid REFERENCES public.ot_bookings(id);

CREATE INDEX IF NOT EXISTS idx_procedure_consents_ot_booking
    ON public.procedure_consents (ot_booking_id)
    WHERE ot_booking_id IS NOT NULL AND deleted_at IS NULL;

-- OT: emergency implied consent. When an emergency operation cannot wait for
-- the patient or a relative to consent, two different doctors each certify,
-- in their own authenticated session, that it is needed now and why. The
-- certification stands in for the linked consent at the start-of-surgery gate.
CREATE TABLE IF NOT EXISTS ot_emergency_consent_certifications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    booking_id          uuid NOT NULL REFERENCES ot_bookings(id),
    reason              text NOT NULL CHECK (length(btrim(reason)) > 0),
    first_doctor_id     uuid NOT NULL REFERENCES users(id),
    first_certified_at  timestamptz NOT NULL DEFAULT now(),
    second_doctor_id    uuid REFERENCES users(id),
    second_certified_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    deleted_by          uuid,
    delete_reason       text,
    CHECK (second_doctor_id IS NULL OR second_doctor_id <> first_doctor_id),
    CHECK ((second_doctor_id IS NULL) = (second_certified_at IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ot_emergency_consent_booking
    ON ot_emergency_consent_certifications (tenant_id, booking_id)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_ot_emergency_consent_soft_delete ON ot_emergency_consent_certifications;
CREATE TRIGGER trg_ot_emergency_consent_soft_delete
    BEFORE DELETE ON ot_emergency_consent_certifications
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();

ALTER TABLE ot_emergency_consent_certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ot_emergency_consent ON ot_emergency_consent_certifications;
CREATE POLICY tenant_isolation_ot_emergency_consent ON ot_emergency_consent_certifications
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));
