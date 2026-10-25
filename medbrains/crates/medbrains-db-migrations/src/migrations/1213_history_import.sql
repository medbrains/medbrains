-- ====================================================================
-- Migration: 1213_history_import.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: history_import_batches, history_import_records
-- Drops: none
-- ====================================================================
-- Bringing a hospital's past into MedBrains: visits, admissions, lab
-- results, dispenses, bills and claims from the system it used before.
--
-- A historical record lands in the same tables as a live one, dated when it
-- happened, so reports and the assistant see one history. Every one is
-- traceable to the batch that brought it in:
--
--   history_import_batches  one upload: who ran it, when, dry run or
--                           committed, what it added and what it refused.
--   history_import_records  provenance: (kind, external id) -> the row it
--                           became. Unique per hospital, so the same legacy
--                           record imported twice is skipped, not doubled,
--                           and later batches can point at earlier ones.
--
-- The go-live cut-over lives in tenant_settings (history_import/go_live_at):
-- nothing dated at or after it, or in the future, is accepted, so history
-- can never reach into the live period.

CREATE TABLE public.history_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    label text NOT NULL,
    dry_run boolean NOT NULL,
    status text NOT NULL CHECK (status IN ('validated', 'refused', 'committed')),
    go_live_at timestamptz NOT NULL,
    record_count integer NOT NULL CHECK (record_count >= 0),
    tallies jsonb NOT NULL DEFAULT '[]'::jsonb,
    problems jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_history_import_batches_tenant_created
    ON public.history_import_batches (tenant_id, created_at DESC);
CREATE INDEX idx_history_import_batches_created_by ON public.history_import_batches (created_by);

CREATE TABLE public.history_import_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    batch_id uuid NOT NULL REFERENCES public.history_import_batches(id),
    kind text NOT NULL CHECK (kind IN ('patient', 'visit', 'admission', 'lab_order',
                                       'dispense', 'invoice', 'claim')),
    external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 120),
    target_table text NOT NULL,
    target_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_history_import_records_external
    ON public.history_import_records (tenant_id, kind, external_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_history_import_records_batch ON public.history_import_records (batch_id);
CREATE INDEX idx_history_import_records_target ON public.history_import_records (target_table, target_id);

ALTER TABLE public.history_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_history_import_batches ON public.history_import_batches
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_history_import_batches BEFORE UPDATE ON public.history_import_batches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_history_import_batches_soft_delete BEFORE DELETE ON public.history_import_batches
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.history_import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_import_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_history_import_records ON public.history_import_records
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER set_updated_at_history_import_records BEFORE UPDATE ON public.history_import_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_history_import_records_soft_delete BEFORE DELETE ON public.history_import_records
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
