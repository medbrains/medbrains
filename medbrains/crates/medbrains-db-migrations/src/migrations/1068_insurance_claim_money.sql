-- ====================================================================
-- Migration: 1068_insurance_claim_money.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- An insurance claim's money columns (total_bill_amount, deductions,
-- patient_payable) and its links (admission_id, insurance_id) were never
-- written: every claim printed a bill of 0 and a patient share of 0.
-- Three writers touch a claim's amounts (billing create/update, bank-statement
-- auto-match, the NHCX callback), so the arithmetic lives here, once, where
-- every writer goes through it. The invoice trigger keeps patient_payable true
-- when the patient pays at the counter after the claim was raised.
--
-- Likewise invoice_items.category was never written by any of the five line
-- create paths; it now comes from the charge master on insert.

CREATE OR REPLACE FUNCTION public.insurance_claim_money()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_total   numeric;
    v_paid    numeric;
    v_adm     uuid;
    v_enc     uuid;
    v_share   numeric;
    v_primary numeric := 0;
BEGIN
    SELECT i.total_amount, i.paid_amount, i.admission_id, i.encounter_id
      INTO v_total, v_paid, v_adm, v_enc
      FROM invoices i
     WHERE i.id = NEW.invoice_id AND i.tenant_id = NEW.tenant_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    NEW.total_bill_amount := v_total;

    IF NEW.admission_id IS NULL THEN
        NEW.admission_id := COALESCE(v_adm, (
            SELECT a.id FROM admissions a
             WHERE a.encounter_id = v_enc AND a.tenant_id = NEW.tenant_id
               AND a.deleted_at IS NULL
             ORDER BY a.admitted_at DESC LIMIT 1));
    END IF;

    -- The policy on the patient's file this claim is made under: same payer,
    -- same policy number when one was given; the active, primary one first.
    IF NEW.insurance_id IS NULL THEN
        NEW.insurance_id := (
            SELECT pi.id FROM patient_insurance pi
             WHERE pi.patient_id = NEW.patient_id AND pi.tenant_id = NEW.tenant_id
               AND pi.deleted_at IS NULL
               AND lower(pi.insurance_provider) = lower(NEW.insurance_provider)
               AND (NEW.policy_number IS NULL OR pi.policy_number = NEW.policy_number)
             ORDER BY pi.is_active DESC, pi.priority
             LIMIT 1);
    END IF;

    -- The payer's share: what it approved; before it answers, what was
    -- pre-authorised or claimed; nothing once it has rejected the claim.
    v_share := CASE
        WHEN NEW.status IN ('pre_auth_rejected', 'claim_rejected') THEN 0
        ELSE COALESCE(NEW.approved_amount, NEW.claim_amount, NEW.pre_auth_amount, 0)
    END;

    -- A secondary claim covers what the primary did not; the patient owes
    -- what neither covers.
    IF NEW.primary_claim_id IS NOT NULL THEN
        SELECT COALESCE(p.approved_amount, 0) INTO v_primary
          FROM insurance_claims p
         WHERE p.id = NEW.primary_claim_id AND p.tenant_id = NEW.tenant_id;
        v_primary := COALESCE(v_primary, 0);
    END IF;

    NEW.deductions := CASE
        WHEN NEW.status = 'claim_rejected' THEN v_total
        WHEN NEW.approved_amount IS NOT NULL THEN GREATEST(v_total - NEW.approved_amount, 0)
        ELSE 0
    END;
    NEW.patient_payable := GREATEST(v_total - v_share - v_primary - v_paid, 0);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_insurance_claim_money ON public.insurance_claims;
CREATE TRIGGER trg_insurance_claim_money
    BEFORE INSERT OR UPDATE ON public.insurance_claims
    FOR EACH ROW EXECUTE FUNCTION public.insurance_claim_money();

-- The bill or the patient's payments changed: re-run the claim arithmetic.
CREATE OR REPLACE FUNCTION public.insurance_claim_money_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE insurance_claims SET total_bill_amount = NEW.total_amount
     WHERE invoice_id = NEW.id AND tenant_id = NEW.tenant_id AND deleted_at IS NULL;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_claim_money ON public.invoices;
CREATE TRIGGER trg_invoice_claim_money
    AFTER UPDATE OF total_amount, paid_amount, admission_id ON public.invoices
    FOR EACH ROW
    WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount
       OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount
       OR OLD.admission_id IS DISTINCT FROM NEW.admission_id)
    EXECUTE FUNCTION public.insurance_claim_money_from_invoice();

-- Backfill: the BEFORE trigger derives everything; primaries before
-- secondaries so a secondary reads its primary's approved amount.
UPDATE public.insurance_claims SET total_bill_amount = total_bill_amount
 WHERE deleted_at IS NULL AND primary_claim_id IS NULL;
UPDATE public.insurance_claims SET total_bill_amount = total_bill_amount
 WHERE deleted_at IS NULL AND primary_claim_id IS NOT NULL;

-- ── invoice_items.category ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invoice_item_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.category := (
        SELECT cm.category FROM charge_master cm
         WHERE cm.tenant_id = NEW.tenant_id AND cm.code = NEW.charge_code
           AND cm.deleted_at IS NULL
         LIMIT 1);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_item_category ON public.invoice_items;
CREATE TRIGGER trg_invoice_item_category
    BEFORE INSERT ON public.invoice_items
    FOR EACH ROW WHEN (NEW.category IS NULL)
    EXECUTE FUNCTION public.invoice_item_category();

-- Lines that bill no charge-master code (pharmacy, lab, ad-hoc) stay NULL:
-- the printed charge head falls back to the module that raised them.
UPDATE public.invoice_items ii
   SET category = cm.category
  FROM public.charge_master cm
 WHERE ii.category IS NULL
   AND cm.tenant_id = ii.tenant_id AND cm.code = ii.charge_code
   AND cm.deleted_at IS NULL;
