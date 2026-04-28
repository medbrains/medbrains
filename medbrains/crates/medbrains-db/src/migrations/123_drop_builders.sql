-- Migration 123: Drop form builder + screen builder tables
-- Form builder, screen builder, and dashboard builder were eradicated in favor of
-- static React components per module. Tables are no longer referenced by any
-- backend route or frontend consumer.

-- Screen builder
DROP TABLE IF EXISTS screen_audit_log CASCADE;
DROP TABLE IF EXISTS screen_sidecars CASCADE;
DROP TABLE IF EXISTS screen_version_snapshots CASCADE;
DROP TABLE IF EXISTS tenant_screen_overrides CASCADE;
DROP TABLE IF EXISTS screen_form_refs CASCADE;
DROP TABLE IF EXISTS screen_masters CASCADE;

-- Form builder versioning + audit
DROP TABLE IF EXISTS field_master_audit_log CASCADE;
DROP TABLE IF EXISTS form_version_snapshots CASCADE;

-- Form builder core
DROP TABLE IF EXISTS tenant_field_overrides CASCADE;
DROP TABLE IF EXISTS module_form_links CASCADE;
DROP TABLE IF EXISTS form_fields CASCADE;
DROP TABLE IF EXISTS form_sections CASCADE;
DROP TABLE IF EXISTS form_masters CASCADE;
DROP TABLE IF EXISTS field_regulatory_links CASCADE;
DROP TABLE IF EXISTS field_masters CASCADE;

-- Note: regulatory_bodies + regulatory_clauses (072_regulatory.sql) are kept —
-- they back the Regulatory & Compliance module, not the form builder.
