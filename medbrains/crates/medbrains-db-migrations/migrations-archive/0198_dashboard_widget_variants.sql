-- Migration: 0198_dashboard_widget_variants.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters dashboard tables, already tenant-policied.
-- Per-audience widget variants.
--
-- One widget on a shared dashboard can render slightly different information per
-- viewer — e.g. a Revenue widget shows the full amount to Finance but only a
-- transaction count to Nursing. A variant carries a `match` audience
-- (roles / groups / users) and overrides for title / config / data_source.
--
-- Shape (jsonb array):
--   [{ "match": { "roles": ["nurse"], "groups": ["<gid>"], "users": ["<uid>"] },
--      "title": "Patient Count",
--      "config": { "format": "number" },
--      "data_source": { "type": "sql_count", "table": "encounters" } }, ...]
--
-- Selection precedence (most specific wins): user > group (highest priority) > role.
-- Resolved server-side in get_my_dashboard + batch_widget_data.

ALTER TABLE public.dashboard_widgets
    ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
