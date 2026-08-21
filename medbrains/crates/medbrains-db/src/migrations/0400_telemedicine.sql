-- RLS-Posture: tenant-scoped (per table)
-- Tenant-Column: tenant_id
-- New-Tables: 5
-- Drops: none
-- telemedicine — schema.
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



-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: prescription_verify_links
-- Drops: none
-- Verification links for printed prescriptions.
-- The QR on a printed prescription encoded the raw encounter id at a route that
-- was never registered — so it promised "scan to verify" and did nothing. A raw
-- entity id is also the wrong thing to print: it never expires, cannot be
-- revoked, and identifies the encounter to anyone who photographs the paper.
-- This follows radiology_share_links, which already solved the same problem:
-- a random token in its own table, with an expiry and an access count, so a
-- link can be aged out and its use can be seen.

CREATE TABLE public.prescription_verify_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accessed_count integer DEFAULT 0 NOT NULL,
    last_accessed timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Name: prescription_verify_links prescription_verify_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_verify_links
    ADD CONSTRAINT prescription_verify_links_pkey PRIMARY KEY (id);

CREATE INDEX idx_prescription_verify_links_encounter ON public.prescription_verify_links USING btree (tenant_id, encounter_id, expires_at);

CREATE UNIQUE INDEX uq_prescription_verify_links_token ON public.prescription_verify_links USING btree (token);

ALTER TABLE public.prescription_verify_links ENABLE ROW LEVEL SECURITY;

-- Name: prescription_verify_links prescription_verify_links_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prescription_verify_links_tenant_isolation ON public.prescription_verify_links USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: TABLE prescription_verify_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.prescription_verify_links IS 'Expiring tokens behind the QR on a printed prescription. Never print a raw entity id — it cannot expire or be revoked.';

-- Migration: 0247_remote_vital_readings.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Remote vital monitoring (ticket #2969): readings streamed from a home patient's connected devices
-- (BP cuff, glucometer, pulse oximeter, thermometer, scale). Bluetooth pairing + read happens in the
-- mobile app; this stores the reading (flexible jsonb) and whether it breached a safe range. Tenant RLS.

CREATE TABLE public.remote_vital_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    device_type text NOT NULL,
    reading jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_flagged boolean DEFAULT false NOT NULL,
    measured_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'device'::text NOT NULL,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT remote_vital_device_check CHECK ((device_type = ANY (ARRAY['bp'::text, 'glucometer'::text, 'pulse_ox'::text, 'thermometer'::text, 'weight'::text])))
);

-- Name: remote_vital_readings remote_vital_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remote_vital_readings
    ADD CONSTRAINT remote_vital_readings_pkey PRIMARY KEY (id);

CREATE INDEX idx_remote_vitals_flagged ON public.remote_vital_readings USING btree (tenant_id, patient_id) WHERE (is_flagged = true);

CREATE INDEX idx_remote_vitals_patient ON public.remote_vital_readings USING btree (tenant_id, patient_id, measured_at DESC);

ALTER TABLE public.remote_vital_readings ENABLE ROW LEVEL SECURITY;

-- Name: remote_vital_readings remote_vital_readings_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY remote_vital_readings_tenant_isolation ON public.remote_vital_readings USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0264_tele_chat_messages.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Telemedicine chat fallback (ticket #2948): text messages within a tele-consultation for when
-- video isn't possible (poor connectivity) or as an adjunct to the call. Tenant RLS.

CREATE TABLE public.tele_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consultation_id uuid NOT NULL,
    sender_role text DEFAULT 'doctor'::text NOT NULL,
    sender_id uuid,
    body text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tele_chat_role_check CHECK ((sender_role = ANY (ARRAY['doctor'::text, 'patient'::text, 'system'::text])))
);

-- Name: tele_chat_messages tele_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_chat_messages
    ADD CONSTRAINT tele_chat_messages_pkey PRIMARY KEY (id);

CREATE INDEX idx_tele_chat_consultation ON public.tele_chat_messages USING btree (tenant_id, consultation_id, sent_at);

ALTER TABLE public.tele_chat_messages ENABLE ROW LEVEL SECURITY;

-- Name: tele_chat_messages tele_chat_messages_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tele_chat_messages_tenant_isolation ON public.tele_chat_messages USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Migration: 0167_telemedicine.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: telemedicine (video consultations)
-- A video-consult session bound to an appointment/encounter. Provider-agnostic
-- room model (default Jitsi: <base>/<room_id>) so it works with no paid SDK;
-- the room base is configurable per tenant (tenant_settings telemedicine/video_base).
-- ============================================================

CREATE TABLE public.tele_consultations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    appointment_id uuid,
    encounter_id uuid,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    room_id text NOT NULL,
    provider text DEFAULT 'jitsi'::text NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    doctor_notes text,
    cancel_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meeting_url text,
    recording_consent boolean DEFAULT false NOT NULL,
    is_recording boolean DEFAULT false NOT NULL,
    recording_url text,
    follow_up_of uuid
);

-- Name: tele_consultations tele_consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_pkey PRIMARY KEY (id);

-- Name: tele_consultations tele_consultations_tenant_room_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_tenant_room_key UNIQUE (tenant_id, room_id);

CREATE INDEX idx_tele_consultations_doctor ON public.tele_consultations USING btree (tenant_id, doctor_id, status, scheduled_at);

CREATE INDEX idx_tele_consultations_patient ON public.tele_consultations USING btree (tenant_id, patient_id, scheduled_at);

ALTER TABLE public.tele_consultations ENABLE ROW LEVEL SECURITY;

-- Name: tele_consultations tenant_isolation_tele_consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_tele_consultations ON public.tele_consultations USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

-- Name: tele_consultations tele_consultations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tele_consultations_set_updated_at BEFORE UPDATE ON public.tele_consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migration: 0265_tele_triage.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- Tele-triage (innovation): a structured pre-consultation intake for a tele-consult that a
-- deterministic, explainable engine grades into an acuity band with red-flags + a recommended
-- timeframe. Transparent (reasoning captured), not a black-box model — clinician-safe decision
-- support that lets the doctor see emergent patients first. One row per consultation. Tenant RLS.

CREATE TABLE public.tele_triage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    consultation_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    chief_complaint text,
    symptoms text[] DEFAULT '{}'::text[] NOT NULL,
    duration_hours integer,
    severity integer,
    vitals jsonb DEFAULT '{}'::jsonb NOT NULL,
    acuity text DEFAULT 'routine'::text NOT NULL,
    red_flags text[] DEFAULT '{}'::text[] NOT NULL,
    recommended_timeframe text,
    reasoning jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tele_triage_acuity_check CHECK ((acuity = ANY (ARRAY['routine'::text, 'urgent'::text, 'emergent'::text]))),
    CONSTRAINT tele_triage_severity_check CHECK (((severity IS NULL) OR ((severity >= 0) AND (severity <= 10))))
);

-- Name: tele_triage tele_triage_consult_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_triage
    ADD CONSTRAINT tele_triage_consult_unique UNIQUE (tenant_id, consultation_id);

-- Name: tele_triage tele_triage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_triage
    ADD CONSTRAINT tele_triage_pkey PRIMARY KEY (id);

CREATE INDEX idx_tele_triage_acuity ON public.tele_triage USING btree (tenant_id, acuity, created_at DESC);

ALTER TABLE public.tele_triage ENABLE ROW LEVEL SECURITY;

-- Name: tele_triage tele_triage_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tele_triage_tenant_isolation ON public.tele_triage USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));

-- Name: tele_triage tele_triage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tele_triage_updated_at BEFORE UPDATE ON public.tele_triage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── foreign keys within this module ─────────────────────────────────
-- Declared last so the tables above can appear in any order.

-- Name: tele_chat_messages tele_chat_messages_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_chat_messages
    ADD CONSTRAINT tele_chat_messages_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.tele_consultations(id) ON DELETE CASCADE;

-- Name: tele_consultations tele_consultations_follow_up_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_follow_up_of_fkey FOREIGN KEY (follow_up_of) REFERENCES public.tele_consultations(id);

-- Name: tele_triage tele_triage_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tele_triage
    ADD CONSTRAINT tele_triage_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.tele_consultations(id) ON DELETE CASCADE;
