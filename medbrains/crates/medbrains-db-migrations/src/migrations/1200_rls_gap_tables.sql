-- ====================================================================
-- Migration: 1200_rls_gap_tables.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: none
-- Drops: form_fields (only when empty)
-- ====================================================================
-- Row level security for the tables that hold a hospital's data and had none.
--
-- Production is moving its request pool to `medbrains_app`, which row level
-- security applies to (docs/ops/DB-ROLES.md). Until now every install
-- connected as the owner, so a table without a policy looked no different
-- from one with. Under `medbrains_app` it is the difference between "this
-- hospital's widgets" and "every hospital's widgets".
--
-- Four kinds of table, four answers:
--
-- 1. Children of a tenant table (a dashboard's widgets, a course's quizzes,
--    a disposal request's lines). They get their own `tenant_id`, backfilled
--    from the parent, indexed, and the same policy as the parent. A trigger
--    copies it from the parent on every insert, so no caller has to remember
--    it and a child cannot point at another hospital's parent: the parent is
--    invisible under RLS, the lookup finds nothing, and the insert fails.
--
-- 2. Records that travel between two hospitals (patient and stock transfers,
--    lab sample routes, cross-hospital appointments). Visible to both ends
--    and nobody else. Stock transfer lines follow their transfer.
--
-- 3. A group's shared masters (`group_*`). Visible to every hospital in the
--    group, which is what a group is (see 0985), and to no other.
--
-- 4. Reference data identical for every hospital (geography, CDS knowledge
--    base, event catalogue, SNOMED, `tenants`, `hospital_groups`, ...). No
--    policy: there is nothing to isolate. Where the application never writes
--    them, `medbrains_app` loses its write grants, so a bug cannot rewrite the
--    country list for everybody.
--
-- No FORCE: the request role is never the owner, and the owner seeds these
-- tables at boot without a tenant context.
--
-- `tests/rls_gap_tables_test.rs` proves each of these as `medbrains_app`, and
-- fails when a new public table has neither RLS nor a place in its list of
-- global tables.

-- Whatever the caller sent, a child row belongs to its parent's hospital.
-- TG_ARGV: parent table, foreign-key column. Runs as the caller, so the
-- parent lookup is itself subject to the parent's policy.
CREATE OR REPLACE FUNCTION public.inherit_parent_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', TG_ARGV[0])
       INTO NEW.tenant_id
      USING (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
    RETURN NEW;
END $$;

-- The hospital group the session's hospital belongs to, or NULL. A deleted
-- group grants nothing, as in app_visible_tenants().
CREATE OR REPLACE FUNCTION public.app_current_group()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT g.id
      FROM public.tenants me
      JOIN public.hospital_groups g ON g.id = me.group_id AND g.deleted_at IS NULL
     WHERE me.id = public.app_current_tenant()
$$;

GRANT EXECUTE ON FUNCTION public.app_current_group() TO PUBLIC;

-- ── 1. Children of tenant tables ────────────────────────────────────
-- dashboard_widgets belongs to the hospital that owns its dashboards row.
ALTER TABLE public.dashboard_widgets ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.dashboard_widgets c SET tenant_id = p.tenant_id
  FROM public.dashboards p WHERE p.id = c.dashboard_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_tenant ON public.dashboard_widgets (tenant_id);
DROP TRIGGER IF EXISTS trg_dashboard_widgets_tenant_from_parent ON public.dashboard_widgets;
CREATE TRIGGER trg_dashboard_widgets_tenant_from_parent
    BEFORE INSERT OR UPDATE OF dashboard_id ON public.dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('dashboards', 'dashboard_id');
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dashboard_widgets ON public.dashboard_widgets;
CREATE POLICY tenant_isolation_dashboard_widgets ON public.dashboard_widgets
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- cms_post_revisions belongs to the hospital that owns its cms_posts row.
ALTER TABLE public.cms_post_revisions ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.cms_post_revisions c SET tenant_id = p.tenant_id
  FROM public.cms_posts p WHERE p.id = c.post_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_post_revisions_tenant ON public.cms_post_revisions (tenant_id);
DROP TRIGGER IF EXISTS trg_cms_post_revisions_tenant_from_parent ON public.cms_post_revisions;
CREATE TRIGGER trg_cms_post_revisions_tenant_from_parent
    BEFORE INSERT OR UPDATE OF post_id ON public.cms_post_revisions
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('cms_posts', 'post_id');
ALTER TABLE public.cms_post_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cms_post_revisions ON public.cms_post_revisions;
CREATE POLICY tenant_isolation_cms_post_revisions ON public.cms_post_revisions
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- cms_post_tags belongs to the hospital that owns its cms_posts row.
ALTER TABLE public.cms_post_tags ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.cms_post_tags c SET tenant_id = p.tenant_id
  FROM public.cms_posts p WHERE p.id = c.post_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_post_tags_tenant ON public.cms_post_tags (tenant_id);
DROP TRIGGER IF EXISTS trg_cms_post_tags_tenant_from_parent ON public.cms_post_tags;
CREATE TRIGGER trg_cms_post_tags_tenant_from_parent
    BEFORE INSERT OR UPDATE OF post_id ON public.cms_post_tags
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('cms_posts', 'post_id');
ALTER TABLE public.cms_post_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cms_post_tags ON public.cms_post_tags;
CREATE POLICY tenant_isolation_cms_post_tags ON public.cms_post_tags
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- cms_post_views belongs to the hospital that owns its cms_posts row.
ALTER TABLE public.cms_post_views ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.cms_post_views c SET tenant_id = p.tenant_id
  FROM public.cms_posts p WHERE p.id = c.post_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cms_post_views_tenant ON public.cms_post_views (tenant_id);
DROP TRIGGER IF EXISTS trg_cms_post_views_tenant_from_parent ON public.cms_post_views;
CREATE TRIGGER trg_cms_post_views_tenant_from_parent
    BEFORE INSERT OR UPDATE OF post_id ON public.cms_post_views
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('cms_posts', 'post_id');
ALTER TABLE public.cms_post_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cms_post_views ON public.cms_post_views;
CREATE POLICY tenant_isolation_cms_post_views ON public.cms_post_views
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- integration_execution_steps belongs to the hospital that owns its integration_executions row.
ALTER TABLE public.integration_execution_steps ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.integration_execution_steps c SET tenant_id = p.tenant_id
  FROM public.integration_executions p WHERE p.id = c.execution_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_integration_execution_steps_tenant ON public.integration_execution_steps (tenant_id);
DROP TRIGGER IF EXISTS trg_integration_execution_steps_tenant_from_parent ON public.integration_execution_steps;
CREATE TRIGGER trg_integration_execution_steps_tenant_from_parent
    BEFORE INSERT OR UPDATE OF execution_id ON public.integration_execution_steps
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('integration_executions', 'execution_id');
ALTER TABLE public.integration_execution_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_integration_execution_steps ON public.integration_execution_steps;
CREATE POLICY tenant_isolation_integration_execution_steps ON public.integration_execution_steps
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- lms_course_modules belongs to the hospital that owns its lms_courses row.
ALTER TABLE public.lms_course_modules ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.lms_course_modules c SET tenant_id = p.tenant_id
  FROM public.lms_courses p WHERE p.id = c.course_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_course_modules_tenant ON public.lms_course_modules (tenant_id);
DROP TRIGGER IF EXISTS trg_lms_course_modules_tenant_from_parent ON public.lms_course_modules;
CREATE TRIGGER trg_lms_course_modules_tenant_from_parent
    BEFORE INSERT OR UPDATE OF course_id ON public.lms_course_modules
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('lms_courses', 'course_id');
ALTER TABLE public.lms_course_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lms_course_modules ON public.lms_course_modules;
CREATE POLICY tenant_isolation_lms_course_modules ON public.lms_course_modules
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- lms_quizzes belongs to the hospital that owns its lms_courses row.
ALTER TABLE public.lms_quizzes ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.lms_quizzes c SET tenant_id = p.tenant_id
  FROM public.lms_courses p WHERE p.id = c.course_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_quizzes_tenant ON public.lms_quizzes (tenant_id);
DROP TRIGGER IF EXISTS trg_lms_quizzes_tenant_from_parent ON public.lms_quizzes;
CREATE TRIGGER trg_lms_quizzes_tenant_from_parent
    BEFORE INSERT OR UPDATE OF course_id ON public.lms_quizzes
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('lms_courses', 'course_id');
ALTER TABLE public.lms_quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lms_quizzes ON public.lms_quizzes;
CREATE POLICY tenant_isolation_lms_quizzes ON public.lms_quizzes
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- lms_quiz_questions belongs to the hospital that owns its lms_quizzes row.
ALTER TABLE public.lms_quiz_questions ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.lms_quiz_questions c SET tenant_id = p.tenant_id
  FROM public.lms_quizzes p WHERE p.id = c.quiz_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_quiz_questions_tenant ON public.lms_quiz_questions (tenant_id);
DROP TRIGGER IF EXISTS trg_lms_quiz_questions_tenant_from_parent ON public.lms_quiz_questions;
CREATE TRIGGER trg_lms_quiz_questions_tenant_from_parent
    BEFORE INSERT OR UPDATE OF quiz_id ON public.lms_quiz_questions
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('lms_quizzes', 'quiz_id');
ALTER TABLE public.lms_quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lms_quiz_questions ON public.lms_quiz_questions;
CREATE POLICY tenant_isolation_lms_quiz_questions ON public.lms_quiz_questions
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- lms_learning_path_courses belongs to the hospital that owns its lms_learning_paths row.
ALTER TABLE public.lms_learning_path_courses ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.lms_learning_path_courses c SET tenant_id = p.tenant_id
  FROM public.lms_learning_paths p WHERE p.id = c.path_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_learning_path_courses_tenant ON public.lms_learning_path_courses (tenant_id);
DROP TRIGGER IF EXISTS trg_lms_learning_path_courses_tenant_from_parent ON public.lms_learning_path_courses;
CREATE TRIGGER trg_lms_learning_path_courses_tenant_from_parent
    BEFORE INSERT OR UPDATE OF path_id ON public.lms_learning_path_courses
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('lms_learning_paths', 'path_id');
ALTER TABLE public.lms_learning_path_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lms_learning_path_courses ON public.lms_learning_path_courses;
CREATE POLICY tenant_isolation_lms_learning_path_courses ON public.lms_learning_path_courses
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- lms_quiz_attempts belongs to the hospital that owns its lms_enrollments row.
ALTER TABLE public.lms_quiz_attempts ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.lms_quiz_attempts c SET tenant_id = p.tenant_id
  FROM public.lms_enrollments p WHERE p.id = c.enrollment_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_quiz_attempts_tenant ON public.lms_quiz_attempts (tenant_id);
DROP TRIGGER IF EXISTS trg_lms_quiz_attempts_tenant_from_parent ON public.lms_quiz_attempts;
CREATE TRIGGER trg_lms_quiz_attempts_tenant_from_parent
    BEFORE INSERT OR UPDATE OF enrollment_id ON public.lms_quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('lms_enrollments', 'enrollment_id');
ALTER TABLE public.lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lms_quiz_attempts ON public.lms_quiz_attempts;
CREATE POLICY tenant_isolation_lms_quiz_attempts ON public.lms_quiz_attempts
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- stock_disposal_items belongs to the hospital that owns its stock_disposal_requests row.
ALTER TABLE public.stock_disposal_items ADD COLUMN IF NOT EXISTS tenant_id UUID;
UPDATE public.stock_disposal_items c SET tenant_id = p.tenant_id
  FROM public.stock_disposal_requests p WHERE p.id = c.disposal_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_disposal_items_tenant ON public.stock_disposal_items (tenant_id);
DROP TRIGGER IF EXISTS trg_stock_disposal_items_tenant_from_parent ON public.stock_disposal_items;
CREATE TRIGGER trg_stock_disposal_items_tenant_from_parent
    BEFORE INSERT OR UPDATE OF disposal_id ON public.stock_disposal_items
    FOR EACH ROW EXECUTE FUNCTION public.inherit_parent_tenant('stock_disposal_requests', 'disposal_id');
ALTER TABLE public.stock_disposal_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_stock_disposal_items ON public.stock_disposal_items;
CREATE POLICY tenant_isolation_stock_disposal_items ON public.stock_disposal_items
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));

-- NOT NULL wherever the backfill reached every row.
DO $$
DECLARE t text; orphaned boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['dashboard_widgets', 'cms_post_revisions', 'cms_post_tags', 'cms_post_views', 'integration_execution_steps', 'lms_course_modules', 'lms_quizzes', 'lms_quiz_questions', 'lms_learning_path_courses', 'lms_quiz_attempts', 'stock_disposal_items'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = format('public.%I', t)::regclass
                       AND attname = 'tenant_id' AND attnotnull) THEN
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE tenant_id IS NULL)', t)
               INTO STRICT orphaned;
            IF orphaned THEN
                -- Hidden from medbrains_app by the policy either way; left
                -- nullable so the migration does not stop a deploy over it.
                RAISE WARNING '%: rows without a parent tenant; tenant_id left nullable', t;
            ELSE
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            END IF;
        END IF;
    END LOOP;
END $$;

-- ── 2. Records shared by the two hospitals at either end ────────────
ALTER TABLE public.patient_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_patient_transfers ON public.patient_transfers;
CREATE POLICY tenant_isolation_patient_transfers ON public.patient_transfers
    USING (source_tenant_id = ANY (public.app_visible_tenants())
           OR dest_tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (source_tenant_id = ANY (public.app_visible_tenants())
                OR dest_tenant_id = ANY (public.app_visible_tenants()));

ALTER TABLE public.inter_hospital_stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_inter_hospital_stock_transfers
    ON public.inter_hospital_stock_transfers;
CREATE POLICY tenant_isolation_inter_hospital_stock_transfers
    ON public.inter_hospital_stock_transfers
    USING (source_tenant_id = ANY (public.app_visible_tenants())
           OR dest_tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (source_tenant_id = ANY (public.app_visible_tenants())
                OR dest_tenant_id = ANY (public.app_visible_tenants()));

-- A line is visible exactly when its transfer is: the subquery is filtered by
-- the transfer's own policy.
ALTER TABLE public.inter_hospital_stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_inter_hospital_stock_transfer_items
    ON public.inter_hospital_stock_transfer_items;
CREATE POLICY tenant_isolation_inter_hospital_stock_transfer_items
    ON public.inter_hospital_stock_transfer_items
    USING (EXISTS (SELECT 1 FROM public.inter_hospital_stock_transfers t
                    WHERE t.id = transfer_id))
    WITH CHECK (EXISTS (SELECT 1 FROM public.inter_hospital_stock_transfers t
                         WHERE t.id = transfer_id));

ALTER TABLE public.lab_sample_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_lab_sample_routes ON public.lab_sample_routes;
CREATE POLICY tenant_isolation_lab_sample_routes ON public.lab_sample_routes
    USING (source_tenant_id = ANY (public.app_visible_tenants())
           OR dest_tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (source_tenant_id = ANY (public.app_visible_tenants())
                OR dest_tenant_id = ANY (public.app_visible_tenants()));

ALTER TABLE public.cross_hospital_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cross_hospital_appointments
    ON public.cross_hospital_appointments;
CREATE POLICY tenant_isolation_cross_hospital_appointments
    ON public.cross_hospital_appointments
    USING (booking_tenant_id = ANY (public.app_visible_tenants())
           OR service_tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (booking_tenant_id = ANY (public.app_visible_tenants())
                OR service_tenant_id = ANY (public.app_visible_tenants()));

-- ── 3. A group's shared masters ─────────────────────────────────────
ALTER TABLE public.group_drug_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_isolation_group_drug_master ON public.group_drug_master;
CREATE POLICY group_isolation_group_drug_master ON public.group_drug_master
    USING (group_id = public.app_current_group())
    WITH CHECK (group_id = public.app_current_group());

ALTER TABLE public.group_test_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_isolation_group_test_master ON public.group_test_master;
CREATE POLICY group_isolation_group_test_master ON public.group_test_master
    USING (group_id = public.app_current_group())
    WITH CHECK (group_id = public.app_current_group());

ALTER TABLE public.group_tariff_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_isolation_group_tariff_master ON public.group_tariff_master;
CREATE POLICY group_isolation_group_tariff_master ON public.group_tariff_master
    USING (group_id = public.app_current_group())
    WITH CHECK (group_id = public.app_current_group());

ALTER TABLE public.group_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS group_isolation_group_templates ON public.group_templates;
CREATE POLICY group_isolation_group_templates ON public.group_templates
    USING (group_id = public.app_current_group())
    WITH CHECK (group_id = public.app_current_group());

-- ── 4. Global reference data the application only reads ─────────────
-- Seeded by migrations and the boot seed, both as the owner.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
    public._sqlx_migrations,
    public.cds_diagnosis_reference, public.cds_drug_ingredient, public.cds_drug_reference,
    public.cds_ingredient_incompatibility, public.cds_lab_reference, public.cds_state_formulary,
    public.event_registry, public.event_schemas, public.module_entity_schemas,
    public.geo_countries, public.geo_states, public.geo_districts, public.geo_subdistricts,
    public.geo_towns, public.regulatory_bodies, public.partition_config
FROM medbrains_app;

DO $$
BEGIN
    IF to_regclass('public._sqlx_migrations_pre_baseline') IS NOT NULL THEN
        REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public._sqlx_migrations_pre_baseline
            FROM medbrains_app;
    END IF;
    -- No code reads or writes form_fields, and its form_id points at a table
    -- that no longer exists. Dropped when empty; otherwise sealed off.
    IF to_regclass('public.form_fields') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.form_fields) THEN
            DROP TABLE public.form_fields;
        ELSE
            REVOKE ALL ON public.form_fields FROM medbrains_app;
        END IF;
    END IF;
END $$;

-- ── Password sign-in under medbrains_app ────────────────────────────
-- Sign-in looks a username up before any tenant is known, and `users` is
-- under row level security: as medbrains_app the lookup found nobody and
-- every password login answered 401. Same shape as 0986's pre-auth lookups:
-- the one question sign-in needs answered, nothing else, callable only by the
-- application. Service accounts never sign in with a password.
CREATE OR REPLACE FUNCTION public.app_login_accounts(p_username TEXT, p_tenant UUID)
RETURNS TABLE (
    id UUID, tenant_id UUID, username TEXT, email TEXT, password_hash TEXT,
    full_name TEXT, role TEXT, is_active BOOLEAN, perm_version INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.tenant_id, u.username, u.email, u.password_hash, u.full_name,
           u.role::text, u.is_active, u.perm_version
      FROM public.users u
     WHERE u.username = p_username AND u.is_service_account = false
       AND (p_tenant IS NULL OR u.tenant_id = p_tenant)
     LIMIT 2
$$;

REVOKE ALL ON FUNCTION public.app_login_accounts(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login_accounts(TEXT, UUID) TO medbrains_app;
