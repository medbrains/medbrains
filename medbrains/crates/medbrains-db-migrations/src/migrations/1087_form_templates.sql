-- ====================================================================
-- Migration: 1087_form_templates.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: form_templates, form_template_versions
-- Drops: none
-- ====================================================================
-- A hospital builds or customises its own forms. The template holds the
-- draft being edited; publishing copies the draft into a numbered version
-- that never changes again, and every record filled in keeps the version id
-- it was answered against — so a consent signed last year still shows the
-- exact questions the patient saw.

CREATE TABLE public.form_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{1,62}$'),
    name text NOT NULL,
    module text NOT NULL,
    draft jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
    published_version integer,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);

CREATE UNIQUE INDEX uq_form_templates_code ON public.form_templates (tenant_id, code)
    WHERE deleted_at IS NULL;

CREATE TABLE public.form_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    template_id uuid NOT NULL REFERENCES public.form_templates(id),
    version integer NOT NULL CHECK (version > 0),
    definition jsonb NOT NULL,
    published_by uuid NOT NULL REFERENCES public.users(id),
    published_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, version)
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_form_templates ON public.form_templates
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE public.form_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_template_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_form_template_versions ON public.form_template_versions
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_form_templates BEFORE UPDATE ON public.form_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_form_templates_soft_delete BEFORE DELETE ON public.form_templates
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
-- A published version is evidence of what was asked: it is never edited or removed.
CREATE TRIGGER trg_form_template_versions_append_only BEFORE UPDATE OR DELETE
    ON public.form_template_versions
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();

-- The consent pilot: which published version a consent was taken against
-- (NULL = the built-in form).
ALTER TABLE public.procedure_consents
    ADD COLUMN form_version_id uuid REFERENCES public.form_template_versions(id);
