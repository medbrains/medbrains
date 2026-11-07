-- ====================================================================
-- Migration: 1411_charge_attention_queue.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: charge_attention_items
-- Drops: none
-- ====================================================================
-- Charges needing attention: an automatic charge that a clinical action
-- (diet order, CSSD issue, OT completion, ER registration, ambulance trip,
-- discharge room rent, OPD consult) tried to post and could not.
--
-- Before this table the failure was thrown away (`let _ = create_service_charge`)
-- and an unreadable auto-billing setting was read as "off", so the patient was
-- simply never billed and nobody knew. `charge_or_queue` now writes a row here
-- in the same transaction as the clinical write instead; the billing desk posts
-- the charge or dismisses it with a reason.
--
-- The row carries everything needed to post the same charge again (code,
-- quantity, the description / price / tax the module chose) so posting from the
-- queue is the charge the module meant, not a re-priced guess. `reason` is the
-- error class only (`charge_failed:database`, `billing_setting_unreadable`, ...),
-- never the error text, which can carry patient data.
--
-- Status moves open -> posted | dismissed and never back. Who resolved it and
-- when sits on the row; the audit trigger keeps every change.

CREATE TABLE public.charge_attention_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    -- `invoice_items.source` the charge would carry (a charge_source value).
    source_module text NOT NULL CHECK (length(btrim(source_module)) BETWEEN 1 AND 40),
    -- The `auto_charge_<module>` setting that governs it (e.g. `ipd_room`).
    setting_module text NOT NULL CHECK (length(btrim(setting_module)) BETWEEN 1 AND 40),
    -- The charge's idempotency key: `invoice_items.source_id`.
    source_entity_id uuid NOT NULL,
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    encounter_id uuid REFERENCES public.encounters(id),
    charge_code text NOT NULL CHECK (length(btrim(charge_code)) BETWEEN 1 AND 80),
    quantity integer NOT NULL CHECK (quantity > 0),
    description_override text,
    unit_price_override numeric(14, 2),
    tax_percent_override numeric(6, 2),
    apply_concessions boolean NOT NULL DEFAULT false,
    reason text NOT NULL CHECK (reason ~ '^[a-z_:]{3,80}$'),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'posted', 'dismissed')),
    invoice_id uuid REFERENCES public.invoices(id),
    dismiss_reason text,
    resolved_by uuid REFERENCES public.users(id),
    resolved_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT charge_attention_resolved_has_who
        CHECK (status = 'open' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL)),
    CONSTRAINT charge_attention_posted_has_invoice
        CHECK (status <> 'posted' OR invoice_id IS NOT NULL),
    CONSTRAINT charge_attention_dismissed_has_reason
        CHECK (status <> 'dismissed' OR length(btrim(coalesce(dismiss_reason, ''))) >= 3)
);

CREATE INDEX idx_charge_attention_tenant_status
    ON public.charge_attention_items (tenant_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- One open item per charge: an action repeated before the desk acts on it
-- (a retried completion) does not queue the same charge twice.
CREATE UNIQUE INDEX uq_charge_attention_open_source
    ON public.charge_attention_items (tenant_id, source_module, source_entity_id)
    WHERE status = 'open' AND deleted_at IS NULL;

ALTER TABLE public.charge_attention_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_attention_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_charge_attention_items ON public.charge_attention_items
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER set_updated_at_charge_attention_items BEFORE UPDATE ON public.charge_attention_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_charge_attention_items_soft_delete BEFORE DELETE ON public.charge_attention_items
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_charge_attention_items AFTER INSERT OR UPDATE OR DELETE
    ON public.charge_attention_items
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');
