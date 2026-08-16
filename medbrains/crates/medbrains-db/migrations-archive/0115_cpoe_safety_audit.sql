-- Goal 7: CPOE/CDS Phase 1.
-- Unsafe medication orders must leave an immutable safety trail whether they
-- are blocked, warned, or overridden by an authorized clinician.

CREATE TABLE IF NOT EXISTS public.cpoe_safety_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    source_module text NOT NULL,
    source_record_id uuid,
    order_type text NOT NULL,
    warning_code text NOT NULL,
    severity text NOT NULL,
    action_taken text NOT NULL,
    item_ref jsonb DEFAULT '{}'::jsonb NOT NULL,
    message text NOT NULL,
    override_reason text,
    overridden_by uuid,
    checked_by uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cpoe_safety_audit_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_source_module_check'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_source_module_check
            CHECK (source_module IN ('pharmacy', 'order_basket'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_order_type_check'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_order_type_check
            CHECK (order_type IN ('drug', 'lab', 'radiology', 'procedure', 'diet', 'referral'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_severity_check'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_severity_check
            CHECK (severity IN ('warn', 'block'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_action_taken_check'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_action_taken_check
            CHECK (action_taken IN ('blocked', 'warned', 'overridden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_override_reason_check'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_override_reason_check
            CHECK (
                action_taken <> 'overridden'
                OR (
                    override_reason IS NOT NULL
                    AND length(trim(override_reason)) >= 5
                    AND overridden_by IS NOT NULL
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_tenant_id_fkey'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_patient_id_fkey'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES public.patients(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_checked_by_fkey'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_checked_by_fkey
            FOREIGN KEY (checked_by) REFERENCES public.users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cpoe_safety_audit_overridden_by_fkey'
    ) THEN
        ALTER TABLE public.cpoe_safety_audit
            ADD CONSTRAINT cpoe_safety_audit_overridden_by_fkey
            FOREIGN KEY (overridden_by) REFERENCES public.users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cpoe_safety_audit_patient_checked
    ON public.cpoe_safety_audit (tenant_id, patient_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_cpoe_safety_audit_source
    ON public.cpoe_safety_audit (tenant_id, source_module, source_record_id)
    WHERE source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cpoe_safety_audit_code
    ON public.cpoe_safety_audit (tenant_id, warning_code, checked_at DESC);

ALTER TABLE public.cpoe_safety_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.cpoe_safety_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cpoe_safety_audit ON public.cpoe_safety_audit;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'cpoe_safety_audit'
          AND policyname = 'tenant_isolation_cpoe_safety_audit'
    ) THEN
        CREATE POLICY tenant_isolation_cpoe_safety_audit
            ON public.cpoe_safety_audit
            USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
            WITH CHECK ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
    END IF;
END $$;
