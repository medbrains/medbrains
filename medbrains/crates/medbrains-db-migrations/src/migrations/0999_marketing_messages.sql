-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mkt_messages
-- Drops: none
-- The per-recipient dispatch ledger.
--
-- "We approved the camp SMS on Tuesday. Who actually got it, who didn't, and
-- why not?"
--
-- Until now a send was two integers on the run — `sent_count`, `failed_count`
-- — and there was no sender at all, so both were zero. `cancel_run`'s own doc
-- comment says "once a sender exists". This is the record that sender writes.
--
-- ## One row per recipient, minted BEFORE dispatch
--
-- The id is the idempotency key handed to the outbox, so a retried worker
-- cannot double-send and a delivery receipt arriving out of order has
-- something to correlate against. Minting after dispatch would leave a window
-- where a message is in flight with nothing recording it.
--
-- ## Blocked recipients are rows too
--
-- Every excluded recipient is written in the same transaction as the sent
-- ones. An exclusion that exists only as a smaller number is not auditable:
-- "why didn't my mother get the reminder" has an answer here, and would
-- otherwise have none.
--
-- ## The message body is NOT stored, and that is load-bearing
--
-- This table holds `template_id` and the resolved `variables` — never the
-- rendered text. A clinical recall run's variables are a name, a date and a
-- place; the template says the rest. Storing the rendered body per recipient
-- would reconstitute "who is due a retinopathy screen" one message at a time,
-- in a marketing table, which is the wall in `0975_marketing.sql` breached by
-- a convenience.
--
-- It is also why `mkt_outreach_runs.body_preview` stays: the approver signs a
-- frozen blob, and pointing approval at a mutable template id would let the
-- words change after sign-off.

CREATE TABLE IF NOT EXISTS public.mkt_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    run_id          uuid NOT NULL REFERENCES public.mkt_outreach_runs(id) ON DELETE CASCADE,
    contact_id      uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    channel         text NOT NULL,
    -- The address as resolved at send time. Kept because the contact's number
    -- may change, and the audit answer is "what we dialled that day".
    address         text,
    traffic_class   text NOT NULL,
    purpose         text NOT NULL,
    -- Proof of the consent that authorised THIS message. Points at the exact
    -- ledger row, so "on what consent did you send this" is a join rather than
    -- an argument. NULL when the basis was a §7 legitimate use or the row was
    -- blocked before consent mattered.
    consent_id      uuid REFERENCES public.mkt_consents(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'queued',
    -- Why an excluded recipient was excluded. A closed, operational
    -- vocabulary — none of these is a clinical reason and none may become one.
    blocked_reason  text,
    provider_msg_id text,
    template_id     uuid,
    variables       jsonb,
    queued_at       timestamptz NOT NULL DEFAULT now(),
    sent_at         timestamptz,
    delivered_at    timestamptz,
    failed_at       timestamptz,
    failure_code    text,
    CONSTRAINT mkt_messages_status CHECK (status IN
        ('queued', 'blocked', 'sent', 'delivered', 'failed')),
    CONSTRAINT mkt_messages_blocked_reason CHECK (blocked_reason IS NULL
        OR blocked_reason IN ('no_consent', 'withdrawn', 'suppressed',
                              'over_cap', 'no_address', 'unknown')),
    -- A blocked row has a reason and a sent row does not. Without this the
    -- two states drift: a row marked blocked with no reason is an exclusion
    -- nobody can explain, which is the failure this table exists to prevent.
    CONSTRAINT mkt_messages_blocked_has_reason CHECK (
        (status = 'blocked') = (blocked_reason IS NOT NULL)),
    -- Anything actually dispatched needs somewhere it went.
    CONSTRAINT mkt_messages_sent_has_address CHECK (
        status = 'blocked' OR address IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS mkt_messages_run
    ON public.mkt_messages (tenant_id, run_id, status);

-- The frequency-cap window. Partial: only promotional traffic counts against
-- a cap, and service traffic must never be slowed by one.
CREATE INDEX IF NOT EXISTS mkt_messages_cap_window
    ON public.mkt_messages (tenant_id, contact_id, sent_at DESC)
    WHERE traffic_class = 'promotional' AND sent_at IS NOT NULL;

-- Delivery receipts correlate on the provider's id.
CREATE UNIQUE INDEX IF NOT EXISTS mkt_messages_provider
    ON public.mkt_messages (tenant_id, provider_msg_id)
    WHERE provider_msg_id IS NOT NULL;

-- One row per recipient per run. A second pass over the same cohort must not
-- mint a duplicate, which is what makes starting a run idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS mkt_messages_once_per_run
    ON public.mkt_messages (tenant_id, run_id, contact_id);

-- ── Row-level security ───────────────────────────────────────────────────
ALTER TABLE public.mkt_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_messages_tenant_isolation ON public.mkt_messages;
CREATE POLICY mkt_messages_tenant_isolation ON public.mkt_messages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
