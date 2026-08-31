-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- Make call ingestion idempotent.
--
-- Every telephony provider retries a webhook it did not get a 2xx for, and
-- FreePBX's AMI reconnect replays events across a dropped socket. Without a
-- uniqueness rule the same call lands twice, and the second landing is not
-- harmless: `ingest_call` raises a callback task for a missed call, so a
-- retried webhook books the same patient two callbacks and inflates the one
-- number this product is sold on.
--
-- `external_ref` is the switch's own call id — Asterisk `uniqueid`/`linkedid`,
-- or the provider's call sid — so it is the natural key for "this call". The
-- index is partial because interactions that are not calls (notes, stage
-- changes, messages typed by an agent) legitimately have no external id and
-- there can be any number of them.
--
-- Duplicates are possible in data written before this index existed, so it is
-- created with the older rows deduplicated first, keeping the earliest of each
-- group: the first landing is the one whose callback task, if any, is already
-- in somebody's queue.

DELETE FROM public.mkt_interactions a
USING public.mkt_interactions b
WHERE a.external_ref IS NOT NULL
  AND a.tenant_id = b.tenant_id
  AND a.external_ref = b.external_ref
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS mkt_interactions_external_ref_unique
    ON public.mkt_interactions (tenant_id, external_ref)
    WHERE external_ref IS NOT NULL;
