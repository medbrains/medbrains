-- ============================================================
-- MedBrains schema — module: orders
-- ============================================================

--
-- Name: medication_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_timeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrollment_id uuid,
    prescription_item_id uuid,
    encounter_id uuid,
    event_type public.medication_event_type NOT NULL,
    drug_name text NOT NULL,
    generic_name text,
    atc_code text,
    catalog_item_id uuid,
    dosage text,
    frequency text,
    route text,
    previous_dosage text,
    previous_frequency text,
    change_reason text,
    switched_from_drug text,
    ordered_by uuid NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    is_auto_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: order_basket_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_basket_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    items jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.order_basket_drafts FORCE ROW LEVEL SECURITY;



--
-- Name: order_basket_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_basket_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    patient_id uuid,
    signed_by uuid NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    items_count integer NOT NULL,
    items_snapshot jsonb NOT NULL,
    warnings_returned jsonb DEFAULT '[]'::jsonb NOT NULL,
    warnings_acknowledged jsonb DEFAULT '[]'::jsonb NOT NULL,
    override_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_order_ids jsonb NOT NULL,
    client_session_id text,
    device_id text,
    CONSTRAINT order_basket_signatures_items_count_check CHECK ((items_count > 0))
);

ALTER TABLE ONLY public.order_basket_signatures FORCE ROW LEVEL SECURITY;



--
-- Name: order_set_activation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_set_activation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    activation_id uuid NOT NULL,
    template_item_id uuid,
    item_type public.order_set_item_type NOT NULL,
    was_selected boolean DEFAULT true NOT NULL,
    skip_reason text,
    lab_order_id uuid,
    prescription_id uuid,
    nursing_task_id uuid,
    diet_order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: order_set_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_set_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    template_version integer NOT NULL,
    encounter_id uuid,
    patient_id uuid NOT NULL,
    admission_id uuid,
    activated_by uuid,
    diagnosis_icd text,
    total_items integer DEFAULT 0 NOT NULL,
    selected_items integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: order_set_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_set_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    item_type public.order_set_item_type NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    default_selected boolean DEFAULT true NOT NULL,
    lab_test_id uuid,
    lab_priority text,
    lab_notes text,
    drug_catalog_id uuid,
    drug_name text,
    dosage text,
    frequency text,
    duration text,
    route text,
    med_instructions text,
    task_type text,
    task_description text,
    task_frequency text,
    diet_template_id uuid,
    diet_type text,
    diet_instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: order_set_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_set_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    context public.order_set_context DEFAULT 'general'::public.order_set_context NOT NULL,
    department_id uuid,
    trigger_diagnoses text[] DEFAULT '{}'::text[],
    surgery_type text,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    parent_template_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: order_set_usage_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_set_usage_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    activation_count integer DEFAULT 0 NOT NULL,
    unique_doctors integer DEFAULT 0 NOT NULL,
    items_ordered integer DEFAULT 0 NOT NULL,
    items_skipped integer DEFAULT 0 NOT NULL,
    completion_rate numeric(5,2) DEFAULT 0 NOT NULL
);



--
-- Name: procedure_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedure_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    department_id uuid,
    category text,
    base_price numeric(12,2),
    duration_minutes integer,
    requires_consent boolean DEFAULT false NOT NULL,
    requires_anesthesia boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: procedure_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedure_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    procedure_id uuid NOT NULL,
    ordered_by uuid NOT NULL,
    performed_by uuid,
    priority text DEFAULT 'routine'::text NOT NULL,
    status text DEFAULT 'ordered'::text NOT NULL,
    scheduled_date date,
    scheduled_time time without time zone,
    notes text,
    findings text,
    complications text,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procedure_orders_priority_check CHECK ((priority = ANY (ARRAY['routine'::text, 'urgent'::text, 'stat'::text]))),
    CONSTRAINT procedure_orders_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);



--
-- Name: medication_timeline_events medication_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_timeline_events
    ADD CONSTRAINT medication_timeline_events_pkey PRIMARY KEY (id);



--
-- Name: order_basket_drafts order_basket_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_pkey PRIMARY KEY (id);



--
-- Name: order_basket_drafts order_basket_drafts_tenant_id_encounter_id_owner_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_drafts
    ADD CONSTRAINT order_basket_drafts_tenant_id_encounter_id_owner_user_id_key UNIQUE (tenant_id, encounter_id, owner_user_id);



--
-- Name: order_basket_signatures order_basket_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_basket_signatures
    ADD CONSTRAINT order_basket_signatures_pkey PRIMARY KEY (id);



--
-- Name: order_set_activation_items order_set_activation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_pkey PRIMARY KEY (id);



--
-- Name: order_set_activations order_set_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_pkey PRIMARY KEY (id);



--
-- Name: order_set_template_items order_set_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_pkey PRIMARY KEY (id);



--
-- Name: order_set_templates order_set_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_pkey PRIMARY KEY (id);



--
-- Name: order_set_usage_stats order_set_usage_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_pkey PRIMARY KEY (id);



--
-- Name: order_set_usage_stats order_set_usage_stats_tenant_id_template_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_tenant_id_template_id_period_start_key UNIQUE (tenant_id, template_id, period_start);



--
-- Name: procedure_catalog procedure_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_pkey PRIMARY KEY (id);



--
-- Name: procedure_catalog procedure_catalog_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_catalog
    ADD CONSTRAINT procedure_catalog_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: procedure_orders procedure_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_pkey PRIMARY KEY (id);



--
-- Name: idx_med_timeline_drug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_med_timeline_drug ON public.medication_timeline_events USING btree (tenant_id, patient_id, drug_name, effective_date);



--
-- Name: idx_med_timeline_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_med_timeline_enrollment ON public.medication_timeline_events USING btree (enrollment_id) WHERE (enrollment_id IS NOT NULL);



--
-- Name: idx_med_timeline_patient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_med_timeline_patient_date ON public.medication_timeline_events USING btree (tenant_id, patient_id, effective_date);



--
-- Name: idx_order_set_activation_items_activation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_activation_items_activation ON public.order_set_activation_items USING btree (activation_id);



--
-- Name: idx_order_set_activations_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_activations_encounter ON public.order_set_activations USING btree (encounter_id);



--
-- Name: idx_order_set_activations_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_activations_patient ON public.order_set_activations USING btree (patient_id);



--
-- Name: idx_order_set_activations_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_activations_template ON public.order_set_activations USING btree (template_id);



--
-- Name: idx_order_set_template_items_template_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_template_items_template_sort ON public.order_set_template_items USING btree (template_id, sort_order);



--
-- Name: idx_order_set_templates_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_templates_parent ON public.order_set_templates USING btree (parent_template_id) WHERE (parent_template_id IS NOT NULL);



--
-- Name: idx_order_set_templates_tenant_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_templates_tenant_context ON public.order_set_templates USING btree (tenant_id, context);



--
-- Name: idx_order_set_templates_tenant_current_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_templates_tenant_current_active ON public.order_set_templates USING btree (tenant_id, is_current, is_active);



--
-- Name: idx_order_set_templates_trigger_diagnoses; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_set_templates_trigger_diagnoses ON public.order_set_templates USING gin (trigger_diagnoses);



--
-- Name: idx_procedure_catalog_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_catalog_active ON public.procedure_catalog USING btree (tenant_id) WHERE (is_active = true);



--
-- Name: idx_procedure_catalog_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_catalog_tenant ON public.procedure_catalog USING btree (tenant_id);



--
-- Name: idx_procedure_orders_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_orders_encounter ON public.procedure_orders USING btree (encounter_id);



--
-- Name: idx_procedure_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_orders_patient ON public.procedure_orders USING btree (tenant_id, patient_id);



--
-- Name: idx_procedure_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_orders_status ON public.procedure_orders USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['ordered'::text, 'scheduled'::text, 'in_progress'::text]));



--
-- Name: idx_procedure_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_orders_tenant ON public.procedure_orders USING btree (tenant_id);



--
-- Name: order_basket_drafts_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_basket_drafts_encounter_idx ON public.order_basket_drafts USING btree (tenant_id, encounter_id);



--
-- Name: order_basket_drafts_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_basket_drafts_owner_idx ON public.order_basket_drafts USING btree (tenant_id, owner_user_id);



--
-- Name: order_basket_signatures_encounter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_basket_signatures_encounter_idx ON public.order_basket_signatures USING btree (tenant_id, encounter_id, signed_at DESC);



--
-- Name: order_basket_signatures_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_basket_signatures_patient_idx ON public.order_basket_signatures USING btree (tenant_id, patient_id, signed_at DESC) WHERE (patient_id IS NOT NULL);



--
-- Name: order_basket_signatures_signed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_basket_signatures_signed_by_idx ON public.order_basket_signatures USING btree (tenant_id, signed_by, signed_at DESC);



--
-- Name: order_basket_drafts order_basket_drafts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_basket_drafts_updated BEFORE UPDATE ON public.order_basket_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: procedure_catalog set_updated_at_procedure_catalog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_procedure_catalog BEFORE UPDATE ON public.procedure_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: procedure_orders set_updated_at_procedure_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_procedure_orders BEFORE UPDATE ON public.procedure_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: order_set_templates trg_order_set_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_set_templates_updated_at BEFORE UPDATE ON public.order_set_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: order_set_activation_items order_set_activation_items_activation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_activation_id_fkey FOREIGN KEY (activation_id) REFERENCES public.order_set_activations(id) ON DELETE CASCADE;



--
-- Name: order_set_activation_items order_set_activation_items_template_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activation_items
    ADD CONSTRAINT order_set_activation_items_template_item_id_fkey FOREIGN KEY (template_item_id) REFERENCES public.order_set_template_items(id);



--
-- Name: order_set_activations order_set_activations_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_activations
    ADD CONSTRAINT order_set_activations_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id);



--
-- Name: order_set_template_items order_set_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_template_items
    ADD CONSTRAINT order_set_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id) ON DELETE CASCADE;



--
-- Name: order_set_templates order_set_templates_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_templates
    ADD CONSTRAINT order_set_templates_parent_template_id_fkey FOREIGN KEY (parent_template_id) REFERENCES public.order_set_templates(id);



--
-- Name: order_set_usage_stats order_set_usage_stats_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_set_usage_stats
    ADD CONSTRAINT order_set_usage_stats_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.order_set_templates(id);



--
-- Name: procedure_orders procedure_orders_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_orders
    ADD CONSTRAINT procedure_orders_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.procedure_catalog(id);



--
-- Name: medication_timeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_timeline_events ENABLE ROW LEVEL SECURITY;


--
-- Name: order_basket_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_basket_drafts ENABLE ROW LEVEL SECURITY;


--
-- Name: order_basket_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_basket_signatures ENABLE ROW LEVEL SECURITY;


--
-- Name: order_set_activation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_set_activation_items ENABLE ROW LEVEL SECURITY;


--
-- Name: order_set_activations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_set_activations ENABLE ROW LEVEL SECURITY;


--
-- Name: order_set_template_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_set_template_items ENABLE ROW LEVEL SECURITY;


--
-- Name: order_set_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_set_templates ENABLE ROW LEVEL SECURITY;


--
-- Name: order_set_usage_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_set_usage_stats ENABLE ROW LEVEL SECURITY;


--
-- Name: procedure_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedure_catalog ENABLE ROW LEVEL SECURITY;


--
-- Name: procedure_catalog procedure_catalog_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_catalog_tenant ON public.procedure_catalog USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: procedure_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedure_orders ENABLE ROW LEVEL SECURITY;


--
-- Name: procedure_orders procedure_orders_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procedure_orders_tenant ON public.procedure_orders USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: medication_timeline_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.medication_timeline_events USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: order_basket_drafts tenant_isolation_order_basket_drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_basket_drafts ON public.order_basket_drafts USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_basket_signatures tenant_isolation_order_basket_signatures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_basket_signatures ON public.order_basket_signatures USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_set_activation_items tenant_isolation_order_set_activation_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_activation_items ON public.order_set_activation_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_set_activations tenant_isolation_order_set_activations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_activations ON public.order_set_activations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_set_template_items tenant_isolation_order_set_template_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_template_items ON public.order_set_template_items USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_set_templates tenant_isolation_order_set_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_templates ON public.order_set_templates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: order_set_usage_stats tenant_isolation_order_set_usage_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_order_set_usage_stats ON public.order_set_usage_stats USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


