-- ====================================================================
-- Migration: 1410_code_blue_delivery.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: code_blue_team_members, code_blue_pages
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
-- 4. A critical lab value escalated once, and with no phone on file it was
--    marked escalated and only logged. It now repeats by tier, and a blocked
--    escalation says why instead of pretending. The lab-to-clinician phone
--    call is documented on the alert (NABL/NABH read-back).

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
    -- 1 code team, 2 duty medical officer, 3 medical superintendent.
    tier          smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    added_by      uuid NOT NULL REFERENCES public.users(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_code_blue_team_members_active
    ON public.code_blue_team_members (tenant_id, user_id, tier)
    WHERE deleted_at IS NULL;

ALTER TABLE public.code_blue_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_blue_team_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_code_blue_team_members ON public.code_blue_team_members;
CREATE POLICY tenant_isolation_code_blue_team_members ON public.code_blue_team_members
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE TRIGGER trg_code_blue_team_members_soft_delete BEFORE DELETE ON public.code_blue_team_members
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Who each round paged, and how they were chosen. Never deleted: who was
-- called to an arrest is what a resuscitation review asks.
CREATE TABLE IF NOT EXISTS public.code_blue_pages (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code_blue_id  uuid NOT NULL REFERENCES public.code_blue_events(id),
    round         smallint NOT NULL CHECK (round >= 1),
    tier          smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    user_id       uuid NOT NULL REFERENCES public.users(id),
    -- roster | on_call | ward_shift | all_clinicians
    routing       text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_code_blue_pages_once_per_round
    ON public.code_blue_pages (tenant_id, code_blue_id, round, user_id);

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

ALTER TABLE public.lab_critical_alerts
    ADD COLUMN IF NOT EXISTS escalation_tier smallint NOT NULL DEFAULT 0,
    -- Last time the pass tried, sent or not; the window counts from here.
    ADD COLUMN IF NOT EXISTS escalation_attempted_at timestamptz,
    ADD COLUMN IF NOT EXISTS escalation_blocked_reason text,
    ADD COLUMN IF NOT EXISTS phone_called_by uuid REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS phone_received_by text,
    ADD COLUMN IF NOT EXISTS phone_called_at timestamptz,
    ADD COLUMN IF NOT EXISTS phone_attempts smallint CHECK (phone_attempts BETWEEN 1 AND 20),
    ADD COLUMN IF NOT EXISTS phone_readback_confirmed boolean;

-- Rows escalated under the old once-only rule count as tier 1.
UPDATE public.lab_critical_alerts
   SET escalation_tier = 1, escalation_attempted_at = escalated_at
 WHERE escalated_at IS NOT NULL AND escalation_tier = 0;
