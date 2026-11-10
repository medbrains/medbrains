-- ====================================================================
-- Migration: 1290_dpdp_compliance_pack.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: privacy_officers, compliance_policies, compliance_drills
-- Drops: none
-- ====================================================================
-- The hospital's DPDP Act 2023 / DPDP Rules 2025 and CERT-In 2022 pack.
--
-- privacy_officers: who patients and CERT-In reach.
--   * dpo / grievance_officer — the business contact a Data Fiduciary must
--     publish and quote in every response to a rights request (Rules r.9),
--     and the grievance redressal channel (r.14(3), within 90 days).
--   * certin_poc — the Point of Contact CERT-In writes to (Directions
--     No. 20(3)/2022-CERT-In of 28-04-2022, direction (iii)).
--   One live row per role; published_at records when the contact went to
--   patients (portal and printed notice).
--
-- compliance_policies: the policy pack, versioned per (kind, language).
--   A draft is written from a template, sent for review, and approved by a
--   different person — approval publishes it and supersedes the version
--   it replaces. Published text is never edited; a change is a new version.
--   Every template is marked for review with counsel before use.
--
-- compliance_drills: breach-response drills, so an untested plan shows as a
--   gap.

CREATE TABLE public.privacy_officers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    role text NOT NULL CHECK (role IN ('dpo', 'grievance_officer', 'certin_poc')),
    user_id uuid REFERENCES public.users(id),
    name text NOT NULL CHECK (length(btrim(name)) >= 2),
    designation text NOT NULL CHECK (length(btrim(designation)) >= 2),
    email text NOT NULL CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    phone text NOT NULL CHECK (length(btrim(phone)) >= 6),
    address text,
    hours text,
    published_at timestamptz,
    published_by uuid REFERENCES public.users(id),
    updated_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_privacy_officers_role
    ON public.privacy_officers (tenant_id, role) WHERE deleted_at IS NULL;

CREATE TABLE public.compliance_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    kind text NOT NULL CHECK (kind IN (
        'privacy_notice', 'retention_schedule', 'breach_response_plan',
        'processor_policy', 'children_data_policy', 'confidentiality_undertaking')),
    language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'ta')),
    version integer NOT NULL CHECK (version >= 1),
    title text NOT NULL CHECK (length(btrim(title)) >= 3),
    body text NOT NULL CHECK (length(btrim(body)) >= 20),
    template_version text,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_review', 'published', 'superseded', 'returned')),
    drafted_by uuid NOT NULL REFERENCES public.users(id),
    submitted_at timestamptz,
    decided_by uuid REFERENCES public.users(id),
    decided_at timestamptz,
    return_reason text,
    published_at timestamptz,
    superseded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT compliance_policies_maker_checker
        CHECK (decided_by IS NULL OR decided_by <> drafted_by),
    CONSTRAINT compliance_policies_published
        CHECK (status NOT IN ('published', 'superseded')
               OR (published_at IS NOT NULL AND decided_by IS NOT NULL)),
    CONSTRAINT compliance_policies_returned
        CHECK (status <> 'returned' OR return_reason IS NOT NULL)
);

CREATE UNIQUE INDEX uq_compliance_policies_version
    ON public.compliance_policies (tenant_id, kind, language, version) WHERE deleted_at IS NULL;
-- One published version of each policy in each language.
CREATE UNIQUE INDEX uq_compliance_policies_published
    ON public.compliance_policies (tenant_id, kind, language)
    WHERE status = 'published' AND deleted_at IS NULL;
-- One open draft at a time, so two people do not edit rival drafts.
CREATE UNIQUE INDEX uq_compliance_policies_open_draft
    ON public.compliance_policies (tenant_id, kind, language)
    WHERE status IN ('draft', 'in_review', 'returned') AND deleted_at IS NULL;

CREATE TABLE public.compliance_drills (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    kind text NOT NULL DEFAULT 'breach_response' CHECK (kind IN ('breach_response')),
    held_on date NOT NULL,
    format text NOT NULL CHECK (format IN ('tabletop', 'live')),
    scenario text NOT NULL CHECK (length(btrim(scenario)) >= 3),
    findings text NOT NULL CHECK (length(btrim(findings)) >= 3),
    next_due_on date NOT NULL,
    conducted_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT compliance_drills_next_after CHECK (next_due_on > held_on)
);

CREATE INDEX idx_compliance_drills_latest
    ON public.compliance_drills (tenant_id, kind, held_on DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.privacy_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_officers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_privacy_officers ON public.privacy_officers
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_privacy_officers BEFORE UPDATE ON public.privacy_officers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_privacy_officers_soft_delete BEFORE DELETE ON public.privacy_officers
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_privacy_officers AFTER INSERT OR DELETE OR UPDATE ON public.privacy_officers
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('compliance');

ALTER TABLE public.compliance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_policies ON public.compliance_policies
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_compliance_policies BEFORE UPDATE ON public.compliance_policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_compliance_policies_soft_delete BEFORE DELETE ON public.compliance_policies
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_compliance_policies AFTER INSERT OR DELETE OR UPDATE ON public.compliance_policies
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('compliance');

ALTER TABLE public.compliance_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_drills FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_compliance_drills ON public.compliance_drills
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER set_updated_at_compliance_drills BEFORE UPDATE ON public.compliance_drills
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_compliance_drills_soft_delete BEFORE DELETE ON public.compliance_drills
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER audit_compliance_drills AFTER INSERT OR DELETE OR UPDATE ON public.compliance_drills
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('compliance');
