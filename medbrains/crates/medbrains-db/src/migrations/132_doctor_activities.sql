-- ====================================================================
-- Migration: 132_doctor_activities.sql
-- RLS-Posture: tenant-scoped
-- Tenant-Column: tenant_id
-- New-Tables: doctor_profiles, doctor_signature_credentials,
--             signed_records, doctor_coverage_assignments
-- Drops: none
-- ====================================================================
-- Doctor Activities — Sub-Sprint A: profiles + digital signatures +
-- sign-off queue + dashboard. Per RFCs/sprints/SPRINT-doctor-activities.md.
--
-- Packages + locum coverage UX live in Sub-Sprint B (separate branch).
-- This migration includes coverage_assignments because the sign-off
-- queue surfaces "covering for" attribution.
--
-- Signatures are TWO things:
--   1. Cryptographic — Ed25519 over canonical JSON payload hash
--   2. Visual       — image stamp on PDF documents (display_image_url)
-- Both are recorded in signed_records.
-- ====================================================================

-- ── 1. doctor_profiles ──────────────────────────────────────────────

CREATE TABLE doctor_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prefix                      TEXT,
    display_name                TEXT NOT NULL,
    qualification_string        TEXT,
    mci_number                  TEXT,
    state_council_number        TEXT,
    state_council_name          TEXT,
    registration_valid_until    DATE,
    specialty_ids               UUID[] NOT NULL DEFAULT '{}',
    subspecialty                TEXT,
    years_experience            INT CHECK (years_experience >= 0 AND years_experience <= 80),
    is_full_time                BOOLEAN NOT NULL DEFAULT TRUE,
    is_visiting                 BOOLEAN NOT NULL DEFAULT FALSE,
    parent_employee_id          UUID,
    can_prescribe_schedule_x    BOOLEAN NOT NULL DEFAULT FALSE,
    can_perform_surgery         BOOLEAN NOT NULL DEFAULT FALSE,
    can_sign_mlc                BOOLEAN NOT NULL DEFAULT FALSE,
    can_sign_death_certificate  BOOLEAN NOT NULL DEFAULT FALSE,
    can_sign_fitness_certificate BOOLEAN NOT NULL DEFAULT TRUE,
    bio_short                   TEXT,
    bio_long                    TEXT,
    photo_url                   TEXT,
    languages_spoken            TEXT[] NOT NULL DEFAULT '{}',
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);

CREATE INDEX doctor_profiles_active_idx
    ON doctor_profiles (tenant_id, is_active)
    WHERE is_active;

CREATE INDEX doctor_profiles_user_idx
    ON doctor_profiles (tenant_id, user_id);

CREATE TRIGGER doctor_profiles_updated
    BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE doctor_profiles FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_profiles');

COMMENT ON TABLE doctor_profiles IS
    'Per-doctor identity, credentials, capability flags. SPRINT-doctor-activities.md §2.1';

-- ── 2. doctor_signature_credentials ─────────────────────────────────

CREATE TABLE doctor_signature_credentials (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    doctor_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_type         TEXT NOT NULL CHECK (credential_type IN
        ('stored_key', 'aadhaar_esign', 'dsc_usb', 'external_pkcs11')),
    algorithm               TEXT NOT NULL DEFAULT 'Ed25519',
    public_key              BYTEA NOT NULL,
    encrypted_private_key   BYTEA,
    -- Visual representation (the scanned signature image stamped onto
    -- printed documents). NULL = use generated text-only signature block.
    display_image_url       TEXT,
    -- Optional handwriting font name to render "Dr. XYZ" cursive when
    -- no image is available. Defaults applied at print time.
    display_font            TEXT,
    valid_from              TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until             TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    revoked_reason          TEXT,
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    created_by              UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX doctor_signature_credentials_doctor_idx
    ON doctor_signature_credentials (tenant_id, doctor_user_id)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX doctor_signature_credentials_default_idx
    ON doctor_signature_credentials (tenant_id, doctor_user_id)
    WHERE is_default AND revoked_at IS NULL;

ALTER TABLE doctor_signature_credentials FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_signature_credentials');

COMMENT ON TABLE doctor_signature_credentials IS
    'Ed25519 credentials per doctor. encrypted_private_key uses pgcrypto with tenant master key. display_image_url is the visual signature stamped on PDFs. SPRINT-doctor-activities.md §2.4.';

-- ── 3. signed_records ───────────────────────────────────────────────
-- Universal audit row for every digital signature. Multi-signer
-- records have multiple rows referencing same (record_type, record_id).

CREATE TABLE signed_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    record_type             TEXT NOT NULL CHECK (record_type IN (
        'prescription', 'lab_report', 'radiology_report', 'discharge_summary',
        'mlc_certificate', 'death_certificate', 'fitness_certificate',
        'medical_leave_certificate', 'birth_certificate', 'consent_form',
        'operative_note', 'progress_note', 'package_subscription',
        'order_basket', 'invoice', 'refund', 'other'
    )),
    record_id               UUID NOT NULL,
    signer_user_id          UUID NOT NULL REFERENCES users(id),
    signer_role             TEXT NOT NULL CHECK (signer_role IN
        ('primary', 'co_signer', 'attestor', 'witness')),
    signer_credential_id    UUID REFERENCES doctor_signature_credentials(id),
    signed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- SHA-256 of canonicalized payload
    payload_hash            BYTEA NOT NULL,
    -- Ed25519 signature bytes
    signature_bytes         BYTEA NOT NULL,
    -- Snapshot of the displayable signature image at sign time (denormalized
    -- so we can stamp the historical image even if the credential's image
    -- is later updated)
    display_image_snapshot  TEXT,
    -- Display block text rendered into PDF: "Digitally signed by Dr. X
    -- on 2026-04-28 14:32 IST. Verify: <verification_url>"
    display_block           TEXT,
    legal_class             TEXT NOT NULL CHECK (legal_class IN
        ('administrative', 'clinical', 'medico_legal', 'statutory_export')),
    device_fingerprint      TEXT,
    ip_address              INET,
    user_agent              TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX signed_records_record_idx
    ON signed_records (tenant_id, record_type, record_id);

CREATE INDEX signed_records_signer_idx
    ON signed_records (tenant_id, signer_user_id, signed_at DESC);

CREATE INDEX signed_records_legal_idx
    ON signed_records (tenant_id, legal_class, signed_at DESC);

ALTER TABLE signed_records FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('signed_records');

COMMENT ON TABLE signed_records IS
    'Universal audit row for every digital signature event. payload_hash + signature_bytes cryptographically verifiable. display_image_snapshot + display_block frozen at sign time for PDF embedding. SPRINT-doctor-activities.md §2.4.';

-- ── 4. doctor_coverage_assignments ──────────────────────────────────
-- Locum / cross-coverage. Dr. A out → Dr. B covers; appointments and
-- sign-offs route to Dr. B with "covering for Dr. A" attribution.

CREATE TABLE doctor_coverage_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    absent_doctor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    covering_doctor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ NOT NULL CHECK (end_at > start_at),
    reason              TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (absent_doctor_id <> covering_doctor_id)
);

CREATE INDEX doctor_coverage_assignments_active_idx
    ON doctor_coverage_assignments (tenant_id, absent_doctor_id, start_at, end_at);

CREATE INDEX doctor_coverage_assignments_covering_idx
    ON doctor_coverage_assignments (tenant_id, covering_doctor_id, start_at, end_at);

ALTER TABLE doctor_coverage_assignments FORCE ROW LEVEL SECURITY;
SELECT apply_tenant_rls('doctor_coverage_assignments');

COMMENT ON TABLE doctor_coverage_assignments IS
    'Locum/cross-coverage assignments. Dr. A absent → Dr. B covers. Surfaces in appointment routing + sign-off queue. SPRINT-doctor-activities.md §2.2.';

-- ── 5. is_signed flag on signable record types ─────────────────────
-- Add denormalized is_signed flag where missing so the pending-signoffs
-- view is fast. Best-effort: only ALTER tables that exist; ignore if
-- some haven't been created yet (older migrations).

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prescriptions') THEN
        ALTER TABLE prescriptions
            ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS signed_record_id UUID;
        CREATE INDEX IF NOT EXISTS prescriptions_unsigned_idx
            ON prescriptions (tenant_id, ordered_by) WHERE NOT is_signed;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lab_results') THEN
        ALTER TABLE lab_results
            ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS signed_record_id UUID;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'radiology_reports') THEN
        ALTER TABLE radiology_reports
            ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS signed_record_id UUID;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'discharge_summaries') THEN
        ALTER TABLE discharge_summaries
            ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS signed_record_id UUID;
    END IF;
END $$;

-- ── 6. Worker grants ────────────────────────────────────────────────
GRANT SELECT ON doctor_profiles, doctor_signature_credentials,
                signed_records, doctor_coverage_assignments
                TO medbrains_outbox_worker;
