-- ====================================================================
-- Migration: 1424_paperless_meter.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: paperless_daily, paperless_days
-- Drops: none
-- ====================================================================
-- The paperless meter (RFCs/modules/RFC-MODULE-paperless-meter.md): how many
-- clinical documents each department made in the system on a day, how many of
-- those are signed, and how much paper is still in use (case sheets scanned,
-- system documents printed).
--
-- Both tables are derived data, rebuilt by `medbrains_analytics::paperless`
-- for a window of days in one transaction: the window's rows are deleted and
-- written again, so a re-run gives the same rows. Hence no soft delete.
--
-- `paperless_days` says which days were counted. A day with no row there was
-- never measured, which the screen shows as unknown; a counted day with no
-- `paperless_daily` rows had no documents. The indexes the recount reads by
-- are migrations 1426-1449, one CONCURRENTLY build each.

CREATE TABLE public.paperless_daily (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    day date NOT NULL,
    -- Null: the document names no department the meter can reach. No
    -- foreign key: this is derived data, and one record pointing at a
    -- missing department must not fail a hospital's whole recount.
    department_id uuid,
    -- A signable record type (`prescription`, `lab_report`, ...),
    -- `clinical_note`, `case_sheet_scan`, or a printed document's module.
    doc_type text NOT NULL CHECK (doc_type ~ '^[a-z0-9_]{2,60}$'),
    -- Documents created in the system that day.
    created integer NOT NULL DEFAULT 0 CHECK (created >= 0),
    -- Of those, signed digitally (a live `signed_records` row, or a signed note).
    signed integer NOT NULL DEFAULT 0 CHECK (signed >= 0 AND signed <= created),
    -- Paper case sheets scanned in that day.
    scanned integer NOT NULL DEFAULT 0 CHECK (scanned >= 0),
    -- System documents printed for the first time that day.
    printed integer NOT NULL DEFAULT 0 CHECK (printed >= 0),
    CONSTRAINT uq_paperless_daily UNIQUE NULLS NOT DISTINCT (tenant_id, day, department_id, doc_type)
);

CREATE TABLE public.paperless_days (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    day date NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    -- Sources the recount that counted this day could not count, each
    -- "label: why" (a statement that failed or ran out of time, a table with
    -- no signature link). The screen shows them as "could not count".
    not_counted text[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, day)
);

ALTER TABLE public.paperless_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paperless_daily FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_paperless_daily ON public.paperless_daily
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

ALTER TABLE public.paperless_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paperless_days FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_paperless_days ON public.paperless_days
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- The management dashboard's KPI tile: a seven-day signed share.
WITH targets AS (
    SELECT d.id
      FROM dashboards d
     WHERE d.code = 'role-admin' AND d.deleted_at IS NULL
       AND NOT EXISTS (
           SELECT 1 FROM dashboard_widgets w
            WHERE w.dashboard_id = d.id AND w.deleted_at IS NULL
              AND w.data_source->'params'->>'code' = 'paperless_signed_pct')
)
INSERT INTO dashboard_widgets
    (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source,
     position_x, position_y, width, height, permission_code, sort_order, refresh_interval)
SELECT t.id, 'stat_card'::widget_type, 'Signed digitally',
       'Clinical documents signed in the system, 7 days', 'IconSignature', 'indigo', '{}'::jsonb,
       '{"type": "module_query", "module": "management", "query": "kpi", "params": {"code": "paperless_signed_pct"}}'::jsonb,
       0, 23, 3, 2, 'analytics.management.view', 27, 300000
  FROM targets t;
