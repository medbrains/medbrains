-- ============================================================
-- MedBrains schema — module: onboarding
-- ============================================================

--
-- Name: onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    completed_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_complete boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: onboarding_progress onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_pkey PRIMARY KEY (id);



--
-- Name: onboarding_progress onboarding_progress_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_progress
    ADD CONSTRAINT onboarding_progress_tenant_id_key UNIQUE (tenant_id);



--
-- Name: idx_onboarding_progress_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_progress_tenant ON public.onboarding_progress USING btree (tenant_id);



--
-- Name: onboarding_progress trg_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_progress_updated_at BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: onboarding_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;


--
-- Name: onboarding_progress tenant_isolation_onboarding_progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_onboarding_progress ON public.onboarding_progress USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


