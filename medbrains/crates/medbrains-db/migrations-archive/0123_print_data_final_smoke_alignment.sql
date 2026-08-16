-- Final schema alignment discovered by print-data smoke coverage.
-- Keep this separate from 0122 so local databases that already recorded 0122
-- do not hit SQLx migration checksum mismatches.

CREATE TABLE IF NOT EXISTS public.fall_risk_interventions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
    intervention_text text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fall_risk_interventions_admission_idx
    ON public.fall_risk_interventions (tenant_id, admission_id, created_at);

ALTER TABLE public.fall_risk_interventions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fall_risk_interventions'
          AND policyname = 'tenant_isolation_fall_risk_interventions'
    ) THEN
        CREATE POLICY tenant_isolation_fall_risk_interventions
            ON public.fall_risk_interventions
            USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
            WITH CHECK ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
    END IF;
END
$$;
