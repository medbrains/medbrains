-- ====================================================================
-- Migration: 1410_code_blue_delivery.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: code_blue_team_members, code_blue_pages, lab_critical_calls
-- Drops: none
-- ====================================================================
-- A code blue that reached nobody looked exactly like one that reached
-- everybody.
--
-- 1. The outbox marked a row `sent` when no handler and no pipeline acted on
--    it, so the code-blue SMS, which had no handler, read as delivered. A row
--    nothing acted on now ends `undelivered`, with the reason in last_error.
-- 2. The page went to every active doctor and nurse in the hospital. It now
--    goes to the code team on `code_blue_team_members` (tier 1), and on each
--    unanswered round adds the duty medical officer (tier 2), then the medical
--    superintendent (tier 3). Every page is a row of `code_blue_pages`.
-- 3. Nothing re-paged a code nobody answered. `page_round` and `last_paged_at`
--    let the escalation pass page again, a bounded number of times.
-- 4. Floor codes on er_code_activations (Code Pink, Red, ...) paged nobody.
--    An insert trigger now queues their page, routed to a roster per code.
-- 5. A critical lab or radiology value escalated once, and with no phone on
--    file it was marked escalated and only logged. It now repeats by tier,
--    and a blocked escalation says why instead of pretending. The
--    lab-to-clinician phone call is recorded, append-only (NABL/NABH).

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_status_check;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_status_check
    CHECK (status = ANY (ARRAY['pending', 'retrying', 'sent', 'failed', 'dlq',
                               'skipped_unconfigured', 'undelivered']));

COMMENT ON COLUMN public.outbox_events.status IS
    'pending | retrying | sent | failed | dlq | skipped_unconfigured (no provider configured) | undelivered (nothing acted on it; last_error says why).';

CREATE TABLE IF NOT EXISTS public.code_blue_team_members (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES public.users(id),
    -- Which emergency code this person responds to: code_blue, or one of the
    -- floor codes on er_code_activations (code_pink, code_red, ...).
    code_type     text NOT NULL DEFAULT 'code_blue'
        CHECK (code_type IN ('code_blue', 'code_yellow', 'code_pink', 'code_orange',
                             'code_red', 'code_silver', 'code_black')),
    -- 1 responders (the code team), 2 duty medical officer, 3 medical superintendent.
    tier          smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    added_by      uuid NOT NULL REFERENCES public.users(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_code_blue_team_members_active
    ON public.code_blue_team_members (tenant_id, code_type, user_id, tier)
    WHERE deleted_at IS NULL;

ALTER TABLE public.code_blue_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_blue_team_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_code_blue_team_members ON public.code_blue_team_members;
CREATE POLICY tenant_isolation_code_blue_team_members ON public.code_blue_team_members
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER trg_code_blue_team_members_soft_delete BEFORE DELETE ON public.code_blue_team_members
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Who each round paged, and how they were chosen, for a code blue or a floor
-- code. Never deleted: who was called is what a review asks.
CREATE TABLE IF NOT EXISTS public.code_blue_pages (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code_blue_id  uuid REFERENCES public.code_blue_events(id),
    er_code_id    uuid REFERENCES public.er_code_activations(id),
    round         smallint NOT NULL CHECK (round >= 1),
    tier          smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    user_id       uuid NOT NULL REFERENCES public.users(id),
    -- roster | ward_shift | all_clinicians | duty_mo_and_security
    routing       text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT code_blue_pages_one_subject CHECK ((code_blue_id IS NULL) <> (er_code_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_code_blue_pages_once_per_round
    ON public.code_blue_pages (tenant_id, code_blue_id, round, user_id)
    WHERE code_blue_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_code_blue_pages_er_once_per_round
    ON public.code_blue_pages (tenant_id, er_code_id, round, user_id)
    WHERE er_code_id IS NOT NULL;

ALTER TABLE public.code_blue_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_blue_pages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_code_blue_pages ON public.code_blue_pages;
CREATE POLICY tenant_isolation_code_blue_pages ON public.code_blue_pages
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE public.code_blue_events
    ADD COLUMN IF NOT EXISTS page_round smallint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_paged_at timestamptz,
    ADD COLUMN IF NOT EXISTS routing_note text,
    ADD COLUMN IF NOT EXISTS delivery_warning text;

COMMENT ON COLUMN public.code_blue_events.page_round IS
    'Rounds of paging requested so far. 0 for codes started before paging was tracked; the escalation pass never re-pages those.';

-- The escalation pass looks only at open codes.
CREATE INDEX IF NOT EXISTS idx_code_blue_events_open_paging
    ON public.code_blue_events (last_paged_at)
    WHERE ended_at IS NULL AND deleted_at IS NULL AND page_round > 0;

ALTER TABLE public.er_code_activations
    ADD COLUMN IF NOT EXISTS routing_note text,
    ADD COLUMN IF NOT EXISTS delivery_warning text;

-- Every floor code pages its responders, whichever path raised it: the
-- emergency screen, a Code Pink from an infant tag, or anything later. The
-- page row is written in the same transaction as the activation, so a code
-- cannot be recorded without being paged.
CREATE OR REPLACE FUNCTION public.er_code_queue_page() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.outbox_events
        (tenant_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key)
    VALUES (NEW.tenant_id, 'er_code_activation', NEW.id, 'emergency.code_blue_alert',
            jsonb_build_object('er_code_id', NEW.id, 'code_type', NEW.code_type, 'round', 1),
            'er_code:' || NEW.id || ':round:1')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never let paging block recording the code: the handler also pages
    -- inline, and the screen warns "Paging not confirmed".
    RAISE WARNING 'er_code_queue_page: page not queued for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_er_code_queue_page ON public.er_code_activations;
CREATE TRIGGER trg_er_code_queue_page AFTER INSERT ON public.er_code_activations
    FOR EACH ROW EXECUTE FUNCTION public.er_code_queue_page();

-- Wake the outbox worker for an emergency page instead of waiting for its
-- next poll. NOTIFY is delivered at commit, so it never wakes for a page
-- that was rolled back.
CREATE OR REPLACE FUNCTION public.outbox_wake_emergency() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('outbox_wake', NEW.event_type);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_outbox_wake_emergency ON public.outbox_events;
CREATE TRIGGER trg_outbox_wake_emergency AFTER INSERT ON public.outbox_events
    FOR EACH ROW
    WHEN (NEW.event_type IN ('emergency.code_blue_alert', 'sms.code_blue_alert',
                             'whatsapp.code_blue_alert'))
    EXECUTE FUNCTION public.outbox_wake_emergency();

-- Critical values: repeat by tier, and remember a blocked try (lab and radiology).
ALTER TABLE public.lab_critical_alerts
    ADD COLUMN IF NOT EXISTS escalation_tier smallint NOT NULL DEFAULT 0,
    -- Last time the pass tried, sent or not; the window counts from here.
    ADD COLUMN IF NOT EXISTS escalation_attempted_at timestamptz,
    ADD COLUMN IF NOT EXISTS escalation_blocked_reason text;
ALTER TABLE public.radiology_critical_alerts
    ADD COLUMN IF NOT EXISTS escalation_tier smallint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS escalation_attempted_at timestamptz,
    ADD COLUMN IF NOT EXISTS escalation_blocked_reason text;

-- Rows escalated under the old once-only rule count as tier 1.
UPDATE public.lab_critical_alerts
   SET escalation_tier = 1, escalation_attempted_at = escalated_at
 WHERE escalated_at IS NOT NULL AND escalation_tier = 0;
UPDATE public.radiology_critical_alerts
   SET escalation_tier = 1, escalation_attempted_at = escalated_at
 WHERE escalated_at IS NOT NULL AND escalation_tier = 0;

-- The lab-to-clinician phone call (NABL/NABH read-back), append-only: every
-- attempt is its own row, so a later call cannot overwrite an earlier one.
CREATE TABLE IF NOT EXISTS public.lab_critical_calls (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    alert_id           uuid NOT NULL REFERENCES public.lab_critical_alerts(id),
    called_by          uuid NOT NULL REFERENCES public.users(id),
    received_by        text NOT NULL CHECK (length(btrim(received_by)) >= 2),
    called_at          timestamptz NOT NULL DEFAULT now(),
    attempts           smallint NOT NULL CHECK (attempts BETWEEN 1 AND 20),
    -- What the receiver said back, and whether it matched the reported value
    -- (decided by the server, never claimed by the client).
    readback_value     text NOT NULL,
    readback_confirmed boolean NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_critical_calls_alert
    ON public.lab_critical_calls (tenant_id, alert_id, called_at);

ALTER TABLE public.lab_critical_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_critical_calls FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lab_critical_calls ON public.lab_critical_calls;
CREATE POLICY tenant_isolation_lab_critical_calls ON public.lab_critical_calls
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- Append-only: no edits, no deletes.
CREATE OR REPLACE FUNCTION public.lab_critical_calls_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- A tenant's deletion cascades here; only direct edits and deletes are refused.
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'lab_critical_calls is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_lab_critical_calls_append_only ON public.lab_critical_calls;
CREATE TRIGGER trg_lab_critical_calls_append_only BEFORE UPDATE OR DELETE ON public.lab_critical_calls
    FOR EACH ROW EXECUTE FUNCTION public.lab_critical_calls_append_only();