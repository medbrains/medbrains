-- Migration: 0155_jsonb_gin_indexes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- GIN indexes only, on existing tenant-policied tables.
-- Selective GIN indexes on JSONB columns that are actually filtered
-- with containment / key-exists operators (audit P1 #162). Only
-- columns with a real WHERE-clause operator are indexed; scalar
-- ->>'key' extractions and write-heavy JSONB (audit_log, outbox,
-- step logs) are deliberately left unindexed — see the note at the
-- foot of this file.
--
-- Plain CREATE INDEX (not CONCURRENTLY): runs inside the embedded
-- startup migration transaction, matching 0152. These tables are
-- small at Starter tier; revisit with CONCURRENTLY out of band
-- before a multi-GB production rebuild.

-- dashboards.role_codes — `role_codes @> $1::jsonb` in dashboard
-- resolution (routes/dashboard.rs: list + my-dashboard tiers). Only
-- the @> operator is used, so jsonb_path_ops (smaller, faster for
-- containment) is the right operator class.
CREATE INDEX IF NOT EXISTS idx_dashboards_role_codes
    ON public.dashboards USING gin (role_codes jsonb_path_ops);

-- dashboards.department_ids — filtered with `?|` (key-exists), which
-- jsonb_path_ops CANNOT serve. The pre-existing idx_dashboards_dept
-- was built with jsonb_path_ops, so the `?|` query has been
-- full-scanning despite an index existing. Replace it with a
-- default-ops GIN index that supports `?|`.
DROP INDEX IF EXISTS public.idx_dashboards_dept;
CREATE INDEX IF NOT EXISTS idx_dashboards_dept
    ON public.dashboards USING gin (department_ids);

-- quality_incidents.contributing_factors — `contributing_factors @>
-- $2::jsonb` when resolving audit findings (routes/quality.rs). @>
-- only → jsonb_path_ops.
CREATE INDEX IF NOT EXISTS idx_quality_incidents_contributing_factors
    ON public.quality_incidents USING gin (contributing_factors jsonb_path_ops);

-- Deliberately NOT indexed (would be bloat without query need):
--   * encounters.attributes->>'camp_id' — every read of this is
--     already pinned by patient_id or the encounter PK, so the row
--     set is tiny; a btree expression index on a write-heavy table
--     buys nothing.
--   * tenant_settings.value->>'sms_enabled' — tenant_settings is a
--     small config table already keyed by (tenant_id, category); the
--     reminder job's cross-tenant scan reads a handful of rows.
--   * audit_log / outbox_events / *_step_logs payloads — stored but
--     never filtered; indexing them only taxes the write path.
