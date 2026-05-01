-- ============================================================
-- MedBrains schema — module: procurement
-- ============================================================

--
-- Name: goods_receipt_notes; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.goods_receipts FORCE ROW LEVEL SECURITY;



--
-- Name: grn_items; Type: TABLE; Schema: public; Owner: -
--

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
    pharmacy_batch_id uuid
);



--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

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
    pharmacy_catalog_id uuid
);



--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

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
    emergency_reason text
);



--
-- Name: rate_contract_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_contract_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    contracted_price numeric(14,2) NOT NULL,
    max_quantity integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: rate_contracts; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: supplier_payments; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

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
    is_pharmacy_vendor boolean DEFAULT false
);



--
-- Name: goods_receipt_notes goods_receipt_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_pkey PRIMARY KEY (id);



--
-- Name: goods_receipt_notes goods_receipt_notes_tenant_id_grn_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_tenant_id_grn_number_key UNIQUE (tenant_id, grn_number);



--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);



--
-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_pkey PRIMARY KEY (id);



--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);



--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);



--
-- Name: purchase_orders purchase_orders_tenant_id_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_tenant_id_po_number_key UNIQUE (tenant_id, po_number);



--
-- Name: rate_contract_items rate_contract_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_pkey PRIMARY KEY (id);



--
-- Name: rate_contracts rate_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_pkey PRIMARY KEY (id);



--
-- Name: rate_contracts rate_contracts_tenant_id_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_tenant_id_contract_number_key UNIQUE (tenant_id, contract_number);



--
-- Name: supplier_payments supplier_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);



--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);



--
-- Name: vendors vendors_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: idx_grn_items_grn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_items_grn ON public.grn_items USING btree (grn_id);



--
-- Name: idx_grn_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_po ON public.goods_receipt_notes USING btree (po_id);



--
-- Name: idx_grn_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_status ON public.goods_receipt_notes USING btree (tenant_id, status);



--
-- Name: idx_grn_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_tenant ON public.goods_receipt_notes USING btree (tenant_id);



--
-- Name: idx_grn_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grn_vendor ON public.goods_receipts USING btree (tenant_id, vendor_id, grn_date DESC);



--
-- Name: idx_po_items_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_items_po ON public.purchase_order_items USING btree (po_id);



--
-- Name: idx_po_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_status ON public.purchase_orders USING btree (tenant_id, status);



--
-- Name: idx_po_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_tenant ON public.purchase_orders USING btree (tenant_id);



--
-- Name: idx_po_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_vendor ON public.purchase_orders USING btree (tenant_id, vendor_id);



--
-- Name: idx_rc_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rc_active ON public.rate_contracts USING btree (tenant_id, status, end_date);



--
-- Name: idx_rc_items_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rc_items_contract ON public.rate_contract_items USING btree (contract_id);



--
-- Name: idx_rc_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rc_tenant ON public.rate_contracts USING btree (tenant_id);



--
-- Name: idx_rc_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rc_vendor ON public.rate_contracts USING btree (tenant_id, vendor_id);



--
-- Name: idx_supplier_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_status ON public.supplier_payments USING btree (status);



--
-- Name: idx_supplier_payments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_tenant ON public.supplier_payments USING btree (tenant_id);



--
-- Name: idx_supplier_payments_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_vendor ON public.supplier_payments USING btree (vendor_id);



--
-- Name: idx_vendors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_status ON public.vendors USING btree (tenant_id, status);



--
-- Name: idx_vendors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_tenant ON public.vendors USING btree (tenant_id);



--
-- Name: goods_receipt_notes set_grn_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_grn_updated_at BEFORE UPDATE ON public.goods_receipt_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: purchase_orders set_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: rate_contracts set_rate_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_rate_contracts_updated_at BEFORE UPDATE ON public.rate_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: vendors set_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: supplier_payments trg_supplier_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_supplier_payments_updated_at BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: purchase_orders fk_po_rate_contract; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_rate_contract FOREIGN KEY (rate_contract_id) REFERENCES public.rate_contracts(id);



--
-- Name: goods_receipt_notes goods_receipt_notes_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);



--
-- Name: goods_receipt_notes goods_receipt_notes_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT goods_receipt_notes_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);



--
-- Name: grn_items grn_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE;



--
-- Name: grn_items grn_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_items
    ADD CONSTRAINT grn_items_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id);



--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;



--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);



--
-- Name: rate_contract_items rate_contract_items_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contract_items
    ADD CONSTRAINT rate_contract_items_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.rate_contracts(id) ON DELETE CASCADE;



--
-- Name: rate_contracts rate_contracts_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_contracts
    ADD CONSTRAINT rate_contracts_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);



--
-- Name: supplier_payments supplier_payments_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);



--
-- Name: supplier_payments supplier_payments_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);



--
-- Name: supplier_payments supplier_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);



--
-- Name: goods_receipt_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;


--
-- Name: goods_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;


--
-- Name: grn_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;


--
-- Name: grn_items grn_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grn_items_tenant ON public.grn_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: goods_receipt_notes grn_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grn_tenant ON public.goods_receipt_notes USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: purchase_order_items po_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY po_items_tenant ON public.purchase_order_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;


--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: purchase_orders purchase_orders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY purchase_orders_tenant ON public.purchase_orders USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: rate_contract_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_contract_items ENABLE ROW LEVEL SECURITY;


--
-- Name: rate_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_contracts ENABLE ROW LEVEL SECURITY;


--
-- Name: rate_contracts rate_contracts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rate_contracts_tenant ON public.rate_contracts USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: rate_contract_items rc_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rc_items_tenant ON public.rate_contract_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: supplier_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;


--
-- Name: supplier_payments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.supplier_payments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: goods_receipts tenant_isolation_goods_receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_goods_receipts ON public.goods_receipts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;


--
-- Name: vendors vendors_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendors_tenant ON public.vendors USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


