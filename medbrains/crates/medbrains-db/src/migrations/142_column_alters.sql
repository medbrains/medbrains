-- ====================================================================
-- Migration: 142_column_alters.sql
-- RLS-Posture: inherits per-table (no new tables)
-- New-Tables: none
-- Drops: none
-- ====================================================================
-- ADD COLUMN IF NOT EXISTS for every column referenced by route
-- handlers but missing from the original table definition. Surfaced
-- by the smoke layer as "column X does not exist" 5xx errors.
--
-- All ALTERs use IF NOT EXISTS so re-runs are safe.
-- ====================================================================

-- ── locations: bed routing + status ────────────────────────────────

ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS bed_type_id UUID,
    ADD COLUMN IF NOT EXISTS status TEXT;

-- ── mlc_cases: link to admission + examining doctor ────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mlc_cases') THEN
        ALTER TABLE mlc_cases
            ADD COLUMN IF NOT EXISTS admission_id UUID,
            ADD COLUMN IF NOT EXISTS examining_doctor_id UUID;
    END IF;
END $$;

-- ── invoices: admission + doctor links ─────────────────────────────

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS admission_id UUID,
    ADD COLUMN IF NOT EXISTS doctor_id UUID;

-- ── fall_risk_assessments: admission link ──────────────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fall_risk_assessments') THEN
        ALTER TABLE fall_risk_assessments
            ADD COLUMN IF NOT EXISTS admission_id UUID;
    END IF;
END $$;

-- ── cashless_claims: admission link ────────────────────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashless_claims') THEN
        ALTER TABLE cashless_claims
            ADD COLUMN IF NOT EXISTS admission_id UUID;
    END IF;
END $$;

-- ── patients: ABHA + address line 1 ────────────────────────────────

ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS abha_number TEXT,
    ADD COLUMN IF NOT EXISTS address_line1 TEXT;

-- ── users: designation + computed full_name view ───────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS designation_id UUID;

-- Add full_name as a generated column if missing — handlers query
-- u.full_name in joins. (Postgres requires the dependency cols to
-- exist; if first_name/last_name don't exist on users, skip.)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE users
            ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
                CASE
                    WHEN first_name IS NULL AND last_name IS NULL THEN NULL
                    WHEN first_name IS NULL THEN last_name
                    WHEN last_name IS NULL THEN first_name
                    ELSE first_name || ' ' || last_name
                END
            ) STORED;
    END IF;
END $$;

-- ── lab_orders: department link ────────────────────────────────────

ALTER TABLE lab_orders
    ADD COLUMN IF NOT EXISTS department_id UUID;

-- ── case_records: primary surgeon (for OT analytics) ───────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_records') THEN
        ALTER TABLE case_records
            ADD COLUMN IF NOT EXISTS primary_surgeon UUID;
    END IF;
END $$;

-- ── donations / blood_donations: medical officer link ──────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blood_donations') THEN
        ALTER TABLE blood_donations
            ADD COLUMN IF NOT EXISTS medical_officer_id UUID;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'donations') THEN
        ALTER TABLE donations
            ADD COLUMN IF NOT EXISTS medical_officer_id UUID;
    END IF;
END $$;

-- ── lab_results: numeric_value (for delta-check + range comparison) ─

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lab_results') THEN
        ALTER TABLE lab_results
            ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(14,4);
    END IF;
END $$;

-- ── newborns: mother link (maternity module) ───────────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'newborn_records') THEN
        ALTER TABLE newborn_records
            ADD COLUMN IF NOT EXISTS mother_id UUID;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'newborns') THEN
        ALTER TABLE newborns
            ADD COLUMN IF NOT EXISTS mother_id UUID;
    END IF;
END $$;

-- ── ot_bookings: surgeon link ──────────────────────────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ot_bookings') THEN
        ALTER TABLE ot_bookings
            ADD COLUMN IF NOT EXISTS surgeon_id UUID;
    END IF;
END $$;

-- ── radiology_orders: patient_id (for join robustness) ─────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'radiology_orders') THEN
        ALTER TABLE radiology_orders
            ADD COLUMN IF NOT EXISTS patient_id UUID;
    END IF;
END $$;

-- ── employee_credentials: credential_number (for HR/regulatory print) ─

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_credentials') THEN
        ALTER TABLE employee_credentials
            ADD COLUMN IF NOT EXISTS credential_number TEXT;
    END IF;
END $$;

-- ── visitor_logs: checked_out_at (front-office analytics) ──────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitor_logs') THEN
        ALTER TABLE visitor_logs
            ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
    END IF;
END $$;

-- ── adr_reports: reporter_department_id ────────────────────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'adr_reports') THEN
        ALTER TABLE adr_reports
            ADD COLUMN IF NOT EXISTS reporter_department_id UUID;
    END IF;
END $$;

-- ── audit_logs: department_id (for filtered audit views) ───────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS department_id UUID;
    END IF;
END $$;

-- ── pharmacy_payment_transactions: updated_at + trigger ────────────

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacy_payment_transactions') THEN
        ALTER TABLE pharmacy_payment_transactions
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'pharmacy_payment_transactions_updated'
        ) THEN
            CREATE TRIGGER pharmacy_payment_transactions_updated
                BEFORE UPDATE ON pharmacy_payment_transactions
                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        END IF;
    END IF;
END $$;
