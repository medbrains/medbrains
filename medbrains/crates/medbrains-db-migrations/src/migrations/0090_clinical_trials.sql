-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 4
-- Drops: none
-- clinical trials — schema.
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



-- Migration: 0242_trial_adverse_events.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Adverse event + SAE reporting for clinical trials (ticket #2987): safety events during a trial,
-- flagged serious (SAE) with severity, relatedness to the investigational product, and outcome.
-- Tenant RLS.

CREATE TABLE public.trial_adverse_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trial_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    event_term text NOT NULL,
    onset_date date,
    severity text DEFAULT 'mild'::text NOT NULL,
    is_serious boolean DEFAULT false NOT NULL,
    relatedness text DEFAULT 'unassessed'::text NOT NULL,
    outcome text DEFAULT 'ongoing'::text NOT NULL,
    reported_date date DEFAULT CURRENT_DATE NOT NULL,
    reported_by uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trial_ae_outcome_check CHECK ((outcome = ANY (ARRAY['recovered'::text, 'recovering'::text, 'ongoing'::text, 'fatal'::text, 'unknown'::text]))),
    CONSTRAINT trial_ae_relatedness_check CHECK ((relatedness = ANY (ARRAY['unassessed'::text, 'unrelated'::text, 'possible'::text, 'probable'::text, 'definite'::text]))),
    CONSTRAINT trial_ae_severity_check CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text])))
);

-- Name: trial_adverse_events trial_adverse_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_adverse_events
    ADD CONSTRAINT trial_adverse_events_pkey PRIMARY KEY (id);

CREATE INDEX idx_trial_ae_serious ON public.trial_adverse_events USING btree (tenant_id, trial_id) WHERE (is_serious = true);

CREATE INDEX idx_trial_ae_trial ON public.trial_adverse_events USING btree (tenant_id, trial_id, reported_date DESC);

ALTER TABLE public.trial_adverse_events ENABLE ROW LEVEL SECURITY;

-- Name: trial_adverse_events trial_adverse_events_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trial_adverse_events_tenant_isolation ON public.trial_adverse_events USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: trial_adverse_events trial_adverse_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trial_adverse_events_updated_at BEFORE UPDATE ON public.trial_adverse_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0244_trial_irb_submissions.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- IRB / Ethics committee submission tracking (ticket #2989): the ethics-committee submissions for a
-- trial (initial, amendment, renewal, SAE report, closure) and their review outcome. Tenant RLS.

CREATE TABLE public.trial_irb_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trial_id uuid NOT NULL,
    submission_type text DEFAULT 'initial'::text NOT NULL,
    committee_name text,
    reference_number text,
    submitted_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    decision_date date,
    notes text,
    submitted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trial_irb_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'deferred'::text]))),
    CONSTRAINT trial_irb_type_check CHECK ((submission_type = ANY (ARRAY['initial'::text, 'amendment'::text, 'renewal'::text, 'sae_report'::text, 'closure'::text])))
);

-- Name: trial_irb_submissions trial_irb_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_irb_submissions
    ADD CONSTRAINT trial_irb_submissions_pkey PRIMARY KEY (id);

CREATE INDEX idx_trial_irb_trial ON public.trial_irb_submissions USING btree (tenant_id, trial_id, submitted_date DESC);

ALTER TABLE public.trial_irb_submissions ENABLE ROW LEVEL SECURITY;

-- Name: trial_irb_submissions trial_irb_submissions_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trial_irb_submissions_tenant_isolation ON public.trial_irb_submissions USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: trial_irb_submissions trial_irb_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trial_irb_submissions_updated_at BEFORE UPDATE ON public.trial_irb_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0243_trial_randomizations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Blinded/unblinded randomization (ticket #2988): a patient's treatment-arm assignment. The arm
-- is stored but concealed — the list endpoint only returns it once the record is unblinded (for a
-- documented reason). The randomization/IWRS algorithm is external; this stores + guards the arm.
-- Tenant RLS.

CREATE TABLE public.trial_randomizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trial_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    arm text NOT NULL,
    randomization_code text,
    is_unblinded boolean DEFAULT false NOT NULL,
    unblinded_by uuid,
    unblinded_at timestamp with time zone,
    unblind_reason text,
    randomized_by uuid,
    randomized_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: trial_randomizations trial_randomization_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_randomizations
    ADD CONSTRAINT trial_randomization_unique UNIQUE (tenant_id, trial_id, patient_id);

-- Name: trial_randomizations trial_randomizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_randomizations
    ADD CONSTRAINT trial_randomizations_pkey PRIMARY KEY (id);

CREATE INDEX idx_trial_randomizations_trial ON public.trial_randomizations USING btree (tenant_id, trial_id, randomized_at DESC);

ALTER TABLE public.trial_randomizations ENABLE ROW LEVEL SECURITY;

-- Name: trial_randomizations trial_randomizations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trial_randomizations_tenant_isolation ON public.trial_randomizations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: trial_randomizations trial_randomizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trial_randomizations_updated_at BEFORE UPDATE ON public.trial_randomizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0241_trial_visits.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Protocol-driven visit schedule + procedure tracking (ticket #2986): each enrolled patient has a
-- schedule of protocol visits (e.g. Screening, Day 0, Day 28) with the procedures to perform and a
-- completion status. Tenant RLS.

CREATE TABLE public.trial_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    trial_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    visit_name text NOT NULL,
    scheduled_date date NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    procedures text,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trial_visit_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'missed'::text, 'rescheduled'::text])))
);

-- Name: trial_visits trial_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_visits
    ADD CONSTRAINT trial_visits_pkey PRIMARY KEY (id);

CREATE INDEX idx_trial_visits_trial ON public.trial_visits USING btree (tenant_id, trial_id, scheduled_date);

ALTER TABLE public.trial_visits ENABLE ROW LEVEL SECURITY;

-- Name: trial_visits trial_visits_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trial_visits_tenant_isolation ON public.trial_visits USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: trial_visits trial_visits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trial_visits_updated_at BEFORE UPDATE ON public.trial_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
