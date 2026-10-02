-- ====================================================================
-- Migration: 1033_dashboard_api_widgets.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Three default-dashboard widgets were seeded with a `{"type": "api"}` data
-- source that nothing resolves: the dashboard fetches every widget through
-- the batch resolver, which answers "unsupported", so OPD Queue, Recent
-- Admissions and Revenue showed "unavailable" on every tenant. Point them at
-- the resolver's own queries (as the seed now does), with columns that match
-- what those queries return.
UPDATE dashboard_widgets
   SET data_source = '{"type": "module_query", "module": "opd", "query": "active_tokens", "params": {"limit": 10}}',
       config = config || '{"columns": ["token_no", "patient_name", "doctor_name", "status"]}'
 WHERE data_source->>'type' = 'api' AND data_source->>'endpoint' = '/api/opd/queue';

UPDATE dashboard_widgets
   SET data_source = '{"type": "module_query", "module": "ipd", "query": "recent_admissions", "params": {"limit": 10}}'
 WHERE data_source->>'type' = 'api' AND data_source->>'endpoint' = '/api/ipd/admissions';

UPDATE dashboard_widgets
   SET data_source = '{"type": "module_query", "module": "billing", "query": "revenue_trend"}',
       config = config || '{"y_axis": "revenue", "sensitive": {"revenue": "billing.amount"}}',
       title = CASE WHEN title = 'Revenue This Month' THEN 'Revenue, last 30 days' ELSE title END,
       subtitle = CASE WHEN subtitle = 'Monthly billing trend' THEN 'Billed per day' ELSE subtitle END
 WHERE data_source->>'type' = 'api'
   AND data_source->>'endpoint' = '/api/dashboard/widget-data/revenue-monthly';
