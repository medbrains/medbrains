-- ============================================================
-- MedBrains schema — module: indent
-- ============================================================

--
-- Name: batch_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    store_location_id uuid,
    batch_number text NOT NULL,
    expiry_date date,
    manufacture_date date,
    quantity integer DEFAULT 0 NOT NULL,
    unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    grn_id uuid,
    vendor_id uuid,
    is_consignment boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    serial_number text,
    barcode text,
    pharmacy_batch_id uuid
);



--
-- Name: equipment_condemnations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_condemnations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    condemnation_number text NOT NULL,
    status public.condemnation_status DEFAULT 'initiated'::public.condemnation_status NOT NULL,
    reason text NOT NULL,
    current_value numeric(12,2) DEFAULT 0 NOT NULL,
    purchase_value numeric(12,2) DEFAULT 0 NOT NULL,
    committee_remarks text,
    approved_by uuid,
    approved_at timestamp with time zone,
    disposal_method text,
    disposed_at timestamp with time zone,
    initiated_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: implant_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.implant_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    batch_stock_id uuid,
    patient_id uuid NOT NULL,
    serial_number text,
    implant_date date NOT NULL,
    implant_site text,
    surgeon_id uuid,
    manufacturer text,
    model_number text,
    warranty_expiry date,
    removal_date date,
    removal_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: indent_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indent_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    requisition_id uuid NOT NULL,
    catalog_item_id uuid,
    item_name text NOT NULL,
    quantity_requested integer NOT NULL,
    quantity_approved integer DEFAULT 0 NOT NULL,
    quantity_issued integer DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_price numeric(12,2) DEFAULT 0 NOT NULL,
    item_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indent_items_quantity_requested_check CHECK ((quantity_requested > 0))
);



--
-- Name: indent_requisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indent_requisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    indent_number text NOT NULL,
    department_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    indent_type text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT indent_requisitions_indent_type_check CHECK ((indent_type = ANY (ARRAY['general'::text, 'pharmacy'::text, 'lab'::text, 'surgical'::text, 'housekeeping'::text, 'emergency'::text]))),
    CONSTRAINT indent_requisitions_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text, 'emergency'::text]))),
    CONSTRAINT indent_requisitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'partially_approved'::text, 'rejected'::text, 'issued'::text, 'partially_issued'::text, 'closed'::text, 'cancelled'::text])))
);



--
-- Name: indents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    indent_number text,
    indent_date date,
    indent_type text,
    priority text,
    department_id uuid,
    store_id uuid,
    requested_by uuid,
    estimated_value numeric(14,2),
    justification text,
    approved_by uuid,
    approved_at timestamp with time zone,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.indents FORCE ROW LEVEL SECURITY;



--
-- Name: patient_consumable_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_consumable_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    batch_stock_id uuid,
    department_id uuid,
    encounter_id uuid,
    admission_id uuid,
    quantity integer NOT NULL,
    returned_qty integer DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    status public.consumable_issue_status DEFAULT 'issued'::public.consumable_issue_status NOT NULL,
    is_chargeable boolean DEFAULT true NOT NULL,
    invoice_item_id uuid,
    issued_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_consumable_issues_quantity_check CHECK ((quantity > 0))
);



--
-- Name: reorder_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reorder_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    alert_type text DEFAULT 'below_reorder'::text NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    threshold_level integer DEFAULT 0 NOT NULL,
    is_acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: stock_disposal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_disposal_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    disposal_id uuid NOT NULL,
    item_id uuid,
    item_name text NOT NULL,
    item_code text,
    batch_number text,
    expiry_date date,
    quantity numeric(12,3) NOT NULL,
    unit text NOT NULL,
    unit_cost numeric(12,2),
    total_cost numeric(14,2),
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: stock_disposal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_disposal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_number text NOT NULL,
    store_id uuid,
    disposal_type text NOT NULL,
    disposal_method text,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    executed_by uuid,
    executed_at timestamp with time zone,
    total_value numeric(14,2),
    reason text,
    notes text,
    certificate_number text,
    witness_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.stock_disposal_requests FORCE ROW LEVEL SECURITY;



--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    transfer_number text,
    transfer_date date,
    from_store_id uuid,
    to_store_id uuid,
    transfer_type text,
    reason text,
    initiated_by uuid,
    dispatched_by uuid,
    dispatched_at timestamp with time zone,
    received_by uuid,
    received_at timestamp with time zone,
    status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.stock_transfers FORCE ROW LEVEL SECURITY;



--
-- Name: store_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    sub_category text,
    unit text DEFAULT 'unit'::text NOT NULL,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_implant boolean DEFAULT false NOT NULL,
    is_high_value boolean DEFAULT false NOT NULL,
    ved_class public.ved_class,
    hsn_code text,
    bin_location text,
    last_issue_date timestamp with time zone,
    last_receipt_date timestamp with time zone,
    min_stock integer DEFAULT 0 NOT NULL,
    max_stock integer DEFAULT 0 NOT NULL
);



--
-- Name: store_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    location_type text DEFAULT 'main_store'::text NOT NULL,
    department_id uuid,
    facility_id uuid,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: store_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    reference_type text,
    reference_id uuid,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    store_location_id uuid,
    batch_stock_id uuid,
    patient_id uuid,
    CONSTRAINT store_stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'return'::text, 'adjustment'::text, 'transfer'::text])))
);



--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    ndps_license_number text,
    ndps_license_valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.stores FORCE ROW LEVEL SECURITY;



--
-- Name: batch_stock batch_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_pkey PRIMARY KEY (id);



--
-- Name: equipment_condemnations equipment_condemnations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_pkey PRIMARY KEY (id);



--
-- Name: implant_registry implant_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_pkey PRIMARY KEY (id);



--
-- Name: indent_items indent_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_pkey PRIMARY KEY (id);



--
-- Name: indent_requisitions indent_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_pkey PRIMARY KEY (id);



--
-- Name: indent_requisitions indent_requisitions_tenant_id_indent_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_tenant_id_indent_number_key UNIQUE (tenant_id, indent_number);



--
-- Name: indents indents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_pkey PRIMARY KEY (id);



--
-- Name: patient_consumable_issues patient_consumable_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_pkey PRIMARY KEY (id);



--
-- Name: reorder_alerts reorder_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_pkey PRIMARY KEY (id);



--
-- Name: stock_disposal_items stock_disposal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_items
    ADD CONSTRAINT stock_disposal_items_pkey PRIMARY KEY (id);



--
-- Name: stock_disposal_requests stock_disposal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_pkey PRIMARY KEY (id);



--
-- Name: stock_disposal_requests stock_disposal_requests_tenant_id_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_tenant_id_request_number_key UNIQUE (tenant_id, request_number);



--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);



--
-- Name: store_catalog store_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_catalog
    ADD CONSTRAINT store_catalog_pkey PRIMARY KEY (id);



--
-- Name: store_catalog store_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_catalog
    ADD CONSTRAINT store_catalog_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: store_locations store_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_pkey PRIMARY KEY (id);



--
-- Name: store_locations store_locations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: store_stock_movements store_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_pkey PRIMARY KEY (id);



--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);



--
-- Name: idx_batch_stock_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_stock_expiry ON public.batch_stock USING btree (tenant_id, expiry_date) WHERE (quantity > 0);



--
-- Name: idx_batch_stock_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_stock_item ON public.batch_stock USING btree (tenant_id, catalog_item_id);



--
-- Name: idx_batch_stock_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_stock_location ON public.batch_stock USING btree (tenant_id, store_location_id);



--
-- Name: idx_condemnations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_condemnations_status ON public.equipment_condemnations USING btree (status);



--
-- Name: idx_condemnations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_condemnations_tenant ON public.equipment_condemnations USING btree (tenant_id);



--
-- Name: idx_consumable_issues_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_patient ON public.patient_consumable_issues USING btree (patient_id);



--
-- Name: idx_consumable_issues_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumable_issues_tenant ON public.patient_consumable_issues USING btree (tenant_id);



--
-- Name: idx_disposal_items_disposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disposal_items_disposal ON public.stock_disposal_items USING btree (disposal_id);



--
-- Name: idx_implant_registry_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_implant_registry_patient ON public.implant_registry USING btree (patient_id);



--
-- Name: idx_implant_registry_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_implant_registry_tenant ON public.implant_registry USING btree (tenant_id);



--
-- Name: idx_indent_items_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_items_catalog ON public.indent_items USING btree (catalog_item_id) WHERE (catalog_item_id IS NOT NULL);



--
-- Name: idx_indent_items_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_items_req ON public.indent_items USING btree (requisition_id);



--
-- Name: idx_indent_req_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_req_dept ON public.indent_requisitions USING btree (tenant_id, department_id);



--
-- Name: idx_indent_req_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_req_requested_by ON public.indent_requisitions USING btree (tenant_id, requested_by);



--
-- Name: idx_indent_req_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_req_status ON public.indent_requisitions USING btree (tenant_id, status);



--
-- Name: idx_indent_req_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_req_tenant ON public.indent_requisitions USING btree (tenant_id);



--
-- Name: idx_indent_req_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indent_req_type ON public.indent_requisitions USING btree (tenant_id, indent_type);



--
-- Name: idx_indents_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indents_dept ON public.indents USING btree (tenant_id, department_id, created_at DESC);



--
-- Name: idx_reorder_alerts_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reorder_alerts_item ON public.reorder_alerts USING btree (catalog_item_id);



--
-- Name: idx_reorder_alerts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reorder_alerts_tenant ON public.reorder_alerts USING btree (tenant_id);



--
-- Name: idx_reorder_alerts_unack; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reorder_alerts_unack ON public.reorder_alerts USING btree (is_acknowledged) WHERE (is_acknowledged = false);



--
-- Name: idx_stock_movements_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_date ON public.store_stock_movements USING btree (created_at);



--
-- Name: idx_stock_movements_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_department ON public.store_stock_movements USING btree (department_id) WHERE (department_id IS NOT NULL);



--
-- Name: idx_stock_movements_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_item ON public.store_stock_movements USING btree (catalog_item_id);



--
-- Name: idx_stock_movements_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_location ON public.store_stock_movements USING btree (store_location_id) WHERE (store_location_id IS NOT NULL);



--
-- Name: idx_stock_movements_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_patient ON public.store_stock_movements USING btree (patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_stock_movements_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_ref ON public.store_stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);



--
-- Name: idx_stock_movements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_tenant ON public.store_stock_movements USING btree (tenant_id);



--
-- Name: idx_stock_transfers_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfers_from ON public.stock_transfers USING btree (tenant_id, from_store_id, transfer_date DESC);



--
-- Name: idx_store_catalog_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_catalog_active ON public.store_catalog USING btree (tenant_id, is_active) WHERE is_active;



--
-- Name: idx_store_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_catalog_category ON public.store_catalog USING btree (tenant_id, category);



--
-- Name: idx_store_catalog_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_catalog_tenant ON public.store_catalog USING btree (tenant_id);



--
-- Name: idx_store_locations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_locations_tenant ON public.store_locations USING btree (tenant_id);



--
-- Name: batch_stock set_batch_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_batch_stock_updated_at BEFORE UPDATE ON public.batch_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: store_locations set_store_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_store_locations_updated_at BEFORE UPDATE ON public.store_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: equipment_condemnations trg_equipment_condemnations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_condemnations_updated_at BEFORE UPDATE ON public.equipment_condemnations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: implant_registry trg_implant_registry_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_implant_registry_updated_at BEFORE UPDATE ON public.implant_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: patient_consumable_issues trg_patient_consumable_issues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consumable_issues_updated_at BEFORE UPDATE ON public.patient_consumable_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: reorder_alerts trg_reorder_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reorder_alerts_updated_at BEFORE UPDATE ON public.reorder_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: batch_stock batch_stock_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: batch_stock batch_stock_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);



--
-- Name: equipment_condemnations equipment_condemnations_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: implant_registry implant_registry_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);



--
-- Name: implant_registry implant_registry_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: indent_items indent_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: indent_items indent_items_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.indent_requisitions(id) ON DELETE CASCADE;



--
-- Name: indents indents_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);



--
-- Name: patient_consumable_issues patient_consumable_issues_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);



--
-- Name: patient_consumable_issues patient_consumable_issues_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: reorder_alerts reorder_alerts_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: stock_disposal_items stock_disposal_items_disposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_items
    ADD CONSTRAINT stock_disposal_items_disposal_id_fkey FOREIGN KEY (disposal_id) REFERENCES public.stock_disposal_requests(id) ON DELETE CASCADE;



--
-- Name: stock_transfers stock_transfers_from_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_store_id_fkey FOREIGN KEY (from_store_id) REFERENCES public.stores(id);



--
-- Name: stock_transfers stock_transfers_to_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_store_id_fkey FOREIGN KEY (to_store_id) REFERENCES public.stores(id);



--
-- Name: store_stock_movements store_stock_movements_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);



--
-- Name: store_stock_movements store_stock_movements_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);



--
-- Name: store_stock_movements store_stock_movements_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);



--
-- Name: batch_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batch_stock ENABLE ROW LEVEL SECURITY;


--
-- Name: batch_stock batch_stock_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_stock_tenant ON public.batch_stock USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: equipment_condemnations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.equipment_condemnations ENABLE ROW LEVEL SECURITY;


--
-- Name: implant_registry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.implant_registry ENABLE ROW LEVEL SECURITY;


--
-- Name: indent_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.indent_items ENABLE ROW LEVEL SECURITY;


--
-- Name: indent_items indent_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY indent_items_tenant ON public.indent_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: indent_requisitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.indent_requisitions ENABLE ROW LEVEL SECURITY;


--
-- Name: indent_requisitions indent_requisitions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY indent_requisitions_tenant ON public.indent_requisitions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: indents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.indents ENABLE ROW LEVEL SECURITY;


--
-- Name: patient_consumable_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_consumable_issues ENABLE ROW LEVEL SECURITY;


--
-- Name: reorder_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;


--
-- Name: stock_disposal_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_disposal_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: stock_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;


--
-- Name: store_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_catalog ENABLE ROW LEVEL SECURITY;


--
-- Name: store_catalog store_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_catalog_tenant ON public.store_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: store_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;


--
-- Name: store_locations store_locations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_locations_tenant ON public.store_locations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: store_stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_stock_movements ENABLE ROW LEVEL SECURITY;


--
-- Name: store_stock_movements store_stock_movements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_stock_movements_tenant ON public.store_stock_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;


--
-- Name: equipment_condemnations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.equipment_condemnations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: implant_registry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.implant_registry USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: patient_consumable_issues tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_consumable_issues USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: reorder_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reorder_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: indents tenant_isolation_indents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_indents ON public.indents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: stock_disposal_requests tenant_isolation_stock_disposal_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stock_disposal_requests ON public.stock_disposal_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: stock_transfers tenant_isolation_stock_transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stock_transfers ON public.stock_transfers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: stores tenant_isolation_stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stores ON public.stores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


