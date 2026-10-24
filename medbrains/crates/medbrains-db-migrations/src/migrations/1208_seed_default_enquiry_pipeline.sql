-- ====================================================================
-- Migration: 1208_seed_default_enquiry_pipeline.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Every hospital gets the default enquiry pipeline, not only the ones that
-- existed when 0976 ran.
--
-- 0976 inserted the six default stages for the tenants present at the time,
-- and a migration runs once: every hospital created afterwards (self-signup,
-- a fresh install whose first tenant the seed makes after migrations) had no
-- pipeline, so its enquiry board was empty, nothing could be marked won, and
-- the campaign funnel counted no conversions. Same shape as 1172: one
-- function, called by a trigger on every new tenant and once below for the
-- ones already missing a pipeline.
--
-- Only a tenant with no pipeline at all is seeded: a hospital that built or
-- renamed its own keeps it. SECURITY DEFINER because the new tenant's context
-- is not set when its row is inserted; neither table FORCEs row level
-- security, so the owner may write them.

CREATE OR REPLACE FUNCTION seed_default_enquiry_pipeline(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    pipeline uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM mkt_pipelines WHERE tenant_id = p_tenant) THEN
        RETURN;
    END IF;

    INSERT INTO mkt_pipelines (tenant_id, name, is_default)
    VALUES (p_tenant, 'Enquiry', true)
    RETURNING id INTO pipeline;

    INSERT INTO mkt_pipeline_stages
        (tenant_id, pipeline_id, code, name, position, is_won, sla_minutes)
    VALUES
        (p_tenant, pipeline, 'enquiry',   'Enquiry',            1, false, 5),
        (p_tenant, pipeline, 'contacted', 'Contacted',          2, false, NULL),
        (p_tenant, pipeline, 'booked',    'Appointment Booked', 3, false, NULL),
        (p_tenant, pipeline, 'consulted', 'Consulted',          4, false, NULL),
        (p_tenant, pipeline, 'procedure', 'Procedure',          5, true,  NULL),
        (p_tenant, pipeline, 'follow_up', 'Follow-up',          6, false, NULL)
    ON CONFLICT (tenant_id, pipeline_id, code) DO NOTHING;
END;
$$;

-- The trigger runs as whoever inserts the tenant: sign-up does, as the
-- request role.
REVOKE ALL ON FUNCTION seed_default_enquiry_pipeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_default_enquiry_pipeline(uuid) TO medbrains_app;

CREATE OR REPLACE FUNCTION trg_seed_default_enquiry_pipeline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM seed_default_enquiry_pipeline(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_enquiry_pipeline ON tenants;
CREATE TRIGGER trg_tenants_seed_enquiry_pipeline
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION trg_seed_default_enquiry_pipeline();

SELECT seed_default_enquiry_pipeline(id) FROM tenants;
