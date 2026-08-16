-- Migration: 0159_tokens.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: tokens (unified multi-module queue/token system)
-- One token stream model for every module + scope (department / room /
-- counter / combined). Drives TV / web / mobile token boards + "now serving".
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    -- registration | opd | pharmacy | billing | lab | radiology | dispatch | ...
    module text NOT NULL,
    -- department | room | counter | combined | global
    scope text NOT NULL DEFAULT 'department',
    scope_id uuid,                    -- department / room / counter id (null for global)
    scope_label text,                 -- display label, e.g. "OPD Room 3", "Counter 2"
    number text NOT NULL,             -- printed token, e.g. "T-014"
    seq integer NOT NULL,             -- per (tenant, module, scope, scope_id, token_date)
    -- waiting | called | serving | completed | no_show | cancelled
    status text NOT NULL DEFAULT 'waiting',
    priority text NOT NULL DEFAULT 'normal',  -- normal | urgent | stat
    patient_id uuid,
    patient_name text,                -- denormalised for display; privacy-gated on read
    entity_type text,                 -- source resource: encounter | order | invoice | ...
    entity_id uuid,
    counter_label text,               -- where it is being served (set on call)
    issued_by uuid,
    called_by uuid,
    called_at timestamp with time zone,
    served_at timestamp with time zone,
    completed_at timestamp with time zone,
    token_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tokens
    ADD CONSTRAINT tokens_pkey PRIMARY KEY (id);

-- Board read path: a module's live queue for a scope on a date.
CREATE INDEX IF NOT EXISTS idx_tokens_board
    ON public.tokens (tenant_id, module, scope, scope_id, token_date, status);
-- "My token" lookups.
CREATE INDEX IF NOT EXISTS idx_tokens_patient
    ON public.tokens (tenant_id, patient_id, token_date);

ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tokens ON public.tokens;
CREATE POLICY tenant_isolation_tokens ON public.tokens
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER tokens_set_updated_at
    BEFORE UPDATE ON public.tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
