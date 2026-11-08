-- ====================================================================
-- Migration: 1423_preauth_used_up_and_room_eligibility.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: room_upgrade_consents, preauth_check_failures
-- Drops: none
-- ====================================================================
-- Revenue integrity RFC, wave 1.3 and 1.4 (register rows IN3, IN4).
--
-- 1.3 Pre-auth used up. An insured inpatient's running bill passes the
-- amount the payer approved, nobody asks for an enhancement, and the excess
-- is short-paid at discharge. When the bill reaches 80% of the approved
-- pre-authorisation, a `preauth_used_up` row goes on the inbox for the
-- insurance desk, whose action is "request an enhancement". The check runs in
-- a trigger on the invoice total, the same way the claim arithmetic does
-- (migration 1068): every writer of a bill goes through it, in its own
-- transaction. An approved pre-auth whose amount could not be read raises a
-- `preauth_approval_unknown` row instead: an unknown is not "within limit".
-- The trigger never blocks a bill; when it fails it records the failure in
-- `preauth_check_failures`, and an hourly sweep (`medbrains-billing`
-- `preauth_sweep`) recomputes every insured open visit, so a failed check is
-- caught and counted rather than lost.
--
-- 1.4 Room eligibility. IRDAI/HLT/REG/CIR/151/06/2020 (11 June 2020): when a
-- policyholder takes a higher room than eligible, an insurer may deduct
-- "associated medical expenses" in proportion, but never pharmacy and
-- consumables, implants and medical devices, or diagnostics (para 4), never
-- at a hospital that does not follow differential billing (para 6), and never
-- on ICU charges (para 7). The policy now records its limit, as a fixed rupee
-- amount a day or a percentage of the sum insured; bed types say whether they
-- are critical care; the hospital says whether it bills by room category
-- (`tenant_settings` billing/`differential_billing`, default true). When a
-- room above the limit is allocated at admission or transfer, a
-- `room_over_limit` row records the expected cut, and the family's consent to
-- pay it is kept in `room_upgrade_consents` and closes the row.
--
-- The inbox (`charge_attention_items`, migrations 1411 and 1416) gains the
-- RFC §6 fields these kinds need: `kind`, `amount` (rupees at stake) and
-- `evidence` (the numbers behind the row, ids only, never patient text). The
-- charge columns become optional for the non-charge kinds, and a row of those
-- kinds closes as `actioned` (enhancement requested, consent recorded,
-- patient moved) rather than `posted`.

-- ── Policy room rent limit ─────────────────────────────────────────

ALTER TABLE public.patient_insurance
    ADD COLUMN room_rent_limit_per_day numeric(12, 2)
        CHECK (room_rent_limit_per_day IS NULL OR room_rent_limit_per_day > 0),
    ADD COLUMN room_rent_limit_percent numeric(5, 2)
        CHECK (room_rent_limit_percent IS NULL
               OR (room_rent_limit_percent > 0 AND room_rent_limit_percent <= 100));

COMMENT ON COLUMN public.patient_insurance.room_rent_limit_per_day IS
    'Eligible room rent a day in rupees. Wins over the percentage when both are set.';
COMMENT ON COLUMN public.patient_insurance.room_rent_limit_percent IS
    'Eligible room rent a day as a percentage of the sum insured (often 1).';

-- A policy decides what the hospital is paid; every change to it is kept.
CREATE TRIGGER audit_patient_insurance AFTER INSERT OR UPDATE OR DELETE
    ON public.patient_insurance
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('patients');

-- ── Critical-care beds ─────────────────────────────────────────────

-- ICU charges are outside the proportionate cut. The flag is derived from the
-- bed type's code and name, so every writer (seed, onboarding, setup screen)
-- sets it the same way and no bed type is left unflagged.
ALTER TABLE public.bed_types
    ADD COLUMN is_critical_care boolean GENERATED ALWAYS AS (
        translate(lower(code || ' ' || name), '_-/', '   ')
            ~ '\m(icu|nicu|picu|sicu|micu|cticu|ccu|iccu|hdu)\M|intensive care|critical care|high dependency'
    ) STORED;

-- ── Pre-auth enhancement request ───────────────────────────────────

-- The desk's ask is kept apart from the original estimate, which stays what
-- the payer approved against.
ALTER TABLE public.prior_auth_requests
    ADD COLUMN enhancement_amount numeric(12, 2)
        CHECK (enhancement_amount IS NULL OR enhancement_amount > 0),
    ADD COLUMN enhancement_requested_at timestamptz,
    ADD COLUMN enhancement_requested_by uuid REFERENCES public.users(id);

-- The used-up check looks a pre-auth up by the visit its bill is for.
CREATE INDEX IF NOT EXISTS idx_prior_auth_requests_tenant_encounter
    ON public.prior_auth_requests (tenant_id, encounter_id)
    WHERE deleted_at IS NULL AND encounter_id IS NOT NULL;

-- ── Inbox kinds ────────────────────────────────────────────────────

ALTER TABLE public.charge_attention_items
    ADD COLUMN kind text NOT NULL DEFAULT 'charge_not_posted'
        CHECK (kind IN ('charge_not_posted', 'preauth_used_up', 'room_over_limit')),
    ADD COLUMN amount numeric(14, 2),
    ADD COLUMN evidence jsonb,
    ALTER COLUMN setting_module DROP NOT NULL,
    ALTER COLUMN charge_code DROP NOT NULL,
    ALTER COLUMN quantity DROP NOT NULL,
    ADD CONSTRAINT charge_attention_charge_kind_has_charge
        CHECK (kind <> 'charge_not_posted'
               OR (setting_module IS NOT NULL AND charge_code IS NOT NULL
                   AND quantity IS NOT NULL)),
    DROP CONSTRAINT charge_attention_items_status_check,
    ADD CONSTRAINT charge_attention_items_status_check
        CHECK (status IN ('open', 'posted', 'dismissed', 'actioned')),
    ADD CONSTRAINT charge_attention_actioned_not_a_charge
        CHECK (status <> 'actioned' OR kind <> 'charge_not_posted'),
    -- A detector acts for the hospital, not for a person. The charge
    -- detectors are named (1416 unbilled orders, 1421 unbilled consumption);
    -- the new kinds are raised by a trigger, a sweep or the check itself, so
    -- they may be unattributed too. A superset of every earlier definition.
    DROP CONSTRAINT charge_attention_only_detector_unattributed,
    ADD CONSTRAINT charge_attention_only_detector_unattributed
        CHECK (created_by IS NOT NULL
               OR reason IN ('unbilled_order', 'unbilled_consumption')
               OR kind <> 'charge_not_posted');

CREATE INDEX idx_charge_attention_kind_open
    ON public.charge_attention_items (tenant_id, kind, created_at DESC)
    WHERE status = 'open' AND deleted_at IS NULL;

-- ── Room upgrade consent ───────────────────────────────────────────

CREATE TABLE public.room_upgrade_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    admission_id uuid NOT NULL REFERENCES public.admissions(id),
    patient_insurance_id uuid NOT NULL REFERENCES public.patient_insurance(id),
    bed_id uuid NOT NULL,
    room_rate numeric(12, 2) NOT NULL CHECK (room_rate > 0),
    eligible_rate numeric(12, 2) NOT NULL CHECK (eligible_rate > 0),
    -- The share of room-linked charges the insurer may pay: eligible / room,
    -- rounded down, so a room just above the limit is never read as 1.
    payable_ratio numeric(8, 6) NOT NULL CHECK (payable_ratio > 0 AND payable_ratio < 1),
    estimated_bill numeric(14, 2) CHECK (estimated_bill IS NULL OR estimated_bill >= 0),
    estimated_deduction numeric(14, 2)
        CHECK (estimated_deduction IS NULL OR estimated_deduction >= 0),
    -- Who agreed: the patient or a named relative, as told to the desk.
    consented_by_name text NOT NULL CHECK (length(btrim(consented_by_name)) BETWEEN 2 AND 120),
    consenter_relation text NOT NULL CHECK (length(btrim(consenter_relation)) BETWEEN 2 AND 40),
    -- A second member of staff who saw the family agree.
    witness_user_id uuid NOT NULL REFERENCES public.users(id),
    -- Which wording of the disclosure the family was shown.
    disclosure_version text NOT NULL CHECK (disclosure_version ~ '^[a-z0-9-]{3,40}$'),
    recorded_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT room_upgrade_consent_witness_is_another
        CHECK (witness_user_id <> recorded_by)
);

CREATE INDEX idx_room_upgrade_consents_admission
    ON public.room_upgrade_consents (tenant_id, admission_id)
    WHERE deleted_at IS NULL;

ALTER TABLE public.room_upgrade_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_upgrade_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_room_upgrade_consents ON public.room_upgrade_consents
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER trg_room_upgrade_consents_soft_delete BEFORE DELETE ON public.room_upgrade_consents
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_room_upgrade_consents AFTER INSERT OR UPDATE OR DELETE
    ON public.room_upgrade_consents
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

-- ── Pre-auth check failures ────────────────────────────────────────

-- One row each time the trigger could not run its check. The sweep re-checks
-- the hospital's visits and stamps `swept_at`, and reports how many it found.
CREATE TABLE public.preauth_check_failures (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    invoice_id uuid,
    -- The error class only; the message can quote the row.
    sqlstate text NOT NULL CHECK (sqlstate ~ '^[0-9A-Z]{5}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    swept_at timestamptz,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE INDEX idx_preauth_check_failures_unswept
    ON public.preauth_check_failures (tenant_id, created_at)
    WHERE swept_at IS NULL AND deleted_at IS NULL;

ALTER TABLE public.preauth_check_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preauth_check_failures FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_preauth_check_failures ON public.preauth_check_failures
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

CREATE TRIGGER trg_preauth_check_failures_soft_delete BEFORE DELETE
    ON public.preauth_check_failures
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Pre-auth used up: the check ────────────────────────────────────

-- The check for one visit, shared by the invoice trigger and the sweep.
-- Finds the approved, unexpired pre-auth for the admitted visit, sums the
-- visit's live bills, and at 80% of the approval raises (or refreshes) the
-- open row. A pre-auth that already had a row at this approved amount, open
-- or closed, is not raised again: the next row comes only after the approval
-- changes (an enhancement granted). Returns what it did.
CREATE OR REPLACE FUNCTION public.preauth_usage_raise(
    p_tenant uuid, p_encounter uuid, p_patient uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_pa       uuid;
    v_approved numeric;
    v_running  numeric;
    v_reason   text;
BEGIN
    SELECT p.id, p.approved_amount INTO v_pa, v_approved
      FROM prior_auth_requests p
     WHERE p.tenant_id = p_tenant AND p.encounter_id = p_encounter
       AND p.deleted_at IS NULL
       AND p.status IN ('approved', 'partially_approved')
       AND (p.expires_at IS NULL OR p.expires_at > now())
     ORDER BY p.responded_at DESC NULLS LAST, p.created_at DESC
     LIMIT 1;
    IF v_pa IS NULL OR NOT EXISTS (
        SELECT 1 FROM admissions a
         WHERE a.tenant_id = p_tenant AND a.encounter_id = p_encounter
           AND a.deleted_at IS NULL) THEN
        RETURN 'not_insured';
    END IF;

    SELECT COALESCE(SUM(i.total_amount), 0) INTO v_running
      FROM invoices i
     WHERE i.tenant_id = p_tenant AND i.encounter_id = p_encounter
       AND i.deleted_at IS NULL AND i.status NOT IN ('cancelled', 'refunded');

    IF v_approved IS NULL OR v_approved <= 0 THEN
        v_reason := 'preauth_approval_unknown';
        v_approved := NULL;
    ELSIF v_running >= v_approved * 0.8 THEN
        v_reason := 'preauth_used_up';
    ELSE
        RETURN 'within';
    END IF;

    IF EXISTS (
        SELECT 1 FROM charge_attention_items c
         WHERE c.tenant_id = p_tenant AND c.source_module = 'prior_auth'
           AND c.source_entity_id = v_pa AND c.deleted_at IS NULL
           AND c.status <> 'open'
           AND (c.evidence ->> 'approved_amount')::numeric IS NOT DISTINCT FROM v_approved) THEN
        RETURN 'already_actioned';
    END IF;

    INSERT INTO charge_attention_items
        (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id,
         reason, amount, evidence, service_at)
    VALUES (p_tenant, 'preauth_used_up', 'prior_auth', v_pa, p_patient,
            p_encounter, v_reason, v_running,
            jsonb_build_object('approved_amount', v_approved, 'running_bill', v_running,
                               'threshold_percent', 80),
            now())
    ON CONFLICT (tenant_id, source_module, source_entity_id)
        WHERE status = 'open' AND deleted_at IS NULL
    DO UPDATE SET amount = EXCLUDED.amount, evidence = EXCLUDED.evidence,
                  reason = EXCLUDED.reason, updated_at = now();
    RETURN v_reason;
END;
$$;

-- Runs after a bill is created with a total or its total grows. It never
-- fails the bill: a failure is written to `preauth_check_failures` (the
-- SQLSTATE only, never the message, which can quote the row), and only if
-- even that cannot be written does it fall back to a server-log WARNING. The
-- sweep re-checks the visit either way.
--
-- `medbrains.fault_inject = 'preauth_check'` makes the check fail on purpose,
-- so a test can prove the failure is counted and the sweep still raises the row.
CREATE OR REPLACE FUNCTION public.preauth_usage_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_state text;
BEGIN
    IF NEW.encounter_id IS NULL THEN
        RETURN NULL;
    END IF;
    BEGIN
        IF current_setting('medbrains.fault_inject', true) = 'preauth_check' THEN
            RAISE EXCEPTION 'fault injected' USING ERRCODE = 'P0001';
        END IF;
        PERFORM preauth_usage_raise(NEW.tenant_id, NEW.encounter_id, NEW.patient_id);
    EXCEPTION WHEN OTHERS THEN
        v_state := SQLSTATE;
        BEGIN
            INSERT INTO preauth_check_failures (tenant_id, invoice_id, sqlstate)
            VALUES (NEW.tenant_id, NEW.id, v_state);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'preauth usage check failed (%), and its failure was not recorded (%)',
                v_state, SQLSTATE;
        END;
    END;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoice_preauth_usage_insert
    AFTER INSERT ON public.invoices
    FOR EACH ROW
    WHEN (NEW.total_amount > 0)
    EXECUTE FUNCTION public.preauth_usage_check();

CREATE TRIGGER trg_invoice_preauth_usage
    AFTER UPDATE OF total_amount ON public.invoices
    FOR EACH ROW
    WHEN (NEW.total_amount > COALESCE(OLD.total_amount, 0))
    EXECUTE FUNCTION public.preauth_usage_check();
