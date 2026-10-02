-- ====================================================================
-- Migration: 1036_management_opd_kpis.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The management dashboard (role-admin) gains an OPD row: visits, median
-- wait, median consult time and appointment no-shows, each read against the
-- usual day (management_kpis.rs). New tenants get it from the seed; this puts
-- it on existing ones — the row goes on top and the rest moves down a row.
-- Gated on analytics.management.view; idempotent per dashboard.
WITH targets AS (
    SELECT d.id
      FROM dashboards d
     WHERE d.code = 'role-admin' AND d.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM dashboard_widgets w
            WHERE w.dashboard_id = d.id AND w.deleted_at IS NULL
              AND w.data_source->>'module' = 'management')
), shifted AS (
    UPDATE dashboard_widgets w
       SET position_y = w.position_y + 2, sort_order = w.sort_order + 4
      FROM targets t
     WHERE w.dashboard_id = t.id
    RETURNING w.id
)
INSERT INTO dashboard_widgets
    (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source,
     position_x, position_y, width, height, permission_code, sort_order, refresh_interval)
SELECT t.id, 'stat_card'::widget_type, k.title, k.subtitle, k.icon, 'indigo',
       jsonb_build_object('format', k.format),
       jsonb_build_object('type', 'module_query', 'module', 'management', 'query', 'kpi',
                          'params', jsonb_build_object('code', k.code)),
       k.x, 0, 3, 2, 'analytics.management.view', k.sort, 300000
  FROM targets t
 CROSS JOIN (VALUES
    ('OPD visits', 'Against the usual day', 'IconStethoscope', 'opd_visits', 'number', 0, 1),
    ('Median wait', 'Token issued to called', 'IconClock', 'opd_wait_minutes', 'minutes', 3, 2),
    ('Median consult time', 'Called to completed', 'IconClipboardCheck', 'opd_consult_minutes', 'minutes', 6, 3),
    ('Appointment no-shows', 'Of appointments with an outcome', 'IconCalendar',
     'appointment_no_show_pct', 'percent', 9, 4)
 ) AS k(title, subtitle, icon, code, format, x, sort);
