-- ====================================================================
-- Migration: 1391_knowledge_change_sets.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: knowledge_change_sets, knowledge_change_items
-- Drops: none
-- ====================================================================
-- Knowledge change sets (RFCs/RFC-KNOWLEDGE-CHANGE-SETS.md).
--
-- A change to the clinical knowledge a hospital runs on (drug interactions,
-- critical lab values) is drafted as a set of items, previewed for who it
-- affects, approved by a second person, applied all-or-nothing, and can be
-- rolled back by a new set. `before` is captured at preview and re-checked at
-- apply: if the live row moved, apply refuses and the set becomes `stale`.
-- `proof_canonical` is the exact text `proof_hash` is the sha256 of, so an
-- auditor can recompute it offline.

CREATE TABLE public.knowledge_change_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    area text NOT NULL CHECK (area IN ('drug_interactions', 'critical_value_rules')),
    title text NOT NULL CHECK (length(btrim(title)) > 0),
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN
        ('draft', 'previewed', 'approved', 'applied', 'rolled_back', 'rejected', 'stale')),
    author_id uuid NOT NULL REFERENCES public.users(id),
    approver_id uuid REFERENCES public.users(id),
    decision_note text,
    rejected_by uuid REFERENCES public.users(id),
    rejected_at timestamptz,
    applied_by uuid REFERENCES public.users(id),
    rollback_of_set_id uuid REFERENCES public.knowledge_change_sets(id),
    rolled_back_by_set_id uuid REFERENCES public.knowledge_change_sets(id),
    previewed_at timestamptz,
    approved_at timestamptz,
    applied_at timestamptz,
    base_hash text,
    proof_hash text,
    proof_canonical text,
    impact jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    -- Nobody approves their own change, whatever the code path.
    CONSTRAINT knowledge_change_sets_four_eyes CHECK (approver_id IS NULL OR approver_id <> author_id)
);
CREATE INDEX idx_knowledge_change_sets_tenant_status
    ON public.knowledge_change_sets (tenant_id, status, created_at DESC);
CREATE INDEX idx_knowledge_change_sets_author ON public.knowledge_change_sets (author_id);
CREATE INDEX idx_knowledge_change_sets_approver ON public.knowledge_change_sets (approver_id);
CREATE INDEX idx_knowledge_change_sets_rejected_by ON public.knowledge_change_sets (rejected_by);
CREATE INDEX idx_knowledge_change_sets_applied_by ON public.knowledge_change_sets (applied_by);
CREATE INDEX idx_knowledge_change_sets_rolled_back_by
    ON public.knowledge_change_sets (rolled_back_by_set_id);
-- At most one live rollback per applied set.
CREATE UNIQUE INDEX uq_knowledge_change_sets_rollback_of
    ON public.knowledge_change_sets (rollback_of_set_id)
    WHERE rollback_of_set_id IS NOT NULL AND status <> 'rejected' AND deleted_at IS NULL;

CREATE TABLE public.knowledge_change_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    change_set_id uuid NOT NULL REFERENCES public.knowledge_change_sets(id),
    target_kind text NOT NULL,
    -- The row's id for update/delete; for create, filled in at apply.
    target_key text,
    op text NOT NULL CHECK (op IN ('create', 'update', 'delete')),
    before jsonb,
    after jsonb,
    seq integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT knowledge_change_items_after_shape CHECK ((op = 'delete') = (after IS NULL))
);
CREATE UNIQUE INDEX uq_knowledge_change_items_seq
    ON public.knowledge_change_items (change_set_id, seq) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_change_items_tenant ON public.knowledge_change_items (tenant_id);
CREATE INDEX idx_knowledge_change_items_target
    ON public.knowledge_change_items (tenant_id, target_kind, target_key);

ALTER TABLE public.knowledge_change_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_change_sets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_change_sets ON public.knowledge_change_sets
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
ALTER TABLE public.knowledge_change_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_change_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_knowledge_change_items ON public.knowledge_change_items
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE TRIGGER set_updated_at_knowledge_change_sets BEFORE UPDATE ON public.knowledge_change_sets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_knowledge_change_items BEFORE UPDATE ON public.knowledge_change_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_knowledge_change_sets_soft_delete BEFORE DELETE ON public.knowledge_change_sets
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
CREATE TRIGGER trg_knowledge_change_items_soft_delete BEFORE DELETE ON public.knowledge_change_items
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
