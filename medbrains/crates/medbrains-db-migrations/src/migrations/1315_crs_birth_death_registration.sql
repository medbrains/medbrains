-- ====================================================================
-- Migration: 1315_crs_birth_death_registration.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: crs_events
-- Drops: none
-- ====================================================================
-- Births and deaths owed to the civil registrar (CRS).
--
-- The Registration of Births and Deaths (Amendment) Act 2023 makes the
-- hospital's in-charge the informant for every birth and death in the
-- hospital, reported on the Centre's CRS portal within 21 days. The births
-- were recorded (maternity newborn records, the MRD birth register) and so
-- were the deaths (the IPD death summary that is the MCCD, the MRD death
-- register) -- but nothing said which were still unreported, or when they
-- fall due.
--
-- One row per event. A baby recorded both by the labour room and in the
-- birth register is one birth: each register entry is matched to one
-- unmatched newborn of the same mother, date and sex (so twins stay two). A
-- death recorded in both the death summary and the death register is one
-- death: a patient dies once. Rows are opened by trigger, so no path that
-- records a birth or a death can forget the registrar.

CREATE TABLE IF NOT EXISTS public.crs_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('birth', 'death')),
    -- The mother, for a birth; the deceased, for a death.
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    event_date DATE NOT NULL,
    baby_sex TEXT,
    due_on DATE NOT NULL,
    newborn_id UUID REFERENCES public.newborn_records(id),
    birth_register_id UUID REFERENCES public.mrd_birth_register(id),
    death_summary_id UUID REFERENCES public.ipd_death_summaries(id),
    death_register_id UUID REFERENCES public.mrd_death_register(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered')),
    crs_registration_number TEXT,
    registered_on DATE,
    recorded_by UUID REFERENCES public.users(id),
    recorded_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    delete_reason TEXT,
    CONSTRAINT crs_events_registered_numbered
        CHECK (status = 'pending' OR crs_registration_number IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crs_events_death
    ON public.crs_events (tenant_id, patient_id) WHERE event_type = 'death' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crs_events_newborn
    ON public.crs_events (newborn_id) WHERE newborn_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_crs_events_birth_register
    ON public.crs_events (birth_register_id) WHERE birth_register_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crs_events_due
    ON public.crs_events (tenant_id, due_on) WHERE status = 'pending' AND deleted_at IS NULL;

ALTER TABLE public.crs_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crs_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_crs_events ON public.crs_events;
CREATE POLICY tenant_isolation_crs_events ON public.crs_events
    USING (tenant_id = ANY (public.app_visible_tenants()))
    WITH CHECK (tenant_id = ANY (public.app_visible_tenants()));
DROP TRIGGER IF EXISTS set_updated_at_crs_events ON public.crs_events;
CREATE TRIGGER set_updated_at_crs_events BEFORE UPDATE ON public.crs_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_crs_events_soft_delete ON public.crs_events;
CREATE TRIGGER trg_crs_events_soft_delete BEFORE DELETE ON public.crs_events
    FOR EACH ROW EXECUTE FUNCTION public.soft_delete_guardrail();

-- ── A birth: from the labour room or the birth register, matched once ──
CREATE OR REPLACE FUNCTION public.crs_record_birth(
    p_tenant UUID, p_mother UUID, p_date DATE, p_sex TEXT,
    p_newborn UUID, p_register UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_match UUID;
BEGIN
    IF p_mother IS NULL OR p_date IS NULL THEN
        RETURN;
    END IF;
    -- The other record of this same baby, not yet matched to one of ours.
    SELECT id INTO v_match FROM public.crs_events
     WHERE tenant_id = p_tenant AND event_type = 'birth' AND deleted_at IS NULL
       AND patient_id = p_mother AND event_date = p_date
       AND lower(coalesce(baby_sex, '')) = lower(coalesce(p_sex, ''))
       AND ((p_newborn IS NOT NULL AND newborn_id IS NULL)
         OR (p_register IS NOT NULL AND birth_register_id IS NULL))
     ORDER BY created_at LIMIT 1;
    IF v_match IS NOT NULL THEN
        UPDATE public.crs_events
           SET newborn_id = COALESCE(newborn_id, p_newborn),
               birth_register_id = COALESCE(birth_register_id, p_register)
         WHERE id = v_match;
        RETURN;
    END IF;
    INSERT INTO public.crs_events (tenant_id, event_type, patient_id, event_date, baby_sex,
                                   due_on, newborn_id, birth_register_id)
    VALUES (p_tenant, 'birth', p_mother, p_date, p_sex, p_date + 21, p_newborn, p_register);
END;
$$;

-- ── A death: from the death summary (MCCD) or the death register ──────
CREATE OR REPLACE FUNCTION public.crs_record_death(
    p_tenant UUID, p_patient UUID, p_date DATE, p_summary UUID, p_register UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF p_patient IS NULL OR p_date IS NULL THEN
        RETURN;
    END IF;
    INSERT INTO public.crs_events (tenant_id, event_type, patient_id, event_date, due_on,
                                   death_summary_id, death_register_id)
    VALUES (p_tenant, 'death', p_patient, p_date, p_date + 21, p_summary, p_register)
    ON CONFLICT (tenant_id, patient_id) WHERE event_type = 'death' AND deleted_at IS NULL
    DO UPDATE SET death_summary_id = COALESCE(crs_events.death_summary_id, EXCLUDED.death_summary_id),
                  death_register_id = COALESCE(crs_events.death_register_id, EXCLUDED.death_register_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_crs_newborn() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.crs_record_birth(NEW.tenant_id, NEW.mother_id,
        COALESCE(NEW.date_of_birth, (NEW.birth_date AT TIME ZONE 'Asia/Kolkata')::date),
        NEW.gender, NEW.id, NULL);
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.trg_crs_birth_register() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.crs_record_birth(NEW.tenant_id, NEW.patient_id, NEW.birth_date,
        NEW.baby_gender, NULL, NEW.id);
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.trg_crs_death_summary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.crs_record_death(NEW.tenant_id, NEW.patient_id, NEW.date_of_death, NEW.id, NULL);
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.trg_crs_death_register() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.crs_record_death(NEW.tenant_id, NEW.patient_id, NEW.death_date, NULL, NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_newborn_records_crs ON public.newborn_records;
CREATE TRIGGER trg_newborn_records_crs AFTER INSERT ON public.newborn_records
    FOR EACH ROW EXECUTE FUNCTION public.trg_crs_newborn();
DROP TRIGGER IF EXISTS trg_mrd_birth_register_crs ON public.mrd_birth_register;
CREATE TRIGGER trg_mrd_birth_register_crs AFTER INSERT ON public.mrd_birth_register
    FOR EACH ROW EXECUTE FUNCTION public.trg_crs_birth_register();
DROP TRIGGER IF EXISTS trg_ipd_death_summaries_crs ON public.ipd_death_summaries;
CREATE TRIGGER trg_ipd_death_summaries_crs AFTER INSERT ON public.ipd_death_summaries
    FOR EACH ROW EXECUTE FUNCTION public.trg_crs_death_summary();
DROP TRIGGER IF EXISTS trg_mrd_death_register_crs ON public.mrd_death_register;
CREATE TRIGGER trg_mrd_death_register_crs AFTER INSERT ON public.mrd_death_register
    FOR EACH ROW EXECUTE FUNCTION public.trg_crs_death_register();

-- ── Backfill: the past year, the window CRS still registers late ──────
-- Events already past due are marked escalated so a first deploy does not
-- send one alert per historical birth; they show as overdue on the list.
-- A death the death register already reported to the municipality is
-- registered under the register number it was reported with.
-- Run per hospital, as the hospital: every table here is under forced RLS.
DO $$
DECLARE
    t RECORD;
    r RECORD;
    prev TEXT := current_setting('app.tenant_id', true);
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);
        FOR r IN SELECT mother_id,
                        COALESCE(date_of_birth, (birth_date AT TIME ZONE 'Asia/Kolkata')::date) AS d,
                        gender, id
                   FROM public.newborn_records
                  WHERE tenant_id = t.id AND deleted_at IS NULL AND mother_id IS NOT NULL
                    AND COALESCE(date_of_birth, birth_date::date) >= current_date - 365
                  ORDER BY created_at
        LOOP
            PERFORM public.crs_record_birth(t.id, r.mother_id, r.d, r.gender, r.id, NULL);
        END LOOP;
        FOR r IN SELECT patient_id, birth_date, baby_gender, id FROM public.mrd_birth_register
                  WHERE tenant_id = t.id AND deleted_at IS NULL
                    AND birth_date >= current_date - 365
                  ORDER BY created_at
        LOOP
            PERFORM public.crs_record_birth(t.id, r.patient_id, r.birth_date, r.baby_gender,
                                            NULL, r.id);
        END LOOP;
        FOR r IN SELECT patient_id, date_of_death, id FROM public.ipd_death_summaries
                  WHERE tenant_id = t.id AND deleted_at IS NULL
                    AND date_of_death >= current_date - 365
        LOOP
            PERFORM public.crs_record_death(t.id, r.patient_id, r.date_of_death, r.id, NULL);
        END LOOP;
        FOR r IN SELECT patient_id, death_date, id FROM public.mrd_death_register
                  WHERE tenant_id = t.id AND deleted_at IS NULL
                    AND death_date >= current_date - 365
        LOOP
            PERFORM public.crs_record_death(t.id, r.patient_id, r.death_date, NULL, r.id);
        END LOOP;
        UPDATE public.crs_events e
           SET status = 'registered', crs_registration_number = d.register_number,
               registered_on = d.municipality_report_date
          FROM public.mrd_death_register d
         WHERE e.tenant_id = t.id AND e.death_register_id = d.id
           AND d.reported_to_municipality AND e.status = 'pending';
        UPDATE public.crs_events SET escalated_at = now()
         WHERE tenant_id = t.id AND status = 'pending' AND due_on < current_date
           AND escalated_at IS NULL;
    END LOOP;
    PERFORM set_config('app.tenant_id', COALESCE(prev, ''), true);
END;
$$;
