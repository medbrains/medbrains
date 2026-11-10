-- ====================================================================
-- Migration: 1219_history_import_skip_hardening.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The row-audit skip that keeps a history import from holding the audit-chain
-- lock (1218) must not be a way to write unaudited rows.
--
-- A batch is now 'running' while its own transaction imports it, and records
-- that transaction's id (import_txid). The audit trigger skips a row only when
-- the setting names this hospital's batch, still running, started by the
-- current transaction. The batch is marked finished (validated / refused /
-- committed, import_txid cleared) before that transaction commits, and a
-- rolled-back batch leaves no row at all, so no committed batch ever matches.

ALTER TABLE public.history_import_batches ADD COLUMN import_txid bigint;
ALTER TABLE public.history_import_batches DROP CONSTRAINT history_import_batches_status_check;
ALTER TABLE public.history_import_batches ADD CONSTRAINT history_import_batches_status_check
    CHECK (status IN ('running', 'validated', 'refused', 'committed'));
-- A batch is running only inside its own transaction.
ALTER TABLE public.history_import_batches ADD CONSTRAINT history_import_batches_running_txid_check
    CHECK ((status = 'running') = (import_txid IS NOT NULL));

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_tenant_id     UUID;
    v_user_id       UUID;
    v_ip_address    TEXT;
    v_user_agent    TEXT;
    v_session_id    UUID;
    v_correlation   UUID;
    v_old_values    JSONB;
    v_new_values    JSONB;
    v_entity_id     UUID;
    v_skip          BOOLEAN := false;
BEGIN
    -- Read context from session GUCs (set by application middleware)
    BEGIN
        v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL;
    END;
    BEGIN
        v_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_user_id := NULL;
    END;
    BEGIN
        v_ip_address := NULLIF(current_setting('app.ip_address', true), '');
    EXCEPTION WHEN OTHERS THEN v_ip_address := NULL;
    END;
    BEGIN
        v_user_agent := NULLIF(current_setting('app.user_agent', true), '');
    EXCEPTION WHEN OTHERS THEN v_user_agent := NULL;
    END;
    BEGIN
        v_session_id := NULLIF(current_setting('app.session_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_session_id := NULL;
    END;
    BEGIN
        v_correlation := NULLIF(current_setting('app.correlation_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN v_correlation := NULL;
    END;

    -- Without tenant context we cannot audit; bail out silently rather
    -- than failing the underlying write.
    IF v_tenant_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- A historical-import batch is audited once, as a batch, and every row it
    -- writes is traced in history_import_records (see 1218). The skip holds
    -- only inside the importing transaction itself: the setting must name a
    -- batch of this hospital that is still running and was started by this
    -- very transaction. A finished, refused or dry-run batch, another
    -- hospital's batch, or a setting left over on a pooled connection never
    -- switches auditing off.
    IF NULLIF(current_setting('app.history_import_batch', true), '') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM history_import_batches b
            WHERE b.id = NULLIF(current_setting('app.history_import_batch', true), '')::uuid
              AND b.tenant_id = v_tenant_id
              AND b.status = 'running'
              AND b.import_txid = txid_current()
       ) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        v_entity_id := (row_to_json(NEW)->>'id')::UUID;
        v_new_values := to_jsonb(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_entity_id := (row_to_json(NEW)->>'id')::UUID;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        -- Skip no-op updates that only changed updated_at
        IF v_old_values - 'updated_at' = v_new_values - 'updated_at' THEN
            v_skip := true;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_entity_id := (row_to_json(OLD)->>'id')::UUID;
        v_old_values := to_jsonb(OLD);
    END IF;

    -- HTTP middleware dedup: if we have a correlation_id and an audit row
    -- already exists for this correlation+entity within the last 5s, skip
    IF NOT v_skip AND v_correlation IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM audit_log
            WHERE correlation_id = v_correlation
              AND entity_id IS NOT DISTINCT FROM v_entity_id
              AND entity_type = TG_TABLE_NAME
              AND created_at > now() - INTERVAL '5 seconds'
        ) THEN
            v_skip := true;
        END IF;
    END IF;

    IF NOT v_skip THEN
        INSERT INTO audit_log (
            tenant_id, user_id, action, entity_type, entity_id,
            old_values, new_values, ip_address, user_agent,
            session_id, correlation_id, hash
        ) VALUES (
            v_tenant_id, v_user_id, TG_OP, TG_TABLE_NAME, v_entity_id,
            v_old_values, v_new_values, v_ip_address, v_user_agent,
            v_session_id, v_correlation, NULL
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END $function$;


