-- ====================================================================
-- Migration: 1067_mlc_numbers_outbox_skipped.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- MLC police intimation and Code Yellow notifications (COMPLIANCE-GAP-2026-10 #11).
--
-- 1. MLC and police-intimation numbers came from the clock to the second, so
--    two registrations in the same second shared a number (MLC: a 500 on the
--    unique index; intimation: a silent duplicate on a legal document). They
--    are now allocated from the per-tenant `sequences` row by trigger, like
--    the IP number (1065), so every insert path gets one. Existing numbers
--    are kept; new ones read MLC-000001 / PI-000001, which no timestamped
--    number can equal.
-- 2. An outbox event whose handler had no provider configured (Twilio/SMTP
--    credentials unset) was marked `sent`. It now ends in its own terminal
--    status, `skipped_unconfigured`, so no screen reports a message that was
--    never sent as delivered. The status check is widened (re-created with
--    the extra value; nothing is removed).

INSERT INTO public.sequences (tenant_id, seq_type, prefix, current_val, pad_width)
SELECT t.id, s.seq_type, s.prefix, 0, 6
  FROM public.tenants t
 CROSS JOIN (VALUES ('MLC_NUMBER', 'MLC-'), ('MLC_POLICE_INTIMATION', 'PI-')) AS s(seq_type, prefix)
ON CONFLICT (tenant_id, seq_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_sequence_number(
    p_tenant_id uuid, p_seq_type text, p_prefix text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    seq record;
    num text;
BEGIN
    INSERT INTO public.sequences (tenant_id, seq_type, prefix, current_val, pad_width)
    VALUES (p_tenant_id, p_seq_type, p_prefix, 1, 6)
    ON CONFLICT (tenant_id, seq_type)
        DO UPDATE SET current_val = public.sequences.current_val + 1, updated_at = now(),
                      deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
    RETURNING prefix, current_val, pad_width INTO seq;
    num := seq.current_val::text;
    RETURN seq.prefix || lpad(num, GREATEST(seq.pad_width, length(num)), '0');
END
$$;

CREATE OR REPLACE FUNCTION public.assign_mlc_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.mlc_number IS NULL THEN
        NEW.mlc_number := public.next_sequence_number(NEW.tenant_id, 'MLC_NUMBER', 'MLC-');
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_mlc_cases_assign_number ON public.mlc_cases;
CREATE TRIGGER trg_mlc_cases_assign_number
    BEFORE INSERT ON public.mlc_cases
    FOR EACH ROW EXECUTE FUNCTION public.assign_mlc_number();

CREATE OR REPLACE FUNCTION public.assign_police_intimation_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.intimation_number IS NULL THEN
        NEW.intimation_number :=
            public.next_sequence_number(NEW.tenant_id, 'MLC_POLICE_INTIMATION', 'PI-');
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_mlc_police_intimations_assign_number ON public.mlc_police_intimations;
CREATE TRIGGER trg_mlc_police_intimations_assign_number
    BEFORE INSERT ON public.mlc_police_intimations
    FOR EACH ROW EXECUTE FUNCTION public.assign_police_intimation_number();

-- Same-second duplicates already issued keep their number with a suffix, so
-- the unique index can hold from here on.
WITH dups AS (
    SELECT id, row_number() OVER (PARTITION BY tenant_id, intimation_number
                                  ORDER BY sent_at, id) AS rn
      FROM public.mlc_police_intimations
)
UPDATE public.mlc_police_intimations i
   SET intimation_number = i.intimation_number || '-' || dups.rn
  FROM dups
 WHERE i.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mlc_police_intimations_tenant_number
    ON public.mlc_police_intimations (tenant_id, intimation_number);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_status_check;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_status_check
    CHECK (status = ANY (ARRAY['pending', 'retrying', 'sent', 'failed', 'dlq',
                               'skipped_unconfigured']));

COMMENT ON COLUMN public.outbox_events.status IS
    'pending | retrying | sent | failed | dlq | skipped_unconfigured (handler had no provider configured; nothing was sent).';
