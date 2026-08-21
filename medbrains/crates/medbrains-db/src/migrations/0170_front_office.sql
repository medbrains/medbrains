-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 6
-- Drops: none
-- front office — schema.
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



CREATE TABLE public.enquiry_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    caller_name text,
    caller_phone text,
    enquiry_type text DEFAULT 'general'::text NOT NULL,
    patient_id uuid,
    response_text text,
    handled_by uuid,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: enquiry_logs enquiry_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enquiry_logs
    ADD CONSTRAINT enquiry_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_enquiry_logs_deleted_at_c3127fe0 ON public.enquiry_logs USING btree (deleted_at);

CREATE INDEX idx_enquiry_logs_patient_id ON public.enquiry_logs USING btree (patient_id);

CREATE INDEX idx_enquiry_logs_tenant ON public.enquiry_logs USING btree (tenant_id);

ALTER TABLE public.enquiry_logs ENABLE ROW LEVEL SECURITY;

-- Name: enquiry_logs enquiry_logs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enquiry_logs_tenant ON public.enquiry_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: enquiry_logs trg_enquiry_logs_soft_delete_c3127fe0; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enquiry_logs_soft_delete_c3127fe0 BEFORE DELETE ON public.enquiry_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: enquiry_logs trg_enquiry_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enquiry_logs_updated_at BEFORE UPDATE ON public.enquiry_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0149_public_booking_otps.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Phone verification for public appointment booking (audit P1):
-- name+phone matching alone can book into the wrong patient record.

CREATE TABLE public.public_booking_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: public_booking_otps public_booking_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_booking_otps
    ADD CONSTRAINT public_booking_otps_pkey PRIMARY KEY (id);

CREATE INDEX idx_public_booking_otps_phone ON public.public_booking_otps USING btree (tenant_id, phone, created_at DESC);

ALTER TABLE public.public_booking_otps ENABLE ROW LEVEL SECURITY;

-- Name: public_booking_otps tenant_isolation_public_booking_otps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_public_booking_otps ON public.public_booking_otps USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TABLE public.visiting_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    ward_id uuid,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    max_visitors_per_patient integer DEFAULT 2 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT visiting_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

-- Name: visiting_hours visiting_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visiting_hours
    ADD CONSTRAINT visiting_hours_pkey PRIMARY KEY (id);

CREATE INDEX idx_visiting_hours_deleted_at_87baa8b2 ON public.visiting_hours USING btree (deleted_at);

CREATE INDEX idx_visiting_hours_tenant ON public.visiting_hours USING btree (tenant_id);

CREATE INDEX idx_visiting_hours_ward_id ON public.visiting_hours USING btree (ward_id);

ALTER TABLE public.visiting_hours ENABLE ROW LEVEL SECURITY;

-- Name: visiting_hours visiting_hours_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY visiting_hours_tenant ON public.visiting_hours USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: visiting_hours trg_visiting_hours_soft_delete_87baa8b2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visiting_hours_soft_delete_87baa8b2 BEFORE DELETE ON public.visiting_hours FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: visiting_hours trg_visiting_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visiting_hours_updated_at BEFORE UPDATE ON public.visiting_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.visitor_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    pass_id uuid NOT NULL,
    check_in_at timestamp with time zone DEFAULT now() NOT NULL,
    check_out_at timestamp with time zone,
    logged_by uuid,
    gate text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_out_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: visitor_logs visitor_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_pkey PRIMARY KEY (id);

CREATE INDEX idx_visitor_logs_deleted_at_4af7c04d ON public.visitor_logs USING btree (deleted_at);

CREATE INDEX idx_visitor_logs_pass ON public.visitor_logs USING btree (pass_id);

CREATE INDEX idx_visitor_logs_tenant ON public.visitor_logs USING btree (tenant_id);

ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

-- Name: visitor_logs visitor_logs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY visitor_logs_tenant ON public.visitor_logs USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: visitor_logs trg_visitor_logs_soft_delete_4af7c04d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_logs_soft_delete_4af7c04d BEFORE DELETE ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: visitor_logs trg_visitor_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_logs_updated_at BEFORE UPDATE ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.visitor_passes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    pass_number text NOT NULL,
    ward_id uuid,
    bed_number text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    status public.visitor_pass_status DEFAULT 'active'::public.visitor_pass_status NOT NULL,
    qr_code text,
    issued_by uuid,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: visitor_passes visitor_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_passes
    ADD CONSTRAINT visitor_passes_pkey PRIMARY KEY (id);

CREATE INDEX idx_visitor_passes_deleted_at_03ab835d ON public.visitor_passes USING btree (deleted_at);

CREATE INDEX idx_visitor_passes_registration ON public.visitor_passes USING btree (registration_id);

CREATE INDEX idx_visitor_passes_status ON public.visitor_passes USING btree (status);

CREATE INDEX idx_visitor_passes_tenant ON public.visitor_passes USING btree (tenant_id);

CREATE INDEX idx_visitor_passes_ward_id ON public.visitor_passes USING btree (ward_id);

ALTER TABLE public.visitor_passes ENABLE ROW LEVEL SECURITY;

-- Name: visitor_passes visitor_passes_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY visitor_passes_tenant ON public.visitor_passes USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: visitor_passes trg_visitor_passes_soft_delete_03ab835d; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_passes_soft_delete_03ab835d BEFORE DELETE ON public.visitor_passes FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: visitor_passes trg_visitor_passes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_passes_updated_at BEFORE UPDATE ON public.visitor_passes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.visitor_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    visitor_name text NOT NULL,
    phone text,
    id_type text,
    id_number text,
    photo_url text,
    relationship text,
    category public.visitor_category DEFAULT 'general'::public.visitor_category NOT NULL,
    patient_id uuid,
    ward_id uuid,
    purpose text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: visitor_registrations visitor_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_registrations
    ADD CONSTRAINT visitor_registrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_visitor_registrations_deleted_at_6c15caa2 ON public.visitor_registrations USING btree (deleted_at);

CREATE INDEX idx_visitor_registrations_patient ON public.visitor_registrations USING btree (patient_id);

CREATE INDEX idx_visitor_registrations_tenant ON public.visitor_registrations USING btree (tenant_id);

CREATE INDEX idx_visitor_registrations_ward_id ON public.visitor_registrations USING btree (ward_id);

ALTER TABLE public.visitor_registrations ENABLE ROW LEVEL SECURITY;

-- Name: visitor_registrations visitor_registrations_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY visitor_registrations_tenant ON public.visitor_registrations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: visitor_registrations trg_visitor_registrations_soft_delete_6c15caa2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_registrations_soft_delete_6c15caa2 BEFORE DELETE ON public.visitor_registrations FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: visitor_registrations trg_visitor_registrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visitor_registrations_updated_at BEFORE UPDATE ON public.visitor_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: visitor_logs visitor_logs_pass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_logs
    ADD CONSTRAINT visitor_logs_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES public.visitor_passes(id);

-- Name: visitor_passes visitor_passes_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_passes
    ADD CONSTRAINT visitor_passes_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.visitor_registrations(id);
