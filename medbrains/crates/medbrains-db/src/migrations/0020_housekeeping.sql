-- ============================================================
-- MedBrains schema — module: housekeeping
-- ============================================================

--
-- Name: biowaste_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biowaste_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid NOT NULL,
    waste_category public.waste_category NOT NULL,
    weight_kg numeric(10,3) NOT NULL,
    record_date date NOT NULL,
    container_count integer DEFAULT 1 NOT NULL,
    disposal_vendor text,
    manifest_number text,
    notes text,
    recorded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cleaning_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    area_type public.cleaning_area_type NOT NULL,
    location_id uuid,
    department_id uuid,
    frequency_hours integer DEFAULT 24 NOT NULL,
    checklist_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cleaning_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleaning_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_id uuid,
    location_id uuid,
    department_id uuid,
    area_type public.cleaning_area_type NOT NULL,
    task_date date DEFAULT CURRENT_DATE NOT NULL,
    assigned_to text,
    status public.cleaning_task_status DEFAULT 'pending'::public.cleaning_task_status NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    verified_by uuid,
    verified_at timestamp with time zone,
    checklist_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: laundry_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.laundry_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    batch_number text NOT NULL,
    items_count integer DEFAULT 0 NOT NULL,
    total_weight numeric(8,2),
    contamination_type public.linen_contamination_type DEFAULT 'regular'::public.linen_contamination_type NOT NULL,
    wash_formula text,
    wash_temperature integer,
    cycle_minutes integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    operator_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: linen_condemnations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linen_condemnations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    linen_item_id uuid,
    reason text NOT NULL,
    wash_count_at_condemn integer,
    condemned_by uuid,
    condemned_date date DEFAULT CURRENT_DATE NOT NULL,
    replacement_requested boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: linen_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linen_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    barcode text,
    item_type text NOT NULL,
    current_status public.linen_status DEFAULT 'clean'::public.linen_status NOT NULL,
    ward_id uuid,
    wash_count integer DEFAULT 0 NOT NULL,
    max_washes integer DEFAULT 150 NOT NULL,
    commissioned_date date,
    condemned_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: linen_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linen_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    linen_item_id uuid,
    movement_type text NOT NULL,
    from_ward uuid,
    to_ward uuid,
    quantity integer DEFAULT 1 NOT NULL,
    weight_kg numeric(8,2),
    contamination_type public.linen_contamination_type DEFAULT 'regular'::public.linen_contamination_type NOT NULL,
    batch_id uuid,
    recorded_by text,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: linen_par_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linen_par_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ward_id uuid,
    item_type text NOT NULL,
    par_level integer DEFAULT 0 NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pest_control_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pest_control_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    schedule_id uuid,
    treatment_date date NOT NULL,
    treatment_type text NOT NULL,
    chemicals_used text,
    areas_treated jsonb DEFAULT '[]'::jsonb NOT NULL,
    vendor_name text,
    certificate_no text,
    next_due date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: pest_control_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pest_control_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    location_id uuid,
    department_id uuid,
    pest_type text NOT NULL,
    frequency_months integer DEFAULT 3 NOT NULL,
    last_done date,
    next_due date,
    vendor_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: biowaste_records biowaste_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biowaste_records
    ADD CONSTRAINT biowaste_records_pkey PRIMARY KEY (id);



--
-- Name: cleaning_schedules cleaning_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_pkey PRIMARY KEY (id);



--
-- Name: cleaning_tasks cleaning_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_pkey PRIMARY KEY (id);



--
-- Name: laundry_batches laundry_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laundry_batches
    ADD CONSTRAINT laundry_batches_pkey PRIMARY KEY (id);



--
-- Name: linen_condemnations linen_condemnations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_pkey PRIMARY KEY (id);



--
-- Name: linen_items linen_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT linen_items_pkey PRIMARY KEY (id);



--
-- Name: linen_movements linen_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_pkey PRIMARY KEY (id);



--
-- Name: linen_par_levels linen_par_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT linen_par_levels_pkey PRIMARY KEY (id);



--
-- Name: pest_control_logs pest_control_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_logs
    ADD CONSTRAINT pest_control_logs_pkey PRIMARY KEY (id);



--
-- Name: pest_control_schedules pest_control_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_schedules
    ADD CONSTRAINT pest_control_schedules_pkey PRIMARY KEY (id);



--
-- Name: linen_items uq_linen_barcode; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_items
    ADD CONSTRAINT uq_linen_barcode UNIQUE (tenant_id, barcode);



--
-- Name: linen_par_levels uq_linen_par; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_par_levels
    ADD CONSTRAINT uq_linen_par UNIQUE (tenant_id, ward_id, item_type);



--
-- Name: idx_biowaste_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biowaste_date ON public.biowaste_records USING btree (tenant_id, record_date);



--
-- Name: idx_biowaste_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biowaste_dept ON public.biowaste_records USING btree (tenant_id, department_id);



--
-- Name: idx_biowaste_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biowaste_tenant ON public.biowaste_records USING btree (tenant_id);



--
-- Name: idx_cleaning_schedules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_schedules_tenant ON public.cleaning_schedules USING btree (tenant_id);



--
-- Name: idx_cleaning_tasks_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_date ON public.cleaning_tasks USING btree (tenant_id, task_date);



--
-- Name: idx_cleaning_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_status ON public.cleaning_tasks USING btree (tenant_id, status);



--
-- Name: idx_cleaning_tasks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleaning_tasks_tenant ON public.cleaning_tasks USING btree (tenant_id);



--
-- Name: idx_laundry_batches_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_laundry_batches_tenant ON public.laundry_batches USING btree (tenant_id);



--
-- Name: idx_linen_condemnations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linen_condemnations_tenant ON public.linen_condemnations USING btree (tenant_id);



--
-- Name: idx_linen_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linen_items_status ON public.linen_items USING btree (tenant_id, current_status);



--
-- Name: idx_linen_items_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linen_items_tenant ON public.linen_items USING btree (tenant_id);



--
-- Name: idx_linen_movements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linen_movements_tenant ON public.linen_movements USING btree (tenant_id);



--
-- Name: idx_linen_par_levels_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linen_par_levels_tenant ON public.linen_par_levels USING btree (tenant_id);



--
-- Name: idx_pest_control_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pest_control_logs_tenant ON public.pest_control_logs USING btree (tenant_id);



--
-- Name: idx_pest_control_schedules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pest_control_schedules_tenant ON public.pest_control_schedules USING btree (tenant_id);



--
-- Name: biowaste_records set_biowaste_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_biowaste_records_updated_at BEFORE UPDATE ON public.biowaste_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cleaning_schedules set_cleaning_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cleaning_schedules_updated_at BEFORE UPDATE ON public.cleaning_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cleaning_tasks set_cleaning_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cleaning_tasks_updated_at BEFORE UPDATE ON public.cleaning_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: laundry_batches set_laundry_batches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_laundry_batches_updated_at BEFORE UPDATE ON public.laundry_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: linen_condemnations set_linen_condemnations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_condemnations_updated_at BEFORE UPDATE ON public.linen_condemnations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: linen_items set_linen_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_items_updated_at BEFORE UPDATE ON public.linen_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: linen_movements set_linen_movements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_movements_updated_at BEFORE UPDATE ON public.linen_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: linen_par_levels set_linen_par_levels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_linen_par_levels_updated_at BEFORE UPDATE ON public.linen_par_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pest_control_logs set_pest_control_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_pest_control_logs_updated_at BEFORE UPDATE ON public.pest_control_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: pest_control_schedules set_pest_control_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_pest_control_schedules_updated_at BEFORE UPDATE ON public.pest_control_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cleaning_tasks cleaning_tasks_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleaning_tasks
    ADD CONSTRAINT cleaning_tasks_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.cleaning_schedules(id);



--
-- Name: linen_condemnations linen_condemnations_linen_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_condemnations
    ADD CONSTRAINT linen_condemnations_linen_item_id_fkey FOREIGN KEY (linen_item_id) REFERENCES public.linen_items(id);



--
-- Name: linen_movements linen_movements_linen_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linen_movements
    ADD CONSTRAINT linen_movements_linen_item_id_fkey FOREIGN KEY (linen_item_id) REFERENCES public.linen_items(id);



--
-- Name: pest_control_logs pest_control_logs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pest_control_logs
    ADD CONSTRAINT pest_control_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.pest_control_schedules(id);



--
-- Name: biowaste_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.biowaste_records ENABLE ROW LEVEL SECURITY;


--
-- Name: biowaste_records biowaste_records_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY biowaste_records_tenant ON public.biowaste_records USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: cleaning_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: cleaning_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;


--
-- Name: laundry_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.laundry_batches ENABLE ROW LEVEL SECURITY;


--
-- Name: linen_condemnations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linen_condemnations ENABLE ROW LEVEL SECURITY;


--
-- Name: linen_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linen_items ENABLE ROW LEVEL SECURITY;


--
-- Name: linen_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linen_movements ENABLE ROW LEVEL SECURITY;


--
-- Name: linen_par_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linen_par_levels ENABLE ROW LEVEL SECURITY;


--
-- Name: pest_control_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pest_control_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: pest_control_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pest_control_schedules ENABLE ROW LEVEL SECURITY;


--
-- Name: cleaning_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cleaning_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: cleaning_tasks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cleaning_tasks USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: laundry_batches tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.laundry_batches USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: linen_condemnations tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_condemnations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: linen_items tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: linen_movements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_movements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: linen_par_levels tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.linen_par_levels USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pest_control_logs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pest_control_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: pest_control_schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.pest_control_schedules USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


