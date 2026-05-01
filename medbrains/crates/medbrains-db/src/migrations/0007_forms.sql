-- ============================================================
-- MedBrains schema — module: forms
-- ============================================================

--
-- Name: form_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid,
    field_master_id uuid,
    section_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: form_fields form_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_fields
    ADD CONSTRAINT form_fields_pkey PRIMARY KEY (id);



--
-- Name: idx_form_fields_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_fields_form ON public.form_fields USING btree (form_id, sort_order);


