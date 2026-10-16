-- ====================================================================
-- Migration: 1082_audit_append_only.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- An audit trail is evidence only if it cannot be edited. The soft-delete
-- guardrail on the audit tables turned a DELETE into a quiet UPDATE that hid
-- the row — the opposite of what an audit table needs. They become
-- append-only: an UPDATE or DELETE is refused, whoever asks. Old months leave
-- by dropping a partition, which no row trigger sees, so retention still
-- works. billing_audit_log also gets the per-tenant hash chain audit_log
-- already has, so an edit by someone who can disable triggers still shows.

CREATE OR REPLACE FUNCTION public.audit_append_only() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit records cannot be changed or removed (% on %)', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_soft_delete_f8ccc35e ON public.audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_legacy_soft_delete_ce2b05d5 ON public.audit_log_legacy;
DROP TRIGGER IF EXISTS trg_billing_audit_log_soft_delete_99413ae4 ON public.billing_audit_log;
DROP TRIGGER IF EXISTS trg_billing_audit_log_updated_at ON public.billing_audit_log;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON public.audit_log;
CREATE TRIGGER trg_audit_log_append_only BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();
DROP TRIGGER IF EXISTS trg_audit_log_legacy_append_only ON public.audit_log_legacy;
CREATE TRIGGER trg_audit_log_legacy_append_only BEFORE UPDATE OR DELETE ON public.audit_log_legacy
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();
DROP TRIGGER IF EXISTS trg_billing_audit_log_append_only ON public.billing_audit_log;
CREATE TRIGGER trg_billing_audit_log_append_only BEFORE UPDATE OR DELETE ON public.billing_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_append_only();

ALTER TABLE public.billing_audit_log
    ADD COLUMN IF NOT EXISTS prev_hash text,
    ADD COLUMN IF NOT EXISTS hash text;

CREATE OR REPLACE FUNCTION public.billing_audit_log_hash_chain() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    last_hash text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('billing_audit_chain'), hashtext(NEW.tenant_id::text));
    SELECT hash INTO last_hash FROM public.billing_audit_log
     WHERE tenant_id = NEW.tenant_id AND hash IS NOT NULL
     ORDER BY created_at DESC, id DESC LIMIT 1;
    NEW.prev_hash := COALESCE(last_hash, '');
    NEW.hash := encode(digest(jsonb_build_object(
        'tenant_id', NEW.tenant_id::text,
        'action', NEW.action::text,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id::text,
        'invoice_id', COALESCE(NEW.invoice_id::text, ''),
        'amount', COALESCE(NEW.amount::text, ''),
        'previous_state', COALESCE(NEW.previous_state::text, ''),
        'new_state', COALESCE(NEW.new_state::text, ''),
        'performed_by', NEW.performed_by::text,
        'created_at', NEW.created_at::text,
        'prev_hash', NEW.prev_hash
    )::text, 'sha256'), 'hex');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_audit_log_hash_chain ON public.billing_audit_log;
CREATE TRIGGER trg_billing_audit_log_hash_chain BEFORE INSERT ON public.billing_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.billing_audit_log_hash_chain();
