-- ====================================================================
-- Migration: 1214_seed_default_sequences.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Every hospital gets the number sequences the core day needs.
--
-- Only the first tenant got them, from the seed. A hospital created by trial
-- sign-up or onboarding had no OPD_TOKEN row, so the first OPD visit it tried
-- answered 500 ("OPD_TOKEN sequence not configured"); the same was waiting for
-- its first indent, advance, corporate invoice, journal entry and medical
-- certificate. These consumers increment an existing row and do not create
-- one, so the row has to exist before the hospital's first patient does.
--
-- Same shape as 1172 and 1208: one function, a trigger on every new tenant,
-- and a backfill for the tenants already missing rows. ON CONFLICT DO NOTHING
-- keeps a hospital's own prefixes (onboarding may already have set UHID and
-- INVOICE) and never resets a counter. SECURITY DEFINER because the new
-- tenant's context is not set when its row is inserted.

CREATE OR REPLACE FUNCTION seed_default_sequences(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width)
    VALUES
        (p_tenant, 'UHID',              'UHID-', 0, 5),
        (p_tenant, 'INVOICE',           'INV-',  0, 6),
        (p_tenant, 'OPD_TOKEN',         'T',     0, 3),
        (p_tenant, 'INDENT',            'IND-',  0, 6),
        (p_tenant, 'ADVANCE',           'ADV-',  0, 6),
        (p_tenant, 'CORPORATE_INVOICE', 'CINV-', 0, 6),
        (p_tenant, 'JOURNAL_ENTRY',     'JE-',   0, 6),
        (p_tenant, 'CERT',              'CERT-', 0, 6)
    ON CONFLICT (tenant_id, seq_type) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION seed_default_sequences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_default_sequences(uuid) TO medbrains_app;

CREATE OR REPLACE FUNCTION trg_seed_default_sequences() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM seed_default_sequences(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_sequences ON tenants;
CREATE TRIGGER trg_tenants_seed_sequences
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION trg_seed_default_sequences();

SELECT seed_default_sequences(id) FROM tenants;
