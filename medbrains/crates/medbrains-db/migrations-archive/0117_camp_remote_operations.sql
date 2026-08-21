-- ====================================================================
-- Migration: 0117_camp_remote_operations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: camp_remote_setups, camp_remote_checklist_items,
--             camp_supply_items, camp_referrals, camp_incidents,
--             camp_sync_events
-- ====================================================================
-- Remote Camp operations backbone.
--
-- NABH-facing intent:
--   AAC/COP  - assessment, triage, referral and continuity controls
--   PRE      - patient privacy, rights, education and consent support
--   IPC/HIC  - infection prevention, sharps and biomedical waste controls
--   PSQ      - incident reporting and corrective action evidence
--   ROM/FMS  - site safety, water, power, crowd control and emergency route
--   HRM      - staff roster, role briefing and credential checks
--   IMS      - structured records, offline packet evidence and auditability

CREATE TABLE public.camp_remote_setups (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,

    village_name text,
    block_name text,
    district_name text,
    site_landmark text,
    latitude double precision,
    longitude double precision,
    expected_footfall integer,

    site_contact_name text,
    site_contact_phone text,
    local_authority_name text,
    local_authority_phone text,
    referral_facility_name text,
    referral_facility_phone text,
    ambulance_contact_name text,
    ambulance_contact_phone text,

    emergency_route_notes text,
    network_plan text,
    power_plan text,
    water_sanitation_plan text,
    privacy_plan text,
    crowd_control_plan text,
    bmw_plan text,
    infection_control_plan text,

    status text DEFAULT 'draft' NOT NULL
        CHECK (status IN ('draft', 'ready', 'blocked', 'closed')),
    readiness_score integer DEFAULT 0 NOT NULL
        CHECK (readiness_score >= 0 AND readiness_score <= 100),
    completed_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT camp_remote_setups_tenant_camp_key UNIQUE (tenant_id, camp_id),
    CONSTRAINT camp_remote_setups_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE
);

CREATE TABLE public.camp_remote_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    category text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    nabh_chapter text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'ok', 'issue', 'not_applicable')),
    notes text,
    evidence_attachment_id uuid,
    checked_by uuid,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT camp_remote_checklist_tenant_camp_code_key UNIQUE (tenant_id, camp_id, code),
    CONSTRAINT camp_remote_checklist_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE
);

CREATE TABLE public.camp_supply_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    category text NOT NULL
        CHECK (category IN (
            'equipment', 'consumable', 'medicine', 'ppe',
            'biomedical_waste', 'document', 'it', 'other'
        )),
    item_name text NOT NULL,
    unit text,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    packed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    consumed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    returned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    batch_no text,
    expiry_date date,
    is_critical boolean DEFAULT false NOT NULL,
    shortage_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT camp_supply_items_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE
);

CREATE TABLE public.camp_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    registration_id uuid,
    referred_to_facility text NOT NULL,
    referral_department text,
    urgency text DEFAULT 'routine' NOT NULL
        CHECK (urgency IN ('routine', 'urgent', 'emergency')),
    reason text NOT NULL,
    transport_mode text,
    ambulance_required boolean DEFAULT false NOT NULL,
    attendant_name text,
    attendant_phone text,
    status text DEFAULT 'created' NOT NULL
        CHECK (status IN ('created', 'sent', 'accepted', 'completed', 'cancelled')),
    referred_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT camp_referrals_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE,
    CONSTRAINT camp_referrals_registration_id_fkey
        FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id)
);

CREATE TABLE public.camp_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    registration_id uuid,
    incident_type text NOT NULL
        CHECK (incident_type IN (
            'patient_safety', 'infection_control', 'biomedical_waste',
            'facility_safety', 'staff_safety', 'data_privacy',
            'equipment', 'network', 'crowd_control', 'other'
        )),
    severity text DEFAULT 'low' NOT NULL
        CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    description text NOT NULL,
    immediate_action text,
    status text DEFAULT 'open' NOT NULL
        CHECK (status IN ('open', 'contained', 'closed')),
    reported_by uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT camp_incidents_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE,
    CONSTRAINT camp_incidents_registration_id_fkey
        FOREIGN KEY (registration_id) REFERENCES public.camp_registrations(id)
);

CREATE TABLE public.camp_sync_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    device_id text NOT NULL,
    idempotency_key text NOT NULL,
    event_type text NOT NULL,
    client_entity_id uuid,
    payload jsonb NOT NULL,
    status text DEFAULT 'received' NOT NULL
        CHECK (status IN ('received', 'applied', 'duplicate', 'failed')),
    server_entity_type text,
    server_entity_id uuid,
    error text,
    occurred_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,

    CONSTRAINT camp_sync_events_tenant_key UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT camp_sync_events_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE
);

CREATE INDEX idx_camp_remote_setups_camp
    ON public.camp_remote_setups (tenant_id, camp_id);

CREATE INDEX idx_camp_remote_checklist_camp
    ON public.camp_remote_checklist_items (tenant_id, camp_id, category);

CREATE INDEX idx_camp_remote_checklist_status
    ON public.camp_remote_checklist_items (tenant_id, camp_id, status);

CREATE INDEX idx_camp_supply_items_camp
    ON public.camp_supply_items (tenant_id, camp_id, category);

CREATE INDEX idx_camp_referrals_camp
    ON public.camp_referrals (tenant_id, camp_id, status);

CREATE INDEX idx_camp_referrals_registration
    ON public.camp_referrals (tenant_id, registration_id)
    WHERE registration_id IS NOT NULL;

CREATE INDEX idx_camp_incidents_camp
    ON public.camp_incidents (tenant_id, camp_id, status, severity);

CREATE INDEX idx_camp_incidents_registration
    ON public.camp_incidents (tenant_id, registration_id)
    WHERE registration_id IS NOT NULL;

CREATE INDEX idx_camp_sync_events_camp
    ON public.camp_sync_events (tenant_id, camp_id, received_at DESC);

CREATE INDEX idx_camp_sync_events_device
    ON public.camp_sync_events (tenant_id, device_id, received_at DESC);

CREATE INDEX idx_camp_sync_events_status
    ON public.camp_sync_events (tenant_id, status, received_at)
    WHERE status IN ('received', 'failed');

CREATE TRIGGER trg_camp_remote_setups_updated_at
    BEFORE UPDATE ON public.camp_remote_setups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_camp_remote_checklist_updated_at
    BEFORE UPDATE ON public.camp_remote_checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_camp_supply_items_updated_at
    BEFORE UPDATE ON public.camp_supply_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_camp_referrals_updated_at
    BEFORE UPDATE ON public.camp_referrals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_camp_incidents_updated_at
    BEFORE UPDATE ON public.camp_incidents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER audit_camp_remote_setups
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_remote_setups
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

CREATE TRIGGER audit_camp_remote_checklist_items
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_remote_checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

CREATE TRIGGER audit_camp_supply_items
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_supply_items
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

CREATE TRIGGER audit_camp_referrals
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_referrals
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

CREATE TRIGGER audit_camp_incidents
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_incidents
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

CREATE TRIGGER audit_camp_sync_events
    AFTER INSERT OR DELETE OR UPDATE ON public.camp_sync_events
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('camp');

SELECT apply_tenant_rls('camp_remote_setups');
SELECT apply_tenant_rls('camp_remote_checklist_items');
SELECT apply_tenant_rls('camp_supply_items');
SELECT apply_tenant_rls('camp_referrals');
SELECT apply_tenant_rls('camp_incidents');
SELECT apply_tenant_rls('camp_sync_events');
