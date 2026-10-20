-- ====================================================================
-- Migration: 1151_doctor_payout_ledger.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: doctor_payout_accruals
-- Drops: none
-- ====================================================================
-- Credit goes to the doctor who PERFORMED the service, not the one who
-- ordered it (NMC 2023 cl. 26: "the RMP who attends to the patient ... is
-- entitled to the appropriate fees"). invoice_items had only
-- ordering_doctor_id. Every charge path inserts through invoice_items, so one
-- trigger fills performing_doctor_id from the line's source record; lines whose
-- performer is known only later (a lab result verified, a radiology report
-- signed) are filled by the payout engine when it accrues the bill.

ALTER TABLE public.invoice_items
    ADD COLUMN performing_doctor_id uuid REFERENCES public.users(id);
CREATE INDEX idx_invoice_items_performing_doctor ON public.invoice_items (tenant_id, performing_doctor_id)
    WHERE performing_doctor_id IS NOT NULL;

-- The doctor who performed the service a charge line was raised for.
CREATE FUNCTION public.invoice_item_performer(p_source text, p_source_id uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT CASE p_source
        WHEN 'opd' THEN COALESCE(
            (SELECT COALESCE(q.doctor_id, e.doctor_id) FROM public.opd_queues q
               LEFT JOIN public.encounters e ON e.id = q.encounter_id WHERE q.id = p_source_id),
            (SELECT t.doctor_id FROM public.tele_consultations t WHERE t.id = p_source_id))
        WHEN 'procedure' THEN COALESCE(
            (SELECT p.performed_by FROM public.procedure_orders p WHERE p.id = p_source_id),
            (SELECT d.performed_by FROM public.dialysis_sessions d WHERE d.id = p_source_id))
        WHEN 'lab' THEN (SELECT l.verified_by FROM public.lab_orders l WHERE l.id = p_source_id)
        WHEN 'radiology' THEN (SELECT r.reported_by FROM public.radiology_reports r
                                WHERE r.order_id = p_source_id ORDER BY r.created_at DESC LIMIT 1)
        WHEN 'ot' THEN (SELECT b.primary_surgeon_id FROM public.ot_bookings b WHERE b.id = p_source_id)
        WHEN 'emergency' THEN (SELECT v.attending_doctor_id FROM public.er_visits v WHERE v.id = p_source_id)
        WHEN 'ipd' THEN (SELECT n.author_id FROM public.clinical_notes n WHERE n.id = p_source_id)
        WHEN 'dental' THEN (SELECT i.done_by FROM public.dental_treatment_items i WHERE i.id = p_source_id)
    END
$$;

CREATE FUNCTION public.invoice_items_fill_performer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.performing_doctor_id IS NULL THEN
        IF NEW.reversal_of_id IS NOT NULL THEN
            SELECT o.performing_doctor_id INTO NEW.performing_doctor_id
              FROM public.invoice_items o WHERE o.id = NEW.reversal_of_id;
        ELSIF NEW.source_id IS NOT NULL THEN
            NEW.performing_doctor_id := public.invoice_item_performer(NEW.source::text, NEW.source_id);
        END IF;
    END IF;
    RETURN NEW;
END
$$;
CREATE TRIGGER trg_invoice_items_fill_performer BEFORE INSERT ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.invoice_items_fill_performer();

-- The accrual ledger: append-only. One row per (invoice line x doctor x role)
-- per change; a refund, cancellation or insurer deduction is a negative row,
-- never an edit. The rate and the base are snapshotted on the row.
CREATE TABLE public.doctor_payout_accruals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    doctor_id uuid REFERENCES public.users(id),
    referral_doctor_id uuid REFERENCES public.lab_referral_doctors(id),
    agreement_id uuid REFERENCES public.doctor_incentive_assignments(id),
    invoice_id uuid REFERENCES public.invoices(id),
    invoice_item_id uuid REFERENCES public.invoice_items(id),
    role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'assistant', 'anaesthetist', 'referrer')),
    rule_id uuid REFERENCES public.incentive_plan_rules(id),
    event text NOT NULL CHECK (event IN
        ('billed', 'collected', 'realised', 'reversal', 'session_minimum', 'adjustment', 'referral')),
    basis text CHECK (basis IN ('billed', 'collected', 'realised')),
    payer_class text,
    service_date date NOT NULL,
    line_amount numeric(14,2) NOT NULL DEFAULT 0,
    base_amount numeric(14,2) NOT NULL DEFAULT 0,
    share_amount numeric(14,2) NOT NULL DEFAULT 0,
    fraction numeric(9,6) NOT NULL DEFAULT 1,
    amount numeric(14,2) NOT NULL,
    reversal_of_id uuid REFERENCES public.doctor_payout_accruals(id),
    reason text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_payout_accruals_payee CHECK (doctor_id IS NOT NULL OR referral_doctor_id IS NOT NULL),
    CONSTRAINT doctor_payout_accruals_reason CHECK (event NOT IN ('adjustment', 'reversal') OR reason IS NOT NULL)
);
CREATE INDEX idx_doctor_payout_accruals_doctor ON public.doctor_payout_accruals (tenant_id, doctor_id, service_date);
CREATE INDEX idx_doctor_payout_accruals_item ON public.doctor_payout_accruals (invoice_item_id, doctor_id, role);
CREATE INDEX idx_doctor_payout_accruals_invoice ON public.doctor_payout_accruals (tenant_id, invoice_id);
CREATE INDEX idx_doctor_payout_accruals_referrer ON public.doctor_payout_accruals (tenant_id, referral_doctor_id)
    WHERE referral_doctor_id IS NOT NULL;

ALTER TABLE public.doctor_payout_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payout_accruals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_payout_accruals ON public.doctor_payout_accruals
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE FUNCTION public.doctor_payout_accruals_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'doctor_payout_accruals is append-only; post a reversal or adjustment row instead'
        USING ERRCODE = 'restrict_violation';
END
$$;
-- The soft-delete guardrail turns a DELETE into an UPDATE, which this refuses:
-- a ledger row is never removed.
CREATE TRIGGER trg_doctor_payout_accruals_soft_delete BEFORE DELETE ON public.doctor_payout_accruals
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER trg_doctor_payout_accruals_append_only BEFORE UPDATE ON public.doctor_payout_accruals
    FOR EACH ROW EXECUTE FUNCTION public.doctor_payout_accruals_append_only();
