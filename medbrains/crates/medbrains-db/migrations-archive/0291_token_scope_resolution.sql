-- ====================================================================
-- Migration: 0291_token_scope_resolution.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Tie a token's queue to the room it is actually held in.
--
-- `tokens.scope_id` is an opaque uuid: nothing says whether it points at a
-- department, a camp counter, or nothing at all, and `scope_label` is a string
-- copied in at issue time. Two consequences worth removing before a camp:
--
--   * A counter renamed or moved on the morning of the camp leaves every token
--     already issued showing yesterday's label, on the board and on the slip.
--   * A typo in scope_id creates a queue nobody can find. It takes tokens, it
--     shows on no board, and the patients holding them are invisible.
--
-- The fix is a resolver rather than a foreign key. A foreign key cannot work
-- here: scope_id points into a different table depending on `scope`
-- (departments for 'department', camp_counters for 'counter'), and 'global'
-- has no target at all. So the label is resolved on read, from whichever table
-- the scope names, and the stored `scope_label` becomes a fallback for scopes
-- that have no registry.
--
-- Scope: this view serves `public.tokens` only — the queues used by billing,
-- lab, pharmacy and registration. A camp's OPD queue is not one of them: camp
-- registration writes `opd_queues` (see 0027), and the camp board reads there.
-- The two are not merged here; that is a data migration, not a view.
-- ============================================================

-- Every queue that could be shown on a board, with its label resolved from the
-- registry that owns it. One row per (scope, scope_id) that has a real target.
CREATE OR REPLACE VIEW public.token_scopes AS
    SELECT d.tenant_id,
           'department'::text        AS scope,
           d.id                      AS scope_id,
           d.name                    AS label,
           d.department_type::text   AS kind,
           NULL::integer             AS capacity_per_hour,
           NULL::text                AS location_label,
           NULL::uuid                AS camp_id,
           d.is_active               AS is_active
      FROM public.departments d
    UNION ALL
    SELECT c.tenant_id,
           'counter'::text,
           c.id,
           c.counter_name,
           c.counter_type,
           c.capacity_per_hour,
           c.location_label,
           c.camp_id,
           (c.status IN ('ready', 'active')) AS is_active
      FROM public.camp_counters c
     WHERE c.deleted_at IS NULL;

-- A camp's live board reads counters for one camp; the planning tables index by
-- camp already, but the queue side needs the reverse lookup on token_date.
CREATE INDEX IF NOT EXISTS idx_tokens_scope_live
    ON public.tokens (tenant_id, scope, scope_id, token_date, status);
