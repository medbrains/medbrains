-- ====================================================================
-- Migration: 1227_claim_settlement_postings.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: claim_settlement_postings
-- Drops: none
-- ====================================================================
-- Settled insurance claims, posted against their bills — by hand.
--
-- Until now insurer money settled on the claim and never reached the bill:
-- a bill whose insurer paid still read as owing everything but the patient's
-- counter payments. Finance decided (founder, 2026-10) that insurer money is
-- a payment against the bill, mode `insurance`, and that it is never posted
-- automatically: every settlement — typed in by the insurance desk, an NHCX
-- payment notice, a bank-statement match, a claim marked settled, a
-- historical import, or the one-time backfill — files a PENDING posting
-- here, and a second person approves or rejects it.
--
-- On approval, in one transaction: a payment of the settled (gross) amount,
-- capped at the bill's balance, lands on the bill; deduction lines the
-- hospital absorbs become an approved write-off; deduction lines the patient
-- bears stay outstanding on the patient. Whoever recorded the posting cannot
-- decide it. A wrongly approved posting is reversed, never edited: the
-- payment and write-off are soft-deleted and the bill's balance restored.
--
-- One live posting per settlement: (claim, source, source_ref) is unique
-- among postings that are pending or approved. A rejected or reversed one
-- frees the key, so a corrected settlement can be filed again.
--
-- The claim-money trigger counted every payment as the patient's. With
-- insurer payments on the bill that would take the insurer's share off the
-- patient twice, so `patient_payable` now counts only non-insurance money.

CREATE TABLE public.claim_settlement_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    insurance_claim_id uuid NOT NULL REFERENCES public.insurance_claims(id),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    -- Where the settlement came from, and its key there (a UTR, an NHCX
    -- allocation, a bank transaction, `claim` for a whole-claim import).
    source text NOT NULL CHECK (source IN
        ('manual', 'nhcx', 'bank', 'claim_update', 'import', 'backfill')),
    source_ref text NOT NULL,
    payer text,
    -- Gross: what the insurer discharged, the transfer plus TDS withheld.
    settled_amount numeric(14,2) NOT NULL CHECK (settled_amount > 0),
    tds_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
    payment_reference text,
    settlement_date date,
    -- [{reason, amount, treatment: 'patient' | 'write_off'}]
    deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
    deduction_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (deduction_total >= 0),
    notes text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'reversed')),
    needs_review boolean NOT NULL DEFAULT false,
    review_reason text,
    -- NULL when the system filed it (NHCX notice, bank match, import).
    recorded_by uuid REFERENCES public.users(id),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    decided_by uuid REFERENCES public.users(id),
    decided_at timestamptz,
    reject_reason text,
    posted_amount numeric(14,2),
    excess_amount numeric(14,2),
    payment_id uuid REFERENCES public.payments(id),
    write_off_id uuid REFERENCES public.bad_debt_write_offs(id),
    -- Whether approving raised the claim's settled amount (a desk-entered
    -- settlement); the other sources had already settled the claim.
    claim_applied boolean NOT NULL DEFAULT false,
    reversed_by uuid REFERENCES public.users(id),
    reversed_at timestamptz,
    reversal_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT claim_settlement_postings_tds CHECK (tds_amount <= settled_amount),
    CONSTRAINT claim_settlement_postings_maker_checker
        CHECK (decided_by IS NULL OR recorded_by IS NULL OR decided_by <> recorded_by),
    CONSTRAINT claim_settlement_postings_rejected
        CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
    CONSTRAINT claim_settlement_postings_reversed
        CHECK (status <> 'reversed' OR (reversed_by IS NOT NULL AND reversal_reason IS NOT NULL))
);

CREATE UNIQUE INDEX uq_claim_settlement_postings_live
    ON public.claim_settlement_postings (tenant_id, insurance_claim_id, source, source_ref)
    WHERE status IN ('pending', 'approved') AND deleted_at IS NULL;
CREATE INDEX idx_claim_settlement_postings_queue
    ON public.claim_settlement_postings (tenant_id, status, recorded_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_claim_settlement_postings_invoice
    ON public.claim_settlement_postings (tenant_id, invoice_id) WHERE deleted_at IS NULL;

ALTER TABLE public.claim_settlement_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_settlement_postings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_claim_settlement_postings ON public.claim_settlement_postings
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_claim_settlement_postings BEFORE UPDATE ON public.claim_settlement_postings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_claim_settlement_postings_soft_delete BEFORE DELETE ON public.claim_settlement_postings
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_claim_settlement_postings
    AFTER INSERT OR DELETE OR UPDATE ON public.claim_settlement_postings
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

-- File a pending posting for a settlement, once. Every writer that settles a
-- claim calls this, so the rule lives in one place: the claim's own bill,
-- patient and payer; a second filing of the same settlement does nothing;
-- more than the bill can take is flagged for review, never trimmed silently.
CREATE OR REPLACE FUNCTION public.file_claim_settlement(
    p_tenant uuid, p_claim uuid, p_source text, p_source_ref text,
    p_amount numeric, p_tds numeric, p_reference text, p_date date, p_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_id uuid;
    v_open numeric;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN NULL;
    END IF;
    SELECT i.total_amount - i.paid_amount - COALESCE((
             SELECT SUM(s.settled_amount) FROM claim_settlement_postings s
              WHERE s.invoice_id = i.id AND s.tenant_id = i.tenant_id
                AND s.status = 'pending' AND s.deleted_at IS NULL), 0)
      INTO v_open
      FROM insurance_claims c JOIN invoices i ON i.id = c.invoice_id AND i.tenant_id = c.tenant_id
     WHERE c.id = p_claim AND c.tenant_id = p_tenant;
    INSERT INTO claim_settlement_postings
        (tenant_id, insurance_claim_id, invoice_id, patient_id, source, source_ref, payer,
         settled_amount, tds_amount, payment_reference, settlement_date, recorded_by,
         needs_review, review_reason)
    SELECT c.tenant_id, c.id, c.invoice_id, c.patient_id, p_source, p_source_ref,
           COALESCE(NULLIF(c.tpa_name, ''), c.insurance_provider),
           round(p_amount, 2), round(COALESCE(p_tds, 0), 2), p_reference,
           COALESCE(p_date, c.settled_at::date, CURRENT_DATE), p_by,
           round(p_amount, 2) > COALESCE(v_open, 0),
           CASE WHEN round(p_amount, 2) > COALESCE(v_open, 0) THEN
               format('Settled %s is more than the %s the bill has open', round(p_amount, 2),
                      GREATEST(COALESCE(v_open, 0), 0))
           END
      FROM insurance_claims c
     WHERE c.id = p_claim AND c.tenant_id = p_tenant AND c.deleted_at IS NULL
    ON CONFLICT (tenant_id, insurance_claim_id, source, source_ref)
       WHERE status IN ('pending', 'approved') AND deleted_at IS NULL
       DO NOTHING
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- The patient owes what neither payer covers, less what the patient paid —
-- not less what the insurer paid onto the bill, which v_share already took.
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
    SELECT i.total_amount,
           i.paid_amount - COALESCE((
               SELECT SUM(p.amount) FROM payments p
                WHERE p.invoice_id = i.id AND p.tenant_id = i.tenant_id
                  AND p.mode = 'insurance' AND p.deleted_at IS NULL), 0),
           i.admission_id, i.encounter_id
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

    v_share := CASE
        WHEN NEW.status IN ('pre_auth_rejected', 'claim_rejected') THEN 0
        ELSE COALESCE(NEW.approved_amount, NEW.claim_amount, NEW.pre_auth_amount, 0)
    END;

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
