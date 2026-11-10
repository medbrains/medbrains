-- ====================================================================
-- Migration: 1403_audit_chain_lock_order.sql
-- RLS-Posture: not-applicable
-- Tenant-Column: N/A
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Take the audit chain lock before a numbering row or a bill, always.
--
-- Every audited write holds one per-hospital advisory lock until commit
-- (audit_log_hash_chain). Two rows every hospital contends on were taken in
-- either order around it:
--
--   create_invoice    UPDATE sequences, then INSERT invoices -> audit -> chain
--   auto_charge       audited clinical write -> chain, then UPDATE sequences
--
--   record_payment    SELECT invoice FOR UPDATE, then INSERT payments -> chain
--   auto_charge       audited clinical write -> chain, then UPDATE that invoice
--
-- A cashier working while a clinical write charged the same hospital could each
-- hold what the other wanted. PostgreSQL then killed a transaction and the user
-- saw a 500 "deadlock detected". Nothing was half saved: the transaction rolled
-- back whole.
--
-- A statement trigger fires before any row is locked; a BEFORE ROW trigger would
-- be too late, as the row is locked before it runs. Whoever holds one of these
-- rows now already holds the chain, so the cycle cannot form. `SELECT ... FOR
-- UPDATE` fires no trigger, so the code that locks a bill calls
-- medbrains_db::pool::take_audit_chain_first.
--
-- The tenant is the request's context: a statement trigger sees no rows. With
-- no context (seeding, the owner connection) no lock is taken, and the worst
-- case is the old behaviour.
--
-- Ceiling: this removes the cycles through `sequences` and `invoices`. Any other
-- row locked before a transaction's first audit write, and after it by another,
-- can still cycle. Removing the class means not holding the chain lock to
-- commit, which is the ledger-grade audit design.

CREATE OR REPLACE FUNCTION public.take_audit_chain_first()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    tenant TEXT := NULLIF(current_setting('app.tenant_id', true), '');
BEGIN
    IF tenant IS NOT NULL THEN
        -- The same key as audit_log_hash_chain, or this orders nothing.
        PERFORM pg_advisory_xact_lock(hashtext('audit_chain'), hashtext(tenant));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sequences_audit_chain_first ON public.sequences;
CREATE TRIGGER trg_sequences_audit_chain_first
    BEFORE UPDATE ON public.sequences
    FOR EACH STATEMENT EXECUTE FUNCTION public.take_audit_chain_first();

DROP TRIGGER IF EXISTS trg_invoices_audit_chain_first ON public.invoices;
CREATE TRIGGER trg_invoices_audit_chain_first
    BEFORE UPDATE ON public.invoices
    FOR EACH STATEMENT EXECUTE FUNCTION public.take_audit_chain_first();
