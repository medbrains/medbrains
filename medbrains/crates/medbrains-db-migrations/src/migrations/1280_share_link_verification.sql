-- ====================================================================
-- Migration: 1280_share_link_verification.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: radiology_share_otps, radiology_share_sessions
-- Drops: none
-- ====================================================================
-- A share link opened a patient's images to anyone holding it — a link
-- forwarded on WhatsApp showed the name, ID and birth date in every DICOM
-- header for up to a week. Now:
--
-- - the link names who it is for and how to reach them (the patient's own
--   phone on record, or a clinician's phone or email), and the viewer opens
--   only after a one-time code sent there is entered (radiology_share_otps:
--   hashed, ten minutes, five tries, a few codes an hour);
-- - a correct code starts a browser session for that link alone
--   (radiology_share_sessions, the secret stored hashed);
-- - a clinician link can be de-identified: identifying DICOM attributes are
--   replaced on the way out (PS3.15 basic profile, retaining patient
--   characteristics and UIDs), and whole DICOM files are not served.

ALTER TABLE public.radiology_share_links
    ADD COLUMN IF NOT EXISTS recipient_kind text NOT NULL DEFAULT 'clinician',
    ADD COLUMN IF NOT EXISTS recipient_phone text,
    ADD COLUMN IF NOT EXISTS deidentify boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiology_share_links_kind_check') THEN
        ALTER TABLE public.radiology_share_links
            ADD CONSTRAINT radiology_share_links_kind_check
                CHECK (recipient_kind IN ('clinician', 'patient'));
    END IF;
    -- A patient's own share is never de-identified: they are the patient.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radiology_share_links_patient_identified') THEN
        ALTER TABLE public.radiology_share_links
            ADD CONSTRAINT radiology_share_links_patient_identified
                CHECK (recipient_kind <> 'patient' OR NOT deidentify) NOT VALID;
    END IF;
END $$;

-- Links made before verification existed have nowhere to send a code: they
-- stop opening rather than stay open to anyone.
UPDATE public.radiology_share_links
   SET deleted_at = now(), delete_reason = 'no recipient to verify (1280)'
 WHERE deleted_at IS NULL AND recipient_phone IS NULL AND recipient_email IS NULL;

CREATE TABLE IF NOT EXISTS public.radiology_share_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    link_id uuid NOT NULL REFERENCES public.radiology_share_links(id),
    code_hash text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX IF NOT EXISTS idx_radiology_share_otps_link
    ON public.radiology_share_otps (link_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.radiology_share_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    link_id uuid NOT NULL REFERENCES public.radiology_share_links(id),
    secret_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text
);
CREATE INDEX IF NOT EXISTS idx_radiology_share_sessions_link
    ON public.radiology_share_sessions (link_id);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['radiology_share_otps', 'radiology_share_sessions'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON public.%I', t, t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_%s ON public.%I '
            'USING (tenant_id = ANY (public.app_visible_tenants())) '
            'WITH CHECK (tenant_id = ANY (public.app_visible_tenants()))', t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON public.%I', t, t);
        EXECUTE format(
            'CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t, t);
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_soft_delete ON public.%I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_soft_delete BEFORE DELETE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail()', t, t);
    END LOOP;
END $$;
