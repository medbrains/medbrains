-- ============================================================
-- MedBrains schema — module: geo
-- ============================================================

--
-- Name: geo_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_countries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    phone_code text,
    currency text,
    is_active boolean DEFAULT true NOT NULL,
    default_locale text DEFAULT 'en'::text NOT NULL,
    default_timezone text DEFAULT 'UTC'::text NOT NULL,
    date_format text DEFAULT 'DD/MM/YYYY'::text NOT NULL,
    measurement_system text DEFAULT 'metric'::text NOT NULL
);



--
-- Name: geo_districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_districts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    state_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: geo_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_states (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    country_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: geo_subdistricts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_subdistricts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    district_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: geo_towns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_towns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    subdistrict_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    pincode text,
    is_active boolean DEFAULT true NOT NULL
);



--
-- Name: geo_countries geo_countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_code_key UNIQUE (code);



--
-- Name: geo_countries geo_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (id);



--
-- Name: geo_districts geo_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_pkey PRIMARY KEY (id);



--
-- Name: geo_districts geo_districts_state_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_state_id_code_key UNIQUE (state_id, code);



--
-- Name: geo_states geo_states_country_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_country_id_code_key UNIQUE (country_id, code);



--
-- Name: geo_states geo_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_pkey PRIMARY KEY (id);



--
-- Name: geo_subdistricts geo_subdistricts_district_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_district_id_code_key UNIQUE (district_id, code);



--
-- Name: geo_subdistricts geo_subdistricts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_pkey PRIMARY KEY (id);



--
-- Name: geo_towns geo_towns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_pkey PRIMARY KEY (id);



--
-- Name: geo_towns geo_towns_subdistrict_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_subdistrict_id_code_key UNIQUE (subdistrict_id, code);



--
-- Name: idx_geo_districts_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_state ON public.geo_districts USING btree (state_id);



--
-- Name: idx_geo_states_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_states_country ON public.geo_states USING btree (country_id);



--
-- Name: idx_geo_subdistricts_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_subdistricts_district ON public.geo_subdistricts USING btree (district_id);



--
-- Name: idx_geo_towns_pincode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_towns_pincode ON public.geo_towns USING btree (pincode) WHERE (pincode IS NOT NULL);



--
-- Name: idx_geo_towns_subdistrict; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_towns_subdistrict ON public.geo_towns USING btree (subdistrict_id);



--
-- Name: geo_districts geo_districts_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.geo_states(id);



--
-- Name: geo_states geo_states_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_states
    ADD CONSTRAINT geo_states_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);



--
-- Name: geo_subdistricts geo_subdistricts_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_subdistricts
    ADD CONSTRAINT geo_subdistricts_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);



--
-- Name: geo_towns geo_towns_subdistrict_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_towns
    ADD CONSTRAINT geo_towns_subdistrict_id_fkey FOREIGN KEY (subdistrict_id) REFERENCES public.geo_subdistricts(id);


