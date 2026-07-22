-- Migration: 0197_widget_sensitive_money_fields.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Backfills dashboard_widgets, already tenant-policied.
-- Tag money widgets as field-sensitive so the dashboard can mask/hide amounts
-- per the viewer's field access (resolve_restricted_fields → billing.amount).
--
-- A widget declares sensitivity via `config.sensitive` = { data_field: access_code }.
-- New tenants get this from the dashboard seeds; this backfills existing widgets.
-- Idempotent (only touches widgets that aren't already tagged).

-- Currency stat cards: the displayed `value` is a billing amount.
UPDATE public.dashboard_widgets
SET config = config || '{"sensitive": {"value": "billing.amount"}}'::jsonb
WHERE widget_type = 'stat_card'
  AND config->>'format' = 'currency'
  AND NOT (config ? 'sensitive');

-- Amount charts: the `amount` series is billing data.
UPDATE public.dashboard_widgets
SET config = config || '{"sensitive": {"amount": "billing.amount"}}'::jsonb
WHERE widget_type = 'chart'
  AND config->>'y_axis' = 'amount'
  AND NOT (config ? 'sensitive');
