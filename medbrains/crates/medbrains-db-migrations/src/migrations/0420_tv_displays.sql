-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 2
-- Drops: none
-- tv displays — schema.
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



CREATE TABLE public.tv_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    message text NOT NULL,
    priority character varying(20) DEFAULT 'info'::character varying NOT NULL,
    display_ids uuid[],
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    CONSTRAINT tv_announcements_priority_check CHECK (((priority)::text = ANY (ARRAY[('info'::character varying)::text, ('warning'::character varying)::text, ('emergency'::character varying)::text])))
);

-- Name: tv_announcements tv_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_announcements
    ADD CONSTRAINT tv_announcements_pkey PRIMARY KEY (id);

CREATE INDEX idx_tv_announcements_active ON public.tv_announcements USING btree (tenant_id, starts_at, ends_at) WHERE (ends_at IS NULL);

CREATE INDEX idx_tv_announcements_deleted_at_1fe11f50 ON public.tv_announcements USING btree (deleted_at);

CREATE INDEX idx_tv_announcements_tenant ON public.tv_announcements USING btree (tenant_id);

ALTER TABLE public.tv_announcements ENABLE ROW LEVEL SECURITY;

-- Name: tv_announcements tv_announcements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tv_announcements_tenant ON public.tv_announcements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tv_announcements trg_tv_announcements_soft_delete_1fe11f50; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tv_announcements_soft_delete_1fe11f50 BEFORE DELETE ON public.tv_announcements FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- Name: tv_announcements trg_tv_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tv_announcements_updated_at BEFORE UPDATE ON public.tv_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.tv_displays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    room_number text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);

-- Name: tv_displays tv_displays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_displays
    ADD CONSTRAINT tv_displays_pkey PRIMARY KEY (id);

CREATE INDEX idx_tv_displays_deleted_at_d2b00e67 ON public.tv_displays USING btree (deleted_at);

CREATE INDEX idx_tv_displays_department_id ON public.tv_displays USING btree (department_id);

CREATE INDEX idx_tv_displays_tenant_id ON public.tv_displays USING btree (tenant_id);

ALTER TABLE ONLY public.tv_displays FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tv_displays ENABLE ROW LEVEL SECURITY;

-- Name: tv_displays tenant_isolation_tv_displays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tv_displays ON public.tv_displays USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tv_displays trg_tv_displays_soft_delete_d2b00e67; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tv_displays_soft_delete_d2b00e67 BEFORE DELETE ON public.tv_displays FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();
