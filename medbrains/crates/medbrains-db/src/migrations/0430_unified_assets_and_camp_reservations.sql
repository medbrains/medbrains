-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 3
-- Drops: none
-- unified assets and camp reservations — schema.
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



CREATE TABLE public.asset_classifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    asset_category_id uuid,
    store_category_id uuid,
    asset_domain text DEFAULT 'general'::text NOT NULL,
    criticality text DEFAULT 'routine'::text NOT NULL,
    custody_mode text DEFAULT 'asset_tagged'::text NOT NULL,
    is_camp_eligible boolean DEFAULT false NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT asset_classifications_criticality_check CHECK ((criticality = ANY (ARRAY['critical'::text, 'high'::text, 'routine'::text, 'low'::text]))),
    CONSTRAINT asset_classifications_custody_mode_check CHECK ((custody_mode = ANY (ARRAY['asset_tagged'::text, 'serialised'::text, 'pooled'::text, 'non_movable'::text]))),
    CONSTRAINT asset_classifications_source_type_check CHECK ((source_type = ANY (ARRAY['bme_equipment'::text, 'equipment'::text, 'fms_fire_equipment'::text, 'cssd_instrument'::text, 'cssd_sterilizer'::text, 'linen_item'::text, 'ambulance'::text, 'it_device'::text, 'vehicle'::text, 'other'::text])))
);

-- Name: asset_classifications asset_classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_classifications
    ADD CONSTRAINT asset_classifications_pkey PRIMARY KEY (id);

-- Name: asset_classifications asset_classifications_tenant_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_classifications
    ADD CONSTRAINT asset_classifications_tenant_source_key UNIQUE (tenant_id, source_type, source_id);

CREATE INDEX idx_asset_classifications_category ON public.asset_classifications USING btree (tenant_id, asset_category_id) WHERE (asset_category_id IS NOT NULL);

CREATE INDEX idx_asset_classifications_deleted_at_115e0400 ON public.asset_classifications USING btree (deleted_at);

CREATE INDEX idx_asset_classifications_source ON public.asset_classifications USING btree (tenant_id, source_type, source_id);

ALTER TABLE public.asset_classifications ENABLE ROW LEVEL SECURITY;

-- Name: asset_classifications asset_classifications_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asset_classifications_tenant ON public.asset_classifications USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: asset_classifications trg_asset_classifications_soft_delete_115e0400; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_classifications_soft_delete_115e0400 BEFORE DELETE ON public.asset_classifications FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: asset_classifications trg_asset_classifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_classifications_updated_at BEFORE UPDATE ON public.asset_classifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.camp_asset_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    asset_classification_id uuid,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    asset_category_id uuid,
    asset_code text,
    asset_name text NOT NULL,
    asset_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    required_from timestamp with time zone,
    required_to timestamp with time zone,
    quantity integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    requested_by uuid,
    reserved_by uuid,
    reserved_at timestamp with time zone,
    issued_by uuid,
    issued_to uuid,
    issued_at timestamp with time zone,
    returned_by uuid,
    returned_at timestamp with time zone,
    issue_condition text,
    return_condition text,
    damage_notes text,
    loss_notes text,
    reconciliation_notes text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT camp_asset_reservations_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT camp_asset_reservations_source_type_check CHECK ((source_type = ANY (ARRAY['bme_equipment'::text, 'equipment'::text, 'fms_fire_equipment'::text, 'cssd_instrument'::text, 'cssd_sterilizer'::text, 'linen_item'::text, 'ambulance'::text, 'it_device'::text, 'vehicle'::text, 'other'::text]))),
    CONSTRAINT camp_asset_reservations_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'reserved'::text, 'issued'::text, 'returned'::text, 'damaged'::text, 'lost'::text, 'cancelled'::text])))
);

-- Name: camp_asset_reservations camp_asset_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_asset_reservations
    ADD CONSTRAINT camp_asset_reservations_pkey PRIMARY KEY (id);

CREATE INDEX idx_camp_asset_reservations_camp ON public.camp_asset_reservations USING btree (tenant_id, camp_id, status);

CREATE INDEX idx_camp_asset_reservations_deleted_at_3ea0b1f9 ON public.camp_asset_reservations USING btree (deleted_at);

CREATE INDEX idx_camp_asset_reservations_return ON public.camp_asset_reservations USING btree (tenant_id, camp_id) WHERE (status = ANY (ARRAY['issued'::text, 'damaged'::text, 'lost'::text]));

CREATE INDEX idx_camp_asset_reservations_soft_delete ON public.camp_asset_reservations USING btree (tenant_id, deleted_at);

CREATE INDEX idx_camp_asset_reservations_source ON public.camp_asset_reservations USING btree (tenant_id, source_type, source_id, status);

ALTER TABLE public.camp_asset_reservations ENABLE ROW LEVEL SECURITY;

-- Name: camp_asset_reservations camp_asset_reservations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY camp_asset_reservations_tenant ON public.camp_asset_reservations USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));

-- Name: camp_asset_reservations trg_camp_asset_reservations_soft_delete_3ea0b1f9; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_asset_reservations_soft_delete_3ea0b1f9 BEFORE DELETE ON public.camp_asset_reservations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: camp_asset_reservations trg_camp_asset_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_camp_asset_reservations_updated_at BEFORE UPDATE ON public.camp_asset_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.store_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    store_domain text DEFAULT 'general'::text NOT NULL,
    description text,
    requires_batch_tracking boolean DEFAULT false NOT NULL,
    requires_expiry_tracking boolean DEFAULT false NOT NULL,
    requires_temperature_log boolean DEFAULT false NOT NULL,
    requires_license_tracking boolean DEFAULT false NOT NULL,
    is_camp_source boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT store_categories_domain_check CHECK ((store_domain = ANY (ARRAY['pharmacy'::text, 'ndps_controlled'::text, 'medical_consumables'::text, 'surgical_consumables'::text, 'lab_reagents'::text, 'cssd_sterile'::text, 'linen_laundry'::text, 'kitchen_dietary'::text, 'housekeeping'::text, 'biomedical_spares'::text, 'it_store'::text, 'maintenance_engineering'::text, 'ppe_infection_control'::text, 'biomedical_waste'::text, 'blood_bank'::text, 'radiology_contrast'::text, 'stationery_forms'::text, 'camp_mobile'::text, 'general'::text])))
);

-- Name: store_categories store_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_categories
    ADD CONSTRAINT store_categories_pkey PRIMARY KEY (id);

-- Name: store_categories store_categories_tenant_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_categories
    ADD CONSTRAINT store_categories_tenant_code_key UNIQUE (tenant_id, code);

CREATE INDEX idx_store_categories_deleted_at_37378e4e ON public.store_categories USING btree (deleted_at);

CREATE INDEX idx_store_categories_tenant_domain ON public.store_categories USING btree (tenant_id, store_domain, is_active);

ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

-- Name: store_categories store_categories_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_categories_tenant ON public.store_categories USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));

-- Name: store_categories trg_store_categories_soft_delete_37378e4e; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_categories_soft_delete_37378e4e BEFORE DELETE ON public.store_categories FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: store_categories trg_store_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_store_categories_updated_at BEFORE UPDATE ON public.store_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: asset_classifications asset_classifications_store_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_classifications
    ADD CONSTRAINT asset_classifications_store_category_id_fkey FOREIGN KEY (store_category_id) REFERENCES public.store_categories(id);

-- Name: camp_asset_reservations camp_asset_reservations_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camp_asset_reservations
    ADD CONSTRAINT camp_asset_reservations_classification_id_fkey FOREIGN KEY (asset_classification_id) REFERENCES public.asset_classifications(id);

-- Name: store_categories store_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_categories
    ADD CONSTRAINT store_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.store_categories(id);
