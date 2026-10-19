-- ====================================================================
-- Migration: 1054_default_dashboard_ticker_cards.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- The default dashboard's patient and OPD cards were bare counts — "1",
-- "0" — with nothing to read them against. They now read the management
-- KPIs: today's figure, set against the usual weekday, yesterday or the
-- last seven days, with its 29-day trend.
--
-- Only system dashboards (no owner) change, and only a card still holding
-- the exact source it was seeded with: a copy someone made their own, or a
-- card an administrator re-pointed, is theirs and is left alone.

UPDATE dashboard_widgets w
   SET title = 'New patients',
       subtitle = 'Registered today, against the usual day',
       data_source = '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "patient_registrations"}}'::jsonb,
       updated_at = now()
  FROM dashboards d
 WHERE d.id = w.dashboard_id AND d.user_id IS NULL AND w.deleted_at IS NULL
   AND w.title = 'Total Patients'
   AND w.data_source = '{"type": "sql_count", "table": "patients"}'::jsonb;

UPDATE dashboard_widgets w
   SET subtitle = 'OPD visits, against the usual day',
       data_source = '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "opd_visits"}}'::jsonb,
       updated_at = now()
  FROM dashboards d
 WHERE d.id = w.dashboard_id AND d.user_id IS NULL AND w.deleted_at IS NULL
   AND w.title = 'Today''s OPD'
   AND w.data_source = '{"type": "sql_count", "table": "encounters", "filter": "DATE(encounter_date) = CURRENT_DATE"}'::jsonb;
