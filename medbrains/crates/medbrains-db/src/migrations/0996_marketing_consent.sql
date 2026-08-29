-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: mkt_consents, mkt_suppressions, mkt_send_policy
-- Drops: none
-- Marketing consent — the ledger, the suppression list and the send policy.
--
-- The question this exists to answer: "A patient told us in March to stop
-- sending offers. Prove we stopped — and prove the appointment reminder still
-- reached her."
--
-- ## What was there before
--
-- `mkt_contacts.consent_call`, `consent_sms` and `consent_whatsapp` appear in
-- the marketing crate only inside SELECT lists. Never an UPDATE, never a
-- WHERE. There is no capture endpoint and no withdrawal endpoint, and
-- `outreach::create_run` checks the DLT template id and nothing else. The
-- flags are decoration, and the first send adapter that ships is the first
-- code that could consult them — with no test that fails if it forgets.
--
-- ## Why grants are append-only
--
-- DPDP §6 asks what the consent was AT THE MOMENT OF SEND. A boolean flipped
-- to false destroys the grant that preceded it, so the ledger can no longer
-- answer the question the regulator actually asks. Withdrawal is a new row.
--
-- ## Why suppression is keyed on the value, not the contact
--
-- This is the subtle one. `retention_until` deletes a contact; the next
-- inbound call runs `resolve_or_create` and manufactures a fresh contact with
-- `consent_* = false`, which reads as "not yet asked" and is indistinguishable
-- from "asked and refused". An opt-out has to outlive the record it was
-- recorded against, so it hangs off the phone number and does not cascade.

-- ── The ledger ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_consents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id     uuid NOT NULL REFERENCES public.mkt_contacts(id) ON DELETE CASCADE,
    channel        text NOT NULL,
    purpose        text NOT NULL,
    action         text NOT NULL,
    -- DPDP has consent PLUS a closed §7 list of legitimate uses. Not a GDPR
    -- enum and not free text: a Data Protection Board inquiry asks which one,
    -- and "legitimate interest" is not among the answers available here.
    legal_basis    text NOT NULL DEFAULT 'consent',
    -- Which notice text was shown. A grant against a notice nobody can produce
    -- is not evidence of anything.
    notice_version text,
    source         text NOT NULL,
    -- Recording id, form submission id, DLT opt-in id.
    evidence_ref   text,
    captured_by    uuid,
    occurred_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_consents_action CHECK (action IN ('granted', 'withdrawn')),
    -- THE CLINICAL WALL. A purpose is a coarse operating category, never a
    -- reason. "recall" may not become "diabetic_retinopathy_recall": that
    -- would put a diagnosis in a marketing table under a different column
    -- name, which is the wall breached by a vocabulary rather than a schema.
    CONSTRAINT mkt_consents_purpose CHECK (purpose IN
        ('service', 'appointment', 'recall', 'promotional')),
    CONSTRAINT mkt_consents_channel CHECK (channel IN
        ('phone', 'sms', 'whatsapp', 'email')),
    CONSTRAINT mkt_consents_basis CHECK (legal_basis IN
        ('consent', 's7_medical_emergency', 's7_care_delivery')),
    CONSTRAINT mkt_consents_source CHECK (source IN
        ('web_form', 'ivr', 'front_desk', 'import', 'whatsapp_optin',
         'legacy_backfill'))
);
-- The gate's lookup: latest row per (contact, channel, purpose).
CREATE INDEX IF NOT EXISTS mkt_consents_lookup
    ON public.mkt_consents (tenant_id, contact_id, channel, purpose, occurred_at DESC);

-- ── Suppression ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mkt_suppressions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel    text NOT NULL,
    -- E.164 or lower-cased email — the same normalisation
    -- `contacts::canonical_value` applies, so a number suppressed as typed at
    -- the desk still matches the number a provider webhook reports.
    value      text NOT NULL,
    reason     text NOT NULL,
    -- 'promotional' stops offers and leaves appointment reminders alone.
    -- 'all' stops everything, which is what a bereaved family is asking for.
    scope      text NOT NULL DEFAULT 'promotional',
    since      timestamptz NOT NULL DEFAULT now(),
    note       text,
    created_by uuid,
    CONSTRAINT mkt_suppressions_reason CHECK (reason IN
        ('opted_out', 'dnd', 'bounced', 'deceased', 'complaint')),
    CONSTRAINT mkt_suppressions_scope CHECK (scope IN ('promotional', 'all')),
    CONSTRAINT mkt_suppressions_channel CHECK (channel IN
        ('phone', 'sms', 'whatsapp', 'email'))
);
CREATE UNIQUE INDEX IF NOT EXISTS mkt_suppressions_unique
    ON public.mkt_suppressions (tenant_id, channel, value, scope);

-- ── Send policy ──────────────────────────────────────────────────────────
-- One row per tenant, edited under `marketing.settings.manage` — a permission
-- that until now no handler used.
CREATE TABLE IF NOT EXISTS public.mkt_send_policy (
    tenant_id    uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    max_per_day  integer NOT NULL DEFAULT 1,
    max_per_week integer NOT NULL DEFAULT 3,
    -- TRAI's promotional window. Stored as local clock time with the zone
    -- beside it, because "no promotional messages after 9pm" is a statement
    -- about the recipient's evening, not about UTC.
    quiet_from   time NOT NULL DEFAULT '21:00',
    quiet_to     time NOT NULL DEFAULT '09:00',
    timezone     text NOT NULL DEFAULT 'Asia/Kolkata',
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mkt_send_policy_caps CHECK (max_per_day >= 0 AND max_per_week >= 0)
);

-- ── Traffic class on the run ─────────────────────────────────────────────
-- Three values, not a binary marketing/operational flag. A binary flag routes
-- a discharge-medication instruction on a promotional header and drops it for
-- a DND patient — a clinical-safety failure wearing a marketing bug's
-- clothes. These are TRAI's categories.
ALTER TABLE public.mkt_outreach_runs
    ADD COLUMN IF NOT EXISTS traffic_class text NOT NULL DEFAULT 'promotional';
ALTER TABLE public.mkt_outreach_runs
    DROP CONSTRAINT IF EXISTS mkt_outreach_runs_class;
ALTER TABLE public.mkt_outreach_runs
    ADD CONSTRAINT mkt_outreach_runs_class CHECK (traffic_class IN
        ('service_implicit', 'service_explicit', 'promotional'));

ALTER TABLE public.mkt_outreach_runs
    ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'promotional';
ALTER TABLE public.mkt_outreach_runs
    DROP CONSTRAINT IF EXISTS mkt_outreach_runs_purpose;
ALTER TABLE public.mkt_outreach_runs
    ADD CONSTRAINT mkt_outreach_runs_purpose CHECK (purpose IN
        ('service', 'appointment', 'recall', 'promotional'));

-- ── Backfill ─────────────────────────────────────────────────────────────
-- The three legacy booleans become ledger rows so the gate has something to
-- read on day one. Lossy by construction: one shared `consent_at` cannot be
-- split three ways, and nobody recorded which notice was shown or where the
-- grant came from. It says so — `source = 'legacy_backfill'`, no
-- `notice_version` — rather than inventing provenance it does not have.
INSERT INTO public.mkt_consents
    (tenant_id, contact_id, channel, purpose, action, source, occurred_at)
SELECT c.tenant_id, c.id, v.channel, 'promotional', 'granted', 'legacy_backfill',
       COALESCE(c.consent_at, c.first_seen_at)
FROM public.mkt_contacts c
CROSS JOIN LATERAL (VALUES
    ('phone', c.consent_call),
    ('sms', c.consent_sms),
    ('whatsapp', c.consent_whatsapp)
) AS v(channel, granted)
WHERE v.granted
  AND NOT EXISTS (
      SELECT 1 FROM public.mkt_consents e
      WHERE e.contact_id = c.id AND e.tenant_id = c.tenant_id
        AND e.channel = v.channel
  );

-- ── Row-level security ───────────────────────────────────────────────────
ALTER TABLE public.mkt_consents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_send_policy  ENABLE ROW LEVEL SECURITY;

-- One statement per table rather than a DO-loop, matching 0975: `make
-- check-rls` reads this file, and a policy created by EXECUTE format() is
-- invisible to it.

DROP POLICY IF EXISTS mkt_consents_tenant_isolation ON public.mkt_consents;
CREATE POLICY mkt_consents_tenant_isolation ON public.mkt_consents
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_suppressions_tenant_isolation ON public.mkt_suppressions;
CREATE POLICY mkt_suppressions_tenant_isolation ON public.mkt_suppressions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS mkt_send_policy_tenant_isolation ON public.mkt_send_policy;
CREATE POLICY mkt_send_policy_tenant_isolation ON public.mkt_send_policy
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
