-- ====================================================================
-- Migration: 1100_sticky_notes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: sticky_notes, sticky_note_shares
-- Drops: none
-- ====================================================================
-- The paper notes on a nurses' station: a person writes a note, keeps it or
-- pins it to a department's board or hands it to a colleague. The author owns
-- it; a share is who else may read it. A note can clear itself at a set time
-- (`expires_at`) — "Dr Rao on leave Thursday" should not outlive Thursday.

CREATE TABLE public.sticky_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    author_id uuid NOT NULL REFERENCES public.users(id),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    colour text NOT NULL DEFAULT 'yellow'
        CHECK (colour IN ('yellow', 'blue', 'green', 'pink', 'gray')),
    pinned boolean NOT NULL DEFAULT false,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text
);

CREATE INDEX idx_sticky_notes_author ON public.sticky_notes (tenant_id, author_id)
    WHERE deleted_at IS NULL;

-- Exactly one target: a department's board or one colleague.
CREATE TABLE public.sticky_note_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    note_id uuid NOT NULL REFERENCES public.sticky_notes(id),
    department_id uuid REFERENCES public.departments(id),
    user_id uuid REFERENCES public.users(id),
    shared_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid REFERENCES public.users(id),
    delete_reason text,
    CHECK (num_nonnulls(department_id, user_id) = 1)
);

CREATE UNIQUE INDEX uq_sticky_note_shares_department
    ON public.sticky_note_shares (note_id, department_id)
    WHERE deleted_at IS NULL AND department_id IS NOT NULL;
CREATE UNIQUE INDEX uq_sticky_note_shares_user
    ON public.sticky_note_shares (note_id, user_id)
    WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX idx_sticky_note_shares_department
    ON public.sticky_note_shares (tenant_id, department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sticky_note_shares_user
    ON public.sticky_note_shares (tenant_id, user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sticky_notes ON public.sticky_notes
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_sticky_notes BEFORE UPDATE ON public.sticky_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sticky_notes_soft_delete BEFORE DELETE ON public.sticky_notes
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.sticky_note_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_note_shares FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_sticky_note_shares ON public.sticky_note_shares
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_sticky_note_shares BEFORE UPDATE ON public.sticky_note_shares
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sticky_note_shares_soft_delete BEFORE DELETE ON public.sticky_note_shares
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
