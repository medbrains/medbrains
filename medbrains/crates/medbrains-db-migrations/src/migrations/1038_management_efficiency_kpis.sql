-- ====================================================================
-- Migration: 1038_management_efficiency_kpis.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The management dashboard (role-admin) gains non-clinical efficiency under
-- doctors' documentation: visits with no bill, billing lag, pharmacy wait,
-- lab turnaround and the share within each test's target, and bed
-- turnaround — each against the usual day. New tenants get it from the
-- seed; this puts it on existing ones and moves the rest down. Gated on
-- analytics.management.view; idempotent per dashboard.
WITH targets AS (
    SELECT d.id
      FROM dashboards d
     WHERE d.code = 'role-admin' AND d.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM dashboard_widgets w
            WHERE w.dashboard_id = d.id AND w.deleted_at IS NULL
              AND w.data_source->'params'->>'code' = 'opd_unbilled_pct')
), shifted AS (
    UPDATE dashboard_widgets w
       SET position_y = w.position_y + 4, sort_order = w.sort_order + 6
      FROM targets t
     WHERE w.dashboard_id = t.id AND w.position_y >= 8
    RETURNING w.id
)
INSERT INTO dashboard_widgets
    (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source,
     position_x, position_y, width, height, permission_code, sort_order, refresh_interval)
SELECT t.id, 'stat_card'::widget_type, k.title, k.subtitle, k.icon, 'indigo', '{}'::jsonb,
       jsonb_build_object('type', 'module_query', 'module', 'management', 'query', 'kpi',
                          'params', jsonb_build_object('code', k.code)),
       k.x, k.y, 4, 2, 'analytics.management.view', k.sort, 300000
  FROM targets t
 CROSS JOIN (VALUES
    ('Visits with no bill', 'OPD visits never invoiced, 7 days', 'IconReceipt', 'opd_unbilled_pct', 0, 8, 9),
    ('Billing lag', 'Visit to invoice issued', 'IconCash', 'billing_lag_hours', 4, 8, 10),
    ('Pharmacy wait', 'Token issued to called', 'IconPill', 'pharmacy_wait_minutes', 8, 8, 11),
    ('Lab turnaround', 'Sample collected to verified', 'IconFlask', 'lab_tat_minutes', 0, 10, 12),
    ('Lab within target', 'Verified within the test''s turnaround, 7 days', 'IconClock', 'lab_within_target_pct', 4, 10, 13),
    ('Bed turnaround', 'Vacated to ready for the next patient', 'IconBed', 'bed_turnaround_minutes', 8, 10, 14)
 ) AS k(title, subtitle, icon, code, x, y, sort);
