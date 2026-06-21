-- OT → PACU / ward post-op handoff. After surgery the OT nurse hands the
-- patient over to the receiving PACU/ward nurse with a structured safety
-- checklist (airway, vitals, pain/PONV, dressing, drains/lines, Aldrete,
-- post-op orders). Mirrors the pre-op send-off (ot_preop_handoffs); distinct
-- from ot_postop_records, which tracks the recovery course itself.

CREATE TABLE IF NOT EXISTS public.ot_postop_handoffs (
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
    CONSTRAINT ot_postop_handoffs_booking_uniq UNIQUE (tenant_id, booking_id)
);

ALTER TABLE public.ot_postop_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ot_postop_handoff ON public.ot_postop_handoffs;
CREATE POLICY tenant_isolation_ot_postop_handoff ON public.ot_postop_handoffs
    USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

CREATE INDEX IF NOT EXISTS idx_ot_postop_handoff_booking
    ON public.ot_postop_handoffs USING btree (tenant_id, booking_id);
