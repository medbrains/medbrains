-- ============================================================
-- MedBrains schema — module: pharmacy
-- ============================================================

--
-- Name: adherence_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adherence_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    event_type public.adherence_event_type NOT NULL,
    event_date date DEFAULT CURRENT_DATE NOT NULL,
    drug_name text,
    appointment_id uuid,
    pharmacy_order_id uuid,
    recorded_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    drug_a_name text NOT NULL,
    drug_b_name text NOT NULL,
    severity text NOT NULL,
    description text NOT NULL,
    mechanism text,
    management text,
    source text DEFAULT 'manual'::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT drug_interactions_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'major'::text, 'contraindicated'::text])))
);



--
-- Name: pharmacy_allergy_check_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_allergy_check_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    catalog_item_id uuid,
    drug_name text NOT NULL,
    allergen_matched text,
    allergy_type text,
    severity text,
    action_taken text NOT NULL,
    overridden_by uuid,
    override_reason text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    context text,
    rx_queue_id uuid,
    order_id uuid,
    CONSTRAINT pharmacy_allergy_check_log_action_taken_check CHECK ((action_taken = ANY (ARRAY['blocked'::text, 'overridden'::text, 'no_match'::text]))),
    CONSTRAINT pharmacy_allergy_check_log_context_check CHECK ((context = ANY (ARRAY['order_creation'::text, 'dispensing'::text, 'rx_review'::text, 'pos_sale'::text])))
);



--
-- Name: pharmacy_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    batch_number text NOT NULL,
    expiry_date date NOT NULL,
    manufacture_date date,
    quantity_received integer DEFAULT 0 NOT NULL,
    quantity_dispensed integer DEFAULT 0 NOT NULL,
    quantity_on_hand integer DEFAULT 0 NOT NULL,
    store_location_id uuid,
    supplier_info text,
    grn_item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_order_id uuid,
    grn_id uuid,
    invoice_number text,
    supplier_batch_number text,
    purchase_rate numeric(12,2),
    selling_rate numeric(12,2),
    margin_percent numeric(5,2),
    last_purchase_date date,
    last_purchase_rate numeric(12,2),
    rack_number text,
    shelf_number text,
    bin_number text,
    quarantine_status text DEFAULT 'cleared'::text,
    quality_check_date timestamp with time zone,
    quality_check_by uuid,
    sample_tested boolean DEFAULT false,
    vendor_id uuid,
    CONSTRAINT pharmacy_batches_quarantine_status_check CHECK ((quarantine_status = ANY (ARRAY['quarantine'::text, 'cleared'::text, 'rejected'::text, 'pending'::text])))
);



--
-- Name: pharmacy_cash_drawers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_cash_drawers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pharmacy_location_id uuid NOT NULL,
    cashier_user_id uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_float numeric(12,2) NOT NULL,
    closed_at timestamp with time zone,
    expected_close_amount numeric(12,2),
    actual_close_amount numeric(12,2),
    variance numeric(12,2) GENERATED ALWAYS AS ((actual_close_amount - expected_close_amount)) STORED,
    variance_reason text,
    variance_signed_record_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_cash_drawers_opening_float_check CHECK ((opening_float >= (0)::numeric)),
    CONSTRAINT pharmacy_cash_drawers_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'variance_pending_signoff'::text, 'reopened'::text])))
);

ALTER TABLE ONLY public.pharmacy_cash_drawers FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_cash_float_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_cash_float_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    movement_type text NOT NULL,
    source_drawer_id uuid,
    destination_drawer_id uuid,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    approved_by uuid,
    moved_by uuid NOT NULL,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_cash_float_movements_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT pharmacy_cash_float_movements_check CHECK (((source_drawer_id IS NOT NULL) OR (destination_drawer_id IS NOT NULL))),
    CONSTRAINT pharmacy_cash_float_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['topup_from_main'::text, 'return_to_main'::text, 'transfer_between_counters'::text, 'correction'::text])))
);

ALTER TABLE ONLY public.pharmacy_cash_float_movements FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_cashier_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_cashier_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    cashier_user_id uuid NOT NULL,
    cash_drawer_id uuid,
    pharmacy_order_id uuid,
    override_type text NOT NULL,
    original_value jsonb,
    override_value jsonb,
    reason text NOT NULL,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_cashier_overrides_override_type_check CHECK ((override_type = ANY (ARRAY['manual_price'::text, 'discount_beyond_policy'::text, 'void_after_settle'::text, 'schedule_x_paper_missing'::text, 'allergy_block_override'::text, 'interaction_block_override'::text, 'stock_below_threshold'::text])))
);

ALTER TABLE ONLY public.pharmacy_cashier_overrides FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    generic_name text,
    category text,
    manufacturer text,
    unit text,
    base_price numeric(12,2) DEFAULT 0 NOT NULL,
    tax_percent numeric(5,2) DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drug_schedule text,
    is_controlled boolean DEFAULT false NOT NULL,
    inn_name text,
    atc_code text,
    rxnorm_code text,
    snomed_code text,
    formulary_status text DEFAULT 'approved'::text NOT NULL,
    aware_category text,
    is_lasa boolean DEFAULT false NOT NULL,
    lasa_group text,
    max_dose_per_day text,
    batch_tracking_required boolean DEFAULT false NOT NULL,
    storage_conditions text,
    black_box_warning text,
    mrp numeric(12,2),
    cost_price numeric(12,2),
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    hsn_code text,
    shelf_location text,
    min_stock integer,
    max_stock integer,
    mechanism_of_action text,
    contraindications text,
    indications text,
    side_effects text,
    drug_class text,
    dosage_form text,
    strength text,
    pack_size integer,
    route_of_admin text,
    frequency_default text,
    pregnancy_category text,
    preferred_supplier_id uuid,
    supplier_code text,
    purchase_price numeric(12,2),
    markup_percent numeric(5,2) DEFAULT 0,
    discount_allowed numeric(5,2) DEFAULT 0,
    max_order_qty integer,
    drug_license_required boolean DEFAULT false,
    prescription_only boolean DEFAULT true,
    narcotic_class text,
    poison_schedule text,
    interactions_count integer DEFAULT 0,
    store_catalog_id uuid,
    CONSTRAINT pharmacy_catalog_aware_category_check CHECK ((aware_category = ANY (ARRAY['access'::text, 'watch'::text, 'reserve'::text, NULL::text]))),
    CONSTRAINT pharmacy_catalog_drug_schedule_check CHECK ((drug_schedule = ANY (ARRAY['H'::text, 'H1'::text, 'X'::text, 'G'::text, 'OTC'::text, 'NDPS'::text, NULL::text]))),
    CONSTRAINT pharmacy_catalog_formulary_status_check CHECK ((formulary_status = ANY (ARRAY['approved'::text, 'restricted'::text, 'non_formulary'::text]))),
    CONSTRAINT pharmacy_catalog_pregnancy_category_check CHECK (((pregnancy_category IS NULL) OR (pregnancy_category = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'X'::text]))))
);



--
-- Name: pharmacy_counseling; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_counseling (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pharmacy_order_id uuid NOT NULL,
    food_timing_explained boolean DEFAULT false NOT NULL,
    dose_timing_explained boolean DEFAULT false NOT NULL,
    side_effects_explained boolean DEFAULT false NOT NULL,
    missed_dose_explained boolean DEFAULT false NOT NULL,
    storage_explained boolean DEFAULT false NOT NULL,
    notes text,
    counselled_by uuid NOT NULL,
    counselled_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pharmacy_counseling FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_coverage_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_coverage_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pharmacy_order_id uuid NOT NULL,
    insurance_subscription_id uuid,
    package_subscription_id uuid,
    covered_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cash_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    decision text NOT NULL,
    decided_by uuid,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_coverage_checks_decision_check CHECK ((decision = ANY (ARRAY['covered'::text, 'partial'::text, 'not_covered'::text, 'overridden'::text])))
);

ALTER TABLE ONLY public.pharmacy_coverage_checks FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    credit_note_number text NOT NULL,
    note_type text NOT NULL,
    reference_type text,
    reference_id uuid,
    patient_id uuid,
    vendor_id uuid,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    gst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    net_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    settled_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    adjustment_type text,
    adjusted_invoice_id uuid,
    credit_patient_id uuid,
    original_order_id uuid,
    original_pos_sale_id uuid,
    CONSTRAINT pharmacy_credit_notes_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['reduce_bill'::text, 'add_credit_balance'::text, 'cash_refund'::text, 'pending'::text]))),
    CONSTRAINT pharmacy_credit_notes_note_type_check CHECK ((note_type = ANY (ARRAY['customer_return'::text, 'supplier_return'::text, 'expiry_write_off'::text, 'damage'::text]))),
    CONSTRAINT pharmacy_credit_notes_reference_type_check CHECK ((reference_type = ANY (ARRAY['pharmacy_order'::text, 'pharmacy_return'::text, 'grn'::text, 'batch'::text]))),
    CONSTRAINT pharmacy_credit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'settled'::text, 'cancelled'::text])))
);



--
-- Name: pharmacy_day_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_day_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    settlement_date date NOT NULL,
    counter_id text,
    shift_id text,
    cash_system numeric(12,2) DEFAULT 0,
    cash_counted numeric(12,2) DEFAULT 0,
    cash_difference numeric(12,2) DEFAULT 0,
    card_system numeric(12,2) DEFAULT 0,
    card_settled numeric(12,2) DEFAULT 0,
    upi_system numeric(12,2) DEFAULT 0,
    upi_matched numeric(12,2) DEFAULT 0,
    upi_unmatched numeric(12,2) DEFAULT 0,
    insurance_system numeric(12,2) DEFAULT 0,
    credit_system numeric(12,2) DEFAULT 0,
    total_sales numeric(12,2) DEFAULT 0,
    total_returns numeric(12,2) DEFAULT 0,
    net_collection numeric(12,2) DEFAULT 0,
    transactions_count integer DEFAULT 0,
    returns_count integer DEFAULT 0,
    status text DEFAULT 'open'::text,
    closed_by uuid,
    closed_at timestamp with time zone,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_day_settlements_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'verified'::text])))
);



--
-- Name: pharmacy_destruction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_destruction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    certificate_number text NOT NULL,
    destruction_date date NOT NULL,
    method text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_quantity integer DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    witnessed_by uuid,
    witness_name text NOT NULL,
    authorized_by uuid,
    authorization_date date,
    certificate_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_destruction_log_method_check CHECK ((method = ANY (ARRAY['incineration'::text, 'chemical'::text, 'landfill'::text, 'return_to_manufacturer'::text, 'other'::text]))),
    CONSTRAINT pharmacy_destruction_log_reason_check CHECK ((reason = ANY (ARRAY['expired'::text, 'damaged'::text, 'recalled'::text, 'contaminated'::text, 'other'::text])))
);



--
-- Name: pharmacy_drug_margin_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_drug_margin_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    drug_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    avg_cost numeric(12,4) NOT NULL,
    mrp numeric(12,4) NOT NULL,
    sale_price numeric(12,4) NOT NULL,
    margin_pct numeric(7,2) NOT NULL,
    qty_sold integer DEFAULT 0 NOT NULL,
    revenue numeric(14,2) DEFAULT 0 NOT NULL,
    cost_total numeric(14,2) DEFAULT 0 NOT NULL,
    margin_total numeric(14,2) DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.pharmacy_drug_margin_daily FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_drug_recalls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_drug_recalls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    recall_number text NOT NULL,
    drug_id uuid,
    drug_name text,
    batch_numbers text[] DEFAULT '{}'::text[] NOT NULL,
    reason text NOT NULL,
    severity text,
    manufacturer_ref text,
    fda_ref text,
    status text DEFAULT 'initiated'::text NOT NULL,
    affected_patients_count integer DEFAULT 0,
    recalled_quantity integer DEFAULT 0,
    action_taken text,
    initiated_by uuid,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_drug_recalls_severity_check CHECK ((severity = ANY (ARRAY['class_i'::text, 'class_ii'::text, 'class_iii'::text]))),
    CONSTRAINT pharmacy_drug_recalls_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);



--
-- Name: pharmacy_emergency_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_emergency_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kit_code text NOT NULL,
    kit_type text NOT NULL,
    location_id uuid,
    location_description text,
    department_id uuid,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_checked_at timestamp with time zone,
    last_checked_by uuid,
    next_check_due date,
    check_interval_days integer DEFAULT 7,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_emergency_kits_kit_type_check CHECK ((kit_type = ANY (ARRAY['crash_cart'::text, 'emergency_tray'::text, 'anaphylaxis_kit'::text, 'ot_emergency'::text, 'icu_tray'::text]))),
    CONSTRAINT pharmacy_emergency_kits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'needs_restock'::text, 'expired_items'::text, 'inactive'::text])))
);



--
-- Name: pharmacy_free_dispensings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_free_dispensings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pharmacy_order_id uuid NOT NULL,
    category text NOT NULL,
    scheme_code text,
    approving_user_id uuid NOT NULL,
    cost_value numeric(12,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_free_dispensings_category_check CHECK ((category = ANY (ARRAY['charity'::text, 'hospital_sample'::text, 'government_program'::text, 'staff'::text, 'approved_writeoff'::text]))),
    CONSTRAINT pharmacy_free_dispensings_cost_value_check CHECK ((cost_value >= (0)::numeric))
);

ALTER TABLE ONLY public.pharmacy_free_dispensings FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_ndps_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_ndps_register (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    action public.ndps_register_action NOT NULL,
    quantity integer NOT NULL,
    balance_after integer NOT NULL,
    patient_id uuid,
    prescription_id uuid,
    dispensed_by uuid,
    witnessed_by uuid,
    register_number text,
    page_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    second_witness_id uuid,
    second_witness_at timestamp with time zone,
    requires_dual_sign boolean DEFAULT false
);



--
-- Name: pharmacy_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_id uuid NOT NULL,
    catalog_item_id uuid,
    drug_name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_price numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_number text,
    expiry_date date,
    batch_stock_id uuid,
    quantity_prescribed integer,
    quantity_returned integer DEFAULT 0 NOT NULL
);



--
-- Name: pharmacy_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid,
    patient_id uuid,
    encounter_id uuid,
    ordered_by uuid NOT NULL,
    status text DEFAULT 'ordered'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dispensing_type public.pharmacy_dispensing_type DEFAULT 'prescription'::public.pharmacy_dispensing_type NOT NULL,
    discharge_summary_id uuid,
    billing_package_id uuid,
    store_location_id uuid,
    interaction_check_result jsonb,
    dispensed_by uuid,
    dispensed_at timestamp with time zone,
    pharmacist_reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    rejection_reason text,
    rx_queue_id uuid,
    CONSTRAINT pharmacy_orders_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'dispensed'::text, 'cancelled'::text, 'returned'::text])))
);



--
-- Name: pharmacy_payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pos_sale_id uuid,
    order_id uuid,
    invoice_id uuid,
    payment_mode text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference_number text,
    device_terminal_id text,
    upi_transaction_id text,
    card_last_four text,
    card_network text,
    card_approval_code text,
    bank_name text,
    reconciliation_status text DEFAULT 'pending'::text NOT NULL,
    reconciled_at timestamp with time zone,
    reconciled_by uuid,
    gateway_response jsonb,
    shift_id text,
    counter_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_payment_transactions_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['cash'::text, 'card'::text, 'upi'::text, 'gpay'::text, 'phonepe'::text, 'paytm'::text, 'netbanking'::text, 'insurance'::text, 'credit'::text, 'wallet'::text, 'mixed'::text]))),
    CONSTRAINT pharmacy_payment_transactions_reconciliation_status_check CHECK ((reconciliation_status = ANY (ARRAY['pending'::text, 'matched'::text, 'mismatch'::text, 'manual_verified'::text])))
);



--
-- Name: pharmacy_petty_cash_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_petty_cash_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    cash_drawer_id uuid,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_to text NOT NULL,
    supporting_bill_url text,
    approved_by uuid,
    approved_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_petty_cash_vouchers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT pharmacy_petty_cash_vouchers_category_check CHECK ((category = ANY (ARRAY['supplies'::text, 'stationery'::text, 'refreshment'::text, 'transport'::text, 'repairs'::text, 'medical_consumable'::text, 'other'::text]))),
    CONSTRAINT pharmacy_petty_cash_vouchers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'reimbursed'::text])))
);

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_pos_sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_pos_sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pos_sale_id uuid NOT NULL,
    order_item_id uuid,
    catalog_item_id uuid,
    drug_name text NOT NULL,
    batch_id uuid,
    batch_number text,
    hsn_code text,
    quantity integer NOT NULL,
    mrp numeric(12,2) NOT NULL,
    selling_price numeric(12,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    cgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    igst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_cancelled boolean DEFAULT false,
    cancelled_qty integer DEFAULT 0,
    cancel_reason text
);



--
-- Name: pharmacy_pos_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_pos_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    sale_number text NOT NULL,
    pharmacy_order_id uuid,
    patient_id uuid,
    patient_name text,
    patient_phone text,
    subtotal numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2),
    gst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    payment_mode public.pharmacy_payment_mode DEFAULT 'cash'::public.pharmacy_payment_mode NOT NULL,
    payment_reference text,
    amount_received numeric(12,2) DEFAULT 0 NOT NULL,
    change_due numeric(12,2) DEFAULT 0 NOT NULL,
    receipt_number text,
    receipt_printed boolean DEFAULT false NOT NULL,
    pricing_tier text DEFAULT 'mrp'::text NOT NULL,
    sold_by uuid NOT NULL,
    store_location_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'completed'::text,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text,
    refund_amount numeric(12,2) DEFAULT 0,
    CONSTRAINT pharmacy_pos_sales_pricing_tier_check CHECK ((pricing_tier = ANY (ARRAY['mrp'::text, 'hospital_rate'::text, 'insurance_rate'::text, 'staff_rate'::text, 'discounted_rate'::text]))),
    CONSTRAINT pharmacy_pos_sales_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'partially_cancelled'::text, 'cancelled'::text, 'refunded'::text])))
);



--
-- Name: pharmacy_prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    source text DEFAULT 'opd'::text NOT NULL,
    status public.pharmacy_rx_status DEFAULT 'pending_review'::public.pharmacy_rx_status NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    pharmacy_order_id uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    rejection_reason text,
    allergy_check_done boolean DEFAULT false NOT NULL,
    interaction_check_done boolean DEFAULT false NOT NULL,
    interaction_check_result jsonb,
    store_location_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_prescriptions_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text, 'stat'::text]))),
    CONSTRAINT pharmacy_prescriptions_source_check CHECK ((source = ANY (ARRAY['opd'::text, 'ipd'::text, 'emergency'::text, 'discharge'::text, 'external'::text])))
);



--
-- Name: pharmacy_pricing_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_pricing_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    tier_name text NOT NULL,
    price numeric(12,2) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_pricing_tiers_tier_name_check CHECK ((tier_name = ANY (ARRAY['mrp'::text, 'hospital_rate'::text, 'insurance_rate'::text, 'staff_rate'::text, 'discounted_rate'::text])))
);



--
-- Name: pharmacy_repeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_repeats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    pharmacy_order_id uuid NOT NULL,
    repeat_index integer NOT NULL,
    dispensed_at timestamp with time zone DEFAULT now() NOT NULL,
    dispensed_by uuid NOT NULL,
    notes text,
    CONSTRAINT pharmacy_repeats_repeat_index_check CHECK ((repeat_index > 0))
);

ALTER TABLE ONLY public.pharmacy_repeats FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    quantity_returned integer NOT NULL,
    reason text,
    status public.pharmacy_return_status DEFAULT 'requested'::public.pharmacy_return_status NOT NULL,
    approved_by uuid,
    return_batch_id uuid,
    restocked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pharmacy_stock_reconciliation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_stock_reconciliation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    batch_id uuid,
    system_quantity integer NOT NULL,
    physical_quantity integer NOT NULL,
    variance integer NOT NULL,
    reason text,
    reconciled_by uuid NOT NULL,
    store_location_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pharmacy_stock_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_stock_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    catalog_item_id uuid NOT NULL,
    transaction_type text NOT NULL,
    quantity integer NOT NULL,
    reference_id uuid,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_stock_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'return'::text, 'adjustment'::text])))
);



--
-- Name: pharmacy_store_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_store_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    store_location_id uuid NOT NULL,
    is_central boolean DEFAULT false NOT NULL,
    serves_departments uuid[],
    operating_hours jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pharmacy_store_indents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_store_indents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    indent_number text NOT NULL,
    from_store_id uuid,
    to_store_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    notes text,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    issued_by uuid,
    issued_at timestamp with time zone,
    received_by uuid,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_store_indents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'issued'::text, 'received'::text, 'rejected'::text, 'cancelled'::text])))
);



--
-- Name: pharmacy_substitutes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_substitutes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    brand_drug_id uuid NOT NULL,
    generic_drug_id uuid NOT NULL,
    is_therapeutic_equivalent boolean DEFAULT true,
    is_bioequivalent boolean DEFAULT false,
    price_difference numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pharmacy_substitutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_substitutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pharmacy_order_item_id uuid NOT NULL,
    original_drug_id uuid NOT NULL,
    substituted_drug_id uuid NOT NULL,
    reason text NOT NULL,
    inn_match boolean NOT NULL,
    patient_consent_obtained boolean DEFAULT false NOT NULL,
    substituted_by uuid NOT NULL,
    substituted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pharmacy_substitutions FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_supplier_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_supplier_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_order_id uuid,
    grn_id uuid,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    gross_amount numeric(12,2) NOT NULL,
    tds_amount numeric(12,2) DEFAULT 0 NOT NULL,
    tds_section text,
    net_payable numeric(12,2) GENERATED ALWAYS AS ((gross_amount - tds_amount)) STORED,
    status text DEFAULT 'scheduled'::text NOT NULL,
    payment_mode text,
    paid_at timestamp with time zone,
    paid_amount numeric(12,2),
    utr_number text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_supplier_payments_gross_amount_check CHECK ((gross_amount > (0)::numeric)),
    CONSTRAINT pharmacy_supplier_payments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'approved'::text, 'paid'::text, 'disputed'::text, 'cancelled'::text]))),
    CONSTRAINT pharmacy_supplier_payments_tds_amount_check CHECK ((tds_amount >= (0)::numeric))
);

ALTER TABLE ONLY public.pharmacy_supplier_payments FORCE ROW LEVEL SECURITY;



--
-- Name: pharmacy_transfer_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_transfer_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    from_location_id uuid NOT NULL,
    to_location_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pharmacy_transfer_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'transferred'::text, 'cancelled'::text])))
);



--
-- Name: prescription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    drug_name text NOT NULL,
    dosage text NOT NULL,
    frequency text NOT NULL,
    duration text NOT NULL,
    route text,
    instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    item_status text DEFAULT 'active'::text NOT NULL,
    discontinued_at timestamp with time zone,
    discontinued_by uuid,
    discontinue_reason text,
    catalog_item_id uuid,
    CONSTRAINT prescription_items_item_status_check CHECK ((item_status = ANY (ARRAY['active'::text, 'discontinued'::text, 'changed'::text, 'completed'::text, 'held'::text])))
);



--
-- Name: prescription_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name text NOT NULL,
    description text,
    department_id uuid,
    is_shared boolean DEFAULT false NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_id uuid,
    is_retrospective boolean DEFAULT false NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    signed_record_id uuid,
    repeats_allowed integer DEFAULT 0 NOT NULL,
    repeat_interval_days integer,
    repeats_used integer DEFAULT 0 NOT NULL,
    CONSTRAINT prescriptions_repeat_interval_days_check CHECK (((repeat_interval_days IS NULL) OR ((repeat_interval_days >= 1) AND (repeat_interval_days <= 365)))),
    CONSTRAINT prescriptions_repeats_allowed_check CHECK (((repeats_allowed >= 0) AND (repeats_allowed <= 12)))
);



--
-- Name: restricted_drug_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restricted_drug_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid,
    encounter_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    drug_name text NOT NULL,
    catalog_item_id uuid,
    reason text NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_at timestamp with time zone,
    denied_reason text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT restricted_drug_approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'expired'::text])))
);



--
-- Name: adherence_records adherence_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_pkey PRIMARY KEY (id);



--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_batches pharmacy_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_cash_drawers pharmacy_cash_drawers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_drawers
    ADD CONSTRAINT pharmacy_cash_drawers_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_cashier_overrides pharmacy_cashier_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cashier_overrides
    ADD CONSTRAINT pharmacy_cashier_overrides_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_catalog pharmacy_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_catalog pharmacy_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_catalog
    ADD CONSTRAINT pharmacy_catalog_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: pharmacy_counseling pharmacy_counseling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_counseling
    ADD CONSTRAINT pharmacy_counseling_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_counseling pharmacy_counseling_tenant_id_pharmacy_order_id_counselled__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_counseling
    ADD CONSTRAINT pharmacy_counseling_tenant_id_pharmacy_order_id_counselled__key UNIQUE (tenant_id, pharmacy_order_id, counselled_by);



--
-- Name: pharmacy_coverage_checks pharmacy_coverage_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_coverage_checks
    ADD CONSTRAINT pharmacy_coverage_checks_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_day_settlements pharmacy_day_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_day_settlements
    ADD CONSTRAINT pharmacy_day_settlements_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_destruction_log pharmacy_destruction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_destruction_log
    ADD CONSTRAINT pharmacy_destruction_log_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_drug_margin_daily pharmacy_drug_margin_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_margin_daily
    ADD CONSTRAINT pharmacy_drug_margin_daily_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_drug_margin_daily pharmacy_drug_margin_daily_tenant_id_drug_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_margin_daily
    ADD CONSTRAINT pharmacy_drug_margin_daily_tenant_id_drug_id_snapshot_date_key UNIQUE (tenant_id, drug_id, snapshot_date);



--
-- Name: pharmacy_drug_recalls pharmacy_drug_recalls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_recalls
    ADD CONSTRAINT pharmacy_drug_recalls_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_emergency_kits pharmacy_emergency_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_emergency_kits
    ADD CONSTRAINT pharmacy_emergency_kits_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_free_dispensings pharmacy_free_dispensings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_free_dispensings
    ADD CONSTRAINT pharmacy_free_dispensings_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_order_items pharmacy_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_orders pharmacy_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_petty_cash_vouchers pharmacy_petty_cash_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers
    ADD CONSTRAINT pharmacy_petty_cash_vouchers_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_tenant_id_sale_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_tenant_id_sale_number_key UNIQUE (tenant_id, sale_number);



--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pricing_tiers
    ADD CONSTRAINT pharmacy_pricing_tiers_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_tenant_id_catalog_item_id_tier_name__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pricing_tiers
    ADD CONSTRAINT pharmacy_pricing_tiers_tenant_id_catalog_item_id_tier_name__key UNIQUE (tenant_id, catalog_item_id, tier_name, effective_from);



--
-- Name: pharmacy_repeats pharmacy_repeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_repeats
    ADD CONSTRAINT pharmacy_repeats_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_repeats pharmacy_repeats_tenant_id_prescription_id_repeat_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_repeats
    ADD CONSTRAINT pharmacy_repeats_tenant_id_prescription_id_repeat_index_key UNIQUE (tenant_id, prescription_id, repeat_index);



--
-- Name: pharmacy_returns pharmacy_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_reconciliation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_reconciliation
    ADD CONSTRAINT pharmacy_stock_reconciliation_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_stock_transactions pharmacy_stock_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_transactions
    ADD CONSTRAINT pharmacy_stock_transactions_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_store_assignments pharmacy_store_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_assignments
    ADD CONSTRAINT pharmacy_store_assignments_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_store_assignments pharmacy_store_assignments_store_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_assignments
    ADD CONSTRAINT pharmacy_store_assignments_store_location_id_key UNIQUE (store_location_id);



--
-- Name: pharmacy_store_indents pharmacy_store_indents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_store_indents
    ADD CONSTRAINT pharmacy_store_indents_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_substitutes pharmacy_substitutes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutes
    ADD CONSTRAINT pharmacy_substitutes_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_substitutes pharmacy_substitutes_tenant_id_brand_drug_id_generic_drug_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutes
    ADD CONSTRAINT pharmacy_substitutes_tenant_id_brand_drug_id_generic_drug_i_key UNIQUE (tenant_id, brand_drug_id, generic_drug_id);



--
-- Name: pharmacy_substitutions pharmacy_substitutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutions
    ADD CONSTRAINT pharmacy_substitutions_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_supplier_payments pharmacy_supplier_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_supplier_payments
    ADD CONSTRAINT pharmacy_supplier_payments_pkey PRIMARY KEY (id);



--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_transfer_requests
    ADD CONSTRAINT pharmacy_transfer_requests_pkey PRIMARY KEY (id);



--
-- Name: prescription_items prescription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);



--
-- Name: prescription_templates prescription_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT prescription_templates_pkey PRIMARY KEY (id);



--
-- Name: prescription_templates prescription_templates_tenant_id_created_by_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT prescription_templates_tenant_id_created_by_name_key UNIQUE (tenant_id, created_by, name);



--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);



--
-- Name: restricted_drug_approvals restricted_drug_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_pkey PRIMARY KEY (id);



--
-- Name: idx_adherence_enrollment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_enrollment_date ON public.adherence_records USING btree (tenant_id, enrollment_id, event_date);



--
-- Name: idx_allergy_check_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allergy_check_patient ON public.pharmacy_allergy_check_log USING btree (patient_id, checked_at DESC);



--
-- Name: idx_destruction_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_destruction_tenant ON public.pharmacy_destruction_log USING btree (tenant_id, destruction_date);



--
-- Name: idx_drug_interactions_drug_a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drug_interactions_drug_a ON public.drug_interactions USING btree (tenant_id, lower(drug_a_name));



--
-- Name: idx_drug_interactions_drug_b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drug_interactions_drug_b ON public.drug_interactions USING btree (tenant_id, lower(drug_b_name));



--
-- Name: idx_drug_interactions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drug_interactions_tenant ON public.drug_interactions USING btree (tenant_id);



--
-- Name: idx_kits_check; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kits_check ON public.pharmacy_emergency_kits USING btree (next_check_due) WHERE (status = 'active'::text);



--
-- Name: idx_pharma_pay_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharma_pay_date ON public.pharmacy_payment_transactions USING btree (tenant_id, created_at);



--
-- Name: idx_pharma_pay_pos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharma_pay_pos ON public.pharmacy_payment_transactions USING btree (pos_sale_id) WHERE (pos_sale_id IS NOT NULL);



--
-- Name: idx_pharma_pay_recon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharma_pay_recon ON public.pharmacy_payment_transactions USING btree (tenant_id, reconciliation_status, created_at);



--
-- Name: idx_pharma_pay_upi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharma_pay_upi ON public.pharmacy_payment_transactions USING btree (upi_transaction_id) WHERE (upi_transaction_id IS NOT NULL);



--
-- Name: idx_pharmacy_batches_tenant_catalog_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_batches_tenant_catalog_expiry ON public.pharmacy_batches USING btree (tenant_id, catalog_item_id, expiry_date);



--
-- Name: idx_pharmacy_batches_tenant_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_batches_tenant_location ON public.pharmacy_batches USING btree (tenant_id, store_location_id);



--
-- Name: idx_pharmacy_catalog_controlled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_catalog_controlled ON public.pharmacy_catalog USING btree (tenant_id, is_controlled) WHERE (is_controlled = true);



--
-- Name: idx_pharmacy_catalog_formulary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_catalog_formulary ON public.pharmacy_catalog USING btree (tenant_id, formulary_status);



--
-- Name: idx_pharmacy_catalog_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_catalog_schedule ON public.pharmacy_catalog USING btree (tenant_id, drug_schedule) WHERE (drug_schedule IS NOT NULL);



--
-- Name: idx_pharmacy_catalog_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_catalog_tenant ON public.pharmacy_catalog USING btree (tenant_id);



--
-- Name: idx_pharmacy_credit_notes_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_credit_notes_patient ON public.pharmacy_credit_notes USING btree (patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_pharmacy_credit_notes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_credit_notes_tenant ON public.pharmacy_credit_notes USING btree (tenant_id, status);



--
-- Name: idx_pharmacy_credit_notes_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_credit_notes_vendor ON public.pharmacy_credit_notes USING btree (vendor_id) WHERE (vendor_id IS NOT NULL);



--
-- Name: idx_pharmacy_ndps_register_tenant_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_ndps_register_tenant_catalog ON public.pharmacy_ndps_register USING btree (tenant_id, catalog_item_id, created_at);



--
-- Name: idx_pharmacy_order_items_batch_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_order_items_batch_stock ON public.pharmacy_order_items USING btree (batch_stock_id);



--
-- Name: idx_pharmacy_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_order_items_order ON public.pharmacy_order_items USING btree (order_id);



--
-- Name: idx_pharmacy_orders_dispensing_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_orders_dispensing_type ON public.pharmacy_orders USING btree (tenant_id, dispensing_type);



--
-- Name: idx_pharmacy_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_orders_patient ON public.pharmacy_orders USING btree (tenant_id, patient_id);



--
-- Name: idx_pharmacy_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_orders_status ON public.pharmacy_orders USING btree (tenant_id, status);



--
-- Name: idx_pharmacy_orders_store_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_orders_store_location ON public.pharmacy_orders USING btree (tenant_id, store_location_id);



--
-- Name: idx_pharmacy_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_orders_tenant ON public.pharmacy_orders USING btree (tenant_id);



--
-- Name: idx_pharmacy_returns_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_returns_tenant_status ON public.pharmacy_returns USING btree (tenant_id, status);



--
-- Name: idx_pharmacy_rx_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_rx_patient ON public.pharmacy_prescriptions USING btree (tenant_id, patient_id);



--
-- Name: idx_pharmacy_rx_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_rx_prescription ON public.pharmacy_prescriptions USING btree (prescription_id);



--
-- Name: idx_pharmacy_rx_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_rx_status ON public.pharmacy_prescriptions USING btree (tenant_id, status);



--
-- Name: idx_pharmacy_stock_tx_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_stock_tx_item ON public.pharmacy_stock_transactions USING btree (catalog_item_id);



--
-- Name: idx_pharmacy_store_assignments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_store_assignments_tenant ON public.pharmacy_store_assignments USING btree (tenant_id);



--
-- Name: idx_pharmacy_store_indents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_store_indents_tenant ON public.pharmacy_store_indents USING btree (tenant_id, status);



--
-- Name: idx_pharmacy_transfer_requests_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pharmacy_transfer_requests_tenant_status ON public.pharmacy_transfer_requests USING btree (tenant_id, status);



--
-- Name: idx_pos_sale_items; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sale_items ON public.pharmacy_pos_sale_items USING btree (pos_sale_id);



--
-- Name: idx_pos_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sales_date ON public.pharmacy_pos_sales USING btree (tenant_id, created_at);



--
-- Name: idx_pos_sales_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_sales_patient ON public.pharmacy_pos_sales USING btree (patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_prescription_items_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_items_prescription ON public.prescription_items USING btree (prescription_id);



--
-- Name: idx_prescription_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_items_status ON public.prescription_items USING btree (tenant_id, item_status) WHERE (item_status <> 'active'::text);



--
-- Name: idx_prescription_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_templates_tenant ON public.prescription_templates USING btree (tenant_id);



--
-- Name: idx_prescription_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescription_templates_user ON public.prescription_templates USING btree (tenant_id, created_by);



--
-- Name: idx_prescriptions_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_encounter ON public.prescriptions USING btree (encounter_id);



--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (tenant_id, patient_id) WHERE (patient_id IS NOT NULL);



--
-- Name: idx_prescriptions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_tenant ON public.prescriptions USING btree (tenant_id);



--
-- Name: idx_pricing_tiers_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_tiers_item ON public.pharmacy_pricing_tiers USING btree (catalog_item_id, tier_name);



--
-- Name: idx_recall_drug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recall_drug ON public.pharmacy_drug_recalls USING btree (drug_id);



--
-- Name: idx_recall_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recall_tenant ON public.pharmacy_drug_recalls USING btree (tenant_id, status);



--
-- Name: idx_restricted_drug_approvals_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restricted_drug_approvals_encounter ON public.restricted_drug_approvals USING btree (encounter_id);



--
-- Name: idx_restricted_drug_approvals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restricted_drug_approvals_status ON public.restricted_drug_approvals USING btree (tenant_id, status);



--
-- Name: idx_restricted_drug_approvals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restricted_drug_approvals_tenant ON public.restricted_drug_approvals USING btree (tenant_id);



--
-- Name: idx_settlements_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_settlements_date ON public.pharmacy_day_settlements USING btree (tenant_id, settlement_date, counter_id);



--
-- Name: idx_stock_recon_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_recon_item ON public.pharmacy_stock_reconciliation USING btree (catalog_item_id, created_at DESC);



--
-- Name: pharmacy_cash_drawers_cashier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_cash_drawers_cashier_idx ON public.pharmacy_cash_drawers USING btree (tenant_id, cashier_user_id, opened_at DESC);



--
-- Name: pharmacy_cash_drawers_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_cash_drawers_open_idx ON public.pharmacy_cash_drawers USING btree (tenant_id, pharmacy_location_id) WHERE (status = 'open'::text);



--
-- Name: pharmacy_cashier_overrides_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_cashier_overrides_type_idx ON public.pharmacy_cashier_overrides USING btree (tenant_id, override_type, created_at DESC);



--
-- Name: pharmacy_cashier_overrides_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_cashier_overrides_user_idx ON public.pharmacy_cashier_overrides USING btree (tenant_id, cashier_user_id, created_at DESC);



--
-- Name: pharmacy_counseling_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_counseling_order_idx ON public.pharmacy_counseling USING btree (tenant_id, pharmacy_order_id);



--
-- Name: pharmacy_coverage_checks_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_coverage_checks_order_idx ON public.pharmacy_coverage_checks USING btree (tenant_id, pharmacy_order_id);



--
-- Name: pharmacy_drug_margin_top_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_drug_margin_top_idx ON public.pharmacy_drug_margin_daily USING btree (tenant_id, snapshot_date DESC, margin_total DESC);



--
-- Name: pharmacy_free_dispensings_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_free_dispensings_idx ON public.pharmacy_free_dispensings USING btree (tenant_id, category, created_at DESC);



--
-- Name: pharmacy_petty_cash_drawer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_petty_cash_drawer_idx ON public.pharmacy_petty_cash_vouchers USING btree (tenant_id, cash_drawer_id, status);



--
-- Name: pharmacy_repeats_rx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_repeats_rx_idx ON public.pharmacy_repeats USING btree (tenant_id, prescription_id, dispensed_at DESC);



--
-- Name: pharmacy_substitutions_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_substitutions_item_idx ON public.pharmacy_substitutions USING btree (tenant_id, pharmacy_order_item_id);



--
-- Name: pharmacy_supplier_payments_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_supplier_payments_due_idx ON public.pharmacy_supplier_payments USING btree (tenant_id, due_date) WHERE (status = ANY (ARRAY['scheduled'::text, 'approved'::text]));



--
-- Name: pharmacy_supplier_payments_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pharmacy_supplier_payments_supplier_idx ON public.pharmacy_supplier_payments USING btree (tenant_id, supplier_id, due_date DESC);



--
-- Name: prescriptions_unsigned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_unsigned_idx ON public.prescriptions USING btree (tenant_id, doctor_id) WHERE (NOT is_signed);



--
-- Name: pharmacy_orders audit_pharmacy_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_pharmacy_orders AFTER INSERT OR DELETE OR UPDATE ON public.pharmacy_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('pharmacy');



--
-- Name: prescription_items audit_prescription_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_prescription_items AFTER INSERT OR DELETE OR UPDATE ON public.prescription_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('pharmacy');



--
-- Name: prescriptions audit_prescriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_prescriptions AFTER INSERT OR DELETE OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func('pharmacy');



--
-- Name: pharmacy_cash_drawers pharmacy_cash_drawers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pharmacy_cash_drawers_updated BEFORE UPDATE ON public.pharmacy_cash_drawers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pharmacy_payment_transactions_updated BEFORE UPDATE ON public.pharmacy_payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_supplier_payments pharmacy_supplier_payments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pharmacy_supplier_payments_updated BEFORE UPDATE ON public.pharmacy_supplier_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: drug_interactions set_updated_at_drug_interactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_drug_interactions BEFORE UPDATE ON public.drug_interactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_catalog set_updated_at_pharmacy_catalog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pharmacy_catalog BEFORE UPDATE ON public.pharmacy_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_orders set_updated_at_pharmacy_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_pharmacy_orders BEFORE UPDATE ON public.pharmacy_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: prescription_templates set_updated_at_prescription_templates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_prescription_templates BEFORE UPDATE ON public.prescription_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: restricted_drug_approvals set_updated_at_restricted_drug_approvals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_restricted_drug_approvals BEFORE UPDATE ON public.restricted_drug_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_emergency_kits trg_kits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kits_updated_at BEFORE UPDATE ON public.pharmacy_emergency_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_batches trg_pharmacy_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_batches_updated_at BEFORE UPDATE ON public.pharmacy_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_credit_notes trg_pharmacy_credit_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_credit_notes_updated_at BEFORE UPDATE ON public.pharmacy_credit_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_ndps_register trg_pharmacy_ndps_register_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_ndps_register_updated_at BEFORE UPDATE ON public.pharmacy_ndps_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_returns trg_pharmacy_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_returns_updated_at BEFORE UPDATE ON public.pharmacy_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_prescriptions trg_pharmacy_rx_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_rx_updated_at BEFORE UPDATE ON public.pharmacy_prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_store_assignments trg_pharmacy_store_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_store_assignments_updated_at BEFORE UPDATE ON public.pharmacy_store_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_store_indents trg_pharmacy_store_indents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_store_indents_updated_at BEFORE UPDATE ON public.pharmacy_store_indents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_transfer_requests trg_pharmacy_transfer_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pharmacy_transfer_requests_updated_at BEFORE UPDATE ON public.pharmacy_transfer_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_pos_sales trg_pos_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pos_sales_updated_at BEFORE UPDATE ON public.pharmacy_pos_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: prescriptions trg_prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pharmacy_drug_recalls trg_recalls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recalls_updated_at BEFORE UPDATE ON public.pharmacy_drug_recalls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: adherence_records adherence_records_pharmacy_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adherence_records
    ADD CONSTRAINT adherence_records_pharmacy_order_id_fkey FOREIGN KEY (pharmacy_order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_log_rx_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_allergy_check_log
    ADD CONSTRAINT pharmacy_allergy_check_log_rx_queue_id_fkey FOREIGN KEY (rx_queue_id) REFERENCES public.pharmacy_prescriptions(id);



--
-- Name: pharmacy_batches pharmacy_batches_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_batches
    ADD CONSTRAINT pharmacy_batches_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_destination_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_destination_drawer_id_fkey FOREIGN KEY (destination_drawer_id) REFERENCES public.pharmacy_cash_drawers(id);



--
-- Name: pharmacy_cash_float_movements pharmacy_cash_float_movements_source_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cash_float_movements
    ADD CONSTRAINT pharmacy_cash_float_movements_source_drawer_id_fkey FOREIGN KEY (source_drawer_id) REFERENCES public.pharmacy_cash_drawers(id);



--
-- Name: pharmacy_cashier_overrides pharmacy_cashier_overrides_cash_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_cashier_overrides
    ADD CONSTRAINT pharmacy_cashier_overrides_cash_drawer_id_fkey FOREIGN KEY (cash_drawer_id) REFERENCES public.pharmacy_cash_drawers(id);



--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_original_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_original_order_id_fkey FOREIGN KEY (original_order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_original_pos_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_credit_notes
    ADD CONSTRAINT pharmacy_credit_notes_original_pos_sale_id_fkey FOREIGN KEY (original_pos_sale_id) REFERENCES public.pharmacy_pos_sales(id);



--
-- Name: pharmacy_drug_recalls pharmacy_drug_recalls_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_drug_recalls
    ADD CONSTRAINT pharmacy_drug_recalls_drug_id_fkey FOREIGN KEY (drug_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_ndps_register
    ADD CONSTRAINT pharmacy_ndps_register_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_order_items pharmacy_order_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_order_items pharmacy_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_order_items
    ADD CONSTRAINT pharmacy_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.pharmacy_orders(id) ON DELETE CASCADE;



--
-- Name: pharmacy_orders pharmacy_orders_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);



--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_payment_transactions pharmacy_payment_transactions_pos_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_payment_transactions
    ADD CONSTRAINT pharmacy_payment_transactions_pos_sale_id_fkey FOREIGN KEY (pos_sale_id) REFERENCES public.pharmacy_pos_sales(id);



--
-- Name: pharmacy_petty_cash_vouchers pharmacy_petty_cash_vouchers_cash_drawer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_petty_cash_vouchers
    ADD CONSTRAINT pharmacy_petty_cash_vouchers_cash_drawer_id_fkey FOREIGN KEY (cash_drawer_id) REFERENCES public.pharmacy_cash_drawers(id);



--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.pharmacy_batches(id);



--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.pharmacy_order_items(id);



--
-- Name: pharmacy_pos_sale_items pharmacy_pos_sale_items_pos_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sale_items
    ADD CONSTRAINT pharmacy_pos_sale_items_pos_sale_id_fkey FOREIGN KEY (pos_sale_id) REFERENCES public.pharmacy_pos_sales(id) ON DELETE CASCADE;



--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_pharmacy_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pos_sales
    ADD CONSTRAINT pharmacy_pos_sales_pharmacy_order_id_fkey FOREIGN KEY (pharmacy_order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_pharmacy_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_pharmacy_order_id_fkey FOREIGN KEY (pharmacy_order_id) REFERENCES public.pharmacy_orders(id);



--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_prescriptions
    ADD CONSTRAINT pharmacy_prescriptions_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);



--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_pricing_tiers
    ADD CONSTRAINT pharmacy_pricing_tiers_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_repeats pharmacy_repeats_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_repeats
    ADD CONSTRAINT pharmacy_repeats_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;



--
-- Name: pharmacy_returns pharmacy_returns_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.pharmacy_order_items(id);



--
-- Name: pharmacy_returns pharmacy_returns_return_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_returns
    ADD CONSTRAINT pharmacy_returns_return_batch_id_fkey FOREIGN KEY (return_batch_id) REFERENCES public.pharmacy_batches(id);



--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_reconciliation_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_reconciliation
    ADD CONSTRAINT pharmacy_stock_reconciliation_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.pharmacy_batches(id);



--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_reconciliation_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_reconciliation
    ADD CONSTRAINT pharmacy_stock_reconciliation_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_stock_transactions pharmacy_stock_transactions_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_stock_transactions
    ADD CONSTRAINT pharmacy_stock_transactions_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_substitutes pharmacy_substitutes_brand_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutes
    ADD CONSTRAINT pharmacy_substitutes_brand_drug_id_fkey FOREIGN KEY (brand_drug_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: pharmacy_substitutes pharmacy_substitutes_generic_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_substitutes
    ADD CONSTRAINT pharmacy_substitutes_generic_drug_id_fkey FOREIGN KEY (generic_drug_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: prescription_items prescription_items_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: prescription_items prescription_items_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);



--
-- Name: restricted_drug_approvals restricted_drug_approvals_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.pharmacy_catalog(id);



--
-- Name: restricted_drug_approvals restricted_drug_approvals_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restricted_drug_approvals
    ADD CONSTRAINT restricted_drug_approvals_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);



--
-- Name: adherence_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adherence_records ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_destruction_log destruction_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY destruction_tenant ON public.pharmacy_destruction_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: drug_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;


--
-- Name: drug_interactions drug_interactions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drug_interactions_tenant ON public.drug_interactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_emergency_kits kits_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kits_tenant ON public.pharmacy_emergency_kits USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_payment_transactions payments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_tenant ON public.pharmacy_payment_transactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_allergy_check_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_allergy_check_log ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_allergy_check_log pharmacy_allergy_check_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_allergy_check_tenant ON public.pharmacy_allergy_check_log USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_batches ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_batches pharmacy_batches_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_batches_tenant ON public.pharmacy_batches USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pharmacy_cash_drawers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_cash_drawers ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_cash_float_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_cash_float_movements ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_cashier_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_cashier_overrides ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_catalog ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_catalog pharmacy_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_catalog_tenant ON public.pharmacy_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_counseling; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_counseling ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_coverage_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_coverage_checks ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_credit_notes ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_credit_notes pharmacy_credit_notes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_credit_notes_tenant ON public.pharmacy_credit_notes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_day_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_day_settlements ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_destruction_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_destruction_log ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_drug_margin_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_drug_margin_daily ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_drug_recalls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_drug_recalls ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_emergency_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_emergency_kits ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_free_dispensings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_free_dispensings ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_ndps_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_ndps_register ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_ndps_register pharmacy_ndps_register_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_ndps_register_tenant ON public.pharmacy_ndps_register USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pharmacy_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_order_items ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_order_items pharmacy_order_items_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_order_items_tenant ON public.pharmacy_order_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_orders pharmacy_orders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_orders_tenant ON public.pharmacy_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_payment_transactions ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_petty_cash_vouchers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_petty_cash_vouchers ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_pos_sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_pos_sale_items ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_pos_sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_pos_sales ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_pos_sales pharmacy_pos_sales_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_pos_sales_tenant ON public.pharmacy_pos_sales USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_prescriptions ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_prescriptions pharmacy_prescriptions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_prescriptions_tenant ON public.pharmacy_prescriptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_pricing_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_pricing_tiers ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_pricing_tiers pharmacy_pricing_tiers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_pricing_tiers_tenant ON public.pharmacy_pricing_tiers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_repeats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_repeats ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_returns ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_returns pharmacy_returns_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_returns_tenant ON public.pharmacy_returns USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pharmacy_stock_reconciliation pharmacy_stock_recon_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_stock_recon_tenant ON public.pharmacy_stock_reconciliation USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_stock_reconciliation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_stock_reconciliation ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_stock_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_stock_transactions ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_stock_transactions pharmacy_stock_transactions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_stock_transactions_tenant ON public.pharmacy_stock_transactions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_store_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_store_assignments ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_store_assignments pharmacy_store_assignments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_store_assignments_tenant ON public.pharmacy_store_assignments USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pharmacy_store_indents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_store_indents ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_store_indents pharmacy_store_indents_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_store_indents_tenant ON public.pharmacy_store_indents USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_substitutes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_substitutes ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_substitutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_substitutions ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_supplier_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_supplier_payments ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_transfer_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_transfer_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_transfer_requests pharmacy_transfer_requests_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pharmacy_transfer_requests_tenant ON public.pharmacy_transfer_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: prescription_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;


--
-- Name: prescription_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: prescription_templates prescription_templates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescription_templates_tenant ON public.prescription_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;


--
-- Name: pharmacy_drug_recalls recall_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recall_tenant ON public.pharmacy_drug_recalls USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: restricted_drug_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restricted_drug_approvals ENABLE ROW LEVEL SECURITY;


--
-- Name: restricted_drug_approvals restricted_drug_approvals_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY restricted_drug_approvals_tenant ON public.restricted_drug_approvals USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_day_settlements settlements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settlements_tenant ON public.pharmacy_day_settlements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_substitutes subs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subs_tenant ON public.pharmacy_substitutes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: adherence_records tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.adherence_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: pharmacy_cash_drawers tenant_isolation_pharmacy_cash_drawers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_cash_drawers ON public.pharmacy_cash_drawers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_cash_float_movements tenant_isolation_pharmacy_cash_float_movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_cash_float_movements ON public.pharmacy_cash_float_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_cashier_overrides tenant_isolation_pharmacy_cashier_overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_cashier_overrides ON public.pharmacy_cashier_overrides USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_counseling tenant_isolation_pharmacy_counseling; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_counseling ON public.pharmacy_counseling USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_coverage_checks tenant_isolation_pharmacy_coverage_checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_coverage_checks ON public.pharmacy_coverage_checks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_drug_margin_daily tenant_isolation_pharmacy_drug_margin_daily; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_drug_margin_daily ON public.pharmacy_drug_margin_daily USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_free_dispensings tenant_isolation_pharmacy_free_dispensings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_free_dispensings ON public.pharmacy_free_dispensings USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_petty_cash_vouchers tenant_isolation_pharmacy_petty_cash_vouchers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_petty_cash_vouchers ON public.pharmacy_petty_cash_vouchers USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_pos_sale_items tenant_isolation_pharmacy_pos_sale_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_pos_sale_items ON public.pharmacy_pos_sale_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_repeats tenant_isolation_pharmacy_repeats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_repeats ON public.pharmacy_repeats USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_substitutions tenant_isolation_pharmacy_substitutions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_substitutions ON public.pharmacy_substitutions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pharmacy_supplier_payments tenant_isolation_pharmacy_supplier_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_pharmacy_supplier_payments ON public.pharmacy_supplier_payments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prescription_items tenant_isolation_prescription_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_prescription_items ON public.prescription_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: prescriptions tenant_isolation_prescriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_prescriptions ON public.prescriptions USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


