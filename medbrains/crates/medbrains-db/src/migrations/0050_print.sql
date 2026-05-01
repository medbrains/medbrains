-- ============================================================
-- MedBrains schema — module: print
-- ============================================================

--
-- Name: print_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_output_id uuid NOT NULL,
    printer_id uuid,
    status public.print_job_status DEFAULT 'queued'::public.print_job_status NOT NULL,
    copies integer DEFAULT 1 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    department_id uuid,
    submitted_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: printer_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printer_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    printer_type text DEFAULT 'laser'::text NOT NULL,
    connection_type text DEFAULT 'network'::text,
    connection_string text,
    department_id uuid,
    default_format public.print_format DEFAULT 'a4_portrait'::public.print_format NOT NULL,
    capabilities jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: print_jobs print_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_pkey PRIMARY KEY (id);



--
-- Name: printer_configs printer_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printer_configs
    ADD CONSTRAINT printer_configs_pkey PRIMARY KEY (id);



--
-- Name: idx_print_jobs_printer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_printer ON public.print_jobs USING btree (printer_id, status);



--
-- Name: idx_print_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_print_jobs_status ON public.print_jobs USING btree (tenant_id, status);



--
-- Name: print_jobs trg_print_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_print_jobs_updated_at BEFORE UPDATE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: printer_configs trg_printer_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_printer_configs_updated_at BEFORE UPDATE ON public.printer_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: print_jobs print_jobs_printer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_jobs
    ADD CONSTRAINT print_jobs_printer_id_fkey FOREIGN KEY (printer_id) REFERENCES public.printer_configs(id);



--
-- Name: print_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;


--
-- Name: print_jobs print_jobs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY print_jobs_tenant ON public.print_jobs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));



--
-- Name: printer_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;


--
-- Name: printer_configs printer_configs_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY printer_configs_tenant ON public.printer_configs USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


