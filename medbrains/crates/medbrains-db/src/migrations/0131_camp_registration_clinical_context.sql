-- RLS-Posture: tenant-scoped

ALTER TABLE public.camp_registrations
  ADD COLUMN IF NOT EXISTS clinical_department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS attending_doctor_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS service_line text;

CREATE INDEX IF NOT EXISTS idx_camp_reg_clinical_department
  ON public.camp_registrations (tenant_id, clinical_department_id)
  WHERE clinical_department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_camp_reg_attending_doctor
  ON public.camp_registrations (tenant_id, attending_doctor_id)
  WHERE attending_doctor_id IS NOT NULL;
