-- RLS-Posture: tenant-scoped
-- ============================================================
-- MedBrains schema -- MRD case-sheet packet and shelf tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mrd_storage_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    building text,
    floor text,
    room text,
    rack text,
    shelf text,
    bin text,
    barcode text,
    capacity integer,
    current_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_tenant_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_capacity_check
    CHECK ((capacity IS NULL) OR (capacity >= 0));

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_current_count_check CHECK (current_count >= 0);

CREATE INDEX IF NOT EXISTS idx_mrd_storage_locations_tenant_active
    ON public.mrd_storage_locations USING btree (tenant_id, is_active, code);

CREATE TABLE IF NOT EXISTS public.mrd_case_sheet_packets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    admission_id uuid,
    medical_record_id uuid,
    packet_number text NOT NULL,
    packet_type text NOT NULL,
    status text DEFAULT 'generated'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    page_count integer DEFAULT 0 NOT NULL,
    document_output_id uuid,
    print_job_id uuid,
    storage_location_id uuid,
    shelf_location text,
    source_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    reprint_reason text,
    notes text,
    generated_by uuid,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    printed_by uuid,
    printed_at timestamp with time zone,
    filed_by uuid,
    filed_at timestamp with time zone,
    voided_by uuid,
    voided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mrd_case_sheet_packets_packet_type_check
        CHECK (packet_type = ANY (ARRAY['opd'::text, 'ipd'::text])),
    CONSTRAINT mrd_case_sheet_packets_status_check
        CHECK (status = ANY (ARRAY[
            'draft'::text,
            'generated'::text,
            'printed'::text,
            'filed'::text,
            'issued'::text,
            'returned'::text,
            'deficient'::text,
            'voided'::text
        ])),
    CONSTRAINT mrd_case_sheet_packets_version_check CHECK (version > 0),
    CONSTRAINT mrd_case_sheet_packets_page_count_check CHECK (page_count >= 0),
    CONSTRAINT mrd_case_sheet_packets_source_check
        CHECK (
            ((packet_type = 'opd'::text) AND (encounter_id IS NOT NULL))
            OR ((packet_type = 'ipd'::text) AND (admission_id IS NOT NULL))
        )
);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_tenant_packet_number_key UNIQUE (tenant_id, packet_number);

CREATE INDEX IF NOT EXISTS idx_mrd_case_sheet_packets_patient
    ON public.mrd_case_sheet_packets USING btree (tenant_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mrd_case_sheet_packets_encounter
    ON public.mrd_case_sheet_packets USING btree (tenant_id, encounter_id)
    WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mrd_case_sheet_packets_admission
    ON public.mrd_case_sheet_packets USING btree (tenant_id, admission_id)
    WHERE admission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mrd_case_sheet_packets_status
    ON public.mrd_case_sheet_packets USING btree (tenant_id, status, packet_type);

CREATE TABLE IF NOT EXISTS public.mrd_case_sheet_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    packet_id uuid NOT NULL,
    page_code text NOT NULL,
    page_title text NOT NULL,
    page_order integer NOT NULL,
    source_module text,
    source_table text,
    source_id uuid,
    document_output_id uuid,
    is_required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp with time zone,
    printed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mrd_case_sheet_pages_page_order_check CHECK (page_order > 0),
    CONSTRAINT mrd_case_sheet_pages_status_check
        CHECK (status = ANY (ARRAY[
            'pending'::text,
            'available'::text,
            'printed'::text,
            'deficient'::text,
            'waived'::text
        ]))
);

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_packet_page_code_key UNIQUE (packet_id, page_code);

CREATE INDEX IF NOT EXISTS idx_mrd_case_sheet_pages_packet
    ON public.mrd_case_sheet_pages USING btree (packet_id, page_order);

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.mrd_storage_locations
    ADD CONSTRAINT mrd_storage_locations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_encounter_id_fkey
    FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_admission_id_fkey
    FOREIGN KEY (admission_id) REFERENCES public.admissions(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_medical_record_id_fkey
    FOREIGN KEY (medical_record_id) REFERENCES public.mrd_medical_records(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_document_output_id_fkey
    FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_print_job_id_fkey
    FOREIGN KEY (print_job_id) REFERENCES public.print_jobs(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_storage_location_id_fkey
    FOREIGN KEY (storage_location_id) REFERENCES public.mrd_storage_locations(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_generated_by_fkey
    FOREIGN KEY (generated_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_printed_by_fkey
    FOREIGN KEY (printed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.mrd_case_sheet_packets
    ADD CONSTRAINT mrd_case_sheet_packets_filed_by_fkey
    FOREIGN KEY (filed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_packet_id_fkey
    FOREIGN KEY (packet_id) REFERENCES public.mrd_case_sheet_packets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mrd_case_sheet_pages
    ADD CONSTRAINT mrd_case_sheet_pages_document_output_id_fkey
    FOREIGN KEY (document_output_id) REFERENCES public.document_outputs(id);

CREATE TRIGGER trg_mrd_storage_locations_updated_at
    BEFORE UPDATE ON public.mrd_storage_locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_mrd_case_sheet_packets_updated_at
    BEFORE UPDATE ON public.mrd_case_sheet_packets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_mrd_case_sheet_pages_updated_at
    BEFORE UPDATE ON public.mrd_case_sheet_pages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.mrd_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrd_case_sheet_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrd_case_sheet_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY mrd_storage_locations_tenant ON public.mrd_storage_locations
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE POLICY mrd_case_sheet_packets_tenant ON public.mrd_case_sheet_packets
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));

CREATE POLICY mrd_case_sheet_pages_tenant ON public.mrd_case_sheet_pages
    USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
