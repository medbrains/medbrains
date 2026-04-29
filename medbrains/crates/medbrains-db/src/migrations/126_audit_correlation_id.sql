-- ====================================================================
-- Migration: 126_audit_correlation_id.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Adds `correlation_id` to `audit_log` and `access_log` so that HTTP-level
-- audit emissions (AuditLayer Tower middleware) and DB-trigger emissions
-- (audit_trigger_func from migration 088) can be deduplicated.
--
-- Both the middleware and the trigger will set
-- `current_setting('app.correlation_id', true)` to the same UUID per
-- request. When both fire for the same logical operation the row already
-- carrying that correlation_id is the canonical one; later inserts with
-- the same correlation_id are skipped at write time (handled in the
-- trigger updated below).
-- ====================================================================

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS correlation_id UUID;

ALTER TABLE access_log
    ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_audit_log_correlation
    ON audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_log_correlation
    ON access_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- Update audit_trigger_func to read app.correlation_id and skip duplicate
-- rows (where the HTTP middleware already inserted one with the same
-- correlation_id + entity_id within the last 5 seconds).

CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger
LANGUAGE plpgsql AS $$
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
END $$;
