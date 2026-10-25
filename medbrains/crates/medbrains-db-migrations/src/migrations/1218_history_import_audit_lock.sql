-- ====================================================================
-- Migration: 1218_history_import_audit_lock.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: none
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- A historical import must not freeze the live hospital.
--
-- audit_log is a per-tenant hash chain: its insert trigger takes
-- pg_advisory_xact_lock(audit_chain, tenant) and holds it to the end of the
-- transaction. The row-level audit trigger fired for every row a history
-- batch inserted, so the first one took that lock and a batch of 1,500
-- records held it for minutes - every sign-in and every audited write in the
-- hospital waited for the import to commit.
--
-- An import batch is audited as a batch instead: one history_import.commit
-- row (who, when, what it added), written just before commit, plus
-- history_import_records tracing every row to its batch. The row trigger
-- skips rows written under app.history_import_batch, and only when that names
-- an existing batch of the same hospital.

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

    -- A historical-import batch is audited once, as a batch (who ran it, what
    -- it added), and every row it writes is traced in history_import_records.
    -- Auditing each row here would take the tenant's audit-chain lock on the
    -- first one and hold it for the whole batch, stalling every live audited
    -- write - sign-ins included - until the import commits. The skip needs the
    -- batch to exist for this tenant, so the setting alone switches nothing off.
    IF NULLIF(current_setting('app.history_import_batch', true), '') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM history_import_batches b
            WHERE b.id = NULLIF(current_setting('app.history_import_batch', true), '')::uuid
              AND b.tenant_id = v_tenant_id
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


