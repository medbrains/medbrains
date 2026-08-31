-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 9
-- Drops: none
-- diet — schema.
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



CREATE TABLE public.diet_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    template_id uuid,
    diet_type public.diet_type DEFAULT 'regular'::public.diet_type NOT NULL,
    status public.diet_order_status DEFAULT 'active'::public.diet_order_status NOT NULL,
    ordered_by uuid,
    special_instructions text,
    allergies_flagged jsonb DEFAULT '[]'::jsonb,
    is_npo boolean DEFAULT false NOT NULL,
    npo_reason text,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    calories_target integer,
    protein_g numeric(6,1),
    carbs_g numeric(6,1),
    fat_g numeric(6,1),
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: diet_orders diet_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_orders
    ADD CONSTRAINT diet_orders_pkey PRIMARY KEY (id);

CREATE INDEX idx_diet_orders_admission ON public.diet_orders USING btree (tenant_id, admission_id) WHERE (admission_id IS NOT NULL);

CREATE INDEX idx_diet_orders_deleted_at_5cef7b35 ON public.diet_orders USING btree (deleted_at);

CREATE INDEX idx_diet_orders_patient ON public.diet_orders USING btree (tenant_id, patient_id);

CREATE INDEX idx_diet_orders_status ON public.diet_orders USING btree (tenant_id, status);

CREATE INDEX idx_diet_orders_template_id ON public.diet_orders USING btree (template_id);

ALTER TABLE public.diet_orders ENABLE ROW LEVEL SECURITY;

-- Name: diet_orders tenant_diet_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_diet_orders ON public.diet_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: diet_orders set_diet_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_diet_orders_updated BEFORE UPDATE ON public.diet_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: diet_orders trg_diet_orders_soft_delete_5cef7b35; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_diet_orders_soft_delete_5cef7b35 BEFORE DELETE ON public.diet_orders FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.diet_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    diet_type public.diet_type DEFAULT 'custom'::public.diet_type NOT NULL,
    description text,
    calories_target integer,
    protein_g numeric(6,1),
    carbs_g numeric(6,1),
    fat_g numeric(6,1),
    fiber_g numeric(6,1),
    sodium_mg numeric(7,1),
    restrictions jsonb DEFAULT '[]'::jsonb,
    suitable_for jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: diet_templates diet_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_templates
    ADD CONSTRAINT diet_templates_pkey PRIMARY KEY (id);

CREATE INDEX idx_diet_templates_deleted_at_232afaa8 ON public.diet_templates USING btree (deleted_at);

CREATE INDEX idx_diet_templates_tenant_id ON public.diet_templates USING btree (tenant_id);

ALTER TABLE public.diet_templates ENABLE ROW LEVEL SECURITY;

-- Name: diet_templates tenant_diet_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_diet_templates ON public.diet_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: diet_templates set_diet_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_diet_templates_updated BEFORE UPDATE ON public.diet_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: diet_templates trg_diet_templates_soft_delete_232afaa8; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_diet_templates_soft_delete_232afaa8 BEFORE DELETE ON public.diet_templates FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.kitchen_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    audit_date date DEFAULT CURRENT_DATE NOT NULL,
    auditor_name text NOT NULL,
    audit_type text DEFAULT 'routine'::text NOT NULL,
    temperature_log jsonb DEFAULT '{}'::jsonb,
    hygiene_score integer,
    findings text,
    corrective_actions text,
    is_compliant boolean DEFAULT true NOT NULL,
    next_audit_date date,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT kitchen_audits_hygiene_score_check CHECK (((hygiene_score >= 0) AND (hygiene_score <= 100)))
);

-- Name: kitchen_audits kitchen_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_audits
    ADD CONSTRAINT kitchen_audits_pkey PRIMARY KEY (id);

CREATE INDEX idx_kitchen_audits_date ON public.kitchen_audits USING btree (tenant_id, audit_date);

CREATE INDEX idx_kitchen_audits_deleted_at_6ba261e1 ON public.kitchen_audits USING btree (deleted_at);

ALTER TABLE public.kitchen_audits ENABLE ROW LEVEL SECURITY;

-- Name: kitchen_audits tenant_kitchen_audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_audits ON public.kitchen_audits USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: kitchen_audits trg_kitchen_audits_soft_delete_6ba261e1; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kitchen_audits_soft_delete_6ba261e1 BEFORE DELETE ON public.kitchen_audits FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.kitchen_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    item_name text NOT NULL,
    category text,
    unit text DEFAULT 'kg'::text NOT NULL,
    current_stock numeric(10,2) DEFAULT 0 NOT NULL,
    reorder_level numeric(10,2),
    supplier text,
    last_procured_at timestamp with time zone,
    expiry_date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: kitchen_inventory kitchen_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_inventory
    ADD CONSTRAINT kitchen_inventory_pkey PRIMARY KEY (id);

CREATE INDEX idx_kitchen_inventory_deleted_at_3cfb93a9 ON public.kitchen_inventory USING btree (deleted_at);

CREATE INDEX idx_kitchen_inventory_name ON public.kitchen_inventory USING btree (tenant_id, item_name);

ALTER TABLE public.kitchen_inventory ENABLE ROW LEVEL SECURITY;

-- Name: kitchen_inventory tenant_kitchen_inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_inventory ON public.kitchen_inventory USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: kitchen_inventory set_kitchen_inventory_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_kitchen_inventory_updated BEFORE UPDATE ON public.kitchen_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: kitchen_inventory trg_kitchen_inventory_soft_delete_3cfb93a9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kitchen_inventory_soft_delete_3cfb93a9 BEFORE DELETE ON public.kitchen_inventory FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.kitchen_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    meal_type public.meal_type NOT NULL,
    diet_type public.diet_type DEFAULT 'regular'::public.diet_type NOT NULL,
    item_name text NOT NULL,
    description text,
    calories integer,
    protein_g numeric(6,1),
    carbs_g numeric(6,1),
    fat_g numeric(6,1),
    is_vegetarian boolean DEFAULT false NOT NULL,
    allergens jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT kitchen_menu_items_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

-- Name: kitchen_menu_items kitchen_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menu_items
    ADD CONSTRAINT kitchen_menu_items_pkey PRIMARY KEY (id);

CREATE INDEX idx_kitchen_menu_items_deleted_at_a716edeb ON public.kitchen_menu_items USING btree (deleted_at);

CREATE INDEX idx_kitchen_menu_items_menu ON public.kitchen_menu_items USING btree (tenant_id, menu_id);

ALTER TABLE public.kitchen_menu_items ENABLE ROW LEVEL SECURITY;

-- Name: kitchen_menu_items tenant_kitchen_menu_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_menu_items ON public.kitchen_menu_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: kitchen_menu_items trg_kitchen_menu_items_soft_delete_a716edeb; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kitchen_menu_items_soft_delete_a716edeb BEFORE DELETE ON public.kitchen_menu_items FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.kitchen_menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    week_number integer,
    season text,
    is_active boolean DEFAULT true NOT NULL,
    valid_from date,
    valid_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: kitchen_menus kitchen_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menus
    ADD CONSTRAINT kitchen_menus_pkey PRIMARY KEY (id);

CREATE INDEX idx_kitchen_menus_deleted_at_4298750e ON public.kitchen_menus USING btree (deleted_at);

CREATE INDEX idx_kitchen_menus_tenant_id ON public.kitchen_menus USING btree (tenant_id);

ALTER TABLE public.kitchen_menus ENABLE ROW LEVEL SECURITY;

-- Name: kitchen_menus tenant_kitchen_menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_menus ON public.kitchen_menus USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: kitchen_menus set_kitchen_menus_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_kitchen_menus_updated BEFORE UPDATE ON public.kitchen_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Name: kitchen_menus trg_kitchen_menus_soft_delete_4298750e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_kitchen_menus_soft_delete_4298750e BEFORE DELETE ON public.kitchen_menus FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.meal_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    count_date date DEFAULT CURRENT_DATE NOT NULL,
    meal_type public.meal_type NOT NULL,
    ward text NOT NULL,
    total_beds integer DEFAULT 0 NOT NULL,
    occupied integer DEFAULT 0 NOT NULL,
    npo_count integer DEFAULT 0 NOT NULL,
    regular_count integer DEFAULT 0 NOT NULL,
    special_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: meal_counts meal_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_counts
    ADD CONSTRAINT meal_counts_pkey PRIMARY KEY (id);

-- Name: meal_counts meal_counts_tenant_id_count_date_meal_type_ward_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_counts
    ADD CONSTRAINT meal_counts_tenant_id_count_date_meal_type_ward_key UNIQUE (tenant_id, count_date, meal_type, ward);

CREATE INDEX idx_meal_counts_date ON public.meal_counts USING btree (tenant_id, count_date);

CREATE INDEX idx_meal_counts_deleted_at_230d1b8c ON public.meal_counts USING btree (deleted_at);

ALTER TABLE public.meal_counts ENABLE ROW LEVEL SECURITY;

-- Name: meal_counts tenant_meal_counts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_meal_counts ON public.meal_counts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: meal_counts trg_meal_counts_soft_delete_230d1b8c; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_meal_counts_soft_delete_230d1b8c BEFORE DELETE ON public.meal_counts FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

CREATE TABLE public.meal_preparations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    diet_order_id uuid NOT NULL,
    meal_type public.meal_type NOT NULL,
    meal_date date DEFAULT CURRENT_DATE NOT NULL,
    status public.meal_prep_status DEFAULT 'pending'::public.meal_prep_status NOT NULL,
    prepared_by uuid,
    prepared_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    delivered_to_ward text,
    delivered_to_bed text,
    patient_feedback text,
    feedback_rating integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT meal_preparations_feedback_rating_check CHECK (((feedback_rating >= 1) AND (feedback_rating <= 5)))
);

-- Name: meal_preparations meal_preparations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_preparations
    ADD CONSTRAINT meal_preparations_pkey PRIMARY KEY (id);

CREATE INDEX idx_meal_prep_date ON public.meal_preparations USING btree (tenant_id, meal_date, meal_type);

CREATE INDEX idx_meal_prep_order ON public.meal_preparations USING btree (tenant_id, diet_order_id);

CREATE INDEX idx_meal_preparations_deleted_at_6895fb02 ON public.meal_preparations USING btree (deleted_at);

ALTER TABLE public.meal_preparations ENABLE ROW LEVEL SECURITY;

-- Name: meal_preparations tenant_meal_preparations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_meal_preparations ON public.meal_preparations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: meal_preparations trg_meal_preparations_soft_delete_6895fb02; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_meal_preparations_soft_delete_6895fb02 BEFORE DELETE ON public.meal_preparations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Migration: 0273_nutrition_screening.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- MUST (Malnutrition Universal Screening Tool) nutritional screening. NABH requires every inpatient to
-- be screened for malnutrition risk at admission (within 24h), because malnutrition worsens outcomes,
-- delays healing and is easily missed. MUST sums three steps — BMI, unplanned weight loss, and an
-- acute-disease effect — into a 0-6 score banded low/medium/high, driving a dietitian referral. BMI and
-- the step scores are computed server-side from height/weight so the risk band can't be mis-added.

CREATE TABLE public.nutrition_screenings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid,
    height_cm double precision NOT NULL,
    weight_kg double precision NOT NULL,
    bmi double precision NOT NULL,
    weight_loss_percent double precision DEFAULT 0 NOT NULL,
    acute_disease_no_intake boolean DEFAULT false NOT NULL,
    bmi_score integer NOT NULL,
    weight_loss_score integer NOT NULL,
    acute_score integer NOT NULL,
    total_score integer NOT NULL,
    risk text NOT NULL,
    notes text,
    assessed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nutrition_screening_risk_check CHECK ((risk = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);

-- Name: nutrition_screenings nutrition_screenings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_screenings
    ADD CONSTRAINT nutrition_screenings_pkey PRIMARY KEY (id);

CREATE INDEX idx_nutrition_screening_patient ON public.nutrition_screenings USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.nutrition_screenings ENABLE ROW LEVEL SECURITY;

-- Name: nutrition_screenings nutrition_screenings_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nutrition_screenings_tenant_isolation ON public.nutrition_screenings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: diet_orders diet_orders_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_orders
    ADD CONSTRAINT diet_orders_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.diet_templates(id);

-- Name: kitchen_menu_items kitchen_menu_items_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menu_items
    ADD CONSTRAINT kitchen_menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.kitchen_menus(id) ON DELETE CASCADE;

-- Name: meal_preparations meal_preparations_diet_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_preparations
    ADD CONSTRAINT meal_preparations_diet_order_id_fkey FOREIGN KEY (diet_order_id) REFERENCES public.diet_orders(id);
