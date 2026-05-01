//! Canonical fixture rows with hardcoded UUIDs.
//!
//! Mirrors the `SEED` map in `apps/web/e2e/helpers/canonical-seed.ts`. The
//! TypeScript-side smoke + Vitest tests substitute these UUIDs into path
//! params; this Rust seeder ensures the rows actually exist.
//!
//! Idempotent — every insert uses `ON CONFLICT (id) DO NOTHING` so
//! re-running on a populated DB is a no-op.
//!
//! Why a Rust seed module rather than an HTTP seeder:
//! - No API contract drift (handlers may add required fields; our seed
//!   doesn't have to track them).
//! - No FK chain headaches — we control insert order in one place.
//! - Runs at server boot before any request lands, so the first smoke
//!   call already has a row to read.
//!
//! UUID layout (matches `canonical-seed.ts`):
//!   `10000000-0000-4000-8000-XXXXXXXXXXXX`
//! where suffix encodes (domain × 100 + entity).

use sqlx::PgPool;
use uuid::Uuid;

const PATIENT_ID: &str = "10000000-0000-4000-8000-000000000010";
const ENCOUNTER_ID: &str = "10000000-0000-4000-8000-000000000020";
const APPOINTMENT_ID: &str = "10000000-0000-4000-8000-000000000021";
const ADMISSION_ID: &str = "10000000-0000-4000-8000-000000000040";
const INVOICE_ID: &str = "10000000-0000-4000-8000-000000000060";
const EMERGENCY_CASE_ID: &str = "10000000-0000-4000-8000-000000000140";

/// Seed canonical fixtures for the given tenant. Pulls a pre-existing
/// demo department + doctor + admin user from the demo data already
/// inserted by `demo_patients::seed_demo_patients`.
pub async fn seed_canonical_fixtures(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    // Look up the demo dept + doctor + admin user for FK refs.
    // demo_patients seeded `General Medicine` department + `dr_ravi`
    // doctor user; we reuse them.
    let dept_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 ORDER BY created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let doctor_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND role = 'doctor' \
         ORDER BY created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let admin_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM users WHERE tenant_id = $1 AND role = 'super_admin' \
         ORDER BY created_at LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (Some(dept_id), Some(doctor_id), Some(admin_id)) = (dept_id, doctor_id, admin_id) else {
        tracing::warn!(
            "canonical fixtures skipped — demo dept/doctor/admin not found for tenant {tenant_id}"
        );
        tx.commit().await?;
        return Ok(());
    };

    let patient_uuid = PATIENT_ID.parse::<Uuid>()?;
    let encounter_uuid = ENCOUNTER_ID.parse::<Uuid>()?;
    let appointment_uuid = APPOINTMENT_ID.parse::<Uuid>()?;
    let admission_uuid = ADMISSION_ID.parse::<Uuid>()?;
    let invoice_uuid = INVOICE_ID.parse::<Uuid>()?;
    let emergency_uuid = EMERGENCY_CASE_ID.parse::<Uuid>()?;

    // ── Patient (UH-CANONICAL-1) ─────────────────────────────
    sqlx::query(
        "INSERT INTO patients \
         (id, tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'UH-CANONICAL-1', 'Smoke', 'Patient', 'female'::gender, \
                 '9000000010', '1986-03-14'::date) \
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(patient_uuid)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    // ── OPD encounter ────────────────────────────────────────
    sqlx::query(
        "INSERT INTO encounters \
         (id, tenant_id, patient_id, encounter_type, status, department_id, doctor_id, notes) \
         VALUES ($1, $2, $3, 'opd'::encounter_type, 'open'::encounter_status, $4, $5, \
                 'Canonical fixture encounter') \
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(encounter_uuid)
    .bind(tenant_id)
    .bind(patient_uuid)
    .bind(dept_id)
    .bind(doctor_id)
    .execute(&mut *tx)
    .await?;

    // ── Appointment ──────────────────────────────────────────
    sqlx::query(
        "INSERT INTO appointments \
         (id, tenant_id, patient_id, doctor_id, department_id, \
          appointment_date, slot_start, slot_end, appointment_type, status, \
          encounter_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, \
                 CURRENT_DATE, '09:00'::time, '09:15'::time, \
                 'new_visit'::appointment_type, 'scheduled'::appointment_status, \
                 $6, $7) \
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(appointment_uuid)
    .bind(tenant_id)
    .bind(patient_uuid)
    .bind(doctor_id)
    .bind(dept_id)
    .bind(encounter_uuid)
    .bind(admin_id)
    .execute(&mut *tx)
    .await?;

    // ── IPD admission ────────────────────────────────────────
    sqlx::query(
        "INSERT INTO admissions \
         (id, tenant_id, encounter_id, patient_id, admitting_doctor, status, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'admitted'::admission_status, $6) \
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(admission_uuid)
    .bind(tenant_id)
    .bind(encounter_uuid)
    .bind(patient_uuid)
    .bind(doctor_id)
    .bind(admin_id)
    .execute(&mut *tx)
    .await?;

    // ── Invoice ──────────────────────────────────────────────
    // invoice_number is NOT NULL with no default — must be supplied.
    // ON CONFLICT (id) keeps it idempotent.
    sqlx::query(
        "INSERT INTO invoices \
         (id, tenant_id, invoice_number, patient_id, encounter_id, status) \
         VALUES ($1, $2, 'INV-CANONICAL-1', $3, $4, 'draft'::invoice_status) \
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(invoice_uuid)
    .bind(tenant_id)
    .bind(patient_uuid)
    .bind(encounter_uuid)
    .execute(&mut *tx)
    .await?;

    // emergency_cases was consolidated out of the schema (only
    // pharmacy_emergency_kits remains). Skip emergency_case seed until
    // a replacement table exists. The unused UUID is reserved for
    // future use; suppress the warning.
    let _ = emergency_uuid;

    tx.commit().await?;

    tracing::info!(
        "Seeded canonical fixtures (patient/encounter/appointment/admission/invoice)"
    );
    Ok(())
}
