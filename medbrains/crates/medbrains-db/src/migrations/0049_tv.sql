-- ============================================================
-- MedBrains schema — module: tv
-- ============================================================

--
-- Name: tv_announcements; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT tv_announcements_priority_check CHECK (((priority)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'emergency'::character varying])::text[])))
);



--
-- Name: tv_displays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tv_displays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tv_displays FORCE ROW LEVEL SECURITY;



--
-- Name: tv_announcements tv_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_announcements
    ADD CONSTRAINT tv_announcements_pkey PRIMARY KEY (id);



--
-- Name: tv_displays tv_displays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tv_displays
    ADD CONSTRAINT tv_displays_pkey PRIMARY KEY (id);



--
-- Name: idx_tv_announcements_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tv_announcements_active ON public.tv_announcements USING btree (tenant_id, starts_at, ends_at) WHERE (ends_at IS NULL);



--
-- Name: idx_tv_announcements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tv_announcements_tenant ON public.tv_announcements USING btree (tenant_id);



--
-- Name: tv_announcements trg_tv_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tv_announcements_updated_at BEFORE UPDATE ON public.tv_announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: tv_displays tenant_isolation_tv_displays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tv_displays ON public.tv_displays USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tv_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tv_announcements ENABLE ROW LEVEL SECURITY;


--
-- Name: tv_announcements tv_announcements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tv_announcements_tenant ON public.tv_announcements USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: tv_displays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tv_displays ENABLE ROW LEVEL SECURITY;

