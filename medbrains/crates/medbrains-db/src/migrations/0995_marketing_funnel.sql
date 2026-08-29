-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mkt_stage_events, mkt_touchpoints
-- Drops: none
-- Marketing funnel — stage history and campaign attribution.
--
-- Two questions an administrator asks that this module could not answer:
--
--   "The Coimbatore diabetes camp cost 2.4 lakh. How many of those people
--    actually turned up at OPD?"
--   "How long does an enquiry sit between 'booked' and 'attended'?"
--
-- Both were unanswerable, and the second was quietly wrong.
--
-- ## What was missing
--
-- `pipeline::move_stage` recorded a move as `mkt_interactions(kind =
-- 'stage_change', disposition = <destination code>)`. The destination only,
-- in a column shared with call dispositions, with no record of where the
-- enquiry came FROM. Time-in-stage was therefore a guess assembled by
-- pairing adjacent rows and hoping none were missing — and entry into the
-- first stage was never written at all, so the first interval in the funnel
-- had no start.
--
-- `mkt_contacts.stage_id` also had no foreign key to `mkt_pipeline_stages`,
-- so a deleted stage left contacts pointing at nothing.
--
-- ## Attribution is a list, not a column
--
-- `mkt_contacts.campaign_id` is a single nullable FK, and `create_contact`
-- writes it with `COALESCE(campaign_id, $5)` — which makes it accidentally
-- write-once. A person hears about the hospital at a camp, sees a hoarding,
-- and is finally sent by their GP; the camp gets the credit forever because
-- it happened to be first through the door.
--
-- `mkt_touchpoints` records each one. First-touch and last-touch are then
-- computed on read from `ORDER BY occurred_at`, materialising nothing.
--
-- ## The clinical wall
--
-- Neither table has a free-text field describing what the enquiry was about,
-- and that absence is load-bearing rather than an oversight. "What they asked
-- about" is where a tele-caller writes "wants to know about her mother's
-- chemo", and a marketing table is not where that belongs. The constraint
-- here is the absence of the column; `scripts/check_marketing_wall.py`
-- asserts neither table acquires one.

-- ── Stage history ────────────────────────────────────────────────────────
-- Append-only. The FROM stage is what the interaction row was missing.
CREATE TABLE IF NOT EXISTS public.mkt_stage_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id    uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    -- NULL means entry: the enquiry arriving in the funnel for the first
    -- time. Recorded so the first interval has a start.
    from_stage_id uuid REFERENCES public.mkt_pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id   uuid NOT NULL REFERENCES public.mkt_pipeline_stages(id) ON DELETE CASCADE,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    actor_id      uuid,
    -- Who moved it. `hms_checkin` is the one that matters for conversion:
    -- an enquiry becomes an attendance because the patient walked in, not
    -- because a tele-caller ticked a box.
    source        text NOT NULL DEFAULT 'agent',
    note          text,
    CONSTRAINT mkt_stage_events_source CHECK (source IN
        ('agent', 'system', 'outreach_reply', 'hms_checkin', 'backfill')),
    -- A move to the stage it is already in is not a transition, and counting
    -- it as one deflates every median in the funnel report.
    CONSTRAINT mkt_stage_events_actually_moved
        CHECK (from_stage_id IS NULL OR from_stage_id <> to_stage_id)
);
CREATE INDEX IF NOT EXISTS mkt_stage_events_contact
    ON public.mkt_stage_events (tenant_id, contact_id, occurred_at);
CREATE INDEX IF NOT EXISTS mkt_stage_events_stage
    ON public.mkt_stage_events (tenant_id, to_stage_id, occurred_at DESC);

-- ── Attribution ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_touchpoints (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id     uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    campaign_id    uuid REFERENCES public.mkt_campaigns(id) ON DELETE SET NULL,
    kind           text NOT NULL,
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    -- Marketing metadata, deliberately coarse. There is no "enquired about"
    -- column here; see the clinical-wall note in this file's header.
    source         text,
    medium         text,
    external_ref   text,
    -- An ORGANISATION or a coarse label, never a named individual with money
    -- attached. NMC Regulation 6.4 prohibits fee-splitting, so a
    -- revenue-per-named-referrer ledger is the exact mechanism of cut
    -- practice. This column is for planning where enquiries come from, and
    -- there is deliberately no amount beside it.
    referrer_label text,
    CONSTRAINT mkt_touchpoints_kind CHECK (kind IN
        ('inbound_call', 'camp_walkin', 'web_form', 'referral',
         'outreach_reply', 'ad_click', 'walk_in', 'manual'))
);
CREATE INDEX IF NOT EXISTS mkt_touchpoints_contact
    ON public.mkt_touchpoints (tenant_id, contact_id, occurred_at);
CREATE INDEX IF NOT EXISTS mkt_touchpoints_campaign
    ON public.mkt_touchpoints (tenant_id, campaign_id, occurred_at DESC)
    WHERE campaign_id IS NOT NULL;

-- ── The missing foreign key ──────────────────────────────────────────────
-- Added NOT VALID: an existing row may already point at a deleted stage, and
-- failing the migration over historical rows would block the fix that stops
-- it happening again. New writes are checked from here on.
ALTER TABLE public.mkt_contacts
    DROP CONSTRAINT IF EXISTS mkt_contacts_stage_fk;
ALTER TABLE public.mkt_contacts
    ADD CONSTRAINT mkt_contacts_stage_fk
    FOREIGN KEY (stage_id) REFERENCES public.mkt_pipeline_stages(id)
    ON DELETE SET NULL NOT VALID;

-- ── Backfill ─────────────────────────────────────────────────────────────
-- Every contact currently parked on a stage gets one entry event, so the
-- funnel report is not empty on the day this ships. `from_stage_id` is NULL
-- and `source` is 'backfill' rather than 'agent': the honest claim is "this
-- enquiry was in this stage", not "somebody moved it there at this time".
--
-- `first_seen_at` is used as the timestamp because it is the only defensible
-- one available. Time-in-stage for these rows is therefore
-- time-since-arrival, which is why they are labelled and can be excluded.
INSERT INTO public.mkt_stage_events
    (tenant_id, contact_id, from_stage_id, to_stage_id, occurred_at, source, note)
SELECT c.tenant_id, c.id, NULL, c.stage_id, c.first_seen_at, 'backfill',
       'Reconstructed on migration 0995 — stage at the time, not a move'
FROM public.mkt_contacts c
JOIN public.mkt_pipeline_stages s
     ON s.id = c.stage_id AND s.tenant_id = c.tenant_id
WHERE c.stage_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.mkt_stage_events e
      WHERE e.contact_id = c.id AND e.tenant_id = c.tenant_id
  );

-- The existing single-campaign attribution becomes the first touchpoint, so
-- no credit is lost when the funnel report starts reading this table.
INSERT INTO public.mkt_touchpoints
    (tenant_id, contact_id, campaign_id, kind, occurred_at, source)
SELECT c.tenant_id, c.id, c.campaign_id, 'manual', c.first_seen_at, c.source
FROM public.mkt_contacts c
WHERE c.campaign_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.mkt_touchpoints t
      WHERE t.contact_id = c.id AND t.tenant_id = c.tenant_id
  );

-- ── Row-level security ───────────────────────────────────────────────────
ALTER TABLE public.mkt_stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_touchpoints  ENABLE ROW LEVEL SECURITY;

-- One statement per table rather than a DO-loop, matching 0975: `make
-- check-rls` reads this file, and a policy created by EXECUTE format() is
-- invisible to it.

DROP POLICY IF EXISTS mkt_stage_events_tenant_isolation ON public.mkt_stage_events;
CREATE POLICY mkt_stage_events_tenant_isolation ON public.mkt_stage_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_touchpoints_tenant_isolation ON public.mkt_touchpoints;
CREATE POLICY mkt_touchpoints_tenant_isolation ON public.mkt_touchpoints
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
