-- Ward → OT pre-op send-off handoff. Before a patient leaves the ward for
-- surgery, the ward nurse completes a safety checklist (consent, NPO, site
-- marking, ID band, prosthetics removed, pre-op meds) and formally hands the
-- patient off to the receiving OT nurse. Distinct from ot_preop_assessments
-- (the anaesthetic clearance) — this is the nursing transfer of care.

CREATE TABLE IF NOT EXISTS public.ot_preop_handoffs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    handed_off_by uuid,
    received_by uuid,
    completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ot_preop_handoffs_booking_uniq UNIQUE (tenant_id, booking_id)
);

ALTER TABLE public.ot_preop_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ot_preop_handoff ON public.ot_preop_handoffs;
CREATE POLICY tenant_isolation_ot_preop_handoff ON public.ot_preop_handoffs
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE INDEX IF NOT EXISTS idx_ot_preop_handoff_booking
    ON public.ot_preop_handoffs USING btree (tenant_id, booking_id);
