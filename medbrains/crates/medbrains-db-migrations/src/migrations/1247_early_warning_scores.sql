-- ====================================================================
-- Migration: 1247_early_warning_scores.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: ews_encounter_plans, ews_escalations
-- Drops: none
-- ====================================================================
-- Early-warning scores computed from every charted set of vitals.
--
-- NEWS2, PEWS and MEOWS existed only as calculators a nurse re-typed vitals
-- into. Now each vitals reading carries the score of the tool that fits the
-- patient (NEWS2 adults, PEWS children by age band, MEOWS pregnant and
-- post-partum women), its band, whether it was complete, and when the next
-- full set is due. The parameters the scores need that the vitals row did
-- not hold are added: ACVPU consciousness, oxygen device / flow / FiO2,
-- central capillary refill and respiratory distress.
--
-- A score in an escalating band (urgent / emergency by default) opens an
-- escalation: the nurse in charge, the primary nurse, the attending doctor
-- and the duty doctor are notified, someone must acknowledge it with what
-- they did, and an unacknowledged one goes further each window. One open
-- escalation per encounter; a worse band supersedes it.
--
-- A patient's scoring plan — SpO2 Scale 2 for hypercapnic respiratory
-- failure (RCP NEWS2: prescribed by a clinical decision maker), or an
-- explicit tool — is per encounter. The hospital's frequencies and windows
-- live in tenant_settings ('ews', 'policy'); with no row, the code defaults.

ALTER TABLE public.vitals
    ADD COLUMN consciousness text CHECK (consciousness IN ('A', 'C', 'V', 'P', 'U')),
    ADD COLUMN oxygen_device text
        CHECK (oxygen_device IN ('room_air', 'nasal_prongs', 'mask', 'high_flow', 'other')),
    ADD COLUMN oxygen_flow_lpm numeric(4,1) CHECK (oxygen_flow_lpm >= 0 AND oxygen_flow_lpm <= 80),
    ADD COLUMN fio2_percent integer CHECK (fio2_percent BETWEEN 21 AND 100),
    ADD COLUMN capillary_refill_seconds numeric(3,1)
        CHECK (capillary_refill_seconds >= 0 AND capillary_refill_seconds <= 20),
    ADD COLUMN respiratory_distress text
        CHECK (respiratory_distress IN ('nil', 'mild', 'moderate', 'severe')),
    ADD COLUMN ews_tool text CHECK (ews_tool IN ('news2', 'pews', 'meows')),
    ADD COLUMN ews_total integer,
    ADD COLUMN ews_band text
        CHECK (ews_band IN ('routine', 'low', 'low_medium', 'urgent', 'emergency')),
    ADD COLUMN ews_incomplete boolean,
    ADD COLUMN ews_missing text[],
    ADD COLUMN ews_params jsonb,
    ADD COLUMN ews_spo2_scale smallint CHECK (ews_spo2_scale IN (1, 2)),
    ADD COLUMN ews_age_band text,
    ADD COLUMN ews_next_due_at timestamptz,
    ADD CONSTRAINT vitals_ews_scored CHECK (
        ews_tool IS NULL OR (ews_total IS NOT NULL AND ews_band IS NOT NULL
                             AND ews_incomplete IS NOT NULL AND ews_next_due_at IS NOT NULL));

CREATE TABLE public.ews_encounter_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    encounter_id uuid NOT NULL REFERENCES public.encounters(id),
    spo2_scale2 boolean NOT NULL DEFAULT false,
    -- The target range the clinician set with Scale 2, e.g. '88-92%'.
    scale2_target text,
    tool_override text CHECK (tool_override IN ('news2', 'pews', 'meows')),
    reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
    set_by uuid NOT NULL REFERENCES public.users(id),
    set_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_ews_encounter_plans_encounter
    ON public.ews_encounter_plans (tenant_id, encounter_id) WHERE deleted_at IS NULL;

CREATE TABLE public.ews_escalations (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    encounter_id uuid NOT NULL REFERENCES public.encounters(id),
    admission_id uuid NOT NULL REFERENCES public.admissions(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    -- The reading that opened it, and the latest one while it stays open.
    vitals_id uuid NOT NULL REFERENCES public.vitals(id),
    latest_vitals_id uuid NOT NULL REFERENCES public.vitals(id),
    ews_tool text NOT NULL CHECK (ews_tool IN ('news2', 'pews', 'meows')),
    ews_total integer NOT NULL,
    band text NOT NULL CHECK (band IN ('low_medium', 'urgent', 'emergency')),
    incomplete boolean NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'superseded')),
    -- 0 when it opened; +1 each time it goes further unacknowledged.
    level integer NOT NULL DEFAULT 0 CHECK (level >= 0),
    notified_user_ids uuid[] NOT NULL DEFAULT '{}',
    next_escalation_at timestamptz NOT NULL,
    last_escalated_at timestamptz,
    acknowledged_by uuid REFERENCES public.users(id),
    acknowledged_at timestamptz,
    response_action text CHECK (response_action IN (
        'bedside_review', 'medical_review', 'plan_changed', 'rapid_response_called',
        'transfer_higher_care', 'other')),
    response_note text,
    superseded_by uuid REFERENCES public.ews_escalations(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT ews_escalations_acknowledged CHECK (
        status <> 'acknowledged' OR (acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL
            AND response_action IS NOT NULL AND length(btrim(COALESCE(response_note, ''))) >= 3))
);

CREATE UNIQUE INDEX uq_ews_escalations_open
    ON public.ews_escalations (tenant_id, encounter_id) WHERE status = 'open' AND deleted_at IS NULL;
CREATE INDEX idx_ews_escalations_due
    ON public.ews_escalations (next_escalation_at) WHERE status = 'open' AND deleted_at IS NULL;
CREATE INDEX idx_ews_escalations_admission
    ON public.ews_escalations (tenant_id, admission_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.ews_encounter_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ews_encounter_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ews_encounter_plans ON public.ews_encounter_plans
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_ews_encounter_plans BEFORE UPDATE ON public.ews_encounter_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ews_encounter_plans_soft_delete BEFORE DELETE ON public.ews_encounter_plans
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_ews_encounter_plans
    AFTER INSERT OR DELETE OR UPDATE ON public.ews_encounter_plans
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');

ALTER TABLE public.ews_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ews_escalations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ews_escalations ON public.ews_escalations
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_ews_escalations BEFORE UPDATE ON public.ews_escalations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ews_escalations_soft_delete BEFORE DELETE ON public.ews_escalations
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_ews_escalations
    AFTER INSERT OR DELETE OR UPDATE ON public.ews_escalations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('clinical');
