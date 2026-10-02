-- ====================================================================
-- Migration: 1039_management_ipd_kpis.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The management dashboard (role-admin) gains an IPD row — average length
-- of stay, mortality, 30-day readmissions and leaving against advice — each
-- against the usual day. Two of its tiles were wrong and are corrected:
--   "Bed Occupancy" counted admitted patients (294 on a 28-bed dev tenant);
--     it now reads the midnight census over beds in service.
--   "Revenue This Month" drew a 7-day query; it now draws 30 days and says so.
-- The nurse and facilities dashboards had the same "Bed Occupancy" count;
-- those roles do not see management KPIs, so the tile keeps its data and
-- takes an honest name. Idempotent per dashboard.
WITH targets AS (
    SELECT d.id
      FROM dashboards d
     WHERE d.code = 'role-admin' AND d.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM dashboard_widgets w
            WHERE w.dashboard_id = d.id AND w.deleted_at IS NULL
              AND w.data_source->'params'->>'code' = 'alos_days')
), shifted AS (
    UPDATE dashboard_widgets w
       SET position_y = w.position_y + 2, sort_order = w.sort_order + 4
      FROM targets t
     WHERE w.dashboard_id = t.id AND w.position_y >= 12
    RETURNING w.id
)
INSERT INTO dashboard_widgets
    (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source,
     position_x, position_y, width, height, permission_code, sort_order, refresh_interval)
SELECT t.id, 'stat_card'::widget_type, k.title, k.subtitle, k.icon, 'indigo', '{}'::jsonb,
       jsonb_build_object('type', 'module_query', 'module', 'management', 'query', 'kpi',
                          'params', jsonb_build_object('code', k.code)),
       k.x, 12, 3, 2, 'analytics.management.view', k.sort, 300000
  FROM targets t
 CROSS JOIN (VALUES
    ('Average length of stay', 'Bed-days per discharge, 7 days', 'IconBed', 'alos_days', 0, 15),
    ('Mortality', 'Deaths among discharges, 7 days', 'IconHeartbeat', 'mortality_pct', 3, 16),
    ('Readmissions', 'Back within 30 days of discharge, 7 days', 'IconArrowsTransferDown',
     'readmission_30d_pct', 6, 17),
    ('Left against advice', 'LAMA, DAMA or absconded, 7 days', 'IconAlertTriangle',
     'lama_dama_pct', 9, 18)
 ) AS k(title, subtitle, icon, code, x, sort);

UPDATE dashboard_widgets w
   SET subtitle = 'Patients in beds over beds in service',
       config = '{}',
       data_source = '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "bed_occupancy_pct"}}',
       permission_code = 'analytics.management.view'
  FROM dashboards d
 WHERE d.id = w.dashboard_id AND d.code = 'role-admin' AND w.deleted_at IS NULL
   AND w.data_source->>'query' = 'occupied_beds';

UPDATE dashboard_widgets w
   SET title = 'Revenue, last 30 days',
       subtitle = 'Billed per day',
       config = '{"chart_type": "bar", "x_axis": "date", "y_axis": "revenue", "sensitive": {"revenue": "billing.amount"}}',
       data_source = '{"type": "module_query", "module": "billing", "query": "revenue_trend"}'
  FROM dashboards d
 WHERE d.id = w.dashboard_id AND d.code = 'role-admin' AND w.deleted_at IS NULL
   AND w.data_source->>'query' = 'revenue_summary';

UPDATE dashboard_widgets w
   SET title = 'Patients admitted', subtitle = 'Currently admitted'
  FROM dashboards d
 WHERE d.id = w.dashboard_id AND d.code IN ('role-nurse', 'role-facilities')
   AND w.deleted_at IS NULL AND w.title = 'Bed Occupancy'
   AND w.data_source->>'query' = 'occupied_beds';
