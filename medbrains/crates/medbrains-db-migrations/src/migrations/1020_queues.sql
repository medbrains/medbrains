-- ====================================================================
-- Migration: 1020_queues.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: queues
-- Drops: none
-- ====================================================================
-- A queue the hospital can configure (RFCs/modules/RFC-MODULE-token-queues.md, P1a).
--
-- A queue was only ever implicit: module + place + today's date. Its prefix was
-- hard-coded per module (`T-` for every OPD department, so a desk viewing all
-- departments saw eight `T-001`s), its numbers restarted every day whether the
-- hospital wanted that or not, it had no limit, and it could not be paused,
-- closed, or run for a camp's two days only.
--
-- A row here configures the queue for one module at one place. A place with no
-- row behaves exactly as before, so nothing changes until an administrator sets
-- a queue up. Closing keeps the row (and its tokens) for the record; only one
-- queue per module and place can be live at a time.

CREATE TABLE IF NOT EXISTS queues (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              uuid NOT NULL REFERENCES tenants(id),
    name                   text NOT NULL CHECK (length(trim(name)) > 0),
    module                 text NOT NULL,
    scope                  text NOT NULL,
    scope_id               uuid,
    scope_label            text,
    prefix                 text NOT NULL CHECK (prefix ~ '^[A-Z0-9]{1,6}$'),
    start_at               integer NOT NULL DEFAULT 1 CHECK (start_at >= 0),
    pad_width              smallint NOT NULL DEFAULT 3 CHECK (pad_width BETWEEN 1 AND 6),
    reset_rule             text NOT NULL DEFAULT 'daily' CHECK (reset_rule IN ('daily', 'never')),
    max_tokens_per_period  integer CHECK (max_tokens_per_period > 0),
    lifecycle              text NOT NULL DEFAULT 'permanent'
                             CHECK (lifecycle IN ('permanent', 'temporary')),
    valid_from             date,
    valid_until            date,
    status                 text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paused', 'closed')),
    created_by             uuid REFERENCES users(id),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CHECK (lifecycle = 'permanent' OR (valid_from IS NOT NULL AND valid_until IS NOT NULL)),
    CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_queues_live_per_place
    ON queues (tenant_id, module, scope, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status <> 'closed';

ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_queues ON queues;
CREATE POLICY tenant_isolation_queues ON queues
    USING (tenant_id::text = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

DROP TRIGGER IF EXISTS trg_queues_updated_at ON queues;
CREATE TRIGGER trg_queues_updated_at BEFORE UPDATE ON queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES queues(id);
