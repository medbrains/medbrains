-- ============================================================
-- MedBrains schema — module: diet
-- ============================================================

--
-- Name: diet_orders; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: diet_templates; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: kitchen_audits; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT kitchen_audits_hygiene_score_check CHECK (((hygiene_score >= 0) AND (hygiene_score <= 100)))
);



--
-- Name: kitchen_inventory; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: kitchen_menu_items; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT kitchen_menu_items_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);



--
-- Name: kitchen_menus; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: meal_counts; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: meal_preparations; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT meal_preparations_feedback_rating_check CHECK (((feedback_rating >= 1) AND (feedback_rating <= 5)))
);



--
-- Name: diet_orders diet_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_orders
    ADD CONSTRAINT diet_orders_pkey PRIMARY KEY (id);



--
-- Name: diet_templates diet_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_templates
    ADD CONSTRAINT diet_templates_pkey PRIMARY KEY (id);



--
-- Name: kitchen_audits kitchen_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_audits
    ADD CONSTRAINT kitchen_audits_pkey PRIMARY KEY (id);



--
-- Name: kitchen_inventory kitchen_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_inventory
    ADD CONSTRAINT kitchen_inventory_pkey PRIMARY KEY (id);



--
-- Name: kitchen_menu_items kitchen_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menu_items
    ADD CONSTRAINT kitchen_menu_items_pkey PRIMARY KEY (id);



--
-- Name: kitchen_menus kitchen_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menus
    ADD CONSTRAINT kitchen_menus_pkey PRIMARY KEY (id);



--
-- Name: meal_counts meal_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_counts
    ADD CONSTRAINT meal_counts_pkey PRIMARY KEY (id);



--
-- Name: meal_counts meal_counts_tenant_id_count_date_meal_type_ward_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_counts
    ADD CONSTRAINT meal_counts_tenant_id_count_date_meal_type_ward_key UNIQUE (tenant_id, count_date, meal_type, ward);



--
-- Name: meal_preparations meal_preparations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_preparations
    ADD CONSTRAINT meal_preparations_pkey PRIMARY KEY (id);



--
-- Name: idx_diet_orders_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diet_orders_admission ON public.diet_orders USING btree (tenant_id, admission_id) WHERE (admission_id IS NOT NULL);



--
-- Name: idx_diet_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diet_orders_patient ON public.diet_orders USING btree (tenant_id, patient_id);



--
-- Name: idx_diet_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diet_orders_status ON public.diet_orders USING btree (tenant_id, status);



--
-- Name: idx_kitchen_audits_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_audits_date ON public.kitchen_audits USING btree (tenant_id, audit_date);



--
-- Name: idx_kitchen_inventory_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_inventory_name ON public.kitchen_inventory USING btree (tenant_id, item_name);



--
-- Name: idx_kitchen_menu_items_menu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_menu_items_menu ON public.kitchen_menu_items USING btree (tenant_id, menu_id);



--
-- Name: idx_meal_counts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meal_counts_date ON public.meal_counts USING btree (tenant_id, count_date);



--
-- Name: idx_meal_prep_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meal_prep_date ON public.meal_preparations USING btree (tenant_id, meal_date, meal_type);



--
-- Name: idx_meal_prep_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meal_prep_order ON public.meal_preparations USING btree (tenant_id, diet_order_id);



--
-- Name: diet_orders set_diet_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_diet_orders_updated BEFORE UPDATE ON public.diet_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: diet_templates set_diet_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_diet_templates_updated BEFORE UPDATE ON public.diet_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: kitchen_inventory set_kitchen_inventory_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_kitchen_inventory_updated BEFORE UPDATE ON public.kitchen_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: kitchen_menus set_kitchen_menus_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_kitchen_menus_updated BEFORE UPDATE ON public.kitchen_menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: diet_orders diet_orders_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_orders
    ADD CONSTRAINT diet_orders_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.diet_templates(id);



--
-- Name: kitchen_menu_items kitchen_menu_items_menu_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_menu_items
    ADD CONSTRAINT kitchen_menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES public.kitchen_menus(id) ON DELETE CASCADE;



--
-- Name: meal_preparations meal_preparations_diet_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_preparations
    ADD CONSTRAINT meal_preparations_diet_order_id_fkey FOREIGN KEY (diet_order_id) REFERENCES public.diet_orders(id);



--
-- Name: diet_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diet_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: diet_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diet_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: kitchen_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_audits ENABLE ROW LEVEL SECURITY;


--
-- Name: kitchen_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_inventory ENABLE ROW LEVEL SECURITY;


--
-- Name: kitchen_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_menu_items ENABLE ROW LEVEL SECURITY;


--
-- Name: kitchen_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_menus ENABLE ROW LEVEL SECURITY;


--
-- Name: meal_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meal_counts ENABLE ROW LEVEL SECURITY;


--
-- Name: meal_preparations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meal_preparations ENABLE ROW LEVEL SECURITY;


--
-- Name: diet_orders tenant_diet_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_diet_orders ON public.diet_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: diet_templates tenant_diet_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_diet_templates ON public.diet_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: kitchen_audits tenant_kitchen_audits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_audits ON public.kitchen_audits USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: kitchen_inventory tenant_kitchen_inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_inventory ON public.kitchen_inventory USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: kitchen_menu_items tenant_kitchen_menu_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_menu_items ON public.kitchen_menu_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: kitchen_menus tenant_kitchen_menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_kitchen_menus ON public.kitchen_menus USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: meal_counts tenant_meal_counts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_meal_counts ON public.meal_counts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: meal_preparations tenant_meal_preparations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_meal_preparations ON public.meal_preparations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


