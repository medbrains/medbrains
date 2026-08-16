-- Migration: 0167_telemedicine.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- ============================================================
-- MedBrains schema — module: telemedicine (video consultations)
-- A video-consult session bound to an appointment/encounter. Provider-agnostic
-- room model (default Jitsi: <base>/<room_id>) so it works with no paid SDK;
-- the room base is configurable per tenant (tenant_settings telemedicine/video_base).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tele_consultations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    appointment_id uuid,
    encounter_id uuid,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    -- opaque room name used to build the join URL; unique per tenant
    room_id text NOT NULL,
    provider text NOT NULL DEFAULT 'jitsi',
    -- scheduled | waiting | in_progress | completed | cancelled | no_show
    status text NOT NULL DEFAULT 'scheduled',
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    doctor_notes text,
    cancel_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_tenant_room_key UNIQUE (tenant_id, room_id);

ALTER TABLE ONLY public.tele_consultations
    ADD CONSTRAINT tele_consultations_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- Doctor worklist: today's sessions by status.
CREATE INDEX IF NOT EXISTS idx_tele_consultations_doctor
    ON public.tele_consultations (tenant_id, doctor_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tele_consultations_patient
    ON public.tele_consultations (tenant_id, patient_id, scheduled_at);

ALTER TABLE public.tele_consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tele_consultations ON public.tele_consultations;
CREATE POLICY tenant_isolation_tele_consultations ON public.tele_consultations
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)))
    WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE TRIGGER tele_consultations_set_updated_at
    BEFORE UPDATE ON public.tele_consultations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
