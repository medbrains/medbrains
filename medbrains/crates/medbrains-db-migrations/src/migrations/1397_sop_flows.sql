-- ====================================================================
-- Migration: 1397_sop_flows.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- SOP flows, phase 1 (RFCs/RFC-SOP-FLOWS.md): the dormant workflow tables
-- from 0110 become the flow engine's store.
--
-- workflow_templates: one row per published version of a library flow for a
--   tenant. The stations come from code (`steps` is the snapshot taken at
--   publish, so a running patient keeps the stations they started on); the
--   hospital's choices are `switches`. At most one published version per
--   flow and scope; publishing a new one retires the old one.
-- workflow_instances: one patient (or task) on a flow, pinned to the
--   template row (and version) it started on.
-- workflow_step_logs: one row per station a patient reached: when they
--   arrived, when it cleared, and why it failed.
--
-- Switch changes go through knowledge change sets (area `flow_switches`).
-- Clinical flows need two approvals, the quality officer's and the medical
-- superintendent's, so a set gains a second approver.

ALTER TABLE public.workflow_templates
    ADD COLUMN status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'retired')),
    ADD COLUMN scope text NOT NULL DEFAULT 'hospital'
        CHECK (scope IN ('hospital', 'campus', 'department')),
    ADD COLUMN scope_id uuid,
    ADD COLUMN switches jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN published_from uuid REFERENCES public.workflow_templates(id),
    ADD COLUMN published_at timestamptz,
    ADD COLUMN published_by uuid REFERENCES public.users(id),
    ADD CONSTRAINT workflow_templates_scope_id_shape
        CHECK ((scope = 'hospital') = (scope_id IS NULL));
CREATE UNIQUE INDEX uq_workflow_templates_published
    ON public.workflow_templates (tenant_id, code, scope, COALESCE(scope_id, tenant_id))
    WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_workflow_templates_published_from
    ON public.workflow_templates (published_from);
CREATE INDEX idx_workflow_templates_published_by
    ON public.workflow_templates (published_by);

ALTER TABLE public.workflow_instances
    ADD COLUMN flow_code text,
    ADD COLUMN template_version integer,
    ADD COLUMN subject_type text,
    ADD COLUMN subject_id uuid,
    ADD COLUMN started_by uuid REFERENCES public.users(id),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
    ADD CONSTRAINT workflow_instances_subject_shape
        CHECK ((subject_type IS NULL) = (subject_id IS NULL));
-- One open journey per subject on a flow.
CREATE UNIQUE INDEX uq_workflow_instances_open_subject
    ON public.workflow_instances (tenant_id, flow_code, subject_type, subject_id)
    WHERE status IN ('pending', 'in_progress', 'paused', 'error') AND deleted_at IS NULL;
CREATE INDEX idx_workflow_instances_flow_open
    ON public.workflow_instances (tenant_id, flow_code, current_step)
    WHERE status = 'in_progress' AND deleted_at IS NULL;
CREATE INDEX idx_workflow_instances_started_by ON public.workflow_instances (started_by);
CREATE TRIGGER trg_workflow_instances_updated_at BEFORE UPDATE ON public.workflow_instances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- The control room reads today's station times.
CREATE INDEX idx_workflow_step_logs_tenant_started
    ON public.workflow_step_logs (tenant_id, started_at DESC);
CREATE INDEX idx_workflow_step_logs_actor ON public.workflow_step_logs (actor_id);

-- Tenant isolation forced, with a write check, like the tables around them.
ALTER TABLE public.workflow_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_logs FORCE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation_workflow_templates ON public.workflow_templates;
CREATE POLICY tenant_isolation_workflow_templates ON public.workflow_templates
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
DROP POLICY tenant_isolation_workflow_instances ON public.workflow_instances;
CREATE POLICY tenant_isolation_workflow_instances ON public.workflow_instances
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
DROP POLICY tenant_isolation_workflow_step_logs ON public.workflow_step_logs;
CREATE POLICY tenant_isolation_workflow_step_logs ON public.workflow_step_logs
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Knowledge change sets learn the new area and a second approver.
ALTER TABLE public.knowledge_change_sets
    DROP CONSTRAINT knowledge_change_sets_area_check,
    ADD CONSTRAINT knowledge_change_sets_area_check
        CHECK (area IN ('drug_interactions', 'critical_value_rules', 'flow_switches')),
    ADD COLUMN approver_role text,
    ADD COLUMN second_approver_id uuid REFERENCES public.users(id),
    ADD COLUMN second_approver_role text,
    ADD COLUMN second_approved_at timestamptz,
    -- Two approvals are two people, neither of them the author.
    ADD CONSTRAINT knowledge_change_sets_second_four_eyes CHECK (
        second_approver_id IS NULL
        OR (approver_id IS NOT NULL AND second_approver_id <> author_id
            AND second_approver_id <> approver_id));
CREATE INDEX idx_knowledge_change_sets_second_approver
    ON public.knowledge_change_sets (second_approver_id);
