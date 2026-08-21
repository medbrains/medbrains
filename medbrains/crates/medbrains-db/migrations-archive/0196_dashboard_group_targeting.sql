-- Migration: 0196_dashboard_group_targeting.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Alters dashboard tables, already tenant-policied.
-- Dashboard group targeting + overlap priority.
--
-- Dashboards can already target a user (`user_id`), roles (`role_codes`) and
-- departments (`department_ids`). This adds access-group targeting so a group
-- can have its own dashboard, plus a `priority` on access_groups to break ties
-- deterministically when a user belongs to several targeted groups.
--
-- Resolution precedence (most specific wins):
--   user-specific  >  group (highest priority)  >  dept+role  >  role  >  default
-- See RFC: dashboard widgets / memory project_dashboard_widgets.

-- Tie-break weight when a viewer matches multiple targeted groups: higher wins.
ALTER TABLE public.access_groups
    ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- Access groups this dashboard is shown to (jsonb array of access_group id text),
-- mirroring role_codes / department_ids.
ALTER TABLE public.dashboards
    ADD COLUMN IF NOT EXISTS group_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Speeds the "dashboards targeting any of my groups" lookup in get_my_dashboard.
CREATE INDEX IF NOT EXISTS idx_dashboards_groups
    ON public.dashboards USING gin (group_ids jsonb_path_ops);
