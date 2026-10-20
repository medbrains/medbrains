-- ====================================================================
-- Migration: 1147_collect_foundation.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: billing_entities, billing_lanes, bill_groups, collections
-- Drops: none
-- ====================================================================
-- Collect anywhere (#4885), the foundation.
--
-- A lane is the department a charge belongs to for collection: registration,
-- opd, lab, radiology, emergency, ipd, pharmacy. Each desk collects its own
-- lanes; the central cashier collects all. An admitted patient's charges all
-- sit in the ipd lane (one final bill), whatever produced them.
--
-- Money always belongs to the hospital: a part-payment is never apportioned
-- across departments. Revenue is reported by each item's department
-- (`invoice_items.department_id`, now filled on every charge path by a
-- trigger, and backfilled here); collections by counter, user and shift
-- (`payments.station_id`, `received_by`, `shift_id`). A receipt is split
-- only by legal entity, because each GSTIN keeps its own gapless series.
--
-- `payments.counter_id` (free text) stays: day close (`cash_closing.rs`)
-- still tallies by it.

-- ── Legal entities ───────────────────────────────────────────────────
CREATE TABLE public.billing_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$' AND length(code) <= 20),
    name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
    -- GSTIN: 2-digit state, PAN, entity number, 'Z', check character.
    gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
    drug_licence text,
    address text,
    -- Receipts number as <prefix>/<FY>/<000001>, one series per entity per year.
    receipt_prefix text NOT NULL CHECK (receipt_prefix ~ '^[A-Z0-9]{1,8}$'),
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_billing_entities_code ON public.billing_entities (tenant_id, code)
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_billing_entities_receipt_prefix
    ON public.billing_entities (tenant_id, receipt_prefix) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_billing_entities_default ON public.billing_entities (tenant_id)
    WHERE is_default AND deleted_at IS NULL;

-- ── Lanes ────────────────────────────────────────────────────────────
CREATE TABLE public.billing_lanes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    lane text NOT NULL CHECK (lane IN
        ('registration', 'opd', 'lab', 'radiology', 'emergency', 'ipd', 'pharmacy')),
    legal_entity_id uuid NOT NULL REFERENCES public.billing_entities(id),
    revenue_department_id uuid REFERENCES public.departments(id),
    -- individual: the lane's charges get a bill of their own per visit;
    -- together: they share the visit's one bill. Admitted patients: always one.
    default_mode text NOT NULL DEFAULT 'together' CHECK (default_mode IN ('individual', 'together')),
    -- Registration and OPD: charge the fee when the patient checks in, or when
    -- the consultation is completed.
    charge_at text NOT NULL DEFAULT 'checkin' CHECK (charge_at IN ('checkin', 'complete')),
    -- Registration lane: the fee; NULL charges none.
    fee_amount numeric(10,2) CHECK (fee_amount IS NULL OR fee_amount >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE UNIQUE INDEX uq_billing_lanes_lane ON public.billing_lanes (tenant_id, lane)
    WHERE deleted_at IS NULL;

-- ── Bill groups: one statement over several bills, items never move ──
CREATE TABLE public.bill_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    encounter_id uuid REFERENCES public.encounters(id),
    admission_id uuid REFERENCES public.admissions(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'dissolved')),
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX idx_bill_groups_patient ON public.bill_groups (tenant_id, patient_id)
    WHERE deleted_at IS NULL;

-- ── Collections: one patient payment act ─────────────────────────────
CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    patient_id uuid NOT NULL REFERENCES public.patients(id),
    station_id uuid REFERENCES public.stations(id),
    shift_id uuid REFERENCES public.shift_definitions(id),
    collected_by uuid NOT NULL REFERENCES public.users(id),
    scope text NOT NULL CHECK (scope IN ('department', 'all')),
    lane text CHECK (lane IS NULL OR lane IN
        ('registration', 'opd', 'lab', 'radiology', 'emergency', 'ipd', 'pharmacy')),
    total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
    tenders jsonb NOT NULL,
    -- A key is spent once, deleted or not: a retry never posts twice.
    idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
    request_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT uq_collections_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX idx_collections_patient ON public.collections (tenant_id, patient_id, created_at);

-- ── Links on the existing money tables ───────────────────────────────
ALTER TABLE public.invoices
    ADD COLUMN lane text CHECK (lane IS NULL OR lane IN
        ('together', 'registration', 'opd', 'lab', 'radiology', 'emergency', 'ipd', 'pharmacy')),
    ADD COLUMN legal_entity_id uuid REFERENCES public.billing_entities(id),
    ADD COLUMN bill_group_id uuid REFERENCES public.bill_groups(id);
CREATE INDEX idx_invoices_patient_open ON public.invoices (tenant_id, patient_id)
    WHERE status IN ('draft', 'issued', 'partially_paid') AND deleted_at IS NULL;

ALTER TABLE public.payments
    ADD COLUMN collection_id uuid REFERENCES public.collections(id),
    ADD COLUMN station_id uuid REFERENCES public.stations(id),
    ADD COLUMN shift_id uuid REFERENCES public.shift_definitions(id);
CREATE INDEX idx_payments_collection ON public.payments (collection_id)
    WHERE collection_id IS NOT NULL;
CREATE INDEX idx_payments_station_paid_at ON public.payments (tenant_id, station_id, paid_at)
    WHERE station_id IS NOT NULL;

ALTER TABLE public.receipts
    ADD COLUMN collection_id uuid REFERENCES public.collections(id),
    ADD COLUMN legal_entity_id uuid REFERENCES public.billing_entities(id);
CREATE UNIQUE INDEX uq_receipts_collection_entity ON public.receipts (collection_id, legal_entity_id)
    WHERE collection_id IS NOT NULL AND deleted_at IS NULL;

-- ── RLS, updated_at, soft delete on the new tables ───────────────────
ALTER TABLE public.billing_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_entities FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_entities_tenant ON public.billing_entities
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_billing_entities_updated_at BEFORE UPDATE ON public.billing_entities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_billing_entities_soft_delete BEFORE DELETE ON public.billing_entities
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.billing_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_lanes FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_lanes_tenant ON public.billing_lanes
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_billing_lanes_updated_at BEFORE UPDATE ON public.billing_lanes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_billing_lanes_soft_delete BEFORE DELETE ON public.billing_lanes
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.bill_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY bill_groups_tenant ON public.bill_groups
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_bill_groups_updated_at BEFORE UPDATE ON public.bill_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bill_groups_soft_delete BEFORE DELETE ON public.bill_groups
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections FORCE ROW LEVEL SECURITY;
CREATE POLICY collections_tenant ON public.collections
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON public.collections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_collections_soft_delete BEFORE DELETE ON public.collections
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── Lane of a charge ─────────────────────────────────────────────────
-- The department a charge source belongs to, or NULL for sources that
-- follow the visit (procedure, manual, consumable…).
CREATE FUNCTION public.billing_source_lane(p_source text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_source IN ('registration', 'opd', 'lab', 'radiology', 'emergency', 'ipd', 'pharmacy')
            THEN p_source
        WHEN p_source = 'ambulance' THEN 'emergency'
    END
$$;

-- The lane that collects a charge: everything on an admission is the ipd
-- lane (one final bill); otherwise the source's lane, else OPD.
CREATE FUNCTION public.billing_item_lane(p_source text, p_admission_id uuid) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_admission_id IS NOT NULL THEN 'ipd'
        ELSE COALESCE(public.billing_source_lane(p_source), 'opd')
    END
$$;

-- INFERRED: the seeded department codes a lane earns revenue for when the
-- hospital has not chosen one on its lanes screen.
CREATE FUNCTION public.billing_lane_default_dept_code(p_lane text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p_lane
        WHEN 'lab' THEN 'PATHOLOGY'
        WHEN 'radiology' THEN 'RADIOLOGY'
        WHEN 'pharmacy' THEN 'PHARMACY'
        WHEN 'emergency' THEN 'EMERGENCY'
        WHEN 'registration' THEN 'MRD'
    END
$$;

-- Lab, radiology and pharmacy bill on their own by default, so their desks
-- collect without touching the visit's bill; the rest share the visit's bill.
CREATE FUNCTION public.billing_lane_default_mode(p_lane text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_lane IN ('lab', 'radiology', 'pharmacy') THEN 'individual' ELSE 'together' END
$$;

-- The department that earns a charge: the lane's chosen department, else
-- the seeded one for the lane, else the admission's or visit's department.
CREATE FUNCTION public.billing_item_department(p_tenant uuid, p_source text, p_invoice uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
    WITH inv AS (
        SELECT encounter_id, admission_id FROM public.invoices WHERE id = p_invoice
    ), src AS (
        SELECT public.billing_source_lane(p_source) AS lane
    )
    SELECT COALESCE(
        (SELECT bl.revenue_department_id FROM public.billing_lanes bl, src
          WHERE bl.tenant_id = p_tenant AND bl.lane = src.lane AND bl.deleted_at IS NULL),
        (SELECT d.id FROM public.departments d, src
          WHERE d.tenant_id = p_tenant AND d.deleted_at IS NULL
            AND d.code = public.billing_lane_default_dept_code(src.lane) LIMIT 1),
        (SELECT a.department_id FROM public.admissions a, inv WHERE a.id = inv.admission_id),
        (SELECT e.department_id FROM public.encounters e, inv WHERE e.id = inv.encounter_id)
    )
$$;

CREATE FUNCTION public.billing_fill_item_department() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.department_id IS NULL THEN
        NEW.department_id := public.billing_item_department(NEW.tenant_id, NEW.source::text, NEW.invoice_id);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_items_department BEFORE INSERT ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.billing_fill_item_department();

-- ── Defaults: one entity (from the hospital's GSTIN) and the seven lanes ─
CREATE FUNCTION public.billing_ensure_defaults(p_tenant uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE entity uuid;
BEGIN
    SELECT id INTO entity FROM public.billing_entities
     WHERE tenant_id = p_tenant AND is_default AND deleted_at IS NULL;
    IF entity IS NULL THEN
        INSERT INTO public.billing_entities (tenant_id, code, name, gstin, receipt_prefix, is_default)
        SELECT t.id, 'HOSP', left(COALESCE(NULLIF(t.name, ''), 'Hospital'), 120),
               (SELECT g FROM (
                    SELECT upper(s.value #>> '{}') AS g FROM public.tenant_settings s
                     WHERE s.tenant_id = p_tenant AND s.category = 'billing'
                       AND s.key = 'gst_number' AND s.deleted_at IS NULL) x
                 WHERE g ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
               'RCT', true
          FROM public.tenants t WHERE t.id = p_tenant
        ON CONFLICT DO NOTHING;
        SELECT id INTO entity FROM public.billing_entities
         WHERE tenant_id = p_tenant AND is_default AND deleted_at IS NULL;
    END IF;
    IF entity IS NOT NULL THEN
        INSERT INTO public.billing_lanes (tenant_id, lane, legal_entity_id, revenue_department_id, default_mode)
        SELECT p_tenant, l.lane, entity,
               (SELECT d.id FROM public.departments d
                 WHERE d.tenant_id = p_tenant AND d.deleted_at IS NULL
                   AND d.code = public.billing_lane_default_dept_code(l.lane) LIMIT 1),
               public.billing_lane_default_mode(l.lane)
          FROM unnest(ARRAY['registration', 'opd', 'lab', 'radiology', 'emergency', 'ipd',
                            'pharmacy']) AS l(lane)
         WHERE NOT EXISTS (SELECT 1 FROM public.billing_lanes b
                            WHERE b.tenant_id = p_tenant AND b.lane = l.lane AND b.deleted_at IS NULL)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN entity;
END $$;

-- A bill made by any path names its entity; the default when nobody said.
CREATE FUNCTION public.billing_fill_invoice_entity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.legal_entity_id IS NULL THEN
        NEW.legal_entity_id := public.billing_ensure_defaults(NEW.tenant_id);
    END IF;
    NEW.lane := COALESCE(NEW.lane, 'together');
    RETURN NEW;
END $$;
CREATE TRIGGER trg_invoices_entity BEFORE INSERT ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.billing_fill_invoice_entity();

-- ── Backfill, tenant by tenant under its own RLS context ─────────────
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);
        PERFORM public.billing_ensure_defaults(t.id);
        UPDATE public.invoices i
           SET lane = COALESCE(i.lane, 'together'),
               legal_entity_id = COALESCE(i.legal_entity_id,
                   (SELECT e.id FROM public.billing_entities e
                     WHERE e.tenant_id = t.id AND e.is_default AND e.deleted_at IS NULL))
         WHERE i.tenant_id = t.id AND (i.lane IS NULL OR i.legal_entity_id IS NULL);
        UPDATE public.invoice_items it
           SET department_id = public.billing_item_department(it.tenant_id, it.source::text, it.invoice_id)
         WHERE it.tenant_id = t.id AND it.department_id IS NULL;
    END LOOP;
END $$;
