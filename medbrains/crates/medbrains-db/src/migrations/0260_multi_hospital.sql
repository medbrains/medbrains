-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 12
-- Drops: none
-- multi hospital — schema.
--
-- Each table is declared once, in its final shape, with its indexes, policies
-- and triggers beside it. Before this refactor the definition of a single
-- table was spread over as many as nine migrations, and reading it meant
-- replaying the history in your head.
--
-- Foreign keys are not here. They are relationships rather than structure, and
-- deferring them to the end of the file (same-module) or to
-- 0900_cross_module_foreign_keys.sql (everything else) means no file has to be
-- ordered around anything another file declares.



CREATE TABLE public.brand_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    short_name text,
    logo_url text,
    address text,
    phone text,
    email text,
    registration_no text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: brand_entities brand_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_entities
    ADD CONSTRAINT brand_entities_pkey PRIMARY KEY (id);

-- Name: brand_entities brand_entities_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_entities
    ADD CONSTRAINT brand_entities_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_brand_entities_deleted_at_5df4a5fa ON public.brand_entities USING btree (deleted_at);

CREATE INDEX idx_brand_entities_tenant ON public.brand_entities USING btree (tenant_id);

ALTER TABLE public.brand_entities ENABLE ROW LEVEL SECURITY;

-- Name: brand_entities brand_entities_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brand_entities_tenant ON public.brand_entities USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: brand_entities trg_brand_entities_soft_delete_5df4a5fa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_entities_soft_delete_5df4a5fa BEFORE DELETE ON public.brand_entities FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: brand_entities trg_brand_entities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_entities_updated_at BEFORE UPDATE ON public.brand_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.cross_hospital_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_tenant_id uuid NOT NULL,
    service_tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    status text DEFAULT 'booked'::text NOT NULL,
    booked_by uuid NOT NULL,
    booking_source text DEFAULT 'direct'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: cross_hospital_appointments cross_hospital_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_hospital_appointments
    ADD CONSTRAINT cross_hospital_appointments_pkey PRIMARY KEY (id);

CREATE INDEX idx_cross_hospital_appointments_deleted_at_b39011f8 ON public.cross_hospital_appointments USING btree (deleted_at);

CREATE INDEX idx_cross_hospital_appts_booking ON public.cross_hospital_appointments USING btree (booking_tenant_id);

CREATE INDEX idx_cross_hospital_appts_patient ON public.cross_hospital_appointments USING btree (patient_id);

CREATE INDEX idx_cross_hospital_appts_service ON public.cross_hospital_appointments USING btree (service_tenant_id);

-- Name: cross_hospital_appointments trg_cross_hospital_appointments_soft_delete_b39011f8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cross_hospital_appointments_soft_delete_b39011f8 BEFORE DELETE ON public.cross_hospital_appointments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.group_drug_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    generic_name text,
    manufacturer text,
    drug_schedule text,
    atc_code text,
    formulation text,
    strength text,
    unit text,
    hsn_code text,
    gst_rate numeric(5,2) DEFAULT 12.00,
    is_controlled boolean DEFAULT false,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: group_drug_master group_drug_master_group_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_drug_master
    ADD CONSTRAINT group_drug_master_group_id_code_key UNIQUE (group_id, code);

-- Name: group_drug_master group_drug_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_drug_master
    ADD CONSTRAINT group_drug_master_pkey PRIMARY KEY (id);

CREATE INDEX idx_group_drug_master ON public.group_drug_master USING btree (group_id);

CREATE INDEX idx_group_drug_master_deleted_at_1492c59b ON public.group_drug_master USING btree (deleted_at);

-- Name: group_drug_master trg_group_drug_master_soft_delete_1492c59b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_drug_master_soft_delete_1492c59b BEFORE DELETE ON public.group_drug_master FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.group_kpi_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    tenant_id uuid,
    snapshot_date date NOT NULL,
    snapshot_type text DEFAULT 'daily'::text NOT NULL,
    total_beds integer,
    occupied_beds integer,
    occupancy_pct numeric(5,2),
    opd_visits integer,
    new_patients integer,
    admissions integer,
    discharges integer,
    gross_revenue numeric(14,2),
    net_revenue numeric(14,2),
    collections numeric(14,2),
    avg_los numeric(5,2),
    mortality_rate numeric(5,4),
    readmission_rate numeric(5,4),
    infection_rate numeric(5,4),
    metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: group_kpi_snapshots group_kpi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_kpi_snapshots
    ADD CONSTRAINT group_kpi_snapshots_pkey PRIMARY KEY (id);

CREATE INDEX idx_group_kpi_snapshots_deleted_at_3223f7ba ON public.group_kpi_snapshots USING btree (deleted_at);

CREATE INDEX idx_group_kpi_snapshots_group ON public.group_kpi_snapshots USING btree (group_id, snapshot_date);

CREATE INDEX idx_group_kpi_snapshots_tenant ON public.group_kpi_snapshots USING btree (tenant_id, snapshot_date);

CREATE UNIQUE INDEX idx_group_kpi_unique ON public.group_kpi_snapshots USING btree (group_id, tenant_id, snapshot_date, snapshot_type);

ALTER TABLE public.group_kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Name: group_kpi_snapshots tenant_isolation_group_kpi_snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_group_kpi_snapshots ON public.group_kpi_snapshots USING (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((tenant_id IS NULL) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

-- Name: group_kpi_snapshots trg_group_kpi_snapshots_soft_delete_3223f7ba; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_kpi_snapshots_soft_delete_3223f7ba BEFORE DELETE ON public.group_kpi_snapshots FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.group_tariff_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    service_code text NOT NULL,
    service_name text NOT NULL,
    category text,
    base_price numeric(14,2) NOT NULL,
    gst_applicable boolean DEFAULT true,
    gst_rate numeric(5,2) DEFAULT 18.00,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: group_tariff_master group_tariff_master_group_id_service_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tariff_master
    ADD CONSTRAINT group_tariff_master_group_id_service_code_key UNIQUE (group_id, service_code);

-- Name: group_tariff_master group_tariff_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tariff_master
    ADD CONSTRAINT group_tariff_master_pkey PRIMARY KEY (id);

CREATE INDEX idx_group_tariff_master ON public.group_tariff_master USING btree (group_id);

CREATE INDEX idx_group_tariff_master_deleted_at_e93ec6d4 ON public.group_tariff_master USING btree (deleted_at);

-- Name: group_tariff_master trg_group_tariff_master_soft_delete_e93ec6d4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_tariff_master_soft_delete_e93ec6d4 BEFORE DELETE ON public.group_tariff_master FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.group_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    template_type text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: group_templates group_templates_group_id_template_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_templates
    ADD CONSTRAINT group_templates_group_id_template_type_code_key UNIQUE (group_id, template_type, code);

-- Name: group_templates group_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_templates
    ADD CONSTRAINT group_templates_pkey PRIMARY KEY (id);

CREATE INDEX idx_group_templates ON public.group_templates USING btree (group_id, template_type);

CREATE INDEX idx_group_templates_deleted_at_3a18849c ON public.group_templates USING btree (deleted_at);

-- Name: group_templates trg_group_templates_soft_delete_3a18849c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_templates_soft_delete_3a18849c BEFORE DELETE ON public.group_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.group_test_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    department text,
    loinc_code text,
    sample_type text,
    container_type text,
    volume_required text,
    tat_hours integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: group_test_master group_test_master_group_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_test_master
    ADD CONSTRAINT group_test_master_group_id_code_key UNIQUE (group_id, code);

-- Name: group_test_master group_test_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_test_master
    ADD CONSTRAINT group_test_master_pkey PRIMARY KEY (id);

CREATE INDEX idx_group_test_master ON public.group_test_master USING btree (group_id);

CREATE INDEX idx_group_test_master_deleted_at_56531c96 ON public.group_test_master USING btree (deleted_at);

-- Name: group_test_master trg_group_test_master_soft_delete_56531c96; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_group_test_master_soft_delete_56531c96 BEFORE DELETE ON public.group_test_master FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.hospital_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    display_name text,
    headquarters_address text,
    phone text,
    email text,
    website text,
    logo_url text,
    primary_color text DEFAULT '#228be6'::text,
    config jsonb DEFAULT '{}'::jsonb,
    default_currency text DEFAULT 'INR'::text,
    timezone text DEFAULT 'Asia/Kolkata'::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: hospital_groups hospital_groups_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_groups
    ADD CONSTRAINT hospital_groups_code_key UNIQUE (code);

-- Name: hospital_groups hospital_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_groups
    ADD CONSTRAINT hospital_groups_pkey PRIMARY KEY (id);

CREATE INDEX idx_hospital_groups_code ON public.hospital_groups USING btree (code);

CREATE INDEX idx_hospital_groups_deleted_at_1bf9df28 ON public.hospital_groups USING btree (deleted_at);

-- Name: hospital_groups trg_hospital_groups_soft_delete_1bf9df28; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospital_groups_soft_delete_1bf9df28 BEFORE DELETE ON public.hospital_groups FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: hospital_groups trg_hospital_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospital_groups_updated_at BEFORE UPDATE ON public.hospital_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.hospital_regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    country text DEFAULT 'India'::text,
    states text[],
    regional_head_name text,
    regional_head_email text,
    regional_head_phone text,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: hospital_regions hospital_regions_group_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_regions
    ADD CONSTRAINT hospital_regions_group_id_code_key UNIQUE (group_id, code);

-- Name: hospital_regions hospital_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_regions
    ADD CONSTRAINT hospital_regions_pkey PRIMARY KEY (id);

CREATE INDEX idx_hospital_regions_deleted_at_f49c3730 ON public.hospital_regions USING btree (deleted_at);

CREATE INDEX idx_hospital_regions_group ON public.hospital_regions USING btree (group_id);

-- Name: hospital_regions trg_hospital_regions_soft_delete_f49c3730; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospital_regions_soft_delete_f49c3730 BEFORE DELETE ON public.hospital_regions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: hospital_regions trg_hospital_regions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospital_regions_updated_at BEFORE UPDATE ON public.hospital_regions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.inter_hospital_stock_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid NOT NULL,
    item_id uuid NOT NULL,
    item_type text DEFAULT 'drug'::text NOT NULL,
    item_code text NOT NULL,
    item_name text NOT NULL,
    batch_number text,
    expiry_date date,
    requested_qty numeric(14,3) NOT NULL,
    approved_qty numeric(14,3),
    dispatched_qty numeric(14,3),
    received_qty numeric(14,3),
    unit text NOT NULL,
    unit_price numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: inter_hospital_stock_transfer_items inter_hospital_stock_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfer_items
    ADD CONSTRAINT inter_hospital_stock_transfer_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_inter_hospital_stock_transfer_items_deleted_at_5fdcd0aa ON public.inter_hospital_stock_transfer_items USING btree (deleted_at);

CREATE INDEX idx_stock_transfer_items ON public.inter_hospital_stock_transfer_items USING btree (transfer_id);

-- Name: inter_hospital_stock_transfer_items trg_inter_hospital_stock_transfer_items_soft_delete_5fdcd0aa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inter_hospital_stock_transfer_items_soft_delete_5fdcd0aa BEFORE DELETE ON public.inter_hospital_stock_transfer_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.inter_hospital_stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_tenant_id uuid NOT NULL,
    dest_tenant_id uuid NOT NULL,
    transfer_number text NOT NULL,
    status public.stock_transfer_status DEFAULT 'requested'::public.stock_transfer_status NOT NULL,
    priority text DEFAULT 'normal'::text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    received_at timestamp with time zone,
    requested_by uuid NOT NULL,
    approved_by uuid,
    dispatched_by uuid,
    received_by uuid,
    request_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: inter_hospital_stock_transfers inter_hospital_stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfers
    ADD CONSTRAINT inter_hospital_stock_transfers_pkey PRIMARY KEY (id);

CREATE INDEX idx_inter_hospital_stock_transfers_deleted_at_f666d228 ON public.inter_hospital_stock_transfers USING btree (deleted_at);

CREATE INDEX idx_stock_transfers_dest ON public.inter_hospital_stock_transfers USING btree (dest_tenant_id);

CREATE INDEX idx_stock_transfers_source ON public.inter_hospital_stock_transfers USING btree (source_tenant_id);

CREATE INDEX idx_stock_transfers_status ON public.inter_hospital_stock_transfers USING btree (status);

-- Name: inter_hospital_stock_transfers trg_inter_hospital_stock_transfers_soft_delete_f666d228; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inter_hospital_stock_transfers_soft_delete_f666d228 BEFORE DELETE ON public.inter_hospital_stock_transfers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: inter_hospital_stock_transfers trg_stock_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_transfers_updated_at BEFORE UPDATE ON public.inter_hospital_stock_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.user_hospital_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role text NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true NOT NULL,
    valid_from date DEFAULT CURRENT_DATE,
    valid_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: user_hospital_assignments user_hospital_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_hospital_assignments
    ADD CONSTRAINT user_hospital_assignments_pkey PRIMARY KEY (id);

-- Name: user_hospital_assignments user_hospital_assignments_user_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_hospital_assignments
    ADD CONSTRAINT user_hospital_assignments_user_id_tenant_id_key UNIQUE (user_id, tenant_id);

CREATE INDEX idx_user_hospital_assignments_deleted_at_4175a5ae ON public.user_hospital_assignments USING btree (deleted_at);

CREATE INDEX idx_user_hospital_assignments_tenant ON public.user_hospital_assignments USING btree (tenant_id);

CREATE INDEX idx_user_hospital_assignments_user ON public.user_hospital_assignments USING btree (user_id);

ALTER TABLE public.user_hospital_assignments ENABLE ROW LEVEL SECURITY;

-- Name: user_hospital_assignments tenant_isolation_user_hospital_assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_user_hospital_assignments ON public.user_hospital_assignments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: user_hospital_assignments trg_user_hospital_assignments_soft_delete_4175a5ae; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_hospital_assignments_soft_delete_4175a5ae BEFORE DELETE ON public.user_hospital_assignments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: user_hospital_assignments trg_user_hospital_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_hospital_assignments_updated_at BEFORE UPDATE ON public.user_hospital_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: group_drug_master group_drug_master_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_drug_master
    ADD CONSTRAINT group_drug_master_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: group_kpi_snapshots group_kpi_snapshots_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_kpi_snapshots
    ADD CONSTRAINT group_kpi_snapshots_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: group_tariff_master group_tariff_master_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_tariff_master
    ADD CONSTRAINT group_tariff_master_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: group_templates group_templates_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_templates
    ADD CONSTRAINT group_templates_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: group_test_master group_test_master_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_test_master
    ADD CONSTRAINT group_test_master_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: hospital_regions hospital_regions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_regions
    ADD CONSTRAINT hospital_regions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.hospital_groups(id);

-- Name: inter_hospital_stock_transfer_items inter_hospital_stock_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_hospital_stock_transfer_items
    ADD CONSTRAINT inter_hospital_stock_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.inter_hospital_stock_transfers(id) ON DELETE CASCADE;
