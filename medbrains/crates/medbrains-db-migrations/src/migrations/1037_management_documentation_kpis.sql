-- ====================================================================
-- Migration: 1037_management_documentation_kpis.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The management dashboard (role-admin) gains doctors' documentation under
-- its OPD row: coded diagnosis, complete notes and visits left open as
-- rolling 7-day rates against the usual day, and a table of documentation
-- by doctor, least complete first. New tenants get it from the seed; this
-- puts it on existing ones and moves the rest down. Gated on
-- analytics.management.view; idempotent per dashboard.
WITH targets AS (
    SELECT d.id
      FROM dashboards d
     WHERE d.code = 'role-admin' AND d.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM dashboard_widgets w
            WHERE w.dashboard_id = d.id AND w.deleted_at IS NULL
              AND w.data_source->>'query' = 'doctor_documentation')
), shifted AS (
    UPDATE dashboard_widgets w
       SET position_y = w.position_y + 6, sort_order = w.sort_order + 4
      FROM targets t
     WHERE w.dashboard_id = t.id AND w.position_y >= 2
    RETURNING w.id
)
INSERT INTO dashboard_widgets
    (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source,
     position_x, position_y, width, height, permission_code, sort_order, refresh_interval)
SELECT t.id, k.wtype::widget_type, k.title, k.subtitle, k.icon, 'indigo', k.config::jsonb,
       k.source::jsonb, k.x, k.y, k.w, k.h, 'analytics.management.view', k.sort, 300000
  FROM targets t
 CROSS JOIN (VALUES
    ('stat_card', 'Coded diagnosis', 'OPD visits with an ICD code, 7 days', 'IconFileCheck',
     '{"format": "percent"}',
     '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "coded_diagnosis_pct"}}',
     0, 2, 4, 2, 5),
    ('stat_card', 'Complete notes', 'Complaint and examination recorded, 7 days', 'IconClipboardCheck',
     '{"format": "percent"}',
     '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "complete_note_pct"}}',
     4, 2, 4, 2, 6),
    ('stat_card', 'Visits left open', 'Not closed after their day, 7 days', 'IconAlertTriangle',
     '{"format": "percent"}',
     '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "visits_left_open_pct"}}',
     8, 2, 4, 2, 7),
    ('data_table', 'Documentation by doctor', 'OPD, last 7 days — least complete first', 'IconFileCheck',
     '{"max_rows": 10, "columns": ["doctor", "visits", "coded_pct", "note_pct", "left_open"], "labels": {"doctor": "Doctor", "visits": "Visits", "coded_pct": "Coded diagnosis %", "note_pct": "Complete note %", "left_open": "Left open"}}',
     '{"type": "module_query", "module": "management", "query": "doctor_documentation"}',
     0, 4, 12, 4, 8)
 ) AS k(wtype, title, subtitle, icon, config, source, x, y, w, h, sort);
