-- Structured camp planning backbone.
--
-- New planning rows are no longer only hidden inside camps.equipment_list.
-- The legacy JSON remains readable, but create/update materializes row-level
-- doctor, staff, service, medicine, sponsor, approval, printable, and closure
-- records that can drive readiness, approvals, billing, pharmacy, assets, MRD,
-- and closeout reporting.

CREATE TABLE IF NOT EXISTS public.camp_sponsor_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text DEFAULT 'default' NOT NULL,
    sponsor_name text,
    contact_name text,
    contact_phone text,
    mou_reference text,
    covered_services text[] DEFAULT ARRAY[]::text[] NOT NULL,
    covered_medicines text[] DEFAULT ARRAY[]::text[] NOT NULL,
    coverage_cap numeric(12,2) DEFAULT 0 NOT NULL,
    coverage_percent numeric(5,2) DEFAULT 0 NOT NULL,
    invoice_terms text,
    settlement_owner_id uuid,
    receivable_amount numeric(12,2) DEFAULT 0 NOT NULL,
    collected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_sponsor_plans_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_sponsor_plans_status_check
        CHECK (status IN ('draft', 'active', 'settled', 'cancelled')),
    CONSTRAINT camp_sponsor_plans_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_target_populations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    target_name text NOT NULL,
    population_type text,
    age_group text,
    disease_focus text,
    eligibility_rules text,
    expected_patients integer DEFAULT 0 NOT NULL,
    expected_high_risk_groups text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_target_populations_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_target_populations_expected_patients_check CHECK (expected_patients >= 0),
    CONSTRAINT camp_target_populations_status_check
        CHECK (status IN ('planned', 'ready', 'cancelled', 'closed')),
    CONSTRAINT camp_target_populations_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_site_readiness_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    item_type text NOT NULL,
    label text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    owner_id uuid,
    due_date date,
    evidence_attachment_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_site_readiness_items_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_site_readiness_items_status_check
        CHECK (status IN ('pending', 'ready', 'issue', 'not_applicable', 'closed')),
    CONSTRAINT camp_site_readiness_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_counters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    counter_type text NOT NULL,
    counter_name text NOT NULL,
    owner_id uuid,
    capacity_per_hour integer DEFAULT 0 NOT NULL,
    start_time text,
    end_time text,
    location_label text,
    required_asset_notes text,
    status text DEFAULT 'planned' NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_counters_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_counters_capacity_check CHECK (capacity_per_hour >= 0),
    CONSTRAINT camp_counters_status_check
        CHECK (status IN ('planned', 'ready', 'active', 'closed', 'cancelled')),
    CONSTRAINT camp_counters_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_department_counters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    department_id uuid NOT NULL,
    counter_id uuid,
    service_scope text,
    reporting_owner_id uuid,
    opd_routing_enabled boolean DEFAULT true NOT NULL,
    status text DEFAULT 'planned' NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_department_counters_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_department_counters_counter_id_fkey
        FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id),
    CONSTRAINT camp_department_counters_department_id_fkey
        FOREIGN KEY (department_id) REFERENCES public.departments(id),
    CONSTRAINT camp_department_counters_status_check
        CHECK (status IN ('planned', 'ready', 'active', 'closed', 'cancelled')),
    CONSTRAINT camp_department_counters_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_doctor_roster (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    doctor_id uuid NOT NULL,
    department_id uuid,
    duty_start timestamptz,
    duty_end timestamptz,
    expected_consults integer DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free' NOT NULL,
    patient_fee numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    honorarium_amount numeric(12,2) DEFAULT 0 NOT NULL,
    backup_doctor_id uuid,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_doctor_roster_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_doctor_roster_charge_mode_check
        CHECK (charge_mode IN ('free', 'paid', 'mixed', 'sponsor_covered')),
    CONSTRAINT camp_doctor_roster_status_check
        CHECK (status IN ('planned', 'confirmed', 'active', 'completed', 'cancelled')),
    CONSTRAINT camp_doctor_roster_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_staff_roster (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    employee_id uuid NOT NULL,
    role_in_camp text NOT NULL,
    counter_id uuid,
    duty_start timestamptz,
    duty_end timestamptz,
    break_coverage_notes text,
    attendance_link_id uuid,
    backup_employee_id uuid,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_staff_roster_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_staff_roster_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES public.employees(id),
    CONSTRAINT camp_staff_roster_backup_employee_id_fkey
        FOREIGN KEY (backup_employee_id) REFERENCES public.employees(id),
    CONSTRAINT camp_staff_roster_counter_id_fkey
        FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id),
    CONSTRAINT camp_staff_roster_status_check
        CHECK (status IN ('planned', 'confirmed', 'active', 'completed', 'cancelled')),
    CONSTRAINT camp_staff_roster_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_service_pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    service_key text NOT NULL,
    service_name text NOT NULL,
    counter_id uuid,
    department_id uuid,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free' NOT NULL,
    standard_rate numeric(12,2) DEFAULT 0 NOT NULL,
    patient_rate numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    camp_cost numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    approval_required boolean DEFAULT false NOT NULL,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_service_pricing_rules_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_service_pricing_rules_counter_id_fkey
        FOREIGN KEY (counter_id) REFERENCES public.camp_counters(id),
    CONSTRAINT camp_service_pricing_rules_department_id_fkey
        FOREIGN KEY (department_id) REFERENCES public.departments(id),
    CONSTRAINT camp_service_pricing_rules_charge_mode_check
        CHECK (charge_mode IN ('free', 'paid', 'mixed', 'sponsor_covered')),
    CONSTRAINT camp_service_pricing_rules_status_check
        CHECK (status IN ('planned', 'approved', 'active', 'closed', 'cancelled')),
    CONSTRAINT camp_service_pricing_rules_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_medicine_pricing_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    catalog_item_id uuid,
    medicine_name text NOT NULL,
    generic_name text,
    batch_stock_id uuid,
    batch_no text,
    expiry_date date,
    store_location_id uuid,
    planned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    reserved_qty numeric(12,2) DEFAULT 0 NOT NULL,
    issued_qty numeric(12,2) DEFAULT 0 NOT NULL,
    free_qty numeric(12,2) DEFAULT 0 NOT NULL,
    paid_qty numeric(12,2) DEFAULT 0 NOT NULL,
    consumed_qty numeric(12,2) DEFAULT 0 NOT NULL,
    returned_qty numeric(12,2) DEFAULT 0 NOT NULL,
    damaged_qty numeric(12,2) DEFAULT 0 NOT NULL,
    patient_unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    camp_unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    sponsor_share_amount numeric(12,2) DEFAULT 0 NOT NULL,
    concession_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    charge_mode text DEFAULT 'free' NOT NULL,
    is_lasa boolean DEFAULT false NOT NULL,
    is_controlled boolean DEFAULT false NOT NULL,
    drug_schedule text,
    approval_required boolean DEFAULT false NOT NULL,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_medicine_pricing_rules_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_medicine_pricing_rules_catalog_item_id_fkey
        FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id),
    CONSTRAINT camp_medicine_pricing_rules_batch_stock_id_fkey
        FOREIGN KEY (batch_stock_id) REFERENCES public.pharmacy_batches(id),
    CONSTRAINT camp_medicine_pricing_rules_store_location_id_fkey
        FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id),
    CONSTRAINT camp_medicine_pricing_rules_charge_mode_check
        CHECK (charge_mode IN ('free', 'paid', 'mixed', 'sponsor_covered')),
    CONSTRAINT camp_medicine_pricing_rules_status_check
        CHECK (status IN ('planned', 'approved', 'reserved', 'issued', 'closed', 'cancelled')),
    CONSTRAINT camp_medicine_pricing_rules_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_approval_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    approval_type text NOT NULL,
    linked_entity_type text NOT NULL,
    linked_entity_id uuid,
    requested_by uuid,
    approved_by uuid,
    rejected_by uuid,
    requested_at timestamptz DEFAULT now() NOT NULL,
    decided_at timestamptz,
    reason text,
    notes text,
    status text DEFAULT 'pending' NOT NULL,
    blocks_activation boolean DEFAULT true NOT NULL,
    blocks_closeout boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_approval_items_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_approval_items_type_check
        CHECK (approval_type IN (
            'free_medicine', 'partial_free_medicine', 'sponsor_billing',
            'budget_overrun', 'asset_issue', 'controlled_medicine',
            'camp_activation', 'camp_closure'
        )),
    CONSTRAINT camp_approval_items_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT camp_approval_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_referral_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    referral_facility text NOT NULL,
    referral_department text,
    emergency_contact text,
    transport_mode text,
    red_flag_protocol text,
    escalation_owner_id uuid,
    status text DEFAULT 'planned' NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_referral_plans_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_referral_plans_status_check
        CHECK (status IN ('planned', 'ready', 'active', 'closed', 'cancelled')),
    CONSTRAINT camp_referral_plans_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_print_plan_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    template_type text NOT NULL,
    template_name text NOT NULL,
    status text DEFAULT 'planned' NOT NULL,
    owner_id uuid,
    paper_size text,
    copies integer DEFAULT 1 NOT NULL,
    printer_profile_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_print_plan_items_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_print_plan_items_copies_check CHECK (copies > 0),
    CONSTRAINT camp_print_plan_items_status_check
        CHECK (status IN ('planned', 'ready', 'printed', 'cancelled')),
    CONSTRAINT camp_print_plan_items_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE TABLE IF NOT EXISTS public.camp_closure_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    source_key text NOT NULL,
    task_type text NOT NULL,
    label text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    owner_id uuid,
    due_date date,
    completed_by uuid,
    completed_at timestamptz,
    evidence_attachment_id uuid,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    deleted_at timestamptz,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_closure_tasks_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE RESTRICT,
    CONSTRAINT camp_closure_tasks_status_check
        CHECK (status IN ('pending', 'done', 'waived', 'blocked')),
    CONSTRAINT camp_closure_tasks_tenant_camp_source_key UNIQUE (tenant_id, camp_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_camp_sponsor_plans_active
    ON public.camp_sponsor_plans (tenant_id, camp_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_target_populations_active
    ON public.camp_target_populations (tenant_id, camp_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_site_readiness_items_active
    ON public.camp_site_readiness_items (tenant_id, camp_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_counters_active
    ON public.camp_counters (tenant_id, camp_id, counter_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_department_counters_active
    ON public.camp_department_counters (tenant_id, camp_id, department_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_doctor_roster_active
    ON public.camp_doctor_roster (tenant_id, camp_id, doctor_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_staff_roster_active
    ON public.camp_staff_roster (tenant_id, camp_id, employee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_service_pricing_rules_active
    ON public.camp_service_pricing_rules (tenant_id, camp_id, service_key, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_medicine_pricing_rules_active
    ON public.camp_medicine_pricing_rules (tenant_id, camp_id, catalog_item_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_approval_items_active
    ON public.camp_approval_items (tenant_id, camp_id, status, approval_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_referral_plans_active
    ON public.camp_referral_plans (tenant_id, camp_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_print_plan_items_active
    ON public.camp_print_plan_items (tenant_id, camp_id, template_type, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camp_closure_tasks_active
    ON public.camp_closure_tasks (tenant_id, camp_id, status, task_type) WHERE deleted_at IS NULL;

DO $$
DECLARE
    table_name text;
    trigger_name text;
    soft_delete_trigger_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'camp_sponsor_plans',
        'camp_target_populations',
        'camp_site_readiness_items',
        'camp_counters',
        'camp_department_counters',
        'camp_doctor_roster',
        'camp_staff_roster',
        'camp_service_pricing_rules',
        'camp_medicine_pricing_rules',
        'camp_approval_items',
        'camp_referral_plans',
        'camp_print_plan_items',
        'camp_closure_tasks'
    ]
    LOOP
        trigger_name := 'trg_' || table_name || '_updated_at';
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
                trigger_name,
                table_name
            );
        END IF;

        soft_delete_trigger_name := left(
            'trg_' || table_name || '_soft_delete_' || substr(md5(table_name), 1, 8),
            63
        );
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = soft_delete_trigger_name) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()',
                soft_delete_trigger_name,
                table_name
            );
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = table_name
              AND policyname = table_name || '_tenant'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)',
                table_name || '_tenant',
                table_name
            );
        END IF;
    END LOOP;
END $$;
