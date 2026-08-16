-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 39
-- Drops: none
-- billing — schema.
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



CREATE TABLE public.advance_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    advance_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount_adjusted numeric(12,2) NOT NULL,
    adjusted_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: advance_adjustments advance_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_adjustments
    ADD CONSTRAINT advance_adjustments_pkey PRIMARY KEY (id);

CREATE INDEX idx_advance_adjustments_advance ON public.advance_adjustments USING btree (tenant_id, advance_id);

CREATE INDEX idx_advance_adjustments_deleted_at_ab2994a4 ON public.advance_adjustments USING btree (deleted_at);

CREATE INDEX idx_advance_adjustments_invoice ON public.advance_adjustments USING btree (tenant_id, invoice_id);

CREATE INDEX idx_advance_adjustments_invoice_id ON public.advance_adjustments USING btree (invoice_id);

ALTER TABLE public.advance_adjustments ENABLE ROW LEVEL SECURITY;

-- Name: advance_adjustments tenant_isolation_advance_adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_advance_adjustments ON public.advance_adjustments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: advance_adjustments trg_advance_adjustments_soft_delete_ab2994a4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_advance_adjustments_soft_delete_ab2994a4 BEFORE DELETE ON public.advance_adjustments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.bad_debt_write_offs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    write_off_number text NOT NULL,
    amount numeric(14,2) NOT NULL,
    reason text NOT NULL,
    status public.write_off_status DEFAULT 'pending'::public.write_off_status NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bad_debt_write_offs bad_debt_write_offs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_pkey PRIMARY KEY (id);

-- Name: bad_debt_write_offs bad_debt_write_offs_tenant_id_write_off_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_tenant_id_write_off_number_key UNIQUE (tenant_id, write_off_number);

CREATE INDEX idx_bad_debt_write_offs_deleted_at_a8010436 ON public.bad_debt_write_offs USING btree (deleted_at);

CREATE INDEX idx_bad_debt_write_offs_invoice ON public.bad_debt_write_offs USING btree (tenant_id, invoice_id);

CREATE INDEX idx_bad_debt_write_offs_invoice_id ON public.bad_debt_write_offs USING btree (invoice_id);

CREATE INDEX idx_bad_debt_write_offs_tenant ON public.bad_debt_write_offs USING btree (tenant_id);

ALTER TABLE public.bad_debt_write_offs ENABLE ROW LEVEL SECURITY;

-- Name: bad_debt_write_offs bad_debt_write_offs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bad_debt_write_offs_tenant ON public.bad_debt_write_offs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: bad_debt_write_offs trg_bad_debt_write_offs_soft_delete_a8010436; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bad_debt_write_offs_soft_delete_a8010436 BEFORE DELETE ON public.bad_debt_write_offs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bad_debt_write_offs trg_bad_debt_write_offs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bad_debt_write_offs_updated_at BEFORE UPDATE ON public.bad_debt_write_offs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    transaction_date date NOT NULL,
    value_date date,
    description text,
    debit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    running_balance numeric(14,2),
    reference_number text,
    recon_status public.recon_status DEFAULT 'unmatched'::public.recon_status NOT NULL,
    matched_payment_id uuid,
    matched_refund_id uuid,
    import_batch text,
    matched_by uuid,
    matched_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    matched_claim_id uuid,
    variance_amount numeric(12,2),
    auto_match_score real,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);

CREATE INDEX idx_bank_transactions_claim ON public.bank_transactions USING btree (matched_claim_id) WHERE (matched_claim_id IS NOT NULL);

CREATE INDEX idx_bank_transactions_date ON public.bank_transactions USING btree (tenant_id, transaction_date);

CREATE INDEX idx_bank_transactions_deleted_at_09693ee7 ON public.bank_transactions USING btree (deleted_at);

CREATE INDEX idx_bank_transactions_recon ON public.bank_transactions USING btree (tenant_id, recon_status);

CREATE INDEX idx_bank_transactions_tenant ON public.bank_transactions USING btree (tenant_id);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Name: bank_transactions bank_transactions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bank_transactions_tenant ON public.bank_transactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: bank_transactions trg_bank_transactions_soft_delete_09693ee7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bank_transactions_soft_delete_09693ee7 BEFORE DELETE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: bank_transactions trg_bank_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bank_transactions_updated_at BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.billing_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    action public.audit_action NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    invoice_id uuid,
    patient_id uuid,
    amount numeric(14,2),
    previous_state jsonb,
    new_state jsonb,
    performed_by uuid NOT NULL,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: billing_audit_log billing_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_log
    ADD CONSTRAINT billing_audit_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_billing_audit_log_date ON public.billing_audit_log USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_billing_audit_log_deleted_at_99413ae4 ON public.billing_audit_log USING btree (deleted_at);

CREATE INDEX idx_billing_audit_log_invoice ON public.billing_audit_log USING btree (tenant_id, invoice_id);

CREATE INDEX idx_billing_audit_log_invoice_id ON public.billing_audit_log USING btree (invoice_id);

CREATE INDEX idx_billing_audit_log_patient_id ON public.billing_audit_log USING btree (patient_id);

CREATE INDEX idx_billing_audit_log_tenant ON public.billing_audit_log USING btree (tenant_id);

ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

-- Name: billing_audit_log billing_audit_log_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_audit_log_tenant ON public.billing_audit_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: billing_audit_log trg_billing_audit_log_soft_delete_99413ae4; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_audit_log_soft_delete_99413ae4 BEFORE DELETE ON public.billing_audit_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: billing_audit_log trg_billing_audit_log_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_audit_log_updated_at BEFORE UPDATE ON public.billing_audit_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.billing_concessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid,
    invoice_item_id uuid,
    patient_id uuid NOT NULL,
    concession_type text NOT NULL,
    original_amount numeric(12,2) NOT NULL,
    concession_percent numeric(5,2),
    concession_amount numeric(12,2) NOT NULL,
    final_amount numeric(12,2) NOT NULL,
    reason text,
    status public.concession_status DEFAULT 'pending'::public.concession_status NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    auto_rule text,
    source_module text,
    source_entity_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: billing_concessions billing_concessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_pkey PRIMARY KEY (id);

CREATE INDEX idx_billing_concessions_deleted_at_bd662694 ON public.billing_concessions USING btree (deleted_at);

CREATE INDEX idx_billing_concessions_invoice ON public.billing_concessions USING btree (tenant_id, invoice_id);

CREATE INDEX idx_billing_concessions_invoice_id ON public.billing_concessions USING btree (invoice_id);

CREATE INDEX idx_billing_concessions_patient ON public.billing_concessions USING btree (tenant_id, patient_id);

CREATE INDEX idx_billing_concessions_patient_id ON public.billing_concessions USING btree (patient_id);

CREATE INDEX idx_billing_concessions_status ON public.billing_concessions USING btree (tenant_id, status);

CREATE INDEX idx_billing_concessions_tenant ON public.billing_concessions USING btree (tenant_id);

ALTER TABLE public.billing_concessions ENABLE ROW LEVEL SECURITY;

-- Name: billing_concessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.billing_concessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: billing_concessions trg_billing_concessions_soft_delete_bd662694; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_concessions_soft_delete_bd662694 BEFORE DELETE ON public.billing_concessions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.billing_package_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    charge_code text NOT NULL,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: billing_package_items billing_package_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_package_items
    ADD CONSTRAINT billing_package_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_billing_package_items_deleted_at_497eb396 ON public.billing_package_items USING btree (deleted_at);

CREATE INDEX idx_billing_package_items_package ON public.billing_package_items USING btree (package_id);

CREATE INDEX idx_billing_package_items_tenant_id ON public.billing_package_items USING btree (tenant_id);

ALTER TABLE public.billing_package_items ENABLE ROW LEVEL SECURITY;

-- Name: billing_package_items billing_package_items_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_package_items_tenant_isolation ON public.billing_package_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: billing_package_items trg_billing_package_items_soft_delete_497eb396; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_package_items_soft_delete_497eb396 BEFORE DELETE ON public.billing_package_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.billing_packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    total_price numeric(12,2) NOT NULL,
    discount_percent numeric(4,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: billing_packages billing_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_packages
    ADD CONSTRAINT billing_packages_pkey PRIMARY KEY (id);

-- Name: billing_packages billing_packages_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_packages
    ADD CONSTRAINT billing_packages_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_billing_packages_deleted_at_2d9adfba ON public.billing_packages USING btree (deleted_at);

CREATE INDEX idx_billing_packages_tenant ON public.billing_packages USING btree (tenant_id);

ALTER TABLE public.billing_packages ENABLE ROW LEVEL SECURITY;

-- Name: billing_packages billing_packages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_packages_tenant_isolation ON public.billing_packages USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: billing_packages set_updated_at_billing_packages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_billing_packages BEFORE UPDATE ON public.billing_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: billing_packages trg_billing_packages_soft_delete_2d9adfba; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_packages_soft_delete_2d9adfba BEFORE DELETE ON public.billing_packages FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.charge_master (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    base_price numeric(10,2) NOT NULL,
    tax_percent numeric(4,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hsn_sac_code text,
    gst_category text DEFAULT 'healthcare'::text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: charge_master charge_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master
    ADD CONSTRAINT charge_master_pkey PRIMARY KEY (id);

-- Name: charge_master charge_master_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master
    ADD CONSTRAINT charge_master_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_charge_master_deleted_at_659e6a7b ON public.charge_master USING btree (deleted_at);

CREATE INDEX idx_charge_master_tenant ON public.charge_master USING btree (tenant_id);

ALTER TABLE public.charge_master ENABLE ROW LEVEL SECURITY;

-- Name: charge_master tenant_isolation_charge_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_charge_master ON public.charge_master USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: charge_master trg_charge_master_soft_delete_659e6a7b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_charge_master_soft_delete_659e6a7b BEFORE DELETE ON public.charge_master FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: charge_master trg_charge_master_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_charge_master_updated_at BEFORE UPDATE ON public.charge_master FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.corporate_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    gst_number text,
    billing_address text,
    contact_email text,
    contact_phone text,
    credit_limit numeric(14,2) DEFAULT 0,
    credit_days integer DEFAULT 30,
    agreed_discount_percent numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: corporate_clients corporate_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_clients
    ADD CONSTRAINT corporate_clients_pkey PRIMARY KEY (id);

-- Name: corporate_clients corporate_clients_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_clients
    ADD CONSTRAINT corporate_clients_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_corporate_clients_deleted_at_fc70b3e9 ON public.corporate_clients USING btree (deleted_at);

ALTER TABLE public.corporate_clients ENABLE ROW LEVEL SECURITY;

-- Name: corporate_clients tenant_isolation_corporate_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_corporate_clients ON public.corporate_clients USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: corporate_clients set_updated_at_corporate_clients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_corporate_clients BEFORE UPDATE ON public.corporate_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: corporate_clients trg_corporate_clients_soft_delete_fc70b3e9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_corporate_clients_soft_delete_fc70b3e9 BEFORE DELETE ON public.corporate_clients FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.corporate_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    corporate_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    employee_id text,
    department text,
    is_active boolean DEFAULT true,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: corporate_enrollments corporate_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_enrollments
    ADD CONSTRAINT corporate_enrollments_pkey PRIMARY KEY (id);

-- Name: corporate_enrollments corporate_enrollments_tenant_id_corporate_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_enrollments
    ADD CONSTRAINT corporate_enrollments_tenant_id_corporate_id_patient_id_key UNIQUE (tenant_id, corporate_id, patient_id);

CREATE INDEX idx_corporate_enrollments_corporate ON public.corporate_enrollments USING btree (tenant_id, corporate_id);

CREATE INDEX idx_corporate_enrollments_deleted_at_00354edf ON public.corporate_enrollments USING btree (deleted_at);

CREATE INDEX idx_corporate_enrollments_patient ON public.corporate_enrollments USING btree (tenant_id, patient_id);

CREATE INDEX idx_corporate_enrollments_patient_id ON public.corporate_enrollments USING btree (patient_id);

ALTER TABLE public.corporate_enrollments ENABLE ROW LEVEL SECURITY;

-- Name: corporate_enrollments tenant_isolation_corporate_enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_corporate_enrollments ON public.corporate_enrollments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: corporate_enrollments trg_corporate_enrollments_soft_delete_00354edf; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_corporate_enrollments_soft_delete_00354edf BEFORE DELETE ON public.corporate_enrollments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.credit_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    credit_note_number text NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    used_against_invoice_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);

-- Name: credit_notes credit_notes_status_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.credit_notes
    ADD CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'used'::text, 'cancelled'::text]))) NOT VALID;

-- Name: credit_notes credit_notes_tenant_id_credit_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_tenant_id_credit_note_number_key UNIQUE (tenant_id, credit_note_number);

CREATE INDEX idx_credit_notes_deleted_at_dbe263ee ON public.credit_notes USING btree (deleted_at);

CREATE INDEX idx_credit_notes_invoice ON public.credit_notes USING btree (invoice_id);

CREATE INDEX idx_credit_notes_tenant ON public.credit_notes USING btree (tenant_id);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- Name: credit_notes credit_notes_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_notes_tenant_isolation ON public.credit_notes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: credit_notes set_updated_at_credit_notes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_credit_notes BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: credit_notes trg_credit_notes_soft_delete_dbe263ee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_credit_notes_soft_delete_dbe263ee BEFORE DELETE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.credit_patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    credit_limit numeric(12,2) DEFAULT 0 NOT NULL,
    current_balance numeric(12,2) DEFAULT 0 NOT NULL,
    status public.credit_patient_status DEFAULT 'active'::public.credit_patient_status NOT NULL,
    approved_by uuid,
    overdue_since timestamp with time zone,
    reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: credit_patients credit_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_patients
    ADD CONSTRAINT credit_patients_pkey PRIMARY KEY (id);

-- Name: credit_patients credit_patients_tenant_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_patients
    ADD CONSTRAINT credit_patients_tenant_id_patient_id_key UNIQUE (tenant_id, patient_id);

CREATE INDEX idx_credit_patients_deleted_at_3aa69602 ON public.credit_patients USING btree (deleted_at);

CREATE INDEX idx_credit_patients_patient_id ON public.credit_patients USING btree (patient_id);

CREATE INDEX idx_credit_patients_status ON public.credit_patients USING btree (tenant_id, status);

CREATE INDEX idx_credit_patients_tenant ON public.credit_patients USING btree (tenant_id);

ALTER TABLE public.credit_patients ENABLE ROW LEVEL SECURITY;

-- Name: credit_patients credit_patients_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_patients_tenant ON public.credit_patients USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: credit_patients trg_credit_patients_soft_delete_3aa69602; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_credit_patients_soft_delete_3aa69602 BEFORE DELETE ON public.credit_patients FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: credit_patients trg_credit_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_credit_patients_updated_at BEFORE UPDATE ON public.credit_patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.day_end_closes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    close_date date NOT NULL,
    cashier_id uuid NOT NULL,
    expected_cash numeric(14,2) DEFAULT 0 NOT NULL,
    actual_cash numeric(14,2) DEFAULT 0 NOT NULL,
    cash_difference numeric(14,2) DEFAULT 0 NOT NULL,
    total_card numeric(14,2) DEFAULT 0 NOT NULL,
    total_upi numeric(14,2) DEFAULT 0 NOT NULL,
    total_cheque numeric(14,2) DEFAULT 0 NOT NULL,
    total_bank_transfer numeric(14,2) DEFAULT 0 NOT NULL,
    total_insurance numeric(14,2) DEFAULT 0 NOT NULL,
    total_collected numeric(14,2) DEFAULT 0 NOT NULL,
    invoices_count integer DEFAULT 0 NOT NULL,
    payments_count integer DEFAULT 0 NOT NULL,
    refunds_total numeric(14,2) DEFAULT 0 NOT NULL,
    advances_total numeric(14,2) DEFAULT 0 NOT NULL,
    status public.day_close_status DEFAULT 'open'::public.day_close_status NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    counter_id text,
    shift text,
    denominations jsonb,
    actual_card numeric(14,2) DEFAULT 0 NOT NULL,
    actual_upi numeric(14,2) DEFAULT 0 NOT NULL,
    card_difference numeric(14,2) DEFAULT 0 NOT NULL,
    upi_difference numeric(14,2) DEFAULT 0 NOT NULL,
    verification_notes text
);

-- Name: day_end_closes day_end_closes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_end_closes
    ADD CONSTRAINT day_end_closes_pkey PRIMARY KEY (id);

-- Name: day_end_closes day_end_closes_tenant_id_close_date_cashier_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_end_closes
    ADD CONSTRAINT day_end_closes_tenant_id_close_date_cashier_id_key UNIQUE (tenant_id, close_date, cashier_id);

CREATE INDEX idx_day_end_closes_date ON public.day_end_closes USING btree (tenant_id, close_date);

CREATE INDEX idx_day_end_closes_deleted_at_415091e1 ON public.day_end_closes USING btree (deleted_at);

CREATE INDEX idx_day_end_closes_tenant ON public.day_end_closes USING btree (tenant_id);

ALTER TABLE public.day_end_closes ENABLE ROW LEVEL SECURITY;

-- Name: day_end_closes day_end_closes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_end_closes_tenant ON public.day_end_closes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: day_end_closes trg_day_end_closes_soft_delete_415091e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_day_end_closes_soft_delete_415091e1 BEFORE DELETE ON public.day_end_closes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: day_end_closes trg_day_end_closes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_day_end_closes_updated_at BEFORE UPDATE ON public.day_end_closes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.erp_export_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    target_system text NOT NULL,
    export_type text NOT NULL,
    record_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    date_from date,
    date_to date,
    status public.erp_export_status DEFAULT 'pending'::public.erp_export_status NOT NULL,
    payload jsonb,
    response jsonb,
    error_message text,
    exported_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: erp_export_log erp_export_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_export_log
    ADD CONSTRAINT erp_export_log_pkey PRIMARY KEY (id);

CREATE INDEX idx_erp_export_log_deleted_at_ebbb33fb ON public.erp_export_log USING btree (deleted_at);

CREATE INDEX idx_erp_export_log_tenant ON public.erp_export_log USING btree (tenant_id);

ALTER TABLE public.erp_export_log ENABLE ROW LEVEL SECURITY;

-- Name: erp_export_log erp_export_log_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY erp_export_log_tenant ON public.erp_export_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: erp_export_log trg_erp_export_log_soft_delete_ebbb33fb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_erp_export_log_soft_delete_ebbb33fb BEFORE DELETE ON public.erp_export_log FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    from_currency public.currency_code NOT NULL,
    to_currency public.currency_code DEFAULT 'INR'::public.currency_code NOT NULL,
    rate numeric(12,6) NOT NULL,
    effective_date date NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);

-- Name: exchange_rates exchange_rates_tenant_id_from_currency_to_currency_effectiv_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_tenant_id_from_currency_to_currency_effectiv_key UNIQUE (tenant_id, from_currency, to_currency, effective_date);

CREATE INDEX idx_exchange_rates_deleted_at_e43580d5 ON public.exchange_rates USING btree (deleted_at);

CREATE INDEX idx_exchange_rates_lookup ON public.exchange_rates USING btree (tenant_id, from_currency, to_currency, effective_date DESC);

CREATE INDEX idx_exchange_rates_tenant ON public.exchange_rates USING btree (tenant_id);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Name: exchange_rates exchange_rates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exchange_rates_tenant ON public.exchange_rates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: exchange_rates trg_exchange_rates_soft_delete_e43580d5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exchange_rates_soft_delete_e43580d5 BEFORE DELETE ON public.exchange_rates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.gl_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    account_type text NOT NULL,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT gl_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['asset'::text, 'liability'::text, 'equity'::text, 'revenue'::text, 'expense'::text])))
);

-- Name: gl_accounts gl_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_pkey PRIMARY KEY (id);

-- Name: gl_accounts gl_accounts_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_gl_accounts_deleted_at_dc421175 ON public.gl_accounts USING btree (deleted_at);

CREATE INDEX idx_gl_accounts_tenant ON public.gl_accounts USING btree (tenant_id);

CREATE INDEX idx_gl_accounts_type ON public.gl_accounts USING btree (tenant_id, account_type);

ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;

-- Name: gl_accounts gl_accounts_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gl_accounts_tenant ON public.gl_accounts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: gl_accounts trg_gl_accounts_soft_delete_dc421175; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gl_accounts_soft_delete_dc421175 BEFORE DELETE ON public.gl_accounts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: gl_accounts trg_gl_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gl_accounts_updated_at BEFORE UPDATE ON public.gl_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.gst_return_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    return_type text NOT NULL,
    period text NOT NULL,
    filing_status public.gstr_filing_status DEFAULT 'draft'::public.gstr_filing_status NOT NULL,
    total_taxable numeric(14,2) DEFAULT 0 NOT NULL,
    total_cgst numeric(14,2) DEFAULT 0 NOT NULL,
    total_sgst numeric(14,2) DEFAULT 0 NOT NULL,
    total_igst numeric(14,2) DEFAULT 0 NOT NULL,
    total_cess numeric(14,2) DEFAULT 0 NOT NULL,
    total_tax numeric(14,2) DEFAULT 0 NOT NULL,
    hsn_summary jsonb DEFAULT '[]'::jsonb,
    invoice_count integer DEFAULT 0 NOT NULL,
    arn text,
    filed_by uuid,
    filed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT gst_return_summaries_return_type_check CHECK ((return_type = ANY (ARRAY['GSTR-1'::text, 'GSTR-2B'::text, 'GSTR-3B'::text])))
);

-- Name: gst_return_summaries gst_return_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_return_summaries
    ADD CONSTRAINT gst_return_summaries_pkey PRIMARY KEY (id);

-- Name: gst_return_summaries gst_return_summaries_tenant_id_return_type_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_return_summaries
    ADD CONSTRAINT gst_return_summaries_tenant_id_return_type_period_key UNIQUE (tenant_id, return_type, period);

CREATE INDEX idx_gst_return_summaries_deleted_at_50674f8b ON public.gst_return_summaries USING btree (deleted_at);

CREATE INDEX idx_gst_return_summaries_tenant ON public.gst_return_summaries USING btree (tenant_id);

ALTER TABLE public.gst_return_summaries ENABLE ROW LEVEL SECURITY;

-- Name: gst_return_summaries gst_return_summaries_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gst_return_summaries_tenant ON public.gst_return_summaries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: gst_return_summaries trg_gst_return_summaries_soft_delete_50674f8b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gst_return_summaries_soft_delete_50674f8b BEFORE DELETE ON public.gst_return_summaries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: gst_return_summaries trg_gst_return_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gst_return_summaries_updated_at BEFORE UPDATE ON public.gst_return_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.hospital_price_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    group_tariff_id uuid NOT NULL,
    override_price numeric(14,2) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    reason text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: hospital_price_overrides hospital_price_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_price_overrides
    ADD CONSTRAINT hospital_price_overrides_pkey PRIMARY KEY (id);

-- Name: hospital_price_overrides hospital_price_overrides_tenant_id_group_tariff_id_effectiv_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_price_overrides
    ADD CONSTRAINT hospital_price_overrides_tenant_id_group_tariff_id_effectiv_key UNIQUE (tenant_id, group_tariff_id, effective_from);

CREATE INDEX idx_hospital_price_overrides_deleted_at_a73a0ef0 ON public.hospital_price_overrides USING btree (deleted_at);

ALTER TABLE public.hospital_price_overrides ENABLE ROW LEVEL SECURITY;

-- Name: hospital_price_overrides hospital_price_overrides_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospital_price_overrides_tenant ON public.hospital_price_overrides USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: hospital_price_overrides trg_hospital_price_overrides_soft_delete_a73a0ef0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_hospital_price_overrides_soft_delete_a73a0ef0 BEFORE DELETE ON public.hospital_price_overrides FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.invoice_discounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    reason text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: invoice_discounts invoice_discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_discounts
    ADD CONSTRAINT invoice_discounts_pkey PRIMARY KEY (id);

CREATE INDEX idx_invoice_discounts_deleted_at_14f23812 ON public.invoice_discounts USING btree (deleted_at);

CREATE INDEX idx_invoice_discounts_invoice ON public.invoice_discounts USING btree (invoice_id);

CREATE INDEX idx_invoice_discounts_tenant_id ON public.invoice_discounts USING btree (tenant_id);

ALTER TABLE public.invoice_discounts ENABLE ROW LEVEL SECURITY;

-- Name: invoice_discounts invoice_discounts_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_discounts_tenant_isolation ON public.invoice_discounts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: invoice_discounts trg_invoice_discounts_soft_delete_14f23812; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoice_discounts_soft_delete_14f23812 BEFORE DELETE ON public.invoice_discounts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    charge_code text NOT NULL,
    description text NOT NULL,
    source public.charge_source DEFAULT 'manual'::public.charge_source NOT NULL,
    source_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    tax_percent numeric(4,2) DEFAULT 0 NOT NULL,
    total_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0,
    gst_type public.gst_type DEFAULT 'exempt'::public.gst_type,
    cgst_amount numeric(10,2) DEFAULT 0,
    sgst_amount numeric(10,2) DEFAULT 0,
    igst_amount numeric(10,2) DEFAULT 0,
    hsn_sac_code text,
    ordering_doctor_id uuid,
    department_id uuid,
    pharmacy_order_id uuid,
    pharmacy_batch_id uuid,
    source_module text DEFAULT 'manual'::text,
    batch_number text,
    expiry_date date,
    reversal_of_id uuid,
    is_reversal boolean DEFAULT false NOT NULL,
    reversed_at timestamp with time zone,
    reversed_by uuid,
    reversal_reason text,
    reversal_source_module text,
    reversal_source_id uuid,
    service_code text,
    category text,
    discount_amount numeric DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_invoice_items_batch ON public.invoice_items USING btree (batch_number) WHERE (batch_number IS NOT NULL);

CREATE INDEX idx_invoice_items_deleted_at_58297c02 ON public.invoice_items USING btree (deleted_at);

CREATE INDEX idx_invoice_items_department_id ON public.invoice_items USING btree (department_id);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id);

CREATE UNIQUE INDEX idx_invoice_items_reversal_action_key ON public.invoice_items USING btree (tenant_id, reversal_source_module, reversal_source_id) WHERE ((reversal_source_module IS NOT NULL) AND (reversal_source_id IS NOT NULL));

CREATE INDEX idx_invoice_items_reversal_of ON public.invoice_items USING btree (tenant_id, reversal_of_id) WHERE (reversal_of_id IS NOT NULL);

CREATE UNIQUE INDEX idx_invoice_items_source_idempotency ON public.invoice_items USING btree (invoice_id, source, source_id) WHERE ((source_id IS NOT NULL) AND (reversal_of_id IS NULL));

CREATE INDEX idx_invoice_items_source_reversal ON public.invoice_items USING btree (tenant_id, source, source_id, is_reversal) WHERE (source_id IS NOT NULL);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Name: invoice_items tenant_isolation_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_invoice_items ON public.invoice_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: invoice_items trg_invoice_items_soft_delete_58297c02; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoice_items_soft_delete_58297c02 BEFORE DELETE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_number text NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    issued_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    cgst_amount numeric(12,2) DEFAULT 0,
    sgst_amount numeric(12,2) DEFAULT 0,
    igst_amount numeric(12,2) DEFAULT 0,
    cess_amount numeric(12,2) DEFAULT 0,
    is_interim boolean DEFAULT false,
    billing_period_start timestamp with time zone,
    billing_period_end timestamp with time zone,
    sequence_number integer,
    corporate_id uuid,
    place_of_supply text,
    is_er_deferred boolean DEFAULT false NOT NULL,
    cloned_from_id uuid,
    currency public.currency_code DEFAULT 'INR'::public.currency_code NOT NULL,
    exchange_rate numeric(10,4) DEFAULT 1.0 NOT NULL,
    base_total_amount numeric(12,2),
    admission_id uuid,
    doctor_id uuid,
    department_id uuid,
    invoice_date timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    written_off_amount numeric(12,2) DEFAULT 0 NOT NULL
);

-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

-- Name: invoices invoices_tenant_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tenant_id_invoice_number_key UNIQUE (tenant_id, invoice_number);

CREATE INDEX idx_invoices_corporate ON public.invoices USING btree (tenant_id, corporate_id) WHERE (corporate_id IS NOT NULL);

CREATE INDEX idx_invoices_created_by ON public.invoices USING btree (created_by);

CREATE INDEX idx_invoices_deleted_at_56deca22 ON public.invoices USING btree (deleted_at);

CREATE INDEX idx_invoices_encounter_id ON public.invoices USING btree (encounter_id);

CREATE INDEX idx_invoices_interim ON public.invoices USING btree (tenant_id, encounter_id, is_interim) WHERE (is_interim = true);

CREATE INDEX idx_invoices_patient ON public.invoices USING btree (patient_id);

CREATE INDEX idx_invoices_status ON public.invoices USING btree (tenant_id, status);

CREATE INDEX idx_invoices_tenant ON public.invoices USING btree (tenant_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Name: invoices tenant_isolation_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_invoices ON public.invoices USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: invoices audit_invoices; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_invoices AFTER INSERT OR DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

-- Name: invoices trg_invoices_soft_delete_56deca22; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoices_soft_delete_56deca22 BEFORE DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: invoices trg_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entry_number text NOT NULL,
    entry_date date NOT NULL,
    entry_type public.journal_entry_type DEFAULT 'manual'::public.journal_entry_type NOT NULL,
    status public.journal_entry_status DEFAULT 'draft'::public.journal_entry_status NOT NULL,
    total_debit numeric(14,2) DEFAULT 0 NOT NULL,
    total_credit numeric(14,2) DEFAULT 0 NOT NULL,
    description text,
    reference_type text,
    reference_id uuid,
    posted_by uuid,
    posted_at timestamp with time zone,
    reversal_of_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);

-- Name: journal_entries journal_entries_tenant_id_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_tenant_id_entry_number_key UNIQUE (tenant_id, entry_number);

CREATE INDEX idx_journal_entries_date ON public.journal_entries USING btree (tenant_id, entry_date);

CREATE INDEX idx_journal_entries_deleted_at_068e47ea ON public.journal_entries USING btree (deleted_at);

CREATE INDEX idx_journal_entries_status ON public.journal_entries USING btree (tenant_id, status);

CREATE INDEX idx_journal_entries_tenant ON public.journal_entries USING btree (tenant_id);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Name: journal_entries journal_entries_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_entries_tenant ON public.journal_entries USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: journal_entries trg_journal_entries_soft_delete_068e47ea; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_journal_entries_soft_delete_068e47ea BEFORE DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: journal_entries trg_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    department_id uuid,
    debit_amount numeric(14,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(14,2) DEFAULT 0 NOT NULL,
    narration text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);

CREATE INDEX idx_journal_entry_lines_account ON public.journal_entry_lines USING btree (account_id);

CREATE INDEX idx_journal_entry_lines_deleted_at_bab6c205 ON public.journal_entry_lines USING btree (deleted_at);

CREATE INDEX idx_journal_entry_lines_department_id ON public.journal_entry_lines USING btree (department_id);

CREATE INDEX idx_journal_entry_lines_entry ON public.journal_entry_lines USING btree (journal_entry_id);

CREATE INDEX idx_journal_entry_lines_tenant_id ON public.journal_entry_lines USING btree (tenant_id);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Name: journal_entry_lines journal_entry_lines_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_entry_lines_tenant ON public.journal_entry_lines USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: journal_entry_lines trg_journal_entry_lines_soft_delete_bab6c205; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_journal_entry_lines_soft_delete_bab6c205 BEFORE DELETE ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.patient_advances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    advance_number text NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance numeric(12,2) NOT NULL,
    payment_mode public.payment_mode DEFAULT 'cash'::public.payment_mode NOT NULL,
    reference_number text,
    purpose public.advance_purpose DEFAULT 'general'::public.advance_purpose NOT NULL,
    status public.advance_status DEFAULT 'active'::public.advance_status NOT NULL,
    received_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: patient_advances patient_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_advances
    ADD CONSTRAINT patient_advances_pkey PRIMARY KEY (id);

-- Name: patient_advances patient_advances_tenant_id_advance_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_advances
    ADD CONSTRAINT patient_advances_tenant_id_advance_number_key UNIQUE (tenant_id, advance_number);

CREATE INDEX idx_patient_advances_deleted_at_368a2deb ON public.patient_advances USING btree (deleted_at);

CREATE INDEX idx_patient_advances_patient ON public.patient_advances USING btree (tenant_id, patient_id);

CREATE INDEX idx_patient_advances_patient_id ON public.patient_advances USING btree (patient_id);

CREATE INDEX idx_patient_advances_status ON public.patient_advances USING btree (tenant_id, status);

ALTER TABLE public.patient_advances ENABLE ROW LEVEL SECURITY;

-- Name: patient_advances tenant_isolation_patient_advances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_advances ON public.patient_advances USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: patient_advances set_updated_at_patient_advances; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_patient_advances BEFORE UPDATE ON public.patient_advances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: patient_advances trg_patient_advances_soft_delete_368a2deb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_advances_soft_delete_368a2deb BEFORE DELETE ON public.patient_advances FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.patient_package_consumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    inclusion_type text NOT NULL,
    consumed_visit_id uuid,
    consumed_service_id uuid,
    consumed_test_id uuid,
    consumed_procedure_id uuid,
    consumed_quantity integer DEFAULT 1 NOT NULL,
    consumed_by_user_id uuid,
    consumed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_package_consumptions_consumed_quantity_check CHECK ((consumed_quantity > 0))
);

-- Name: patient_package_consumptions patient_package_consumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_consumptions
    ADD CONSTRAINT patient_package_consumptions_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_package_consumptions_deleted_at_f8c28dc5 ON public.patient_package_consumptions USING btree (deleted_at);

CREATE INDEX patient_package_consumptions_sub_idx ON public.patient_package_consumptions USING btree (tenant_id, subscription_id, consumed_at DESC);

ALTER TABLE ONLY public.patient_package_consumptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.patient_package_consumptions ENABLE ROW LEVEL SECURITY;

-- Name: patient_package_consumptions tenant_isolation_patient_package_consumptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_package_consumptions ON public.patient_package_consumptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_package_consumptions trg_patient_package_consumptions_soft_delete_f8c28dc5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_package_consumptions_soft_delete_f8c28dc5 BEFORE DELETE ON public.patient_package_consumptions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.patient_package_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    purchased_via_invoice_id uuid,
    valid_until timestamp with time zone NOT NULL,
    total_paid numeric(12,2) NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT patient_package_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'exhausted'::text, 'expired'::text, 'refunded'::text, 'suspended'::text])))
);

-- Name: patient_package_subscriptions patient_package_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_subscriptions
    ADD CONSTRAINT patient_package_subscriptions_pkey PRIMARY KEY (id);

CREATE INDEX idx_patient_package_subscriptions_deleted_at_22a3bf5c ON public.patient_package_subscriptions USING btree (deleted_at);

CREATE INDEX patient_package_subscriptions_expiry_idx ON public.patient_package_subscriptions USING btree (tenant_id, valid_until) WHERE (status = 'active'::text);

CREATE INDEX patient_package_subscriptions_patient_idx ON public.patient_package_subscriptions USING btree (tenant_id, patient_id, status);

ALTER TABLE ONLY public.patient_package_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.patient_package_subscriptions ENABLE ROW LEVEL SECURITY;

-- Name: patient_package_subscriptions tenant_isolation_patient_package_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_patient_package_subscriptions ON public.patient_package_subscriptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: patient_package_subscriptions patient_package_subscriptions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER patient_package_subscriptions_updated BEFORE UPDATE ON public.patient_package_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: patient_package_subscriptions trg_patient_package_subscriptions_soft_delete_22a3bf5c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_patient_package_subscriptions_soft_delete_22a3bf5c BEFORE DELETE ON public.patient_package_subscriptions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.payment_gateway_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid,
    pharmacy_pos_sale_id uuid,
    gateway text DEFAULT 'razorpay'::text NOT NULL,
    gateway_order_id text NOT NULL,
    gateway_payment_id text,
    gateway_signature text,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    payment_method text,
    upi_vpa text,
    card_last4 text,
    card_network text,
    bank_name text,
    wallet text,
    error_code text,
    error_description text,
    refund_id text,
    refund_amount numeric(12,2),
    notes jsonb DEFAULT '{}'::jsonb NOT NULL,
    webhook_payload jsonb,
    verified_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idempotency_key text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT payment_gateway_transactions_status_check CHECK ((status = ANY (ARRAY['pending_gateway'::text, 'created'::text, 'authorized'::text, 'captured'::text, 'failed'::text, 'refunded'::text, 'expired'::text])))
);

-- Name: payment_gateway_transactions payment_gateway_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_pkey PRIMARY KEY (id);

CREATE INDEX idx_payment_gateway_transactions_deleted_at_40bf71ce ON public.payment_gateway_transactions USING btree (deleted_at);

CREATE INDEX idx_pgt_gateway_order ON public.payment_gateway_transactions USING btree (gateway_order_id);

CREATE INDEX idx_pgt_invoice ON public.payment_gateway_transactions USING btree (invoice_id);

CREATE INDEX idx_pgt_pos_sale ON public.payment_gateway_transactions USING btree (pharmacy_pos_sale_id) WHERE (pharmacy_pos_sale_id IS NOT NULL);

CREATE INDEX idx_pgt_status ON public.payment_gateway_transactions USING btree (tenant_id, status);

CREATE UNIQUE INDEX pgt_idempotency_key_unique ON public.payment_gateway_transactions USING btree (tenant_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

ALTER TABLE public.payment_gateway_transactions ENABLE ROW LEVEL SECURITY;

-- Name: payment_gateway_transactions pgt_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pgt_tenant ON public.payment_gateway_transactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: payment_gateway_transactions trg_payment_gateway_transactions_soft_delete_40bf71ce; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_gateway_transactions_soft_delete_40bf71ce BEFORE DELETE ON public.payment_gateway_transactions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: payment_gateway_transactions trg_pgt_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pgt_updated_at BEFORE UPDATE ON public.payment_gateway_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.payment_methods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);

-- Name: payment_methods payment_methods_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_payment_methods_deleted_at_cda66af5 ON public.payment_methods USING btree (deleted_at);

CREATE INDEX idx_payment_methods_tenant ON public.payment_methods USING btree (tenant_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Name: payment_methods payment_methods_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_tenant_isolation ON public.payment_methods USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: payment_methods trg_payment_methods_soft_delete_cda66af5; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_methods_soft_delete_cda66af5 BEFORE DELETE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: payment_methods trg_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0164_payment_terminals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: payment_terminals
-- Per-billing-place registry of payment devices. A hospital runs several
-- providers + POS/QR/soundbox devices at once, each bolted to a physical
-- billing place (counter / room / location). Pay-time provider selection =
-- the active terminals mapped to the cashier's counter, not one global switch.
-- See RFCs/RFC-MODULE-payment-providers.md §2.1.
-- ============================================================

CREATE TABLE public.payment_terminals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    provider text NOT NULL,
    kind text DEFAULT 'pos'::text NOT NULL,
    terminal_code text,
    counter_id text,
    location_id uuid,
    label text NOT NULL,
    mode text DEFAULT 'sandbox'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    acquiring_bank text
);

-- Name: payment_terminals payment_terminals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_terminals
    ADD CONSTRAINT payment_terminals_pkey PRIMARY KEY (id);

-- Name: payment_terminals payment_terminals_tenant_provider_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_terminals
    ADD CONSTRAINT payment_terminals_tenant_provider_code_key UNIQUE (tenant_id, provider, terminal_code);

CREATE INDEX idx_payment_terminals_counter ON public.payment_terminals USING btree (tenant_id, counter_id, is_active);

CREATE INDEX idx_payment_terminals_provider ON public.payment_terminals USING btree (tenant_id, provider, is_active);

ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

-- Name: payment_terminals tenant_isolation_payment_terminals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_payment_terminals ON public.payment_terminals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: payment_terminals payment_terminals_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_terminals_set_updated_at BEFORE UPDATE ON public.payment_terminals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0166_payment_webhook_exceptions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- tenant_id is nullable: provider webhooks arrive unauthenticated and the row
-- is written before the order is matched, so RLS is deliberately not applied.
-- Reported by check-rls as uncovered; resolving it needs a writer refactor.
-- ============================================================
-- MedBrains schema — payment_webhook_exceptions
-- Reverse-reconciliation safety net: when an inbound gateway webhook (the
-- money already moved) cannot be matched back to a txn — unknown order ref,
-- amount mismatch, or signature failure — it lands here for a human instead
-- of being silently dropped. Revenue is never lost to a missed match.
-- See RFCs/RFC-MODULE-payment-providers.md §6.
-- Cross-tenant ops table (like processed_webhooks): an unmatched credit often
-- has no resolvable tenant, so no RLS — access is gated at the route by a
-- high billing permission.
-- ============================================================

CREATE TABLE public.payment_webhook_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    provider text NOT NULL,
    order_ref text,
    reason text NOT NULL,
    amount numeric(12,2),
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: payment_webhook_exceptions payment_webhook_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_exceptions
    ADD CONSTRAINT payment_webhook_exceptions_pkey PRIMARY KEY (id);

CREATE INDEX idx_payment_webhook_exceptions_open ON public.payment_webhook_exceptions USING btree (status, created_at DESC);

CREATE INDEX idx_payment_webhook_exceptions_order ON public.payment_webhook_exceptions USING btree (provider, order_ref);

ALTER TABLE public.payment_webhook_exceptions ENABLE ROW LEVEL SECURITY;

-- Name: payment_webhook_exceptions payment_webhook_exceptions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_webhook_exceptions_tenant_isolation ON public.payment_webhook_exceptions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    mode public.payment_mode NOT NULL,
    reference_number text,
    received_by uuid,
    notes text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admission_id uuid,
    payment_type text DEFAULT 'bill'::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    counter_id text,
    shift text
);

-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

CREATE INDEX idx_payments_counter_paid_at ON public.payments USING btree (tenant_id, counter_id, paid_at);

CREATE INDEX idx_payments_deleted_at_84d5eaf7 ON public.payments USING btree (deleted_at);

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);

CREATE INDEX idx_payments_tenant ON public.payments USING btree (tenant_id);

CREATE INDEX idx_payments_tenant_status ON public.payments USING btree (tenant_id, status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Name: payments tenant_isolation_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_payments ON public.payments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: payments audit_payments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_payments AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('billing');

-- Name: payments trg_payments_soft_delete_84d5eaf7; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payments_soft_delete_84d5eaf7 BEFORE DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: payments trg_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.rate_plan_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    rate_plan_id uuid NOT NULL,
    charge_code text NOT NULL,
    override_price numeric(10,2) NOT NULL,
    override_tax_percent numeric(4,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rate_plan_items rate_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_items
    ADD CONSTRAINT rate_plan_items_pkey PRIMARY KEY (id);

-- Name: rate_plan_items rate_plan_items_rate_plan_id_charge_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_items
    ADD CONSTRAINT rate_plan_items_rate_plan_id_charge_code_key UNIQUE (rate_plan_id, charge_code);

CREATE INDEX idx_rate_plan_items_deleted_at_3a56135f ON public.rate_plan_items USING btree (deleted_at);

CREATE INDEX idx_rate_plan_items_rate_plan ON public.rate_plan_items USING btree (rate_plan_id);

CREATE INDEX idx_rate_plan_items_tenant_id ON public.rate_plan_items USING btree (tenant_id);

ALTER TABLE public.rate_plan_items ENABLE ROW LEVEL SECURITY;

-- Name: rate_plan_items rate_plan_items_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rate_plan_items_tenant_isolation ON public.rate_plan_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: rate_plan_items trg_rate_plan_items_soft_delete_3a56135f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rate_plan_items_soft_delete_3a56135f BEFORE DELETE ON public.rate_plan_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.rate_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    patient_category text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: rate_plans rate_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plans
    ADD CONSTRAINT rate_plans_pkey PRIMARY KEY (id);

-- Name: rate_plans rate_plans_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plans
    ADD CONSTRAINT rate_plans_tenant_id_name_key UNIQUE (tenant_id, name);

CREATE INDEX idx_rate_plans_deleted_at_3aa36d5f ON public.rate_plans USING btree (deleted_at);

CREATE INDEX idx_rate_plans_tenant ON public.rate_plans USING btree (tenant_id);

ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;

-- Name: rate_plans rate_plans_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rate_plans_tenant_isolation ON public.rate_plans USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: rate_plans set_updated_at_rate_plans; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_rate_plans BEFORE UPDATE ON public.rate_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: rate_plans trg_rate_plans_soft_delete_3aa36d5f; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_rate_plans_soft_delete_3aa36d5f BEFORE DELETE ON public.rate_plans FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.receipts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    receipt_number text NOT NULL,
    invoice_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    receipt_date timestamp with time zone DEFAULT now() NOT NULL,
    printed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);

-- Name: receipts receipts_tenant_id_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_tenant_id_receipt_number_key UNIQUE (tenant_id, receipt_number);

CREATE INDEX idx_receipts_deleted_at_dd56421b ON public.receipts USING btree (deleted_at);

CREATE INDEX idx_receipts_invoice ON public.receipts USING btree (invoice_id);

CREATE INDEX idx_receipts_payment ON public.receipts USING btree (payment_id);

CREATE INDEX idx_receipts_tenant ON public.receipts USING btree (tenant_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Name: receipts receipts_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_tenant_isolation ON public.receipts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: receipts trg_receipts_soft_delete_dd56421b; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receipts_soft_delete_dd56421b BEFORE DELETE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.refunds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    payment_id uuid,
    refund_number text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    mode public.payment_mode NOT NULL,
    reference_number text,
    refunded_by uuid,
    refunded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_id uuid,
    receipt_number text,
    refund_date timestamp with time zone,
    original_payment_id uuid,
    approved_by uuid,
    processed_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);

-- Name: refunds refunds_tenant_id_refund_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_tenant_id_refund_number_key UNIQUE (tenant_id, refund_number);

CREATE INDEX idx_refunds_deleted_at_0084ff71 ON public.refunds USING btree (deleted_at);

CREATE INDEX idx_refunds_invoice ON public.refunds USING btree (invoice_id);

CREATE INDEX idx_refunds_payment_id ON public.refunds USING btree (payment_id);

CREATE INDEX idx_refunds_tenant ON public.refunds USING btree (tenant_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Name: refunds refunds_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refunds_tenant_isolation ON public.refunds USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: refunds trg_refunds_soft_delete_0084ff71; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refunds_soft_delete_0084ff71 BEFORE DELETE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tax_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    rate_percent numeric(5,2) DEFAULT 0 NOT NULL,
    applicability public.tax_applicability DEFAULT 'taxable'::public.tax_applicability NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tax_categories tax_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_categories
    ADD CONSTRAINT tax_categories_pkey PRIMARY KEY (id);

-- Name: tax_categories tax_categories_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_categories
    ADD CONSTRAINT tax_categories_tenant_id_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_tax_categories_deleted_at_3db4bdfc ON public.tax_categories USING btree (deleted_at);

CREATE INDEX idx_tax_categories_tenant ON public.tax_categories USING btree (tenant_id);

ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;

-- Name: tax_categories tax_categories_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_categories_tenant_isolation ON public.tax_categories USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: tax_categories trg_tax_categories_soft_delete_3db4bdfc; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tax_categories_soft_delete_3db4bdfc BEFORE DELETE ON public.tax_categories FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tax_categories trg_tax_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tax_categories_updated_at BEFORE UPDATE ON public.tax_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.tds_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    employee_id uuid,
    vendor_id uuid,
    financial_year text NOT NULL,
    quarter text,
    certificate_number text,
    section text,
    gross_amount numeric(14,2),
    tds_amount numeric(14,2),
    deposited_at timestamp with time zone,
    issued_at timestamp with time zone,
    pdf_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    section_code text,
    nature_of_payment text,
    total_payment numeric,
    total_tds_deducted numeric,
    total_tds_deposited numeric,
    challan_number text,
    challan_date date,
    bsr_code text,
    verified_by_id uuid,
    verification_date date,
    place text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tds_certificates tds_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_certificates
    ADD CONSTRAINT tds_certificates_pkey PRIMARY KEY (id);

CREATE INDEX idx_tds_certificates_deleted_at_9a03dc50 ON public.tds_certificates USING btree (deleted_at);

CREATE INDEX idx_tds_certificates_tenant_id ON public.tds_certificates USING btree (tenant_id);

ALTER TABLE ONLY public.tds_certificates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tds_certificates ENABLE ROW LEVEL SECURITY;

-- Name: tds_certificates tenant_isolation_tds_certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tds_certificates ON public.tds_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tds_certificates trg_tds_certificates_soft_delete_9a03dc50; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tds_certificates_soft_delete_9a03dc50 BEFORE DELETE ON public.tds_certificates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.tds_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    invoice_id uuid,
    deductee_name text NOT NULL,
    deductee_pan text NOT NULL,
    tds_section text NOT NULL,
    tds_rate numeric(5,2) NOT NULL,
    base_amount numeric(12,2) NOT NULL,
    tds_amount numeric(12,2) NOT NULL,
    status public.tds_status DEFAULT 'deducted'::public.tds_status NOT NULL,
    deducted_date date NOT NULL,
    challan_number text,
    challan_date date,
    certificate_number text,
    certificate_date date,
    financial_year text NOT NULL,
    quarter text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT tds_deductions_quarter_check CHECK ((quarter = ANY (ARRAY['Q1'::text, 'Q2'::text, 'Q3'::text, 'Q4'::text])))
);

-- Name: tds_deductions tds_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_deductions
    ADD CONSTRAINT tds_deductions_pkey PRIMARY KEY (id);

CREATE INDEX idx_tds_deductions_deleted_at_9439e2fb ON public.tds_deductions USING btree (deleted_at);

CREATE INDEX idx_tds_deductions_fy ON public.tds_deductions USING btree (tenant_id, financial_year, quarter);

CREATE INDEX idx_tds_deductions_invoice_id ON public.tds_deductions USING btree (invoice_id);

CREATE INDEX idx_tds_deductions_tenant ON public.tds_deductions USING btree (tenant_id);

ALTER TABLE public.tds_deductions ENABLE ROW LEVEL SECURITY;

-- Name: tds_deductions tds_deductions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tds_deductions_tenant ON public.tds_deductions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tds_deductions trg_tds_deductions_soft_delete_9439e2fb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tds_deductions_soft_delete_9439e2fb BEFORE DELETE ON public.tds_deductions FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tds_deductions trg_tds_deductions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tds_deductions_updated_at BEFORE UPDATE ON public.tds_deductions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.tpa_rate_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tpa_name text NOT NULL,
    insurance_provider text NOT NULL,
    rate_plan_id uuid NOT NULL,
    scheme_type public.insurance_scheme_type DEFAULT 'private'::public.insurance_scheme_type NOT NULL,
    valid_from date,
    valid_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tpa_rate_cards tpa_rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpa_rate_cards
    ADD CONSTRAINT tpa_rate_cards_pkey PRIMARY KEY (id);

-- Name: tpa_rate_cards tpa_rate_cards_tenant_id_tpa_name_insurance_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpa_rate_cards
    ADD CONSTRAINT tpa_rate_cards_tenant_id_tpa_name_insurance_provider_key UNIQUE (tenant_id, tpa_name, insurance_provider);

CREATE INDEX idx_tpa_rate_cards_deleted_at_e483a10e ON public.tpa_rate_cards USING btree (deleted_at);

CREATE INDEX idx_tpa_rate_cards_tenant ON public.tpa_rate_cards USING btree (tenant_id);

ALTER TABLE public.tpa_rate_cards ENABLE ROW LEVEL SECURITY;

-- Name: tpa_rate_cards tpa_rate_cards_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tpa_rate_cards_tenant ON public.tpa_rate_cards USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tpa_rate_cards trg_tpa_rate_cards_soft_delete_e483a10e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tpa_rate_cards_soft_delete_e483a10e BEFORE DELETE ON public.tpa_rate_cards FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tpa_rate_cards trg_tpa_rate_cards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tpa_rate_cards_updated_at BEFORE UPDATE ON public.tpa_rate_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: advance_adjustments advance_adjustments_advance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_adjustments
    ADD CONSTRAINT advance_adjustments_advance_id_fkey FOREIGN KEY (advance_id) REFERENCES public.patient_advances(id);

-- Name: advance_adjustments advance_adjustments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_adjustments
    ADD CONSTRAINT advance_adjustments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: bad_debt_write_offs bad_debt_write_offs_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bad_debt_write_offs
    ADD CONSTRAINT bad_debt_write_offs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: bank_transactions bank_transactions_matched_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_payment_id_fkey FOREIGN KEY (matched_payment_id) REFERENCES public.payments(id);

-- Name: bank_transactions bank_transactions_matched_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_refund_id_fkey FOREIGN KEY (matched_refund_id) REFERENCES public.refunds(id);

-- Name: billing_audit_log billing_audit_log_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_audit_log
    ADD CONSTRAINT billing_audit_log_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: billing_concessions billing_concessions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_concessions
    ADD CONSTRAINT billing_concessions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: billing_package_items billing_package_items_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_package_items
    ADD CONSTRAINT billing_package_items_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.billing_packages(id) ON DELETE CASCADE;

-- Name: corporate_enrollments corporate_enrollments_corporate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corporate_enrollments
    ADD CONSTRAINT corporate_enrollments_corporate_id_fkey FOREIGN KEY (corporate_id) REFERENCES public.corporate_clients(id) ON DELETE CASCADE;

-- Name: credit_notes credit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: credit_notes credit_notes_used_against_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_used_against_invoice_id_fkey FOREIGN KEY (used_against_invoice_id) REFERENCES public.invoices(id);

-- Name: invoices fk_invoices_corporate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_corporate FOREIGN KEY (corporate_id) REFERENCES public.corporate_clients(id);

-- Name: gl_accounts gl_accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gl_accounts
    ADD CONSTRAINT gl_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.gl_accounts(id);

-- Name: invoice_discounts invoice_discounts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_discounts
    ADD CONSTRAINT invoice_discounts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: invoice_items invoice_items_reversal_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES public.invoice_items(id);

-- Name: invoices invoices_cloned_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_cloned_from_id_fkey FOREIGN KEY (cloned_from_id) REFERENCES public.invoices(id);

-- Name: journal_entries journal_entries_reversal_of_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES public.journal_entries(id);

-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.gl_accounts(id);

-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;

-- Name: patient_package_consumptions patient_package_consumptions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_package_consumptions
    ADD CONSTRAINT patient_package_consumptions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.patient_package_subscriptions(id) ON DELETE CASCADE;

-- Name: payment_gateway_transactions payment_gateway_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_transactions
    ADD CONSTRAINT payment_gateway_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: rate_plan_items rate_plan_items_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_items
    ADD CONSTRAINT rate_plan_items_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plans(id) ON DELETE CASCADE;

-- Name: receipts receipts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: receipts receipts_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);

-- Name: refunds refunds_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);

-- Name: tds_deductions tds_deductions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_deductions
    ADD CONSTRAINT tds_deductions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);

-- Name: tpa_rate_cards tpa_rate_cards_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tpa_rate_cards
    ADD CONSTRAINT tpa_rate_cards_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plans(id);
