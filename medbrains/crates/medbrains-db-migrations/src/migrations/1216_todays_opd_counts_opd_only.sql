-- ====================================================================
-- Migration: 1216_todays_opd_counts_opd_only.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- "Today's OPD" counted every encounter dated today: admissions, ER visits and
-- home visits are encounters too, so a demo hospital with 12 OPD visits showed
-- 17. It also used the database's date, not the hospital's, so the count reset
-- at 05:30 in India.
--
-- The card now counts OPD visits on the hospital's calendar day. The old filter
-- is no longer allowed, so every card still holding it -- system dashboards and
-- the copies people placed on their own -- moves to the corrected one. A card
-- whose source someone changed holds a different source and is left alone.

UPDATE dashboard_widgets
   SET data_source = jsonb_set(
           data_source, '{filter}',
           to_jsonb('encounter_type = ''opd'' AND encounter_date = tenant_local_date(tenant_id, now())'::text)),
       updated_at = now()
 WHERE data_source = '{"type": "sql_count", "table": "encounters", "filter": "DATE(encounter_date) = CURRENT_DATE"}'::jsonb;
