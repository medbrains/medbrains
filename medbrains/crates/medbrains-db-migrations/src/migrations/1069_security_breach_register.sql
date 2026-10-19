-- ====================================================================
-- Migration: 1069_security_breach_register.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: security_incident_updates
-- Drops: none
-- ====================================================================
-- Personal-data breach and CERT-In reporting on the security incident
-- record (RFCs/COMPLIANCE-GAP-2026-10.md #13; docs/compliance/INCIDENT-RESPONSE.md §6).
--
-- 1. The clocks start when the incident is NOTICED (`discovered_at`), not
--    when it is confirmed: CERT-In within 6 hours (Directions 28-04-2022,
--    direction (ii)) for a reportable cyber incident; the Data Protection
--    Board intimated without delay and the detailed report within 72 hours
--    (DPDP Rules 2025, rule 7) for a personal-data breach, plus a notice to
--    each affected Data Principal. Deadlines are computed from
--    `discovered_at`; the sent timestamps and references are recorded once.
-- 2. `*_escalated_at` makes the overdue escalation fire once per clock.
-- 3. `security_incident_updates` is the incident's timeline. The CERT-In
--    routes wrote to it for months; it never existed.

ALTER TABLE public.security_incidents
    ADD COLUMN IF NOT EXISTS discovered_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_cert_in_reportable boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_personal_data_breach boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS breach_data_categories text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS principals_affected_estimate integer,
    ADD COLUMN IF NOT EXISTS board_intimated_at timestamptz,
    ADD COLUMN IF NOT EXISTS board_report_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS board_reference text,
    ADD COLUMN IF NOT EXISTS principals_notified_at timestamptz,
    ADD COLUMN IF NOT EXISTS principals_notified_count integer,
    ADD COLUMN IF NOT EXISTS cert_in_escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS board_escalated_at timestamptz;

ALTER TABLE public.security_incidents
    DROP CONSTRAINT IF EXISTS security_incidents_breach_counts_nonnegative;
ALTER TABLE public.security_incidents
    ADD CONSTRAINT security_incidents_breach_counts_nonnegative
    CHECK (COALESCE(principals_affected_estimate, 0) >= 0
           AND COALESCE(principals_notified_count, 0) >= 0);

-- A clock needs a start: a reportable incident must say when it was noticed.
ALTER TABLE public.security_incidents
    DROP CONSTRAINT IF EXISTS security_incidents_clock_has_start;
ALTER TABLE public.security_incidents
    ADD CONSTRAINT security_incidents_clock_has_start
    CHECK (NOT (is_cert_in_reportable OR is_personal_data_breach) OR discovered_at IS NOT NULL);

-- The escalation pass reads only open clocks.
CREATE INDEX IF NOT EXISTS idx_security_incidents_open_clocks
    ON public.security_incidents (tenant_id, discovered_at)
    WHERE deleted_at IS NULL
      AND (is_cert_in_reportable OR is_personal_data_breach);

CREATE TABLE IF NOT EXISTS public.security_incident_updates (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    incident_id   uuid NOT NULL REFERENCES public.security_incidents(id),
    update_type   text NOT NULL
        CHECK (update_type IN ('note', 'assessment', 'cert_in', 'board_initial',
                               'board_report', 'principals', 'escalation')),
    description   text NOT NULL,
    updated_by    uuid REFERENCES public.users(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    deleted_by    uuid,
    delete_reason text
);
CREATE INDEX IF NOT EXISTS idx_security_incident_updates_incident
    ON public.security_incident_updates (tenant_id, incident_id, created_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_security_incident_updates_updated_at ON public.security_incident_updates;
CREATE TRIGGER trg_security_incident_updates_updated_at
    BEFORE UPDATE ON public.security_incident_updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_security_incident_updates_soft_delete ON public.security_incident_updates;
CREATE TRIGGER trg_security_incident_updates_soft_delete
    BEFORE DELETE ON public.security_incident_updates
    FOR EACH ROW EXECUTE FUNCTION soft_delete_guardrail();
DROP TRIGGER IF EXISTS audit_security_incident_updates ON public.security_incident_updates;
CREATE TRIGGER audit_security_incident_updates
    AFTER INSERT OR DELETE OR UPDATE ON public.security_incident_updates
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('security');

ALTER TABLE public.security_incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incident_updates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_security_incident_updates ON public.security_incident_updates;
CREATE POLICY tenant_isolation_security_incident_updates ON public.security_incident_updates
    USING (tenant_id = ANY (app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (app_visible_tenants()));

-- The breach columns change the register itself: audit them at the row too.
DROP TRIGGER IF EXISTS audit_security_incidents ON public.security_incidents;
CREATE TRIGGER audit_security_incidents
    AFTER INSERT OR DELETE OR UPDATE ON public.security_incidents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func('security');
