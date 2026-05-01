-- ============================================================
-- MedBrains schema — module: lms
-- ============================================================

--
-- Name: lms_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid,
    path_id uuid,
    enrollment_id uuid,
    certificate_no text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at date,
    issued_by uuid,
    training_record_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_course_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_course_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    duration_hours numeric(5,1),
    is_mandatory boolean DEFAULT false NOT NULL,
    target_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    thumbnail_url text,
    content_type public.lms_content_type DEFAULT 'text'::public.lms_content_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    training_program_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    status public.lms_enrollment_status DEFAULT 'assigned'::public.lms_enrollment_status NOT NULL,
    progress_percentage integer DEFAULT 0 NOT NULL,
    last_module_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_learning_path_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_learning_path_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path_id uuid NOT NULL,
    course_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true NOT NULL
);



--
-- Name: lms_learning_paths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_learning_paths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    target_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_quiz_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    quiz_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    score integer,
    max_score integer,
    passed boolean,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_quiz_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quiz_id uuid NOT NULL,
    question_text text NOT NULL,
    question_type public.lms_question_type DEFAULT 'single_choice'::public.lms_question_type NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    correct_answer jsonb DEFAULT '""'::jsonb NOT NULL,
    explanation text,
    points integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_quizzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    pass_percentage integer DEFAULT 70 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    time_limit_minutes integer,
    shuffle_questions boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: lms_certificates lms_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_pkey PRIMARY KEY (id);



--
-- Name: lms_certificates lms_certificates_tenant_id_certificate_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_tenant_id_certificate_no_key UNIQUE (tenant_id, certificate_no);



--
-- Name: lms_course_modules lms_course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_course_modules
    ADD CONSTRAINT lms_course_modules_pkey PRIMARY KEY (id);



--
-- Name: lms_courses lms_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_pkey PRIMARY KEY (id);



--
-- Name: lms_courses lms_courses_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_courses
    ADD CONSTRAINT lms_courses_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: lms_enrollments lms_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_pkey PRIMARY KEY (id);



--
-- Name: lms_enrollments lms_enrollments_tenant_id_user_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_tenant_id_user_id_course_id_key UNIQUE (tenant_id, user_id, course_id);



--
-- Name: lms_learning_path_courses lms_learning_path_courses_path_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_path_id_course_id_key UNIQUE (path_id, course_id);



--
-- Name: lms_learning_path_courses lms_learning_path_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_pkey PRIMARY KEY (id);



--
-- Name: lms_learning_paths lms_learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_pkey PRIMARY KEY (id);



--
-- Name: lms_learning_paths lms_learning_paths_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_paths
    ADD CONSTRAINT lms_learning_paths_tenant_id_code_key UNIQUE (tenant_id, code);



--
-- Name: lms_quiz_attempts lms_quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_pkey PRIMARY KEY (id);



--
-- Name: lms_quiz_questions lms_quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_questions
    ADD CONSTRAINT lms_quiz_questions_pkey PRIMARY KEY (id);



--
-- Name: lms_quizzes lms_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quizzes
    ADD CONSTRAINT lms_quizzes_pkey PRIMARY KEY (id);



--
-- Name: idx_lms_attempts_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_attempts_enrollment ON public.lms_quiz_attempts USING btree (enrollment_id);



--
-- Name: idx_lms_attempts_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_attempts_quiz ON public.lms_quiz_attempts USING btree (quiz_id);



--
-- Name: idx_lms_certificates_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_certificates_expiry ON public.lms_certificates USING btree (tenant_id, expires_at) WHERE (expires_at IS NOT NULL);



--
-- Name: idx_lms_certificates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_certificates_user ON public.lms_certificates USING btree (tenant_id, user_id);



--
-- Name: idx_lms_courses_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_courses_active ON public.lms_courses USING btree (tenant_id, is_active) WHERE (is_active = true);



--
-- Name: idx_lms_courses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_courses_category ON public.lms_courses USING btree (tenant_id, category);



--
-- Name: idx_lms_courses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_courses_tenant ON public.lms_courses USING btree (tenant_id);



--
-- Name: idx_lms_enrollments_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_enrollments_course ON public.lms_enrollments USING btree (tenant_id, course_id);



--
-- Name: idx_lms_enrollments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_enrollments_status ON public.lms_enrollments USING btree (tenant_id, status);



--
-- Name: idx_lms_enrollments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_enrollments_user ON public.lms_enrollments USING btree (tenant_id, user_id);



--
-- Name: idx_lms_modules_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_modules_course ON public.lms_course_modules USING btree (course_id, sort_order);



--
-- Name: idx_lms_path_courses; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_path_courses ON public.lms_learning_path_courses USING btree (path_id, sort_order);



--
-- Name: idx_lms_paths_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_paths_tenant ON public.lms_learning_paths USING btree (tenant_id);



--
-- Name: idx_lms_questions_quiz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_questions_quiz ON public.lms_quiz_questions USING btree (quiz_id, sort_order);



--
-- Name: idx_lms_quizzes_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lms_quizzes_course ON public.lms_quizzes USING btree (course_id);



--
-- Name: lms_courses trg_lms_courses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_courses_updated_at BEFORE UPDATE ON public.lms_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lms_enrollments trg_lms_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_enrollments_updated_at BEFORE UPDATE ON public.lms_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lms_course_modules trg_lms_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_modules_updated_at BEFORE UPDATE ON public.lms_course_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lms_learning_paths trg_lms_paths_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_paths_updated_at BEFORE UPDATE ON public.lms_learning_paths FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lms_quizzes trg_lms_quizzes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lms_quizzes_updated_at BEFORE UPDATE ON public.lms_quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



--
-- Name: lms_certificates lms_certificates_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id);



--
-- Name: lms_certificates lms_certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.lms_enrollments(id);



--
-- Name: lms_certificates lms_certificates_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_certificates
    ADD CONSTRAINT lms_certificates_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.lms_learning_paths(id);



--
-- Name: lms_course_modules lms_course_modules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_course_modules
    ADD CONSTRAINT lms_course_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;



--
-- Name: lms_enrollments lms_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id);



--
-- Name: lms_enrollments lms_enrollments_last_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_enrollments
    ADD CONSTRAINT lms_enrollments_last_module_id_fkey FOREIGN KEY (last_module_id) REFERENCES public.lms_course_modules(id);



--
-- Name: lms_learning_path_courses lms_learning_path_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;



--
-- Name: lms_learning_path_courses lms_learning_path_courses_path_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_learning_path_courses
    ADD CONSTRAINT lms_learning_path_courses_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.lms_learning_paths(id) ON DELETE CASCADE;



--
-- Name: lms_quiz_attempts lms_quiz_attempts_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.lms_enrollments(id) ON DELETE CASCADE;



--
-- Name: lms_quiz_attempts lms_quiz_attempts_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_attempts
    ADD CONSTRAINT lms_quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.lms_quizzes(id);



--
-- Name: lms_quiz_questions lms_quiz_questions_quiz_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quiz_questions
    ADD CONSTRAINT lms_quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.lms_quizzes(id) ON DELETE CASCADE;



--
-- Name: lms_quizzes lms_quizzes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_quizzes
    ADD CONSTRAINT lms_quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE;



--
-- Name: lms_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_certificates ENABLE ROW LEVEL SECURITY;


--
-- Name: lms_certificates lms_certificates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_certificates_tenant ON public.lms_certificates USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lms_courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;


--
-- Name: lms_courses lms_courses_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_courses_tenant ON public.lms_courses USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lms_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;


--
-- Name: lms_enrollments lms_enrollments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_enrollments_tenant ON public.lms_enrollments USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));



--
-- Name: lms_learning_paths; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_learning_paths ENABLE ROW LEVEL SECURITY;


--
-- Name: lms_learning_paths lms_paths_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lms_paths_tenant ON public.lms_learning_paths USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


