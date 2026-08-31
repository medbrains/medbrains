-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 10
-- Drops: none
-- home care — schema.
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



-- Migration: 0252_bereavement_followups.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Bereavement support coordination (ticket #2974): after a hospice patient's death, scheduled
-- follow-up contacts with the bereaved family (call, home visit, support group, condolence letter)
-- and their completion status. Tenant RLS.

CREATE TABLE public.bereavement_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    family_contact_name text NOT NULL,
    relationship text,
    contact_type text DEFAULT 'call'::text NOT NULL,
    scheduled_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    completed_at timestamp with time zone,
    coordinator uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bereavement_contact_type_check CHECK ((contact_type = ANY (ARRAY['call'::text, 'visit'::text, 'support_group'::text, 'letter'::text, 'other'::text]))),
    CONSTRAINT bereavement_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'declined'::text])))
);

-- Name: bereavement_followups bereavement_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bereavement_followups
    ADD CONSTRAINT bereavement_followups_pkey PRIMARY KEY (id);

CREATE INDEX idx_bereavement_patient ON public.bereavement_followups USING btree (tenant_id, patient_id, scheduled_date);

ALTER TABLE public.bereavement_followups ENABLE ROW LEVEL SECURITY;

-- Name: bereavement_followups bereavement_followups_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bereavement_followups_tenant_isolation ON public.bereavement_followups USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: bereavement_followups bereavement_followups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bereavement_followups_updated_at BEFORE UPDATE ON public.bereavement_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0249_caregiver_education.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Caregiver education documentation (ticket #2971): records a teaching session given to a home
-- patient's family caregiver — the topic, materials handed over, and whether understanding was
-- confirmed (teach-back). Tenant RLS.

CREATE TABLE public.caregiver_education (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    caregiver_name text NOT NULL,
    relationship text,
    topic text NOT NULL,
    materials_provided text,
    understanding_confirmed boolean DEFAULT false NOT NULL,
    session_date date DEFAULT CURRENT_DATE NOT NULL,
    educated_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: caregiver_education caregiver_education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_education
    ADD CONSTRAINT caregiver_education_pkey PRIMARY KEY (id);

CREATE INDEX idx_caregiver_education_patient ON public.caregiver_education USING btree (tenant_id, patient_id, session_date DESC);

ALTER TABLE public.caregiver_education ENABLE ROW LEVEL SECURITY;

-- Name: caregiver_education caregiver_education_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY caregiver_education_tenant_isolation ON public.caregiver_education USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: caregiver_education caregiver_education_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER caregiver_education_updated_at BEFORE UPDATE ON public.caregiver_education FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0248_home_care_packages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home care billing (ticket #2970): package-based billing — a prepaid bundle of N home-care visits.
-- Purchase auto-charges the price to the patient (reusing the billing auto_charge seam); each visit
-- consumed decrements the balance. Visit-based billing reuses auto_charge per visit (no table).
-- Tenant RLS.

CREATE TABLE public.home_care_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    name text NOT NULL,
    total_visits integer NOT NULL,
    used_visits integer DEFAULT 0 NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invoice_id uuid,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_care_package_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT home_care_package_visits_check CHECK ((total_visits > 0))
);

-- Name: home_care_packages home_care_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_care_packages
    ADD CONSTRAINT home_care_packages_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_care_packages_patient ON public.home_care_packages USING btree (tenant_id, patient_id, status);

ALTER TABLE public.home_care_packages ENABLE ROW LEVEL SECURITY;

-- Name: home_care_packages home_care_packages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_care_packages_tenant_isolation ON public.home_care_packages USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_care_packages home_care_packages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_care_packages_updated_at BEFORE UPDATE ON public.home_care_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0258_home_care_referrals.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home care referral from discharge (ticket #2966): at discharge, refer a patient to home-care
-- services (skilled nursing, wound care, physiotherapy, OT, speech) and track the referral through
-- acceptance / scheduling. Bridges discharge planning to the Home Care program. Tenant RLS.

CREATE TABLE public.home_care_referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    referral_type text NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    provider text,
    referred_date date DEFAULT CURRENT_DATE NOT NULL,
    referred_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_care_referral_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'scheduled'::text, 'declined'::text, 'completed'::text]))),
    CONSTRAINT home_care_referral_type_check CHECK ((referral_type = ANY (ARRAY['nursing'::text, 'wound_care'::text, 'physiotherapy'::text, 'occupational'::text, 'speech'::text, 'general'::text])))
);

-- Name: home_care_referrals home_care_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_care_referrals
    ADD CONSTRAINT home_care_referrals_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_care_referrals_patient ON public.home_care_referrals USING btree (tenant_id, patient_id, status);

ALTER TABLE public.home_care_referrals ENABLE ROW LEVEL SECURITY;

-- Name: home_care_referrals home_care_referrals_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_care_referrals_tenant_isolation ON public.home_care_referrals USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_care_referrals home_care_referrals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_care_referrals_updated_at BEFORE UPDATE ON public.home_care_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0237_home_discharge_program.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare discharge program (ticket #2982): patient/family training materials handed out
-- and the discharge-readiness criteria that must be met before the home-care episode ends. One
-- checklist table with an item_type discriminator (training | criterion). Tenant RLS.

CREATE TABLE public.home_discharge_program (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    item_type text NOT NULL,
    title text NOT NULL,
    description text,
    is_complete boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_discharge_item_type_check CHECK ((item_type = ANY (ARRAY['training'::text, 'criterion'::text])))
);

-- Name: home_discharge_program home_discharge_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_discharge_program
    ADD CONSTRAINT home_discharge_program_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_discharge_patient ON public.home_discharge_program USING btree (tenant_id, patient_id, item_type);

ALTER TABLE public.home_discharge_program ENABLE ROW LEVEL SECURITY;

-- Name: home_discharge_program home_discharge_program_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_discharge_program_tenant_isolation ON public.home_discharge_program USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_discharge_program home_discharge_program_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_discharge_program_updated_at BEFORE UPDATE ON public.home_discharge_program FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0235_home_escalations.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare emergency escalation protocol (ticket #2980). When a home patient's vitals
-- breach a safety threshold, an escalation is raised (by the monitoring device / visiting nurse),
-- which can request an ambulance and is then resolved. The vital snapshot that triggered it is
-- captured for the responding crew. Tenant RLS.

CREATE TABLE public.home_escalations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    reason text NOT NULL,
    vital_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    severity text DEFAULT 'high'::text NOT NULL,
    status text DEFAULT 'raised'::text NOT NULL,
    raised_by uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_escalation_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT home_escalation_status_check CHECK ((status = ANY (ARRAY['raised'::text, 'ambulance_requested'::text, 'resolved'::text, 'cancelled'::text])))
);

-- Name: home_escalations home_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_escalations
    ADD CONSTRAINT home_escalations_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_escalations_open ON public.home_escalations USING btree (tenant_id, status) WHERE (status = ANY (ARRAY['raised'::text, 'ambulance_requested'::text]));

CREATE INDEX idx_home_escalations_patient ON public.home_escalations USING btree (tenant_id, patient_id, created_at DESC);

ALTER TABLE public.home_escalations ENABLE ROW LEVEL SECURITY;

-- Name: home_escalations home_escalations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_escalations_tenant_isolation ON public.home_escalations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_escalations home_escalations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_escalations_updated_at BEFORE UPDATE ON public.home_escalations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0234_home_med_administration.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare / Hospital-at-Home: medication administration tracking (IV antibiotics,
-- infusions) given at the patient's home by a visiting nurse. A home eMAR — each dose is
-- scheduled, then recorded as administered / missed / held with the site and notes. Tenant RLS.
-- Ticket #2979.

CREATE TABLE public.home_med_administrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    drug_name text NOT NULL,
    dose text NOT NULL,
    route text,
    is_infusion boolean DEFAULT false NOT NULL,
    infusion_rate text,
    scheduled_at timestamp with time zone NOT NULL,
    administered_at timestamp with time zone,
    administered_by uuid,
    administration_site text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_med_admin_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'administered'::text, 'missed'::text, 'held'::text])))
);

-- Name: home_med_administrations home_med_administrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_med_administrations
    ADD CONSTRAINT home_med_administrations_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_med_patient ON public.home_med_administrations USING btree (tenant_id, patient_id, scheduled_at);

ALTER TABLE public.home_med_administrations ENABLE ROW LEVEL SECURITY;

-- Name: home_med_administrations home_med_administrations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_med_administrations_tenant_isolation ON public.home_med_administrations USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_med_administrations home_med_administrations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_med_administrations_updated_at BEFORE UPDATE ON public.home_med_administrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0236_home_progress_notes.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home Healthcare daily clinical progress notes (ticket #2981) written by the visiting nurse or
-- the remote physician during a home-care episode, with an optional vitals snapshot. Tenant RLS.

CREATE TABLE public.home_progress_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    author_id uuid,
    author_role text DEFAULT 'nurse'::text NOT NULL,
    note_text text NOT NULL,
    vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_progress_note_role_check CHECK ((author_role = ANY (ARRAY['nurse'::text, 'physician'::text])))
);

-- Name: home_progress_notes home_progress_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_progress_notes
    ADD CONSTRAINT home_progress_notes_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_progress_patient ON public.home_progress_notes USING btree (tenant_id, patient_id, note_date DESC);

ALTER TABLE public.home_progress_notes ENABLE ROW LEVEL SECURITY;

-- Name: home_progress_notes home_progress_notes_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_progress_notes_tenant_isolation ON public.home_progress_notes USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_progress_notes home_progress_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_progress_notes_updated_at BEFORE UPDATE ON public.home_progress_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0245_home_visits.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Home visit scheduling + nurse assignment (ticket #2967): a home-care visit assigned to a nurse
-- for a date/time, with a manual visit_order for the day's route. Automated route optimization is
-- a later enhancement — visit_order lets the nurse sequence the round for now. Tenant RLS.

CREATE TABLE public.home_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    nurse_id uuid,
    scheduled_date date DEFAULT CURRENT_DATE NOT NULL,
    scheduled_time time without time zone,
    address text,
    purpose text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    visit_order integer,
    notes text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    wound_photo_url text,
    medication_compliance text,
    documented_at timestamp with time zone,
    documented_by uuid,
    CONSTRAINT home_visit_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'en_route'::text, 'completed'::text, 'cancelled'::text, 'missed'::text])))
);

-- Name: home_visits home_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_visits
    ADD CONSTRAINT home_visits_pkey PRIMARY KEY (id);

CREATE INDEX idx_home_visits_date ON public.home_visits USING btree (tenant_id, scheduled_date, visit_order);

CREATE INDEX idx_home_visits_nurse ON public.home_visits USING btree (tenant_id, nurse_id, scheduled_date);

ALTER TABLE public.home_visits ENABLE ROW LEVEL SECURITY;

-- Name: home_visits home_visits_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_visits_tenant_isolation ON public.home_visits USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: home_visits home_visits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_visits_updated_at BEFORE UPDATE ON public.home_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0250_hospice_enrollments.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Hospice enrollment (ticket #2972): enrolls a patient in the hospice / palliative program with a
-- terminal diagnosis, a documented prognosis, a comfort-care plan, and DNR status. Tenant RLS.

CREATE TABLE public.hospice_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    enrolled_date date DEFAULT CURRENT_DATE NOT NULL,
    terminal_diagnosis text,
    prognosis text,
    comfort_care_plan text,
    dnr_confirmed boolean DEFAULT false NOT NULL,
    primary_caregiver text,
    status text DEFAULT 'active'::text NOT NULL,
    discharge_date date,
    notes text,
    enrolled_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hospice_status_check CHECK ((status = ANY (ARRAY['active'::text, 'discharged'::text, 'deceased'::text])))
);

-- Name: hospice_enrollments hospice_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospice_enrollments
    ADD CONSTRAINT hospice_enrollments_pkey PRIMARY KEY (id);

CREATE INDEX idx_hospice_patient ON public.hospice_enrollments USING btree (tenant_id, patient_id, status);

ALTER TABLE public.hospice_enrollments ENABLE ROW LEVEL SECURITY;

-- Name: hospice_enrollments hospice_enrollments_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hospice_enrollments_tenant_isolation ON public.hospice_enrollments USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: hospice_enrollments hospice_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hospice_enrollments_updated_at BEFORE UPDATE ON public.hospice_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
