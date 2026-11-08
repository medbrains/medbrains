-- ====================================================================
-- Migration: 1421_unbilled_consumption_on_charge_queue.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ward_stock_consumptions
-- Drops: none
-- ====================================================================
-- Revenue leakage, stock used on a patient but never charged (revenue
-- integrity RFC, wave 1.2: CC3 ward stock, CC4 consignment implants).
--
-- Ward stock: a nurse's consumption from the ward's imprest left no record
-- at all, only a lower count, so nothing could ever be billed or checked.
-- Each consumption is now a row, naming the patient when it was used on one.
-- It is charged through `charge_or_queue` only when the drug is marked
-- `is_patient_billable`, which is off for every item until the hospital turns
-- it on: most ward stock (swabs, gloves, flushes) is overhead or in the bed
-- charge, and billing it would surprise every patient.
--
-- Consignment implants: a usage recorded with no patient was never billed and
-- nobody was told. It now goes on the charge attention queue as
-- `implant_no_patient`, with no patient, for the desk to name the patient and
-- post. That is the only row that may have no patient.
--
-- The daily leakage detector (migration 1416) gains a second reason,
-- `unbilled_consumption`: patient-linked consumable issues, ward stock,
-- consignment usage and implants that no bill line carries.

ALTER TABLE public.pharmacy_catalog
    ADD COLUMN is_patient_billable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pharmacy_catalog.is_patient_billable IS
    'Charge the patient when used from ward stock. Off: overhead or bundled.';

CREATE TABLE public.ward_stock_consumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    department_id uuid NOT NULL REFERENCES public.departments(id),
    catalog_item_id uuid NOT NULL REFERENCES public.pharmacy_catalog(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    -- Who it was used on; empty for ward use (cleaning a trolley, a spill).
    patient_id uuid REFERENCES public.patients(id),
    encounter_id uuid REFERENCES public.encounters(id),
    admission_id uuid REFERENCES public.admissions(id),
    -- Billable at the moment of use: a patient named and the drug marked
    -- billable then. The detector reads this, so switching an item on later
    -- never bills old uses.
    is_billable boolean NOT NULL DEFAULT false,
    consumed_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_ward_stock_consumptions_patient
    ON public.ward_stock_consumptions (tenant_id, created_at)
    WHERE patient_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.ward_stock_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ward_stock_consumptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ward_stock_consumptions ON public.ward_stock_consumptions
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER trg_ward_stock_consumptions_soft_delete
    BEFORE DELETE ON public.ward_stock_consumptions
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_ward_stock_consumptions AFTER INSERT OR UPDATE OR DELETE
    ON public.ward_stock_consumptions
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('pharmacy');

-- An implant used with no patient is queued with none, for the desk to name.
ALTER TABLE public.charge_attention_items
    ALTER COLUMN patient_id DROP NOT NULL,
    ADD CONSTRAINT charge_attention_patient_or_implant_unnamed
        CHECK (patient_id IS NOT NULL OR reason = 'implant_no_patient'),
    DROP CONSTRAINT charge_attention_only_detector_unattributed,
    ADD CONSTRAINT charge_attention_only_detector_unattributed
        CHECK (created_by IS NOT NULL OR reason IN ('unbilled_order', 'unbilled_consumption'));

-- The detector's consignment-usage probe.
CREATE INDEX idx_store_stock_movements_consignment_usage
    ON public.store_stock_movements (tenant_id, created_at)
    WHERE reference_type = 'consignment_usage' AND deleted_at IS NULL;
