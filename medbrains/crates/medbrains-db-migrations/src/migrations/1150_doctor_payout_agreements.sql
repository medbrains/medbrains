-- ====================================================================
-- Migration: 1150_doctor_payout_agreements.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: doctor_payout_settings, doctor_payout_policy_events
-- Drops: incentive_plan_rules.multiplier, incentive_plans_tenant_id_plan_code_key
-- ====================================================================
-- Doctor payouts (#4886): the hospital's defaults, the per-doctor agreement
-- and the versioned rate card. The incentive tables already existed with a
-- placeholder engine; they become the agreement (doctor_incentive_assignments),
-- the rate card (incentive_plans) and its lines (incentive_plan_rules).
--
-- Owner decisions (2026-10-20) are settings, not code: the earning basis, how
-- discounts and insurer deductions are shared, the referral switches and the
-- cash warning limit are all columns here.
--
-- TDS: the section is data because the statute was renumbered mid-life —
-- s.194J until 31 Mar 2026, s.393(1) Table entry 6(iii) of the Income-tax
-- Act 2025 from 1 Apr 2026 [verify with the CA]. Rs 50,000 per FY threshold,
-- 20% without a PAN (former s.206AA).

CREATE TABLE public.doctor_payout_settings (
    tenant_id uuid NOT NULL PRIMARY KEY REFERENCES public.tenants(id),
    default_basis text NOT NULL DEFAULT 'collected'
        CHECK (default_basis IN ('billed', 'collected', 'realised')),
    default_share_on text NOT NULL DEFAULT 'net'
        CHECK (default_share_on IN ('gross', 'net')),
    default_discount_bearer text NOT NULL DEFAULT 'pro_rata'
        CHECK (default_discount_bearer IN ('hospital', 'doctor', 'pro_rata')),
    default_disallowance_bearer text NOT NULL DEFAULT 'pro_rata'
        CHECK (default_disallowance_bearer IN ('hospital', 'doctor', 'pro_rata')),
    excluded_categories text[] NOT NULL DEFAULT ARRAY['pharmacy', 'implant', 'consumable']::text[],
    tds_section_code text NOT NULL DEFAULT '393(1)',
    tds_section_label text NOT NULL
        DEFAULT 'Income-tax Act 2025 s.393(1) Table 6(iii), professional fees (former s.194J)',
    tds_rate numeric(5,2) NOT NULL DEFAULT 10 CHECK (tds_rate BETWEEN 0 AND 100),
    tds_no_pan_rate numeric(5,2) NOT NULL DEFAULT 20 CHECK (tds_no_pan_rate BETWEEN 0 AND 100),
    tds_threshold numeric(12,2) NOT NULL DEFAULT 50000 CHECK (tds_threshold >= 0),
    cash_daily_warn_limit numeric(12,2) NOT NULL DEFAULT 10000 CHECK (cash_daily_warn_limit >= 0),
    referral_enabled boolean NOT NULL DEFAULT false,
    referral_individuals_enabled boolean NOT NULL DEFAULT false,
    referral_tds_section_code text NOT NULL DEFAULT '393(1)-commission',
    referral_tds_rate numeric(5,2) NOT NULL DEFAULT 2 CHECK (referral_tds_rate BETWEEN 0 AND 100),
    referral_tds_threshold numeric(12,2) NOT NULL DEFAULT 20000 CHECK (referral_tds_threshold >= 0),
    updated_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_payout_settings_individuals_need_referral
        CHECK (NOT referral_individuals_enabled OR referral_enabled)
);

ALTER TABLE public.doctor_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payout_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_payout_settings ON public.doctor_payout_settings
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_doctor_payout_settings BEFORE UPDATE ON public.doctor_payout_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_doctor_payout_settings_soft_delete BEFORE DELETE ON public.doctor_payout_settings
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Every flip of a referral switch, with the exact text the person acknowledged.
-- Append-only: the audit of who accepted the IMC Reg 6.4 / Apex Labs position.
CREATE TABLE public.doctor_payout_policy_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    switch text NOT NULL CHECK (switch IN ('referral', 'referral_individuals')),
    enabled boolean NOT NULL,
    acknowledgement text,
    acted_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT doctor_payout_policy_events_ack CHECK (NOT enabled OR length(acknowledgement) > 0)
);
CREATE INDEX idx_doctor_payout_policy_events ON public.doctor_payout_policy_events (tenant_id, created_at DESC);

ALTER TABLE public.doctor_payout_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_payout_policy_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_doctor_payout_policy_events ON public.doctor_payout_policy_events
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_doctor_payout_policy_events BEFORE UPDATE ON public.doctor_payout_policy_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_doctor_payout_policy_events_soft_delete BEFORE DELETE ON public.doctor_payout_policy_events
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Agreement ─────────────────────────────────────────────────────────
ALTER TABLE public.doctor_incentive_assignments
    ADD COLUMN engagement_type text NOT NULL DEFAULT 'fee_for_service'
        CHECK (engagement_type IN ('salaried', 'retainer', 'fee_for_service', 'visiting', 'day', 'on_call')),
    ADD COLUMN accrual_basis text CHECK (accrual_basis IN ('billed', 'collected', 'realised')),
    ADD COLUMN share_on text CHECK (share_on IN ('gross', 'net')),
    ADD COLUMN discount_bearer text CHECK (discount_bearer IN ('hospital', 'doctor', 'pro_rata')),
    ADD COLUMN disallowance_bearer text CHECK (disallowance_bearer IN ('hospital', 'doctor', 'pro_rata')),
    ADD COLUMN charity_rule text NOT NULL DEFAULT 'zero' CHECK (charity_rule IN ('zero', 'full', 'fixed')),
    ADD COLUMN charity_fixed_amount numeric(12,2) CHECK (charity_fixed_amount >= 0),
    ADD COLUMN session_minimum numeric(12,2) CHECK (session_minimum >= 0),
    ADD COLUMN settlement_cycle text NOT NULL DEFAULT 'monthly' CHECK (settlement_cycle IN ('same_day', 'monthly')),
    ADD COLUMN tds_section_code text,
    ADD COLUMN pan text CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
    ADD COLUMN payout_mode text NOT NULL DEFAULT 'bank' CHECK (payout_mode IN ('bank', 'upi', 'cash')),
    ADD COLUMN bank_account_name text,
    ADD COLUMN bank_account_number text CHECK (bank_account_number ~ '^[0-9]{6,20}$'),
    ADD COLUMN bank_ifsc text CHECK (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    ADD COLUMN upi_vpa text CHECK (upi_vpa ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$'),
    ADD COLUMN notes text,
    ADD COLUMN created_by uuid REFERENCES public.users(id),
    ADD COLUMN updated_by uuid REFERENCES public.users(id),
    ADD CONSTRAINT doctor_incentive_assignments_charity_fixed
        CHECK (charity_rule <> 'fixed' OR charity_fixed_amount IS NOT NULL),
    ADD CONSTRAINT doctor_incentive_assignments_dates
        CHECK (effective_to IS NULL OR effective_to >= effective_from);

CREATE TRIGGER set_updated_at_doctor_incentive_assignments BEFORE UPDATE ON public.doctor_incentive_assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Rate card (versioned; a used version is frozen) ──────────────────
ALTER TABLE public.incentive_plans
    ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
    ADD COLUMN frozen_at timestamptz,
    ADD COLUMN supersedes_id uuid REFERENCES public.incentive_plans(id),
    DROP CONSTRAINT incentive_plans_tenant_id_plan_code_key;
CREATE UNIQUE INDEX uq_incentive_plans_code_version ON public.incentive_plans (tenant_id, plan_code, version)
    WHERE deleted_at IS NULL;
CREATE TRIGGER set_updated_at_incentive_plans BEFORE UPDATE ON public.incentive_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Rate-card lines. `service_type` is the category match; min/max_threshold
-- cap the computed share. A NULL matcher means "any".
ALTER TABLE public.incentive_plan_rules
    ADD COLUMN tenant_id uuid REFERENCES public.tenants(id),
    ADD COLUMN match_charge_code text,
    ADD COLUMN payer_class text CHECK (payer_class IN ('cash', 'tpa', 'cghs', 'echs', 'pmjay', 'esis', 'state_scheme')),
    ADD COLUMN visit_kind text CHECK (visit_kind IN ('first', 'follow_up')),
    ADD COLUMN role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'assistant', 'anaesthetist')),
    ADD COLUMN calc_kind text NOT NULL DEFAULT 'percent' CHECK (calc_kind IN ('percent', 'fixed')),
    DROP COLUMN multiplier;
UPDATE public.incentive_plan_rules r SET tenant_id = p.tenant_id
  FROM public.incentive_plans p WHERE p.id = r.plan_id;
ALTER TABLE public.incentive_plan_rules
    ALTER COLUMN tenant_id SET NOT NULL,
    ADD CONSTRAINT incentive_plan_rules_amount CHECK (
        (calc_kind = 'percent' AND percentage IS NOT NULL AND percentage BETWEEN 0 AND 100)
        OR (calc_kind = 'fixed' AND fixed_amount IS NOT NULL AND fixed_amount >= 0)
    ) NOT VALID,
    ADD CONSTRAINT incentive_plan_rules_caps
        CHECK (min_threshold IS NULL OR max_threshold IS NULL OR max_threshold >= min_threshold);
COMMENT ON COLUMN public.incentive_plan_rules.service_type IS 'Category matched (charge_master.category or invoice line source); NULL = any';
COMMENT ON COLUMN public.incentive_plan_rules.min_threshold IS 'Minimum share per line (cap floor)';
COMMENT ON COLUMN public.incentive_plan_rules.max_threshold IS 'Maximum share per line (cap ceiling)';

ALTER TABLE public.incentive_plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_plan_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_incentive_plan_rules ON public.incentive_plan_rules
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
