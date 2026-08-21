-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- A default enquiry pipeline for every tenant.
--
-- 0975 made stages data rather than an enum so a dental clinic and an IVF unit
-- can differ without a deployment. The cost of that choice is that a tenant
-- with no rows has no board at all — the first thing a new hospital sees is an
-- empty screen with no way to add a stage from inside the workflow it is
-- trying to start.
--
-- So every tenant gets the six-stage default from the specification, and
-- renames or reorders it afterwards. `is_won` marks the stage the funnel
-- counts as converted; `is_lost` is deliberately absent from the default set,
-- because "Lost" is a stage a hospital should have to decide to add. A funnel
-- that ships with a bin gets one.
--
-- `sla_minutes` on the first stage is five. Conversion falls roughly fourfold
-- past the five-minute mark, which is the number this product is sold on, so
-- the breach is the default and not an opt-in.

DO $$
DECLARE
    t          record;
    pipeline   uuid;
BEGIN
    -- Guarded: a fresh database runs migrations before any tenant exists.
    IF NOT EXISTS (SELECT 1 FROM public.tenants) THEN
        RETURN;
    END IF;

    FOR t IN SELECT id FROM public.tenants LOOP
        SELECT id INTO pipeline
        FROM public.mkt_pipelines
        WHERE tenant_id = t.id AND is_default
        LIMIT 1;

        IF pipeline IS NULL THEN
            INSERT INTO public.mkt_pipelines (tenant_id, name, is_default)
            VALUES (t.id, 'Enquiry', true)
            RETURNING id INTO pipeline;
        END IF;

        INSERT INTO public.mkt_pipeline_stages
            (tenant_id, pipeline_id, code, name, position, is_won, sla_minutes)
        VALUES
            (t.id, pipeline, 'enquiry',      'Enquiry',           1, false, 5),
            (t.id, pipeline, 'contacted',    'Contacted',         2, false, NULL),
            (t.id, pipeline, 'booked',       'Appointment Booked',3, false, NULL),
            (t.id, pipeline, 'consulted',    'Consulted',         4, false, NULL),
            (t.id, pipeline, 'procedure',    'Procedure',         5, true,  NULL),
            (t.id, pipeline, 'follow_up',    'Follow-up',         6, false, NULL)
        ON CONFLICT (tenant_id, pipeline_id, code) DO NOTHING;
    END LOOP;
END $$;
