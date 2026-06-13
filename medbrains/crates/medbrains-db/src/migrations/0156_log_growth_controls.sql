-- Log/event growth controls (audit P1 #164).
--
-- Strategy decision (documented here because it is the crux of the
-- story): partition-vs-retention is chosen per table by lifetime, not
-- applied blanket.
--
--   * audit_log — long legal hold, highest volume. PARTITIONED by
--     month already (migration 0106). Correct: it cannot be purged,
--     so range partitions keep it queryable and droppable by month.
--
--   * outbox_events / outbox_dlq / job_queue / camp_sync_events —
--     short-lived operational queues. RETENTION (see the retention
--     service), NOT partitioning. Partitioning is actively wrong for
--     outbox_events: its idempotency guarantee is
--     UNIQUE(tenant_id, event_type, idempotency_key), and Postgres
--     requires the partition key in every unique constraint — adding
--     created_at to that key would let duplicate events slip across
--     month boundaries. The worker also UPDATEs these by id in the
--     hot path, which loses partition pruning. For 30–90-day-lived
--     rows the purge keeps them small without that complexity.
--
--   * access_log / break_glass_events / security_access_logs — PHI
--     and physical-security audit with a legal retention hold. They
--     must NOT be short-purged and partitioning them needs a
--     maintenance window (high-write rebuild) — deferred to a
--     dedicated migration, tracked as a follow-up.
--
-- This migration covers the remaining AC item: payments and
-- billing_audit_log gain updated_at so corrections/reversals are
-- timestamped, with the shared update_updated_at() trigger.

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.billing_audit_log
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_billing_audit_log_updated_at ON public.billing_audit_log;
CREATE TRIGGER trg_billing_audit_log_updated_at
    BEFORE UPDATE ON public.billing_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
