-- ============================================================
-- MedBrains schema — module: cssd
-- ============================================================

--
-- Name: cssd_indicator_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_indicator_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_id uuid NOT NULL,
    indicator_type public.indicator_type NOT NULL,
    indicator_brand text,
    indicator_lot text,
    result_pass boolean NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    read_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_instrument_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_instrument_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    set_code text NOT NULL,
    set_name text NOT NULL,
    department text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_instruments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_instruments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    barcode text NOT NULL,
    name text NOT NULL,
    category text,
    manufacturer text,
    status public.instrument_status DEFAULT 'available'::public.instrument_status NOT NULL,
    purchase_date date,
    lifecycle_uses integer DEFAULT 0 NOT NULL,
    max_uses integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_issuances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_issuances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_item_id uuid,
    set_id uuid,
    issued_to_department text NOT NULL,
    issued_to_patient_id uuid,
    issued_by uuid,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    returned_at timestamp with time zone,
    returned_by uuid,
    is_recalled boolean DEFAULT false NOT NULL,
    recall_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_load_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_load_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_id uuid NOT NULL,
    set_id uuid,
    instrument_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    pack_expiry_date date
);



--
-- Name: cssd_maintenance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_maintenance_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    sterilizer_id uuid NOT NULL,
    maintenance_type text NOT NULL,
    performed_by text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    next_due_at timestamp with time zone,
    findings text,
    actions_taken text,
    cost numeric(12,2),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_set_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_set_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    set_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL
);



--
-- Name: cssd_sterilization_loads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_sterilization_loads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    load_number text NOT NULL,
    sterilizer_id uuid NOT NULL,
    method public.sterilization_method NOT NULL,
    status public.load_status DEFAULT 'loading'::public.load_status NOT NULL,
    operator_id uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cycle_time_minutes integer,
    temperature_c numeric(5,1),
    pressure_psi numeric(5,1),
    is_flash boolean DEFAULT false NOT NULL,
    flash_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_sterilizers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cssd_sterilizers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    model text,
    serial_number text,
    method public.sterilization_method DEFAULT 'steam'::public.sterilization_method NOT NULL,
    chamber_size_liters numeric(10,2),
    location text,
    is_active boolean DEFAULT true NOT NULL,
    last_maintenance_at timestamp with time zone,
    next_maintenance_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: cssd_indicator_results cssd_indicator_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_indicator_results
    ADD CONSTRAINT cssd_indicator_results_pkey PRIMARY KEY (id);



--
-- Name: cssd_instrument_sets cssd_instrument_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instrument_sets
    ADD CONSTRAINT cssd_instrument_sets_pkey PRIMARY KEY (id);



--
-- Name: cssd_instrument_sets cssd_instrument_sets_tenant_id_set_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instrument_sets
    ADD CONSTRAINT cssd_instrument_sets_tenant_id_set_code_key UNIQUE (tenant_id, set_code);



--
-- Name: cssd_instruments cssd_instruments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instruments
    ADD CONSTRAINT cssd_instruments_pkey PRIMARY KEY (id);



--
-- Name: cssd_instruments cssd_instruments_tenant_id_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_instruments
    ADD CONSTRAINT cssd_instruments_tenant_id_barcode_key UNIQUE (tenant_id, barcode);



--
-- Name: cssd_issuances cssd_issuances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_pkey PRIMARY KEY (id);



--
-- Name: cssd_load_items cssd_load_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_pkey PRIMARY KEY (id);



--
-- Name: cssd_maintenance_logs cssd_maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_maintenance_logs
    ADD CONSTRAINT cssd_maintenance_logs_pkey PRIMARY KEY (id);



--
-- Name: cssd_set_items cssd_set_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_pkey PRIMARY KEY (id);



--
-- Name: cssd_set_items cssd_set_items_set_id_instrument_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_set_id_instrument_id_key UNIQUE (set_id, instrument_id);



--
-- Name: cssd_sterilization_loads cssd_sterilization_loads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_pkey PRIMARY KEY (id);



--
-- Name: cssd_sterilization_loads cssd_sterilization_loads_tenant_id_load_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_tenant_id_load_number_key UNIQUE (tenant_id, load_number);



--
-- Name: cssd_sterilizers cssd_sterilizers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilizers
    ADD CONSTRAINT cssd_sterilizers_pkey PRIMARY KEY (id);



--
-- Name: idx_cssd_indicators_load; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_indicators_load ON public.cssd_indicator_results USING btree (load_id);



--
-- Name: idx_cssd_instrument_sets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_instrument_sets_tenant ON public.cssd_instrument_sets USING btree (tenant_id);



--
-- Name: idx_cssd_instruments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_instruments_status ON public.cssd_instruments USING btree (tenant_id, status);



--
-- Name: idx_cssd_instruments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_instruments_tenant ON public.cssd_instruments USING btree (tenant_id);



--
-- Name: idx_cssd_issuances_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_issuances_department ON public.cssd_issuances USING btree (tenant_id, issued_to_department);



--
-- Name: idx_cssd_issuances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_issuances_tenant ON public.cssd_issuances USING btree (tenant_id);



--
-- Name: idx_cssd_load_items_load; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_load_items_load ON public.cssd_load_items USING btree (load_id);



--
-- Name: idx_cssd_loads_sterilizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_loads_sterilizer ON public.cssd_sterilization_loads USING btree (sterilizer_id);



--
-- Name: idx_cssd_loads_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_loads_tenant ON public.cssd_sterilization_loads USING btree (tenant_id);



--
-- Name: idx_cssd_maintenance_sterilizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cssd_maintenance_sterilizer ON public.cssd_maintenance_logs USING btree (sterilizer_id);



--
-- Name: cssd_instrument_sets set_cssd_instrument_sets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_instrument_sets_updated_at BEFORE UPDATE ON public.cssd_instrument_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cssd_instruments set_cssd_instruments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_instruments_updated_at BEFORE UPDATE ON public.cssd_instruments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cssd_sterilizers set_cssd_sterilizers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_cssd_sterilizers_updated_at BEFORE UPDATE ON public.cssd_sterilizers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: cssd_indicator_results cssd_indicator_results_load_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_indicator_results
    ADD CONSTRAINT cssd_indicator_results_load_id_fkey FOREIGN KEY (load_id) REFERENCES public.cssd_sterilization_loads(id);



--
-- Name: cssd_issuances cssd_issuances_load_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_load_item_id_fkey FOREIGN KEY (load_item_id) REFERENCES public.cssd_load_items(id);



--
-- Name: cssd_issuances cssd_issuances_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_issuances
    ADD CONSTRAINT cssd_issuances_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id);



--
-- Name: cssd_load_items cssd_load_items_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.cssd_instruments(id);



--
-- Name: cssd_load_items cssd_load_items_load_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_load_id_fkey FOREIGN KEY (load_id) REFERENCES public.cssd_sterilization_loads(id) ON DELETE CASCADE;



--
-- Name: cssd_load_items cssd_load_items_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_load_items
    ADD CONSTRAINT cssd_load_items_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id);



--
-- Name: cssd_maintenance_logs cssd_maintenance_logs_sterilizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_maintenance_logs
    ADD CONSTRAINT cssd_maintenance_logs_sterilizer_id_fkey FOREIGN KEY (sterilizer_id) REFERENCES public.cssd_sterilizers(id);



--
-- Name: cssd_set_items cssd_set_items_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.cssd_instruments(id);



--
-- Name: cssd_set_items cssd_set_items_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_set_items
    ADD CONSTRAINT cssd_set_items_set_id_fkey FOREIGN KEY (set_id) REFERENCES public.cssd_instrument_sets(id) ON DELETE CASCADE;



--
-- Name: cssd_sterilization_loads cssd_sterilization_loads_sterilizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cssd_sterilization_loads
    ADD CONSTRAINT cssd_sterilization_loads_sterilizer_id_fkey FOREIGN KEY (sterilizer_id) REFERENCES public.cssd_sterilizers(id);



--
-- Name: cssd_indicator_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_indicator_results ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_instrument_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_instrument_sets ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_instruments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_instruments ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_issuances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_issuances ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_load_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_load_items ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_maintenance_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_maintenance_logs ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_set_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_set_items ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_sterilization_loads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_sterilization_loads ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_sterilizers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cssd_sterilizers ENABLE ROW LEVEL SECURITY;


--
-- Name: cssd_indicator_results tenant_cssd_indicator_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_indicator_results ON public.cssd_indicator_results USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_instrument_sets tenant_cssd_instrument_sets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_instrument_sets ON public.cssd_instrument_sets USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_instruments tenant_cssd_instruments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_instruments ON public.cssd_instruments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_issuances tenant_cssd_issuances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_issuances ON public.cssd_issuances USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_load_items tenant_cssd_load_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_load_items ON public.cssd_load_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_maintenance_logs tenant_cssd_maintenance_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_maintenance_logs ON public.cssd_maintenance_logs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_set_items tenant_cssd_set_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_set_items ON public.cssd_set_items USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_sterilization_loads tenant_cssd_sterilization_loads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_sterilization_loads ON public.cssd_sterilization_loads USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: cssd_sterilizers tenant_cssd_sterilizers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_cssd_sterilizers ON public.cssd_sterilizers USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


