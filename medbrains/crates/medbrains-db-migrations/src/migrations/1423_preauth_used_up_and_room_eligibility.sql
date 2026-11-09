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
-- pre-authorisation (the hospital's threshold, `tenant_settings`
-- preauth_alerts/`threshold_percent`, default 80, written only through
-- `/api/billing/preauth-alert-settings`) and again at 100%,
-- a `preauth_used_up` row goes on the inbox for the insurance desk, whose
-- action is "request an enhancement". An admitted patient with a policy in
-- force but no usable pre-auth on the visit (expired, unlinked, not approved
-- or none) gets a `preauth_missing_or_expired` row on the same panel. The check runs in
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
    -- Rows of the new kinds are raised by a trigger, a sweep or the check
    -- itself, so they may be unattributed: migration 1425 widens
    -- `charge_attention_only_detector_unattributed` for them. It is numbered
    -- above every migration that redefines that constraint, so it is last.
    -- A closed row names who closed it, except one the system closed because
    -- the fact it reported stopped being true, and each such resolution only
    -- on the source that can have it. On the admission's "no usable pre-auth"
    -- row: a usable pre-auth is now on the visit (`preauth_found`) or the
    -- patient has no policy in force (`not_insured`). On that row or the
    -- admission's room row: the stay is over and its bill settled (`settled`:
    -- discharged, and every bill paid, cancelled or refunded, or a claim
    -- submitted), or the admission was deleted (`admission_deleted`). On a
    -- used-up row of a pre-auth: it expired and the visit's "no usable
    -- pre-auth" row took over (`preauth_expired`). Nobody acted, so nobody
    -- is named.
    DROP CONSTRAINT IF EXISTS charge_attention_resolved_has_who,
    ADD CONSTRAINT charge_attention_resolved_has_who
        CHECK (status = 'open'
               OR (resolved_at IS NOT NULL
                   AND (resolved_by IS NOT NULL
                        OR (status = 'actioned' AND kind <> 'charge_not_posted'
                            AND ((source_module = 'admission_preauth'
                                  AND evidence ->> 'resolution' IN
                                      ('preauth_found', 'not_insured', 'settled',
                                       'admission_deleted'))
                                 OR (source_module = 'admission_room'
                                     AND evidence ->> 'resolution' IN
                                         ('settled', 'admission_deleted'))
                                 OR (source_module = 'prior_auth'
                                     AND reason = 'preauth_used_up'
                                     AND evidence ->> 'resolution' = 'preauth_expired'))))));

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

-- Whether the visit's money is settled: a claim on one of its bills has gone
-- to the payer, or none of its live bills is still owed (each is paid,
-- cancelled or refunded; `invoice_status` also has draft, issued and
-- partially_paid). Discharge is not the end of the bill: the room, the
-- pharmacy return and the final charges are posted at discharge or after, so
-- the checks keep running on a discharged stay until this is true.
CREATE OR REPLACE FUNCTION public.preauth_visit_settled(p_tenant uuid, p_encounter uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
               SELECT 1 FROM insurance_claims c
                 JOIN invoices i ON i.id = c.invoice_id AND i.tenant_id = c.tenant_id
                WHERE c.tenant_id = p_tenant AND i.encounter_id = p_encounter
                  AND c.deleted_at IS NULL
                  AND c.status IN ('claim_submitted', 'claim_approved', 'claim_rejected',
                                   'settled', 'partially_settled'))
        OR NOT EXISTS (
               SELECT 1 FROM invoices i
                WHERE i.tenant_id = p_tenant AND i.encounter_id = p_encounter
                  AND i.deleted_at IS NULL
                  AND i.status NOT IN ('paid', 'cancelled', 'refunded'));
$$;

-- The share of the approval at which the desk is warned: `tenant_settings`
-- preauth_alerts/`threshold_percent` (Billing settings, its own endpoint,
-- which refuses anything but 1 to 100), 80 when the hospital has not set one.
-- A stored value that is not a number from 1 to 100 returns NULL: the caller
-- warns at the default and marks the row `threshold_invalid`, so the fault is
-- seen on every row it touches without hiding the warning itself.
CREATE OR REPLACE FUNCTION public.preauth_alert_threshold(p_tenant uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
    v_value jsonb;
    v_text  text;
BEGIN
    SELECT s.value INTO v_value
      FROM tenant_settings s
     WHERE s.tenant_id = p_tenant AND s.category = 'preauth_alerts'
       AND s.key = 'threshold_percent' AND s.deleted_at IS NULL;
    IF v_value IS NULL OR v_value = 'null'::jsonb THEN
        RETURN 80;
    END IF;
    v_text := v_value #>> '{}';
    -- Nested, not one OR: SQL does not promise to test the shape first.
    IF jsonb_typeof(v_value) NOT IN ('number', 'string')
       OR v_text !~ '^[0-9]{1,3}(\.[0-9]+)?$' THEN
        RETURN NULL;
    END IF;
    IF v_text::numeric < 1 OR v_text::numeric > 100 THEN
        RETURN NULL;
    END IF;
    RETURN v_text::numeric;
END;
$$;

-- An admitted, insured patient with no usable pre-auth on the visit: raise
-- (or refresh) the admission's `preauth_missing_or_expired` row, saying why:
-- `expired` (the approval on the visit has lapsed, the riskiest: the desk
-- believes the stay is covered), `unlinked` (an approval for the patient is
-- not linked to this visit), `not_approved` (one is on the visit but not
-- approved), or `none` (no pre-auth at all). A patient with no policy in
-- force is self-pay: nothing to raise, and an open row raised while a policy
-- was in force closes, as the system (`not_insured`). Once the desk has
-- dismissed the admission's row (the patient pays cash, the treatment is not
-- covered), it is not raised again for that admission, unless a pre-auth
-- for the patient (on this visit or not yet linked to one) was created after
-- the dismissal: the desk's "none is coming" is then out of date.
CREATE OR REPLACE FUNCTION public.preauth_missing_raise(
    p_tenant uuid, p_admission uuid, p_encounter uuid, p_patient uuid, p_running numeric)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_policy  uuid;
    v_pa      uuid;
    v_status  text;
    v_expires timestamptz;
    v_cause   text;
BEGIN
    SELECT pi.id INTO v_policy
      FROM patient_insurance pi
     WHERE pi.tenant_id = p_tenant AND pi.patient_id = p_patient
       AND pi.deleted_at IS NULL AND pi.is_active
       AND current_date BETWEEN pi.valid_from AND pi.valid_until
     ORDER BY pi.priority, pi.created_at
     LIMIT 1;
    IF v_policy IS NULL THEN
        UPDATE charge_attention_items
           SET status = 'actioned', resolved_at = now(),
               evidence = COALESCE(evidence, '{}'::jsonb)
                          || jsonb_build_object('resolution', 'not_insured')
         WHERE tenant_id = p_tenant AND source_module = 'admission_preauth'
           AND source_entity_id = p_admission AND status = 'open' AND deleted_at IS NULL;
        RETURN 'not_insured';
    END IF;
    IF EXISTS (
        SELECT 1 FROM charge_attention_items c
         WHERE c.tenant_id = p_tenant AND c.source_module = 'admission_preauth'
           AND c.source_entity_id = p_admission AND c.status = 'dismissed'
           AND c.deleted_at IS NULL
           AND NOT EXISTS (
               SELECT 1 FROM prior_auth_requests p
                WHERE p.tenant_id = p_tenant AND p.patient_id = p_patient
                  AND (p.encounter_id = p_encounter OR p.encounter_id IS NULL)
                  AND p.deleted_at IS NULL AND p.created_at > c.resolved_at)) THEN
        RETURN 'dismissed';
    END IF;

    SELECT p.id, p.status::text, p.expires_at INTO v_pa, v_status, v_expires
      FROM prior_auth_requests p
     WHERE p.tenant_id = p_tenant AND p.encounter_id = p_encounter AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC
     LIMIT 1;
    IF v_status IN ('approved', 'partially_approved', 'expired') THEN
        v_cause := 'expired';
    ELSIF EXISTS (
        SELECT 1 FROM prior_auth_requests p
         WHERE p.tenant_id = p_tenant AND p.patient_id = p_patient
           AND p.encounter_id IS NULL AND p.deleted_at IS NULL
           AND p.status IN ('approved', 'partially_approved')
           AND (p.expires_at IS NULL OR p.expires_at > now())) THEN
        v_cause := 'unlinked';
    ELSIF v_pa IS NOT NULL THEN
        v_cause := 'not_approved';
    ELSE
        v_cause := 'none';
    END IF;

    INSERT INTO charge_attention_items
        (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id,
         reason, amount, evidence, service_at)
    VALUES (p_tenant, 'preauth_used_up', 'admission_preauth', p_admission, p_patient,
            p_encounter, 'preauth_missing_or_expired', p_running,
            jsonb_build_object('cause', v_cause, 'patient_insurance_id', v_policy,
                               'prior_auth_id', v_pa, 'prior_auth_status', v_status,
                               'expires_at', v_expires, 'running_bill', p_running),
            now())
    ON CONFLICT (tenant_id, source_module, source_entity_id)
        WHERE status = 'open' AND deleted_at IS NULL
    DO UPDATE SET amount = EXCLUDED.amount, evidence = EXCLUDED.evidence,
                  reason = EXCLUDED.reason, updated_at = now();
    RETURN 'preauth_missing_or_expired';
END;
$$;

-- The check for one visit, shared by the invoice trigger and the sweep.
-- Finds the approved, unexpired pre-auth for the visit, while the patient is
-- still admitted or the discharged stay's bill is not yet settled
-- (`preauth_visit_settled`: the final room charge posted at discharge can
-- pass the approval; a settled stay raises nothing, and the sweep closes its
-- admission rows), and sums the visit's live bills. Without one, an open
-- used-up row on a pre-auth of the visit (one that has since expired) closes
-- as `preauth_expired` (a "could not check" row stays: it is a fault, not a
-- finding), and an insured patient gets the "no usable pre-auth"
-- row above. A threshold that cannot be read warns at the default and marks
-- the row `threshold_invalid`. With one, that row (if any) closes, and the bill is
-- placed in a band: the hospital's threshold (default 80% of the approval)
-- or 100% (the approval used up). Reaching a band raises (or refreshes) the
-- open row. A row already closed at this approved amount and at this band or
-- a higher one is not raised again, so a denied or pending enhancement asked
-- at the threshold still warns again once the bill passes the approval.
-- Returns what it did.
CREATE OR REPLACE FUNCTION public.preauth_usage_raise(
    p_tenant uuid, p_encounter uuid, p_patient uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_admission uuid;
    v_pa        uuid;
    v_approved  numeric;
    v_running   numeric;
    v_threshold numeric;
    v_band      numeric;
    v_reason    text;
    v_invalid   boolean;
BEGIN
    SELECT a.id INTO v_admission
      FROM admissions a
     WHERE a.tenant_id = p_tenant AND a.encounter_id = p_encounter AND a.deleted_at IS NULL
       AND (a.status IN ('admitted', 'transferred')
            OR NOT preauth_visit_settled(p_tenant, p_encounter))
     ORDER BY a.created_at DESC
     LIMIT 1;
    IF v_admission IS NULL THEN
        RETURN 'no_open_stay';
    END IF;

    SELECT COALESCE(SUM(i.total_amount), 0) INTO v_running
      FROM invoices i
     WHERE i.tenant_id = p_tenant AND i.encounter_id = p_encounter
       AND i.deleted_at IS NULL AND i.status NOT IN ('cancelled', 'refunded');

    SELECT p.id, p.approved_amount INTO v_pa, v_approved
      FROM prior_auth_requests p
     WHERE p.tenant_id = p_tenant AND p.encounter_id = p_encounter
       AND p.deleted_at IS NULL
       AND p.status IN ('approved', 'partially_approved')
       AND (p.expires_at IS NULL OR p.expires_at > now())
     ORDER BY p.responded_at DESC NULLS LAST, p.created_at DESC
     LIMIT 1;
    IF v_pa IS NULL THEN
        UPDATE charge_attention_items
           SET status = 'actioned', resolved_at = now(),
               evidence = COALESCE(evidence, '{}'::jsonb)
                          || jsonb_build_object('resolution', 'preauth_expired')
         WHERE tenant_id = p_tenant AND source_module = 'prior_auth'
           AND reason = 'preauth_used_up'
           AND encounter_id = p_encounter AND status = 'open' AND deleted_at IS NULL;
        RETURN preauth_missing_raise(p_tenant, v_admission, p_encounter, p_patient, v_running);
    END IF;

    UPDATE charge_attention_items
       SET status = 'actioned', resolved_at = now(),
           evidence = COALESCE(evidence, '{}'::jsonb)
                      || jsonb_build_object('resolution', 'preauth_found', 'prior_auth_id', v_pa)
     WHERE tenant_id = p_tenant AND source_module = 'admission_preauth'
       AND source_entity_id = v_admission AND status = 'open' AND deleted_at IS NULL;

    v_threshold := preauth_alert_threshold(p_tenant);
    v_invalid := v_threshold IS NULL;
    v_threshold := COALESCE(v_threshold, 80);
    IF v_approved IS NULL OR v_approved <= 0 THEN
        v_reason := 'preauth_approval_unknown';
        v_approved := NULL;
    ELSIF v_running >= v_approved THEN
        v_reason := 'preauth_used_up';
        v_band := 100;
    ELSIF v_running >= v_approved * v_threshold / 100 THEN
        v_reason := 'preauth_used_up';
        v_band := v_threshold;
    ELSE
        RETURN 'within';
    END IF;

    IF EXISTS (
        SELECT 1 FROM charge_attention_items c
         WHERE c.tenant_id = p_tenant AND c.source_module = 'prior_auth'
           AND c.source_entity_id = v_pa AND c.deleted_at IS NULL
           AND c.status <> 'open'
           AND (c.evidence ->> 'approved_amount')::numeric IS NOT DISTINCT FROM v_approved
           AND COALESCE((c.evidence ->> 'band')::numeric, -1) >= COALESCE(v_band, -1)) THEN
        RETURN 'already_actioned';
    END IF;

    INSERT INTO charge_attention_items
        (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id,
         reason, amount, evidence, service_at)
    VALUES (p_tenant, 'preauth_used_up', 'prior_auth', v_pa, p_patient,
            p_encounter, v_reason, v_running,
            jsonb_build_object('approved_amount', v_approved, 'running_bill', v_running,
                               'threshold_percent', v_threshold, 'band', v_band,
                               'threshold_invalid', v_invalid),
            now())
    ON CONFLICT (tenant_id, source_module, source_entity_id)
        WHERE status = 'open' AND deleted_at IS NULL
    DO UPDATE SET amount = EXCLUDED.amount, evidence = EXCLUDED.evidence,
                  reason = EXCLUDED.reason, updated_at = now();
    RETURN v_reason;
END;
$$;

-- Runs after a bill is created with a total or its total grows. A bill with
-- no visit, or for a visit with no approved pre-auth and a patient with no
-- active policy (self-pay), returns before the check's subtransaction. The
-- check never fails the bill: a failure is written to
-- `preauth_check_failures` (the SQLSTATE only, never the message, which can
-- quote the row), and only if even that cannot be written does it fall back
-- to a server-log WARNING. The sweep re-checks the visit either way.
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
    IF NOT EXISTS (
        SELECT 1 FROM prior_auth_requests p
         WHERE p.tenant_id = NEW.tenant_id AND p.encounter_id = NEW.encounter_id
           AND p.deleted_at IS NULL AND p.status IN ('approved', 'partially_approved'))
       AND NOT EXISTS (
        SELECT 1 FROM patient_insurance pi
         WHERE pi.tenant_id = NEW.tenant_id AND pi.patient_id = NEW.patient_id
           AND pi.deleted_at IS NULL AND pi.is_active) THEN
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
