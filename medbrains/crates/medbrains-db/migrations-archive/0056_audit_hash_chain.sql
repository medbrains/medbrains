-- Audit hash-chain trigger.
--
-- Each row's `hash` = sha256(prev_hash || canonical_payload). Tampering with
-- a row breaks the chain — every row after it has a hash that doesn't match
-- its actual content. Verification: replay hashes top-to-bottom, compare.
--
-- `prev_hash` = the previous row's `hash` for the same `tenant_id`. First
-- row in a tenant has prev_hash = '' (genesis). Per-tenant chain ensures
-- one tenant's deletion attempt can't break another tenant's verification.
--
-- `hash_input_canonical` is the JSON-serialized canonical form (sorted
-- keys, no whitespace) — kept on the row for verification debugging
-- without re-deriving from the live columns. Required by HIPAA
-- §164.312(c)(2) "integrity controls".

CREATE OR REPLACE FUNCTION audit_log_hash_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    last_hash TEXT;
    canonical TEXT;
BEGIN
    -- pg_advisory_xact_lock prevents concurrent inserts for the same
    -- tenant from racing on prev_hash lookup. Cross-tenant chains are
    -- independent so we lock by tenant_id only.
    PERFORM pg_advisory_xact_lock(hashtext('audit_chain'), hashtext(NEW.tenant_id::text));

    SELECT hash INTO last_hash
    FROM audit_log
    WHERE tenant_id = NEW.tenant_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    NEW.prev_hash := COALESCE(last_hash, '');

    -- Build canonical payload — keys sorted, no whitespace.
    canonical := jsonb_build_object(
        'tenant_id',  NEW.tenant_id::text,
        'user_id',    COALESCE(NEW.user_id::text, ''),
        'action',     NEW.action,
        'entity_type', NEW.entity_type,
        'entity_id',  COALESCE(NEW.entity_id::text, ''),
        'old_values', COALESCE(NEW.old_values::text, ''),
        'new_values', COALESCE(NEW.new_values::text, ''),
        'ip_address', COALESCE(NEW.ip_address, ''),
        'created_at', NEW.created_at::text,
        'prev_hash',  NEW.prev_hash
    )::text;

    NEW.hash_input_canonical := canonical;
    NEW.hash := encode(digest(canonical, 'sha256'), 'hex');

    RETURN NEW;
END;
$$;

-- pgcrypto provides digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TRIGGER IF EXISTS audit_log_hash_chain_trigger ON audit_log;
CREATE TRIGGER audit_log_hash_chain_trigger
    BEFORE INSERT ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_log_hash_chain();

-- Append-only RLS — block UPDATE and DELETE on audit_log even for the
-- service role. The only legitimate path to mutate is a DBA running an
-- ALTER TABLE … DISABLE TRIGGER, which is itself audited at the
-- Postgres role level.
DROP POLICY IF EXISTS audit_log_no_update ON audit_log;
DROP POLICY IF EXISTS audit_log_no_delete ON audit_log;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- Allow SELECT (for read), INSERT (for write), block UPDATE+DELETE.
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log
    FOR SELECT USING (true);
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log
    FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policies → any attempt fails.
