-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Marketing channels and catchment areas.
--
-- Two gaps, both of which made the acquisition report answer a narrower
-- question than the one an administrator asks.
--
-- ## The channel list was the digital half of a digital-first product
--
-- `mkt_touchpoints.kind` allowed eight values, and they described a Western
-- SaaS funnel: web form, ad click, outreach reply. The channels an Indian
-- hospital actually spends money on were not among them — a pamphlet handed
-- out at a bus stand, a hoarding on the trunk road, a newspaper insert, a
-- cable-TV slot, a WhatsApp forward, a doctor's referral, a corporate tie-up.
-- Spend went out on those and every enquiry they produced was recorded as
-- 'manual', so the report could not tell a hoarding from a hospital open day.
--
-- ## There was no geography at all
--
-- Physical marketing is bought by area. Ten thousand pamphlets are
-- distributed in three named localities; a hoarding stands at one junction; a
-- camp serves a catchment. Without an area on the touchpoint, "which
-- localities does our OPD actually draw from, and which ones did we pay to
-- reach" is unanswerable — so the same pamphlet run is repeated in the area
-- that produced nobody.
--
-- ## What area means here, and what it must not become
--
-- `area_label` is WHERE THE CHANNEL WAS, not where the person lives. The
-- locality a hoarding stands in, the ward a pamphlet run covered, the town a
-- camp served. It is coarse by construction — a named locality, never a
-- street address, never a pincode-level identifier for one household.
--
-- The distinction matters because the tempting version of this column is the
-- enquirer's address, and a marketing table holding patient addresses is the
-- wall in 0975 breached by a column rather than a query. The patient register
-- already holds an address, under permissions marketing roles do not have.

-- ── Channels ─────────────────────────────────────────────────────────────
ALTER TABLE public.mkt_touchpoints DROP CONSTRAINT IF EXISTS mkt_touchpoints_kind;
ALTER TABLE public.mkt_touchpoints ADD CONSTRAINT mkt_touchpoints_kind CHECK (kind IN (
    -- Inbound, the person made contact
    'inbound_call', 'missed_call', 'web_form', 'walk_in', 'whatsapp_inbound',
    -- Physical, bought by area
    'pamphlet', 'hoarding', 'newspaper', 'magazine', 'radio', 'cable_tv',
    'bus_panel', 'signage',
    -- Events
    'camp_walkin', 'health_talk', 'corporate_screening',
    -- Digital
    'ad_click', 'social_post', 'social_dm', 'search', 'listing', 'video',
    -- People
    'referral', 'doctor_referral', 'staff_referral', 'word_of_mouth',
    -- Ours, going out
    'outreach_reply',
    -- Unclassified. Kept so nothing has to be discarded at the point of
    -- capture, but it is the value the report nags about.
    'manual'
));

-- The locality the channel occupied. See the header for why this is not an
-- address.
ALTER TABLE public.mkt_touchpoints
    ADD COLUMN IF NOT EXISTS area_label text;

-- A pamphlet run and a hoarding are both 'print' to a finance report and very
-- different to a marketing one, so the medium stays free-form beside the
-- specific kind rather than replacing it.
CREATE INDEX IF NOT EXISTS mkt_touchpoints_area
    ON public.mkt_touchpoints (tenant_id, area_label, occurred_at DESC)
    WHERE area_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS mkt_touchpoints_kind_time
    ON public.mkt_touchpoints (tenant_id, kind, occurred_at DESC);

-- ── Campaign targeting ───────────────────────────────────────────────────
-- Which localities the spend was aimed at. An array rather than a table: a
-- campaign targets a handful of named areas, and a join table for three
-- strings is a migration nobody thanks you for.
ALTER TABLE public.mkt_campaigns
    ADD COLUMN IF NOT EXISTS target_areas text[] NOT NULL DEFAULT '{}';

-- What the campaign physically was. Free-form beside `channel`, which is
-- coarse: 'print' does not distinguish ten thousand pamphlets in one ward
-- from a full-page insert in a daily.
ALTER TABLE public.mkt_campaigns
    ADD COLUMN IF NOT EXISTS medium text;

-- ── Backfill ─────────────────────────────────────────────────────────────
-- Existing touchpoints written by the enquiry form and the contact importer
-- carry their channel in `source`; where that names something the new
-- vocabulary knows, it is promoted so history is not stranded as 'manual'.
UPDATE public.mkt_touchpoints
SET kind = 'web_form'
WHERE kind = 'manual' AND source = 'web_form';

UPDATE public.mkt_touchpoints
SET kind = 'inbound_call'
WHERE kind = 'manual' AND source IN ('phone', 'inbound_call', 'telephony');
