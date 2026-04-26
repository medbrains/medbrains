-- 114_audit_extended_context.sql
-- Update audit_trigger_func to capture user_agent and session_id from session variables.

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_ip TEXT;
    v_user_agent TEXT;
    v_session_id UUID;
    v_action TEXT;
    v_entity_id UUID;
    v_old JSONB;
    v_new JSONB;
BEGIN
    -- Read session variables (set by app middleware)
    v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::UUID;
    v_user_id := NULLIF(current_setting('app.user_id', true), '')::UUID;
    v_ip := NULLIF(current_setting('app.ip_address', true), '');
    v_user_agent := NULLIF(current_setting('app.user_agent', true), '');
    v_session_id := NULLIF(current_setting('app.session_id', true), '')::UUID;

    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_entity_id := NEW.id;
        v_old := NULL;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_entity_id := NEW.id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        -- Skip if nothing actually changed (e.g., only updated_at)
        IF v_old - 'updated_at' = v_new - 'updated_at' THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_entity_id := OLD.id;
        v_old := to_jsonb(OLD);
        v_new := NULL;
    END IF;

    -- Only log if we have a tenant context
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO audit_log (
            tenant_id, user_id, action, entity_type, entity_id,
            old_values, new_values, ip_address, user_agent, session_id, module
        ) VALUES (
            v_tenant_id, v_user_id, v_action, TG_TABLE_NAME, v_entity_id,
            v_old, v_new, v_ip, v_user_agent, v_session_id, TG_ARGV[0]
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
