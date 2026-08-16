-- ====================================================================
-- Migration: 0119_rebac_spicedb_outbox.sql
-- RLS-Posture: tenant-scoped via relation_tuples
-- Tenant-Column: tenant_id
-- ====================================================================
-- SpiceDB is the low-latency ReBAC graph, but the HMS must not lose
-- patient access grants when the sidecar is restarting or temporarily
-- unavailable. relation_tuples is now the durable write-ahead/outbox
-- record for every SpiceDB relationship mutation.

ALTER TABLE public.relation_tuples
    ADD COLUMN IF NOT EXISTS spicedb_sync_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS spicedb_synced_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS spicedb_last_error text,
    ADD COLUMN IF NOT EXISTS spicedb_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS spicedb_next_attempt_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.relation_tuples
    DROP CONSTRAINT IF EXISTS relation_tuples_spicedb_sync_status_check;

ALTER TABLE public.relation_tuples
    ADD CONSTRAINT relation_tuples_spicedb_sync_status_check
    CHECK (
        spicedb_sync_status = ANY (
            ARRAY[
                'pending'::text,
                'applied'::text,
                'failed'::text,
                'skipped'::text
            ]
        )
    );

CREATE INDEX IF NOT EXISTS rt_spicedb_outbox_idx
    ON public.relation_tuples (tenant_id, spicedb_next_attempt_at, tuple_id)
    WHERE spicedb_sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS rt_spicedb_failed_idx
    ON public.relation_tuples (tenant_id, spicedb_attempts DESC, tuple_id)
    WHERE spicedb_sync_status = 'failed';
