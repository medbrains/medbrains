-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 26
-- Drops: none
-- supply chain — schema.
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
    pharmacy_batch_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: batch_stock batch_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_pkey PRIMARY KEY (id);

CREATE INDEX idx_batch_stock_catalog_item_id ON public.batch_stock USING btree (catalog_item_id);

CREATE INDEX idx_batch_stock_deleted_at_c51f71a8 ON public.batch_stock USING btree (deleted_at);

CREATE INDEX idx_batch_stock_expiry ON public.batch_stock USING btree (tenant_id, expiry_date) WHERE (quantity > 0);

CREATE INDEX idx_batch_stock_item ON public.batch_stock USING btree (tenant_id, catalog_item_id);

CREATE INDEX idx_batch_stock_location ON public.batch_stock USING btree (tenant_id, store_location_id);

ALTER TABLE public.batch_stock ENABLE ROW LEVEL SECURITY;

-- Name: batch_stock batch_stock_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_stock_tenant ON public.batch_stock USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: batch_stock set_batch_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_batch_stock_updated_at BEFORE UPDATE ON public.batch_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: batch_stock trg_batch_stock_soft_delete_c51f71a8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_batch_stock_soft_delete_c51f71a8 BEFORE DELETE ON public.batch_stock FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: equipment_condemnations equipment_condemnations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_pkey PRIMARY KEY (id);

CREATE INDEX idx_condemnations_status ON public.equipment_condemnations USING btree (status);

CREATE INDEX idx_condemnations_tenant ON public.equipment_condemnations USING btree (tenant_id);

CREATE INDEX idx_equipment_condemnations_catalog_item_id ON public.equipment_condemnations USING btree (catalog_item_id);

CREATE INDEX idx_equipment_condemnations_deleted_at_ac2e88c2 ON public.equipment_condemnations USING btree (deleted_at);

ALTER TABLE public.equipment_condemnations ENABLE ROW LEVEL SECURITY;

-- Name: equipment_condemnations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.equipment_condemnations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: equipment_condemnations trg_equipment_condemnations_soft_delete_ac2e88c2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_condemnations_soft_delete_ac2e88c2 BEFORE DELETE ON public.equipment_condemnations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: equipment_condemnations trg_equipment_condemnations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_equipment_condemnations_updated_at BEFORE UPDATE ON public.equipment_condemnations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.goods_receipt_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    grn_number text NOT NULL,
    po_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    store_location_id uuid,
    status public.grn_status DEFAULT 'draft'::public.grn_status NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    receipt_date date DEFAULT CURRENT_DATE NOT NULL,
    invoice_number text,
    invoice_date date,
    invoice_amount numeric(14,2),
    received_by uuid NOT NULL,
    inspected_by uuid,
    inspected_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: goods_receipt_notes goods_receipt_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_pkey PRIMARY KEY (id);

-- Name: goods_receipt_notes goods_receipt_notes_tenant_id_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_tenant_id_grn_number_key UNIQUE (tenant_id, grn_number);

CREATE INDEX idx_goods_receipt_notes_deleted_at_dafa046e ON public.goods_receipt_notes USING btree (deleted_at);

CREATE INDEX idx_grn_po ON public.goods_receipt_notes USING btree (po_id);

CREATE INDEX idx_grn_status ON public.goods_receipt_notes USING btree (tenant_id, status);

CREATE INDEX idx_grn_tenant ON public.goods_receipt_notes USING btree (tenant_id);

ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;

-- Name: goods_receipt_notes grn_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grn_tenant ON public.goods_receipt_notes USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: goods_receipt_notes set_grn_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_grn_updated_at BEFORE UPDATE ON public.goods_receipt_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: goods_receipt_notes trg_goods_receipt_notes_soft_delete_dafa046e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_goods_receipt_notes_soft_delete_dafa046e BEFORE DELETE ON public.goods_receipt_notes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.goods_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    grn_number text,
    grn_date date,
    po_id uuid,
    vendor_id uuid,
    vendor_invoice_number text,
    vendor_invoice_date date,
    challan_number text,
    store_id uuid,
    quality_check_done boolean DEFAULT false NOT NULL,
    quality_remarks text,
    received_by uuid,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);

CREATE INDEX idx_goods_receipts_deleted_at_c9a855e1 ON public.goods_receipts USING btree (deleted_at);

CREATE INDEX idx_grn_vendor ON public.goods_receipts USING btree (tenant_id, vendor_id, grn_date DESC);

ALTER TABLE ONLY public.goods_receipts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;

-- Name: goods_receipts tenant_isolation_goods_receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_goods_receipts ON public.goods_receipts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: goods_receipts trg_goods_receipts_soft_delete_c9a855e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_goods_receipts_soft_delete_c9a855e1 BEFORE DELETE ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.grn_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    grn_id uuid NOT NULL,
    po_item_id uuid,
    catalog_item_id uuid,
    item_name text NOT NULL,
    quantity_received integer NOT NULL,
    quantity_accepted integer DEFAULT 0 NOT NULL,
    quantity_rejected integer DEFAULT 0 NOT NULL,
    batch_number text,
    expiry_date date,
    manufacture_date date,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    rejection_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pharmacy_synced boolean DEFAULT false,
    pharmacy_batch_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_grn_items_catalog_item_id ON public.grn_items USING btree (catalog_item_id);

CREATE INDEX idx_grn_items_deleted_at_735462fa ON public.grn_items USING btree (deleted_at);

CREATE INDEX idx_grn_items_grn ON public.grn_items USING btree (grn_id);

CREATE INDEX idx_grn_items_tenant_id ON public.grn_items USING btree (tenant_id);

ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

-- Name: grn_items grn_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grn_items_tenant ON public.grn_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: grn_items trg_grn_items_soft_delete_735462fa; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_grn_items_soft_delete_735462fa BEFORE DELETE ON public.grn_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: implant_registry implant_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_pkey PRIMARY KEY (id);

CREATE INDEX idx_implant_registry_catalog_item_id ON public.implant_registry USING btree (catalog_item_id);

CREATE INDEX idx_implant_registry_deleted_at_c23f04a3 ON public.implant_registry USING btree (deleted_at);

CREATE INDEX idx_implant_registry_patient ON public.implant_registry USING btree (patient_id);

CREATE INDEX idx_implant_registry_tenant ON public.implant_registry USING btree (tenant_id);

ALTER TABLE public.implant_registry ENABLE ROW LEVEL SECURITY;

-- Name: implant_registry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.implant_registry USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: implant_registry trg_implant_registry_soft_delete_c23f04a3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_implant_registry_soft_delete_c23f04a3 BEFORE DELETE ON public.implant_registry FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: implant_registry trg_implant_registry_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_implant_registry_updated_at BEFORE UPDATE ON public.implant_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT indent_items_quantity_requested_check CHECK ((quantity_requested > 0))
);

-- Name: indent_items indent_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_indent_items_catalog ON public.indent_items USING btree (catalog_item_id) WHERE (catalog_item_id IS NOT NULL);

CREATE INDEX idx_indent_items_deleted_at_bd181b6e ON public.indent_items USING btree (deleted_at);

CREATE INDEX idx_indent_items_req ON public.indent_items USING btree (requisition_id);

CREATE INDEX idx_indent_items_tenant_id ON public.indent_items USING btree (tenant_id);

ALTER TABLE public.indent_items ENABLE ROW LEVEL SECURITY;

-- Name: indent_items indent_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY indent_items_tenant ON public.indent_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: indent_items trg_indent_items_soft_delete_bd181b6e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_indent_items_soft_delete_bd181b6e BEFORE DELETE ON public.indent_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT indent_requisitions_indent_type_check CHECK ((indent_type = ANY (ARRAY['general'::text, 'pharmacy'::text, 'lab'::text, 'surgical'::text, 'housekeeping'::text, 'emergency'::text]))),
    CONSTRAINT indent_requisitions_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text, 'emergency'::text]))),
    CONSTRAINT indent_requisitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'partially_approved'::text, 'rejected'::text, 'issued'::text, 'partially_issued'::text, 'closed'::text, 'cancelled'::text])))
);

-- Name: indent_requisitions indent_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_pkey PRIMARY KEY (id);

-- Name: indent_requisitions indent_requisitions_tenant_id_indent_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_requisitions
    ADD CONSTRAINT indent_requisitions_tenant_id_indent_number_key UNIQUE (tenant_id, indent_number);

CREATE INDEX idx_indent_req_dept ON public.indent_requisitions USING btree (tenant_id, department_id);

CREATE INDEX idx_indent_req_requested_by ON public.indent_requisitions USING btree (tenant_id, requested_by);

CREATE INDEX idx_indent_req_status ON public.indent_requisitions USING btree (tenant_id, status);

CREATE INDEX idx_indent_req_tenant ON public.indent_requisitions USING btree (tenant_id);

CREATE INDEX idx_indent_req_type ON public.indent_requisitions USING btree (tenant_id, indent_type);

CREATE INDEX idx_indent_requisitions_deleted_at_1c8381e6 ON public.indent_requisitions USING btree (deleted_at);

CREATE INDEX idx_indent_requisitions_department_id ON public.indent_requisitions USING btree (department_id);

ALTER TABLE public.indent_requisitions ENABLE ROW LEVEL SECURITY;

-- Name: indent_requisitions indent_requisitions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY indent_requisitions_tenant ON public.indent_requisitions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: indent_requisitions trg_indent_requisitions_soft_delete_1c8381e6; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_indent_requisitions_soft_delete_1c8381e6 BEFORE DELETE ON public.indent_requisitions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: indents indents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_pkey PRIMARY KEY (id);

CREATE INDEX idx_indents_deleted_at_9c7acd37 ON public.indents USING btree (deleted_at);

CREATE INDEX idx_indents_department_id ON public.indents USING btree (department_id);

CREATE INDEX idx_indents_dept ON public.indents USING btree (tenant_id, department_id, created_at DESC);

ALTER TABLE ONLY public.indents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.indents ENABLE ROW LEVEL SECURITY;

-- Name: indents tenant_isolation_indents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_indents ON public.indents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: indents trg_indents_soft_delete_9c7acd37; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_indents_soft_delete_9c7acd37 BEFORE DELETE ON public.indents FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_consumable_issues_quantity_check CHECK ((quantity > 0))
);

-- Name: patient_consumable_issues patient_consumable_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_pkey PRIMARY KEY (id);

CREATE INDEX idx_consumable_issues_patient ON public.patient_consumable_issues USING btree (patient_id);

CREATE INDEX idx_consumable_issues_tenant ON public.patient_consumable_issues USING btree (tenant_id);

CREATE INDEX idx_patient_consumable_issues_catalog_item_id ON public.patient_consumable_issues USING btree (catalog_item_id);

CREATE INDEX idx_patient_consumable_issues_deleted_at_98ab6dee ON public.patient_consumable_issues USING btree (deleted_at);

CREATE INDEX idx_patient_consumable_issues_department_id ON public.patient_consumable_issues USING btree (department_id);

ALTER TABLE public.patient_consumable_issues ENABLE ROW LEVEL SECURITY;

-- Name: patient_consumable_issues tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.patient_consumable_issues USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: patient_consumable_issues trg_patient_consumable_issues_soft_delete_98ab6dee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consumable_issues_soft_delete_98ab6dee BEFORE DELETE ON public.patient_consumable_issues FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: patient_consumable_issues trg_patient_consumable_issues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_consumable_issues_updated_at BEFORE UPDATE ON public.patient_consumable_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    po_id uuid NOT NULL,
    catalog_item_id uuid,
    item_name text NOT NULL,
    item_code text,
    unit text DEFAULT 'unit'::text NOT NULL,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    indent_item_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pharmacy_catalog_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_po_items_po ON public.purchase_order_items USING btree (po_id);

CREATE INDEX idx_purchase_order_items_catalog_item_id ON public.purchase_order_items USING btree (catalog_item_id);

CREATE INDEX idx_purchase_order_items_deleted_at_8844e97b ON public.purchase_order_items USING btree (deleted_at);

CREATE INDEX idx_purchase_order_items_tenant_id ON public.purchase_order_items USING btree (tenant_id);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Name: purchase_order_items po_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY po_items_tenant ON public.purchase_order_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: purchase_order_items trg_purchase_order_items_soft_delete_8844e97b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_order_items_soft_delete_8844e97b BEFORE DELETE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    po_number text NOT NULL,
    vendor_id uuid NOT NULL,
    store_location_id uuid,
    status public.po_status DEFAULT 'draft'::public.po_status NOT NULL,
    indent_requisition_id uuid,
    rate_contract_id uuid,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery date,
    payment_terms text,
    delivery_terms text,
    created_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_emergency boolean DEFAULT false NOT NULL,
    emergency_reason text,
    po_date date,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);

-- Name: purchase_orders purchase_orders_tenant_id_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_tenant_id_po_number_key UNIQUE (tenant_id, po_number);

CREATE INDEX idx_po_status ON public.purchase_orders USING btree (tenant_id, status);

CREATE INDEX idx_po_tenant ON public.purchase_orders USING btree (tenant_id);

CREATE INDEX idx_po_vendor ON public.purchase_orders USING btree (tenant_id, vendor_id);

CREATE INDEX idx_purchase_orders_deleted_at_f9112081 ON public.purchase_orders USING btree (deleted_at);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Name: purchase_orders purchase_orders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_tenant ON public.purchase_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: purchase_orders set_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: purchase_orders trg_purchase_orders_soft_delete_f9112081; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purchase_orders_soft_delete_f9112081 BEFORE DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rate_contract_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    contracted_price numeric(14,2) NOT NULL,
    max_quantity integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rate_contract_items rate_contract_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_rate_contract_items_catalog_item_id ON public.rate_contract_items USING btree (catalog_item_id);

CREATE INDEX idx_rate_contract_items_deleted_at_d6aa0591 ON public.rate_contract_items USING btree (deleted_at);

CREATE INDEX idx_rate_contract_items_tenant_id ON public.rate_contract_items USING btree (tenant_id);

CREATE INDEX idx_rc_items_contract ON public.rate_contract_items USING btree (contract_id);

ALTER TABLE public.rate_contract_items ENABLE ROW LEVEL SECURITY;

-- Name: rate_contract_items rc_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rc_items_tenant ON public.rate_contract_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: rate_contract_items trg_rate_contract_items_soft_delete_d6aa0591; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rate_contract_items_soft_delete_d6aa0591 BEFORE DELETE ON public.rate_contract_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rate_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_number text NOT NULL,
    vendor_id uuid NOT NULL,
    status public.rate_contract_status DEFAULT 'draft'::public.rate_contract_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    payment_terms text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rate_contracts rate_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_pkey PRIMARY KEY (id);

-- Name: rate_contracts rate_contracts_tenant_id_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_tenant_id_contract_number_key UNIQUE (tenant_id, contract_number);

CREATE INDEX idx_rate_contracts_deleted_at_8e9d00f4 ON public.rate_contracts USING btree (deleted_at);

CREATE INDEX idx_rc_active ON public.rate_contracts USING btree (tenant_id, status, end_date);

CREATE INDEX idx_rc_tenant ON public.rate_contracts USING btree (tenant_id);

CREATE INDEX idx_rc_vendor ON public.rate_contracts USING btree (tenant_id, vendor_id);

ALTER TABLE public.rate_contracts ENABLE ROW LEVEL SECURITY;

-- Name: rate_contracts rate_contracts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rate_contracts_tenant ON public.rate_contracts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: rate_contracts set_rate_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rate_contracts_updated_at BEFORE UPDATE ON public.rate_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: rate_contracts trg_rate_contracts_soft_delete_8e9d00f4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rate_contracts_soft_delete_8e9d00f4 BEFORE DELETE ON public.rate_contracts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: reorder_alerts reorder_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_pkey PRIMARY KEY (id);

CREATE INDEX idx_reorder_alerts_deleted_at_6f9b59ec ON public.reorder_alerts USING btree (deleted_at);

CREATE INDEX idx_reorder_alerts_item ON public.reorder_alerts USING btree (catalog_item_id);

CREATE INDEX idx_reorder_alerts_tenant ON public.reorder_alerts USING btree (tenant_id);

CREATE INDEX idx_reorder_alerts_unack ON public.reorder_alerts USING btree (is_acknowledged) WHERE (is_acknowledged = false);

ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;

-- Name: reorder_alerts tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reorder_alerts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: reorder_alerts trg_reorder_alerts_soft_delete_6f9b59ec; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reorder_alerts_soft_delete_6f9b59ec BEFORE DELETE ON public.reorder_alerts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: reorder_alerts trg_reorder_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reorder_alerts_updated_at BEFORE UPDATE ON public.reorder_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stock_disposal_items stock_disposal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_items
    ADD CONSTRAINT stock_disposal_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_disposal_items_disposal ON public.stock_disposal_items USING btree (disposal_id);

CREATE INDEX idx_stock_disposal_items_deleted_at_7a6346d7 ON public.stock_disposal_items USING btree (deleted_at);

-- Name: stock_disposal_items trg_stock_disposal_items_soft_delete_7a6346d7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_disposal_items_soft_delete_7a6346d7 BEFORE DELETE ON public.stock_disposal_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stock_disposal_requests stock_disposal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_pkey PRIMARY KEY (id);

-- Name: stock_disposal_requests stock_disposal_requests_tenant_id_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_requests
    ADD CONSTRAINT stock_disposal_requests_tenant_id_request_number_key UNIQUE (tenant_id, request_number);

CREATE INDEX idx_stock_disposal_requests_deleted_at_2b2a7b86 ON public.stock_disposal_requests USING btree (deleted_at);

ALTER TABLE ONLY public.stock_disposal_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stock_disposal_requests ENABLE ROW LEVEL SECURITY;

-- Name: stock_disposal_requests tenant_isolation_stock_disposal_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stock_disposal_requests ON public.stock_disposal_requests USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: stock_disposal_requests trg_stock_disposal_requests_soft_delete_2b2a7b86; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_disposal_requests_soft_delete_2b2a7b86 BEFORE DELETE ON public.stock_disposal_requests FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_department_id uuid,
    dispatched_by_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);

-- Name: stock_transfers stock_transfers_status_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.stock_transfers
    ADD CONSTRAINT stock_transfers_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'dispatched'::text, 'in_transit'::text, 'received'::text, 'cancelled'::text]))) NOT VALID;

CREATE INDEX idx_stock_transfers_deleted_at_d79956ea ON public.stock_transfers USING btree (deleted_at);

CREATE INDEX idx_stock_transfers_from ON public.stock_transfers USING btree (tenant_id, from_store_id, transfer_date DESC);

ALTER TABLE ONLY public.stock_transfers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Name: stock_transfers tenant_isolation_stock_transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stock_transfers ON public.stock_transfers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: stock_transfers trg_stock_transfers_soft_delete_d79956ea; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_transfers_soft_delete_d79956ea BEFORE DELETE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    max_stock integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    domain text DEFAULT 'consumable'::text NOT NULL,
    CONSTRAINT chk_store_catalog_domain CHECK ((domain = ANY (ARRAY['consumable'::text, 'stationery'::text])))
);

-- Name: store_catalog store_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_catalog
    ADD CONSTRAINT store_catalog_pkey PRIMARY KEY (id);

-- Name: store_catalog store_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_catalog
    ADD CONSTRAINT store_catalog_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_store_catalog_active ON public.store_catalog USING btree (tenant_id, is_active) WHERE is_active;

CREATE INDEX idx_store_catalog_category ON public.store_catalog USING btree (tenant_id, category);

CREATE INDEX idx_store_catalog_deleted_at_48680f39 ON public.store_catalog USING btree (deleted_at);

CREATE INDEX idx_store_catalog_domain ON public.store_catalog USING btree (tenant_id, domain);

CREATE INDEX idx_store_catalog_tenant ON public.store_catalog USING btree (tenant_id);

ALTER TABLE public.store_catalog ENABLE ROW LEVEL SECURITY;

-- Name: store_catalog store_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_catalog_tenant ON public.store_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: store_catalog trg_store_catalog_soft_delete_48680f39; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_catalog_soft_delete_48680f39 BEFORE DELETE ON public.store_catalog FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: store_locations store_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_pkey PRIMARY KEY (id);

-- Name: store_locations store_locations_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_locations
    ADD CONSTRAINT store_locations_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_store_locations_deleted_at_3982731d ON public.store_locations USING btree (deleted_at);

CREATE INDEX idx_store_locations_department_id ON public.store_locations USING btree (department_id);

CREATE INDEX idx_store_locations_tenant ON public.store_locations USING btree (tenant_id);

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

-- Name: store_locations store_locations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_locations_tenant ON public.store_locations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: store_locations set_store_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_store_locations_updated_at BEFORE UPDATE ON public.store_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: store_locations trg_store_locations_soft_delete_3982731d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_locations_soft_delete_3982731d BEFORE DELETE ON public.store_locations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

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
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT store_stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'return'::text, 'adjustment'::text, 'transfer'::text])))
);

-- Name: store_stock_movements store_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_pkey PRIMARY KEY (id);

CREATE INDEX idx_stock_movements_date ON public.store_stock_movements USING btree (created_at);

CREATE INDEX idx_stock_movements_department ON public.store_stock_movements USING btree (department_id) WHERE (department_id IS NOT NULL);

CREATE INDEX idx_stock_movements_item ON public.store_stock_movements USING btree (catalog_item_id);

CREATE INDEX idx_stock_movements_location ON public.store_stock_movements USING btree (store_location_id) WHERE (store_location_id IS NOT NULL);

CREATE INDEX idx_stock_movements_patient ON public.store_stock_movements USING btree (patient_id) WHERE (patient_id IS NOT NULL);

CREATE INDEX idx_stock_movements_ref ON public.store_stock_movements USING btree (reference_type, reference_id) WHERE (reference_id IS NOT NULL);

CREATE INDEX idx_stock_movements_tenant ON public.store_stock_movements USING btree (tenant_id);

CREATE INDEX idx_store_stock_movements_deleted_at_386707ae ON public.store_stock_movements USING btree (deleted_at);

ALTER TABLE public.store_stock_movements ENABLE ROW LEVEL SECURITY;

-- Name: store_stock_movements store_stock_movements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_stock_movements_tenant ON public.store_stock_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: store_stock_movements trg_store_stock_movements_soft_delete_386707ae; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_stock_movements_soft_delete_386707ae BEFORE DELETE ON public.store_stock_movements FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    ndps_license_number text,
    ndps_license_valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);

CREATE INDEX idx_stores_deleted_at_61af09f3 ON public.stores USING btree (deleted_at);

CREATE INDEX idx_stores_tenant_id ON public.stores USING btree (tenant_id);

ALTER TABLE ONLY public.stores FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Name: stores tenant_isolation_stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_stores ON public.stores USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: stores trg_stores_soft_delete_61af09f3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stores_soft_delete_61af09f3 BEFORE DELETE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.supplier_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    po_id uuid,
    grn_id uuid,
    payment_number text NOT NULL,
    invoice_amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    balance_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.supplier_payment_status DEFAULT 'pending'::public.supplier_payment_status NOT NULL,
    payment_date date,
    due_date date,
    payment_method text,
    reference_number text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: supplier_payments supplier_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);

CREATE INDEX idx_supplier_payments_deleted_at_a7cf0e35 ON public.supplier_payments USING btree (deleted_at);

CREATE INDEX idx_supplier_payments_status ON public.supplier_payments USING btree (status);

CREATE INDEX idx_supplier_payments_tenant ON public.supplier_payments USING btree (tenant_id);

CREATE INDEX idx_supplier_payments_vendor ON public.supplier_payments USING btree (vendor_id);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- Name: supplier_payments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.supplier_payments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: supplier_payments trg_supplier_payments_soft_delete_a7cf0e35; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_payments_soft_delete_a7cf0e35 BEFORE DELETE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: supplier_payments trg_supplier_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_payments_updated_at BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    display_name text,
    vendor_type text DEFAULT 'supplier'::text NOT NULL,
    status public.vendor_status DEFAULT 'active'::public.vendor_status NOT NULL,
    contact_person text,
    phone text,
    email text,
    website text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    pincode text,
    country text DEFAULT 'India'::text,
    gst_number text,
    pan_number text,
    drug_license_number text,
    fssai_license text,
    bank_name text,
    bank_account text,
    bank_ifsc text,
    payment_terms text DEFAULT 'net_30'::text,
    credit_limit numeric(14,2) DEFAULT 0,
    credit_days integer DEFAULT 30,
    rating numeric(3,2) DEFAULT 0,
    categories jsonb DEFAULT '[]'::jsonb,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    supply_categories text[] DEFAULT '{}'::text[],
    product_lines text,
    fssai_number text,
    is_pharmacy_vendor boolean DEFAULT false,
    pan text,
    address text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);

-- Name: vendors vendors_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_vendors_deleted_at_2bc28e22 ON public.vendors USING btree (deleted_at);

CREATE INDEX idx_vendors_status ON public.vendors USING btree (tenant_id, status);

CREATE INDEX idx_vendors_tenant ON public.vendors USING btree (tenant_id);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Name: vendors vendors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendors_tenant ON public.vendors USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: vendors set_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: vendors trg_vendors_soft_delete_2bc28e22; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vendors_soft_delete_2bc28e22 BEFORE DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0231_ward_par_stock.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Ward / floor PAR (imprest) stock. Wards hold a par level of drugs; the pharmacy tops them
-- up to par (replenish), nurses consume against ward stock. ward_par_levels = the target per
-- ward × drug; ward_stock = current on-hand per ward × drug. Replenish decrements the
-- pharmacy_catalog aggregate; consume decrements ward_stock. Tenant RLS.

CREATE TABLE public.ward_par_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    par_qty integer DEFAULT 0 NOT NULL,
    min_qty integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ward_par_levels ward_par_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_par_levels
    ADD CONSTRAINT ward_par_levels_pkey PRIMARY KEY (id);

-- Name: ward_par_levels ward_par_levels_tenant_id_department_id_catalog_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_par_levels
    ADD CONSTRAINT ward_par_levels_tenant_id_department_id_catalog_item_id_key UNIQUE (tenant_id, department_id, catalog_item_id);

CREATE INDEX idx_ward_par_dept ON public.ward_par_levels USING btree (tenant_id, department_id);

ALTER TABLE public.ward_par_levels ENABLE ROW LEVEL SECURITY;

-- Name: ward_par_levels ward_par_levels_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ward_par_levels_tenant_isolation ON public.ward_par_levels USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: ward_par_levels ward_par_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ward_par_levels_updated_at BEFORE UPDATE ON public.ward_par_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.ward_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: ward_stock ward_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_stock
    ADD CONSTRAINT ward_stock_pkey PRIMARY KEY (id);

-- Name: ward_stock ward_stock_tenant_id_department_id_catalog_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_stock
    ADD CONSTRAINT ward_stock_tenant_id_department_id_catalog_item_id_key UNIQUE (tenant_id, department_id, catalog_item_id);

CREATE INDEX idx_ward_stock_dept ON public.ward_stock USING btree (tenant_id, department_id);

ALTER TABLE public.ward_stock ENABLE ROW LEVEL SECURITY;

-- Name: ward_stock ward_stock_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ward_stock_tenant_isolation ON public.ward_stock USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: ward_stock ward_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ward_stock_updated_at BEFORE UPDATE ON public.ward_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: batch_stock batch_stock_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: batch_stock batch_stock_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);

-- Name: batch_stock batch_stock_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);

-- Name: batch_stock batch_stock_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock
    ADD CONSTRAINT batch_stock_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

-- Name: equipment_condemnations equipment_condemnations_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_condemnations
    ADD CONSTRAINT equipment_condemnations_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: purchase_orders fk_po_rate_contract; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_rate_contract FOREIGN KEY (rate_contract_id) REFERENCES public.rate_contracts(id);

-- Name: goods_receipt_notes goods_receipt_notes_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);

-- Name: goods_receipt_notes goods_receipt_notes_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);

-- Name: goods_receipt_notes goods_receipt_notes_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

-- Name: goods_receipts goods_receipts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);

-- Name: grn_items grn_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: grn_items grn_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE;

-- Name: grn_items grn_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id);

-- Name: implant_registry implant_registry_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);

-- Name: implant_registry implant_registry_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.implant_registry
    ADD CONSTRAINT implant_registry_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: indent_items indent_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: indent_items indent_items_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indent_items
    ADD CONSTRAINT indent_items_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.indent_requisitions(id) ON DELETE CASCADE;

-- Name: indents indents_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indents
    ADD CONSTRAINT indents_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);

-- Name: patient_consumable_issues patient_consumable_issues_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);

-- Name: patient_consumable_issues patient_consumable_issues_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_consumable_issues
    ADD CONSTRAINT patient_consumable_issues_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: purchase_order_items purchase_order_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: purchase_order_items purchase_order_items_indent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_indent_item_id_fkey FOREIGN KEY (indent_item_id) REFERENCES public.indent_items(id);

-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

-- Name: purchase_orders purchase_orders_indent_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_indent_requisition_id_fkey FOREIGN KEY (indent_requisition_id) REFERENCES public.indent_requisitions(id);

-- Name: purchase_orders purchase_orders_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);

-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

-- Name: rate_contract_items rate_contract_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: rate_contract_items rate_contract_items_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.rate_contracts(id) ON DELETE CASCADE;

-- Name: rate_contracts rate_contracts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);

-- Name: reorder_alerts reorder_alerts_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reorder_alerts
    ADD CONSTRAINT reorder_alerts_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: stock_disposal_items stock_disposal_items_disposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_disposal_items
    ADD CONSTRAINT stock_disposal_items_disposal_id_fkey FOREIGN KEY (disposal_id) REFERENCES public.stock_disposal_requests(id) ON DELETE CASCADE;

-- Name: stock_transfers stock_transfers_from_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_store_id_fkey FOREIGN KEY (from_store_id) REFERENCES public.stores(id);

-- Name: stock_transfers stock_transfers_to_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_store_id_fkey FOREIGN KEY (to_store_id) REFERENCES public.stores(id);

-- Name: store_stock_movements store_stock_movements_batch_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_batch_stock_id_fkey FOREIGN KEY (batch_stock_id) REFERENCES public.batch_stock(id);

-- Name: store_stock_movements store_stock_movements_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.store_catalog(id);

-- Name: store_stock_movements store_stock_movements_store_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_stock_movements
    ADD CONSTRAINT store_stock_movements_store_location_id_fkey FOREIGN KEY (store_location_id) REFERENCES public.store_locations(id);

-- Name: supplier_payments supplier_payments_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);

-- Name: supplier_payments supplier_payments_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);

-- Name: supplier_payments supplier_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
