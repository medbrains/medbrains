-- RLS-Posture: tenant-scoped
-- Unified hospital asset taxonomy and camp asset custody.
--
-- Existing source tables remain authoritative:
-- bme_equipment, equipment, fms_fire_equipment, cssd_instruments,
-- cssd_sterilizers, linen_items, and future source modules. This migration
-- adds cross-source categorisation and camp reservation/issue/return tracking.

ALTER TABLE public.asset_categories
    ADD COLUMN IF NOT EXISTS code text,
    ADD COLUMN IF NOT EXISTS parent_id uuid,
    ADD COLUMN IF NOT EXISTS asset_domain text DEFAULT 'general' NOT NULL,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS regulatory_class text,
    ADD COLUMN IF NOT EXISTS default_pm_frequency text,
    ADD COLUMN IF NOT EXISTS default_calibration_frequency text,
    ADD COLUMN IF NOT EXISTS requires_pm boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS requires_calibration boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS is_camp_eligible boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

UPDATE public.asset_categories
SET code = upper(regexp_replace(name, '[^A-Za-z0-9]+', '_', 'g'))
WHERE code IS NULL;

ALTER TABLE public.asset_categories
    ALTER COLUMN code SET DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_categories_parent_id_fkey'
    ) THEN
        ALTER TABLE public.asset_categories
            ADD CONSTRAINT asset_categories_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES public.asset_categories(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_categories_domain_check'
    ) THEN
        ALTER TABLE public.asset_categories
            ADD CONSTRAINT asset_categories_domain_check
            CHECK (asset_domain IN (
                'biomedical', 'diagnostic_monitoring', 'therapeutic_life_support',
                'lab', 'imaging', 'ot_cssd', 'dental_ent_ophthalmology',
                'facility_utility', 'fire_safety', 'it_device',
                'furniture_fixture', 'mobility_transport', 'housekeeping_laundry',
                'kitchen_dietary', 'security_surveillance', 'teaching_simulation',
                'camp_mobile', 'general'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'asset_categories_tenant_code_key'
    ) THEN
        ALTER TABLE public.asset_categories
            ADD CONSTRAINT asset_categories_tenant_code_key UNIQUE (tenant_id, code);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.store_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    store_domain text DEFAULT 'general' NOT NULL,
    description text,
    requires_batch_tracking boolean DEFAULT false NOT NULL,
    requires_expiry_tracking boolean DEFAULT false NOT NULL,
    requires_temperature_log boolean DEFAULT false NOT NULL,
    requires_license_tracking boolean DEFAULT false NOT NULL,
    is_camp_source boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT store_categories_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES public.store_categories(id),
    CONSTRAINT store_categories_tenant_code_key UNIQUE (tenant_id, code),
    CONSTRAINT store_categories_domain_check
        CHECK (store_domain IN (
            'pharmacy', 'ndps_controlled', 'medical_consumables',
            'surgical_consumables', 'lab_reagents', 'cssd_sterile',
            'linen_laundry', 'kitchen_dietary', 'housekeeping',
            'biomedical_spares', 'it_store', 'maintenance_engineering',
            'ppe_infection_control', 'biomedical_waste', 'blood_bank',
            'radiology_contrast', 'stationery_forms', 'camp_mobile', 'general'
        ))
);

CREATE TABLE IF NOT EXISTS public.asset_classifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    asset_category_id uuid,
    store_category_id uuid,
    asset_domain text DEFAULT 'general' NOT NULL,
    criticality text DEFAULT 'routine' NOT NULL,
    custody_mode text DEFAULT 'asset_tagged' NOT NULL,
    is_camp_eligible boolean DEFAULT false NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT asset_classifications_asset_category_id_fkey
        FOREIGN KEY (asset_category_id) REFERENCES public.asset_categories(id),
    CONSTRAINT asset_classifications_store_category_id_fkey
        FOREIGN KEY (store_category_id) REFERENCES public.store_categories(id),
    CONSTRAINT asset_classifications_tenant_source_key UNIQUE (tenant_id, source_type, source_id),
    CONSTRAINT asset_classifications_source_type_check
        CHECK (source_type IN (
            'bme_equipment', 'equipment', 'fms_fire_equipment',
            'cssd_instrument', 'cssd_sterilizer', 'linen_item',
            'ambulance', 'it_device', 'vehicle', 'other'
        )),
    CONSTRAINT asset_classifications_criticality_check
        CHECK (criticality IN ('critical', 'high', 'routine', 'low')),
    CONSTRAINT asset_classifications_custody_mode_check
        CHECK (custody_mode IN ('asset_tagged', 'serialised', 'pooled', 'non_movable'))
);

CREATE TABLE IF NOT EXISTS public.camp_asset_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    camp_id uuid NOT NULL,
    asset_classification_id uuid,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    asset_category_id uuid,
    asset_code text,
    asset_name text NOT NULL,
    asset_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    required_from timestamptz,
    required_to timestamptz,
    quantity integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'reserved' NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    requested_by uuid,
    reserved_by uuid,
    reserved_at timestamptz,
    issued_by uuid,
    issued_to uuid,
    issued_at timestamptz,
    returned_by uuid,
    returned_at timestamptz,
    issue_condition text,
    return_condition text,
    damage_notes text,
    loss_notes text,
    reconciliation_notes text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT camp_asset_reservations_camp_id_fkey
        FOREIGN KEY (camp_id) REFERENCES public.camps(id) ON DELETE CASCADE,
    CONSTRAINT camp_asset_reservations_classification_id_fkey
        FOREIGN KEY (asset_classification_id) REFERENCES public.asset_classifications(id),
    CONSTRAINT camp_asset_reservations_category_id_fkey
        FOREIGN KEY (asset_category_id) REFERENCES public.asset_categories(id),
    CONSTRAINT camp_asset_reservations_quantity_check CHECK (quantity > 0),
    CONSTRAINT camp_asset_reservations_source_type_check
        CHECK (source_type IN (
            'bme_equipment', 'equipment', 'fms_fire_equipment',
            'cssd_instrument', 'cssd_sterilizer', 'linen_item',
            'ambulance', 'it_device', 'vehicle', 'other'
        )),
    CONSTRAINT camp_asset_reservations_status_check
        CHECK (status IN (
            'requested', 'reserved', 'issued', 'returned',
            'damaged', 'lost', 'cancelled'
        ))
);

CREATE INDEX IF NOT EXISTS idx_asset_categories_tenant_domain
    ON public.asset_categories (tenant_id, asset_domain, is_active);

CREATE INDEX IF NOT EXISTS idx_store_categories_tenant_domain
    ON public.store_categories (tenant_id, store_domain, is_active);

CREATE INDEX IF NOT EXISTS idx_asset_classifications_source
    ON public.asset_classifications (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_asset_classifications_category
    ON public.asset_classifications (tenant_id, asset_category_id)
    WHERE asset_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_camp_asset_reservations_camp
    ON public.camp_asset_reservations (tenant_id, camp_id, status);

CREATE INDEX IF NOT EXISTS idx_camp_asset_reservations_source
    ON public.camp_asset_reservations (tenant_id, source_type, source_id, status);

CREATE INDEX IF NOT EXISTS idx_camp_asset_reservations_return
    ON public.camp_asset_reservations (tenant_id, camp_id)
    WHERE status IN ('issued', 'damaged', 'lost');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_asset_categories_updated_at'
    ) THEN
        CREATE TRIGGER trg_asset_categories_updated_at
            BEFORE UPDATE ON public.asset_categories
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_store_categories_updated_at'
    ) THEN
        CREATE TRIGGER trg_store_categories_updated_at
            BEFORE UPDATE ON public.store_categories
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_asset_classifications_updated_at'
    ) THEN
        CREATE TRIGGER trg_asset_classifications_updated_at
            BEFORE UPDATE ON public.asset_classifications
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_camp_asset_reservations_updated_at'
    ) THEN
        CREATE TRIGGER trg_camp_asset_reservations_updated_at
            BEFORE UPDATE ON public.camp_asset_reservations
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_asset_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'asset_categories'
          AND policyname = 'asset_categories_tenant'
    ) THEN
        CREATE POLICY asset_categories_tenant ON public.asset_categories
            USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'store_categories'
          AND policyname = 'store_categories_tenant'
    ) THEN
        CREATE POLICY store_categories_tenant ON public.store_categories
            USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'asset_classifications'
          AND policyname = 'asset_classifications_tenant'
    ) THEN
        CREATE POLICY asset_classifications_tenant ON public.asset_classifications
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'camp_asset_reservations'
          AND policyname = 'camp_asset_reservations_tenant'
    ) THEN
        CREATE POLICY camp_asset_reservations_tenant ON public.camp_asset_reservations
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
    END IF;
END $$;

INSERT INTO public.asset_categories
    (tenant_id, code, name, asset_domain, description, requires_pm, requires_calibration, is_camp_eligible, sort_order)
VALUES
    (NULL, 'BIOMEDICAL_DIAGNOSTIC', 'Biomedical diagnostic and monitoring', 'diagnostic_monitoring', 'BP apparatus, ECG, monitors, oximeters, glucometers and similar diagnostic devices', true, true, true, 10),
    (NULL, 'BIOMEDICAL_THERAPEUTIC', 'Biomedical therapeutic and life support', 'therapeutic_life_support', 'Ventilators, infusion pumps, defibrillators and life-support devices', true, true, true, 20),
    (NULL, 'LAB_EQUIPMENT', 'Laboratory equipment', 'lab', 'Analyzers, centrifuges, microscopes and lab instruments', true, true, false, 30),
    (NULL, 'OT_CSSD_EQUIPMENT', 'OT and CSSD equipment', 'ot_cssd', 'Sterilizers, surgical sets and procedural equipment', true, true, false, 40),
    (NULL, 'FACILITY_UTILITY', 'Facility utility equipment', 'facility_utility', 'Power, water, gas, HVAC and engineering utility assets', true, false, false, 50),
    (NULL, 'FIRE_SAFETY', 'Fire and safety equipment', 'fire_safety', 'Extinguishers, hydrants, alarms, detectors and emergency lights', true, false, true, 60),
    (NULL, 'IT_DEVICES', 'IT, printers and barcode devices', 'it_device', 'Computers, printers, scanners, tablets, routers and barcode devices', true, false, true, 70),
    (NULL, 'MOBILITY_TRANSPORT', 'Mobility and transport assets', 'mobility_transport', 'Ambulances, wheelchairs, stretchers and transport equipment', true, false, true, 80),
    (NULL, 'HOUSEKEEPING_LAUNDRY', 'Housekeeping and laundry assets', 'housekeeping_laundry', 'Laundry equipment, cleaning machines and reusable linen assets', true, false, false, 90),
    (NULL, 'CAMP_MOBILE', 'Camp and mobile kit assets', 'camp_mobile', 'Reusable outreach camp kits and mobile clinical equipment', true, true, true, 100)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.store_categories
    (tenant_id, code, name, store_domain, description, requires_batch_tracking, requires_expiry_tracking, requires_temperature_log, requires_license_tracking, is_camp_source, sort_order)
VALUES
    (NULL, 'PHARMACY', 'Pharmacy store', 'pharmacy', 'Medicines and pharmacy stock', true, true, true, true, true, 10),
    (NULL, 'NDPS_CONTROLLED', 'NDPS / controlled drug store', 'ndps_controlled', 'Narcotic and controlled medicine stock requiring extra registers', true, true, true, true, false, 20),
    (NULL, 'MEDICAL_CONSUMABLES', 'Medical consumables store', 'medical_consumables', 'Syringes, cannulas, dressings, strips and ward consumables', true, true, false, false, true, 30),
    (NULL, 'SURGICAL_CONSUMABLES', 'Surgical consumables store', 'surgical_consumables', 'Sutures, implants, OT disposables and procedure packs', true, true, false, false, false, 40),
    (NULL, 'LAB_REAGENTS', 'Lab reagents and chemicals', 'lab_reagents', 'Reagents, controls, calibrators and lab chemicals', true, true, true, false, false, 50),
    (NULL, 'CSSD_STERILE', 'CSSD sterile store', 'cssd_sterile', 'Sterile packs, instruments and sterilisation supplies', true, true, false, false, false, 60),
    (NULL, 'LINEN_LAUNDRY', 'Linen and laundry store', 'linen_laundry', 'Linen stock, movement and condemnation', false, false, false, false, false, 70),
    (NULL, 'KITCHEN_DIETARY', 'Kitchen and dietary store', 'kitchen_dietary', 'Food ingredients and dietary supplies', true, true, true, false, false, 80),
    (NULL, 'HOUSEKEEPING', 'Housekeeping store', 'housekeeping', 'Cleaning supplies and housekeeping consumables', true, true, false, false, false, 90),
    (NULL, 'BIOMEDICAL_SPARES', 'Biomedical spares store', 'biomedical_spares', 'Biomedical spare parts and service stock', true, false, false, false, false, 100),
    (NULL, 'IT_STORE', 'IT store', 'it_store', 'IT accessories, printer media, labels and devices', true, false, false, false, true, 110),
    (NULL, 'MAINTENANCE_ENGINEERING', 'Maintenance and engineering store', 'maintenance_engineering', 'Electrical, plumbing, gas and civil maintenance stock', true, false, false, false, false, 120),
    (NULL, 'PPE_INFECTION_CONTROL', 'PPE and infection control store', 'ppe_infection_control', 'PPE, disinfectants and infection-control supplies', true, true, false, false, true, 130),
    (NULL, 'BMW', 'Biomedical waste supplies', 'biomedical_waste', 'BMW bags, bins, liners, labels and handoff material', true, true, false, true, true, 140),
    (NULL, 'CAMP_MOBILE_STORE', 'Camp mobile store', 'camp_mobile', 'Dedicated camp kits, outreach stock and mobile issue locations', true, true, false, false, true, 150)
ON CONFLICT (tenant_id, code) DO NOTHING;
