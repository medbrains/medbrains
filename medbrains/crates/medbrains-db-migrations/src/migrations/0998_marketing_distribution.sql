-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mkt_areas, mkt_distributions
-- Drops: none
-- Physical marketing runs — pamphlets, hoardings, and what came back.
--
-- "We gave ten thousand pamphlets in Gandhipuram. How many became patients?"
--
-- That question had no object to attach to. `mkt_touchpoints.area_label` said
-- where an enquiry came FROM once somebody typed it in, but nothing recorded
-- what the hospital had SENT: the quantity, the date, the cost, or the
-- expectation it was bought against. So a pamphlet run could be judged only by
-- whether the month felt busier.
--
-- ## Attribution here is a correlation, and says so
--
-- A pamphlet carries no identifier. Nobody hands one back at reception. So an
-- enquiry is credited to a run when it arrives FROM THAT AREA, AFTER that
-- run's date, WITHIN its response window — and that is a reasonable inference,
-- not a proof.
--
-- Two consequences are made visible rather than hidden:
--
--   * Overlapping runs in one area cannot be told apart. The report marks them
--     rather than dividing the enquiries between them, because splitting by a
--     rule nobody chose produces two confident wrong numbers instead of one
--     honest ambiguity.
--   * Enquiries from an area with no run at all still exist — word of mouth,
--     the hospital being nearby. A run's response rate is therefore an upper
--     bound, and the report shows the area's baseline beside it.
--
-- ## Why an area master rather than free text
--
-- `area_label` on a touchpoint is free text, which is right at the point of
-- capture — the desk should never be blocked because a locality is not in a
-- list. But a map needs coordinates and a report needs one spelling, so a
-- locality that the hospital actually buys against is defined once here.

-- ── Locality master ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_areas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name         text NOT NULL,
    -- Coarse on purpose. A locality centroid, so the catchment can be drawn;
    -- never a household. See the wall note in 0997.
    latitude     numeric(9, 6),
    longitude    numeric(9, 6),
    pincode      text,
    -- Roughly how many people the hospital considers reachable here. Used to
    -- put a response rate in proportion, and nullable because most hospitals
    -- will not know it.
    population   integer,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_areas_latitude  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT mkt_areas_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_areas_name
    ON public.mkt_areas (tenant_id, lower(name));

-- ── Distribution runs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_distributions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id   uuid REFERENCES public.mkt_campaigns(id) ON DELETE SET NULL,
    area_id       uuid NOT NULL REFERENCES public.mkt_areas(id) ON DELETE CASCADE,
    -- Which physical channel. Same vocabulary as mkt_touchpoints.kind, so a
    -- run and the enquiries it produced can be compared without a mapping.
    channel       text NOT NULL,
    -- How many went out. Pamphlets distributed, or 1 for a single hoarding.
    quantity      integer NOT NULL,
    distributed_on date NOT NULL,
    -- What it cost, in paise, like every other money column here.
    cost_minor    bigint NOT NULL DEFAULT 0,
    -- How long the hospital expects a pamphlet to keep working. Past this, an
    -- enquiry from the area is not credited to the run — somebody keeping a
    -- leaflet on the fridge for a year is real but not measurable.
    response_window_days integer NOT NULL DEFAULT 90,
    -- What was expected, if anybody said. Recorded BEFORE the result is known,
    -- which is the only time an expectation means anything.
    expected_enquiries integer,
    note          text,
    created_by    uuid,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_distributions_quantity CHECK (quantity > 0),
    CONSTRAINT mkt_distributions_window CHECK (response_window_days BETWEEN 1 AND 730),
    CONSTRAINT mkt_distributions_channel CHECK (channel IN (
        'pamphlet', 'hoarding', 'newspaper', 'magazine', 'radio', 'cable_tv',
        'bus_panel', 'signage', 'camp_walkin', 'health_talk',
        'corporate_screening'
    ))
);
CREATE INDEX IF NOT EXISTS mkt_distributions_area
    ON public.mkt_distributions (tenant_id, area_id, distributed_on DESC);
CREATE INDEX IF NOT EXISTS mkt_distributions_campaign
    ON public.mkt_distributions (tenant_id, campaign_id)
    WHERE campaign_id IS NOT NULL;

-- Touchpoints already carry a free-text area. Link them to the master where
-- the spelling matches, so a run's catchment can be joined without forcing the
-- desk to pick from a list at capture time.
ALTER TABLE public.mkt_touchpoints
    ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.mkt_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mkt_touchpoints_area_id
    ON public.mkt_touchpoints (tenant_id, area_id, occurred_at DESC)
    WHERE area_id IS NOT NULL;

-- ── Row-level security ───────────────────────────────────────────────────
ALTER TABLE public.mkt_areas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_areas_tenant_isolation ON public.mkt_areas;
CREATE POLICY mkt_areas_tenant_isolation ON public.mkt_areas
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_distributions_tenant_isolation ON public.mkt_distributions;
CREATE POLICY mkt_distributions_tenant_isolation ON public.mkt_distributions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
