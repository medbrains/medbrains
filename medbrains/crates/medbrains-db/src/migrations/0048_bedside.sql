-- ============================================================
-- MedBrains schema — module: bedside
-- ============================================================

--
-- Name: bedside_education_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bedside_education_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    video_url text NOT NULL,
    thumbnail_url text,
    category text NOT NULL,
    condition_codes jsonb,
    language text DEFAULT 'en'::text,
    duration_seconds integer,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bedside_education_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bedside_education_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    video_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    watched_seconds integer DEFAULT 0,
    completed boolean DEFAULT false NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bedside_nurse_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bedside_nurse_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    request_type public.bedside_request_type NOT NULL,
    status public.bedside_request_status DEFAULT 'pending'::public.bedside_request_status NOT NULL,
    notes text,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    completed_by uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bedside_realtime_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bedside_realtime_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    pain_level integer,
    comfort_level integer,
    cleanliness_level integer,
    noise_level integer,
    staff_response integer,
    comments text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bedside_realtime_feedback_cleanliness_level_check CHECK (((cleanliness_level >= 1) AND (cleanliness_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_comfort_level_check CHECK (((comfort_level >= 1) AND (comfort_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_noise_level_check CHECK (((noise_level >= 1) AND (noise_level <= 5))),
    CONSTRAINT bedside_realtime_feedback_pain_level_check CHECK (((pain_level >= 0) AND (pain_level <= 10))),
    CONSTRAINT bedside_realtime_feedback_staff_response_check CHECK (((staff_response >= 1) AND (staff_response <= 5)))
);



--
-- Name: bedside_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bedside_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    bed_location text,
    device_id text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: bedside_education_videos bedside_education_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_videos
    ADD CONSTRAINT bedside_education_videos_pkey PRIMARY KEY (id);



--
-- Name: bedside_education_views bedside_education_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_pkey PRIMARY KEY (id);



--
-- Name: bedside_nurse_requests bedside_nurse_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_nurse_requests
    ADD CONSTRAINT bedside_nurse_requests_pkey PRIMARY KEY (id);



--
-- Name: bedside_realtime_feedback bedside_realtime_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_realtime_feedback
    ADD CONSTRAINT bedside_realtime_feedback_pkey PRIMARY KEY (id);



--
-- Name: bedside_sessions bedside_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_sessions
    ADD CONSTRAINT bedside_sessions_pkey PRIMARY KEY (id);



--
-- Name: idx_bedside_fb_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_fb_admission ON public.bedside_realtime_feedback USING btree (tenant_id, admission_id);



--
-- Name: idx_bedside_fb_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_fb_tenant ON public.bedside_realtime_feedback USING btree (tenant_id);



--
-- Name: idx_bedside_fb_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_fb_time ON public.bedside_realtime_feedback USING btree (tenant_id, submitted_at DESC);



--
-- Name: idx_bedside_req_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_req_admission ON public.bedside_nurse_requests USING btree (tenant_id, admission_id);



--
-- Name: idx_bedside_req_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_req_pending ON public.bedside_nurse_requests USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['pending'::public.bedside_request_status, 'acknowledged'::public.bedside_request_status]));



--
-- Name: idx_bedside_req_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_req_status ON public.bedside_nurse_requests USING btree (tenant_id, status);



--
-- Name: idx_bedside_req_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_req_tenant ON public.bedside_nurse_requests USING btree (tenant_id);



--
-- Name: idx_bedside_sess_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_sess_active ON public.bedside_sessions USING btree (tenant_id, is_active) WHERE (is_active = true);



--
-- Name: idx_bedside_sess_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_sess_admission ON public.bedside_sessions USING btree (tenant_id, admission_id);



--
-- Name: idx_bedside_sess_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_sess_tenant ON public.bedside_sessions USING btree (tenant_id);



--
-- Name: idx_bedside_vid_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_vid_category ON public.bedside_education_videos USING btree (tenant_id, category);



--
-- Name: idx_bedside_vid_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_vid_tenant ON public.bedside_education_videos USING btree (tenant_id);



--
-- Name: idx_bedside_views_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_views_patient ON public.bedside_education_views USING btree (tenant_id, patient_id);



--
-- Name: idx_bedside_views_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bedside_views_tenant ON public.bedside_education_views USING btree (tenant_id);



--
-- Name: bedside_nurse_requests trg_bedside_req_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_req_updated_at BEFORE UPDATE ON public.bedside_nurse_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bedside_education_videos trg_bedside_vid_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bedside_vid_updated_at BEFORE UPDATE ON public.bedside_education_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: bedside_education_views bedside_education_views_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bedside_education_views
    ADD CONSTRAINT bedside_education_views_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.bedside_education_videos(id);



--
-- Name: bedside_education_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bedside_education_videos ENABLE ROW LEVEL SECURITY;


--
-- Name: bedside_education_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bedside_education_views ENABLE ROW LEVEL SECURITY;


--
-- Name: bedside_nurse_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bedside_nurse_requests ENABLE ROW LEVEL SECURITY;


--
-- Name: bedside_realtime_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bedside_realtime_feedback ENABLE ROW LEVEL SECURITY;


--
-- Name: bedside_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bedside_sessions ENABLE ROW LEVEL SECURITY;


--
-- Name: bedside_education_videos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_education_videos USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bedside_education_views tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_education_views USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bedside_nurse_requests tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_nurse_requests USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bedside_realtime_feedback tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_realtime_feedback USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));



--
-- Name: bedside_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.bedside_sessions USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


