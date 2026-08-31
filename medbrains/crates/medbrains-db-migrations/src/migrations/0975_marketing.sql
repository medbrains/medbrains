-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mkt_campaigns, mkt_contacts, mkt_contact_identities, mkt_pipelines,
--             mkt_pipeline_stages, mkt_interactions, mkt_tasks, mkt_cohorts,
--             mkt_cohort_members, mkt_outreach_runs
-- Drops: none
-- Marketing — enquiries, the acquisition pipeline, and outreach.
--
-- A hospital buys advertising, the advertising produces phone calls, and the
-- calls are lost to a WhatsApp group and a paper register. This module is the
-- record of the enquiry: who asked, what they asked about, which campaign
-- produced them, who called them back and when.
--
-- ## Why `mkt_contacts` and not `patients`
--
-- An enquiry exists before anybody is a patient, and often for somebody who
-- never becomes one — the caller comparing three hospitals, the relative
-- asking on behalf of a parent, the number that turns out to be a wrong
-- dial. Writing those into `patients` would corrupt the clinical register
-- with people who have no clinical relationship with the hospital, and would
-- hand the tele-calling desk a patient record it has no business holding.
--
-- `patient_id` is therefore NULLABLE and carries **no foreign key**. The link
-- is one-way and advisory: marketing may know that this enquiry became that
-- patient, and may not reach through it. A foreign key here would make the
-- clinical schema a dependency of the marketing schema, which is how a
-- separable product quietly becomes unshippable on its own.
--
-- ## Why cohorts hold no clinical column
--
-- Recall campaigns are the commercially strongest feature in this module and
-- the most dangerous one: "everybody due for a diabetic retinopathy screen"
-- is a list of people with diabetes. The design keeps the criteria on one
-- side of the wall and the list on the other.
--
-- `mkt_cohorts.criteria` holds an enquiry-level filter when
-- `criteria_kind = 'enquiry'`. When it is 'clinical' the criteria are opaque
-- to this module: the query runs inside the clinical boundary under
-- `marketing.cohorts.clinical_define`, and what comes back is
-- `mkt_cohort_members` — identities and nothing else. There is no diagnosis
-- column, no ICD code, no procedure. A marketing user reading every row in
-- this schema learns that 412 people are worth calling, and not one thing
-- about any of their conditions.
--
-- `criteria_label` is the human name the campaign shows — "annual eye screen
-- due". It is written by the clinician who defined the cohort and is
-- deliberately coarse.
--
-- ## Consent and retention
--
-- DPDP 2023 makes enquiry data personal data with a stated purpose. Consent
-- is captured per contact per channel, because agreeing to a callback is not
-- agreeing to a marketing SMS, and withdrawal has to be able to reach one
-- without the other. `retention_until` is set at ingestion from tenant
-- policy so deletion is a scheduled job rather than a promise.

-- ── Campaigns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_campaigns (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            text NOT NULL,
    channel         text NOT NULL,
    source          text NOT NULL,
    external_ref    text,
    spend_minor     bigint NOT NULL DEFAULT 0,
    currency        text NOT NULL DEFAULT 'INR',
    started_on      date,
    ended_on        date,
    is_active       boolean NOT NULL DEFAULT true,
    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_campaigns_tenant_name
    ON public.mkt_campaigns (tenant_id, lower(name));

-- ── Contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_contacts (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    display_name      text,
    primary_phone     text,
    email             text,
    -- Advisory link only. No FK: see the header.
    patient_id        uuid,
    campaign_id       uuid REFERENCES public.mkt_campaigns(id) ON DELETE SET NULL,
    department_id     uuid,
    source            text NOT NULL DEFAULT 'unknown',
    stage_id          uuid,
    assigned_to       uuid,
    first_seen_at     timestamptz NOT NULL DEFAULT now(),
    last_contacted_at timestamptz,
    consent_call      boolean NOT NULL DEFAULT false,
    consent_sms       boolean NOT NULL DEFAULT false,
    consent_whatsapp  boolean NOT NULL DEFAULT false,
    consent_source    text,
    consent_at        timestamptz,
    retention_until   date,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_contacts_tenant_stage
    ON public.mkt_contacts (tenant_id, stage_id, last_contacted_at DESC);
CREATE INDEX IF NOT EXISTS mkt_contacts_tenant_assigned
    ON public.mkt_contacts (tenant_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS mkt_contacts_patient
    ON public.mkt_contacts (tenant_id, patient_id) WHERE patient_id IS NOT NULL;

-- One contact, many ways of reaching them. The screen-pop reads this table and
-- nothing else, so the unique index is both the deduplication rule at
-- ingestion and the sub-second lookup on call connect.
CREATE TABLE IF NOT EXISTS public.mkt_contact_identities (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id  uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    channel     text NOT NULL,
    -- Phone numbers are stored E.164-normalised at ingestion; a raw
    -- '+91 98400 12345' and '9840012345' must resolve to one contact or the
    -- returning caller gets a stranger's screen-pop.
    value       text NOT NULL,
    is_primary  boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_contact_identities_unique
    ON public.mkt_contact_identities (tenant_id, channel, value);

-- ── Pipeline (stages are data, not an enum) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_pipelines (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name        text NOT NULL,
    specialty   text,
    is_default  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_pipelines_tenant_name
    ON public.mkt_pipelines (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS public.mkt_pipeline_stages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pipeline_id  uuid NOT NULL REFERENCES public.mkt_pipelines(id) ON DELETE CASCADE,
    code         text NOT NULL,
    name         text NOT NULL,
    position     integer NOT NULL,
    is_won       boolean NOT NULL DEFAULT false,
    is_lost      boolean NOT NULL DEFAULT false,
    sla_minutes  integer,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_pipeline_stages_unique
    ON public.mkt_pipeline_stages (tenant_id, pipeline_id, code);

-- ── Interactions ─────────────────────────────────────────────────────────
-- The timeline. `disposition` is what the agent concluded; `recording_url` is
-- held apart behind marketing.interactions.play_recording, because a recording
-- carries whatever the caller actually said and the disposition does not.
CREATE TABLE IF NOT EXISTS public.mkt_interactions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id     uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    kind           text NOT NULL,
    channel        text NOT NULL,
    direction      text NOT NULL,
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    answered       boolean,
    duration_secs  integer,
    agent_id       uuid,
    disposition    text,
    note           text,
    recording_url  text,
    transcript     text,
    external_ref   text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_interactions_contact
    ON public.mkt_interactions (tenant_id, contact_id, occurred_at DESC);
-- The missed-call number the product is sold on: unanswered inbound today.
CREATE INDEX IF NOT EXISTS mkt_interactions_unanswered
    ON public.mkt_interactions (tenant_id, occurred_at DESC)
    WHERE answered IS NOT TRUE AND direction = 'inbound';

-- ── Callback tasks ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_tasks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id   uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    assigned_to  uuid,
    due_at       timestamptz NOT NULL,
    kind         text NOT NULL DEFAULT 'callback',
    status       text NOT NULL DEFAULT 'open',
    escalated_at timestamptz,
    completed_at timestamptz,
    note         text,
    created_by   uuid,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mkt_tasks_due
    ON public.mkt_tasks (tenant_id, status, due_at)
    WHERE status = 'open';

-- ── Cohorts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_cohorts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name           text NOT NULL,
    criteria_kind  text NOT NULL DEFAULT 'enquiry',
    -- Populated only for criteria_kind = 'enquiry'. A clinical cohort leaves
    -- this null on purpose: the criteria stay on the clinical side.
    criteria       jsonb,
    -- The coarse, human label a clinician chose. "Annual eye screen due", not
    -- "E11.3".
    criteria_label text,
    defined_by     uuid,
    member_count   integer NOT NULL DEFAULT 0,
    refreshed_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_cohorts_kind CHECK (criteria_kind IN ('enquiry', 'clinical')),
    -- Enforced, not merely intended: a clinical cohort may not carry its
    -- criteria in this schema.
    CONSTRAINT mkt_cohorts_clinical_opaque
        CHECK (criteria_kind <> 'clinical' OR criteria IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_cohorts_tenant_name
    ON public.mkt_cohorts (tenant_id, lower(name));

-- Identities and nothing else. No diagnosis, no code, no reason.
CREATE TABLE IF NOT EXISTS public.mkt_cohort_members (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cohort_id  uuid NOT NULL REFERENCES public.mkt_cohorts(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    added_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_cohort_members_unique
    ON public.mkt_cohort_members (tenant_id, cohort_id, contact_id);

-- ── Outreach runs ────────────────────────────────────────────────────────
-- A send is a record, not a fire-and-forget. `approved_by` must be somebody
-- other than `created_by`, and the DLT template id is stored because an SMS
-- sent on an unregistered template fails silently at the carrier.
CREATE TABLE IF NOT EXISTS public.mkt_outreach_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cohort_id        uuid NOT NULL REFERENCES public.mkt_cohorts(id) ON DELETE CASCADE,
    campaign_id      uuid REFERENCES public.mkt_campaigns(id) ON DELETE SET NULL,
    channel          text NOT NULL,
    template_ref     text,
    dlt_template_id  text,
    body_preview     text,
    status           text NOT NULL DEFAULT 'draft',
    created_by       uuid,
    approved_by      uuid,
    approved_at      timestamptz,
    started_at       timestamptz,
    completed_at     timestamptz,
    sent_count       integer NOT NULL DEFAULT 0,
    failed_count     integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_outreach_runs_status
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'sending',
                          'completed', 'cancelled', 'failed')),
    CONSTRAINT mkt_outreach_runs_separate_approver
        CHECK (approved_by IS NULL OR created_by IS NULL OR approved_by <> created_by)
);
CREATE INDEX IF NOT EXISTS mkt_outreach_runs_cohort
    ON public.mkt_outreach_runs (tenant_id, cohort_id, created_at DESC);

-- ── Row-level security ───────────────────────────────────────────────────
ALTER TABLE public.mkt_campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_contact_identities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_pipelines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_pipeline_stages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_interactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cohorts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_cohort_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_outreach_runs       ENABLE ROW LEVEL SECURITY;

-- One statement per table rather than a DO-loop. `make check-rls` reads this
-- file, not the database — a policy created by EXECUTE format() is invisible
-- to it, and an invisible guard is reported as an absent one.

DROP POLICY IF EXISTS mkt_campaigns_tenant_isolation ON public.mkt_campaigns;
CREATE POLICY mkt_campaigns_tenant_isolation ON public.mkt_campaigns
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_contacts_tenant_isolation ON public.mkt_contacts;
CREATE POLICY mkt_contacts_tenant_isolation ON public.mkt_contacts
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_contact_identities_tenant_isolation ON public.mkt_contact_identities;
CREATE POLICY mkt_contact_identities_tenant_isolation ON public.mkt_contact_identities
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_pipelines_tenant_isolation ON public.mkt_pipelines;
CREATE POLICY mkt_pipelines_tenant_isolation ON public.mkt_pipelines
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_pipeline_stages_tenant_isolation ON public.mkt_pipeline_stages;
CREATE POLICY mkt_pipeline_stages_tenant_isolation ON public.mkt_pipeline_stages
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_interactions_tenant_isolation ON public.mkt_interactions;
CREATE POLICY mkt_interactions_tenant_isolation ON public.mkt_interactions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_tasks_tenant_isolation ON public.mkt_tasks;
CREATE POLICY mkt_tasks_tenant_isolation ON public.mkt_tasks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_cohorts_tenant_isolation ON public.mkt_cohorts;
CREATE POLICY mkt_cohorts_tenant_isolation ON public.mkt_cohorts
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_cohort_members_tenant_isolation ON public.mkt_cohort_members;
CREATE POLICY mkt_cohort_members_tenant_isolation ON public.mkt_cohort_members
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_outreach_runs_tenant_isolation ON public.mkt_outreach_runs;
CREATE POLICY mkt_outreach_runs_tenant_isolation ON public.mkt_outreach_runs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
