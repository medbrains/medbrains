-- ====================================================================
-- Migration: 1040_widget_template_codes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- Widgets become choosable from a catalogue on the dashboard itself, so a
-- placed widget has to name the catalogue entry it came from — and by a
-- stable code: the system catalogue is synced from code on every boot, and
-- a template's id is not stable across that. `code` is the key the sync
-- upserts on; `template_code` is what a dashboard widget points back to.
ALTER TABLE widget_templates ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_widget_templates_system_code
    ON widget_templates (code) WHERE tenant_id IS NULL AND deleted_at IS NULL;

ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS template_code text;
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_template_code
    ON dashboard_widgets (dashboard_id, template_code) WHERE deleted_at IS NULL;
