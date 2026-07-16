use sqlx::PgPool;

/// `(code, name, department_type)`
const DEPARTMENTS: &[(&str, &str, &str)] = &[
    // Clinical
    ("GEN-MEDICINE", "General Medicine", "clinical"),
    ("GEN-SURGERY", "General Surgery", "clinical"),
    ("PEDIATRICS", "Pediatrics", "clinical"),
    ("OBGYN", "Obstetrics & Gynaecology", "clinical"),
    ("ORTHOPEDICS", "Orthopedics", "clinical"),
    ("OPHTHALMOLOGY", "Ophthalmology", "clinical"),
    ("ENT", "ENT (Otorhinolaryngology)", "clinical"),
    ("DERMATOLOGY", "Dermatology", "clinical"),
    ("PSYCHIATRY", "Psychiatry", "clinical"),
    ("EMERGENCY", "Emergency Medicine", "clinical"),
    ("ICU", "Intensive Care Unit", "clinical"),
    ("CARDIOLOGY", "Cardiology", "clinical"),
    ("NEUROLOGY", "Neurology", "clinical"),
    ("NEPHROLOGY", "Nephrology", "clinical"),
    ("PULMONOLOGY", "Pulmonology", "clinical"),
    ("UROLOGY", "Urology", "clinical"),
    ("ONCOLOGY", "Oncology", "clinical"),
    ("ANESTHESIOLOGY", "Anesthesiology", "clinical"),
    // Para-clinical
    ("RADIOLOGY", "Radiology", "para_clinical"),
    ("PATHOLOGY", "Pathology / Laboratory", "para_clinical"),
    ("MICROBIOLOGY", "Microbiology", "para_clinical"),
    // Support
    ("PHARMACY", "Pharmacy", "support"),
    ("BLOOD-BANK", "Blood Bank", "support"),
    ("PHYSIOTHERAPY", "Physiotherapy & Rehabilitation", "support"),
    ("DIETARY", "Dietary & Nutrition", "support"),
    ("CSSD", "CSSD (Central Sterile Supply)", "support"),
    ("MRD", "Medical Records Department", "support"),
    // Administrative
    ("HOSP-ADMIN", "Hospital Administration", "administrative"),
    ("HR", "Human Resources", "administrative"),
    ("BILLING-DEPT", "Billing & Accounts", "administrative"),
    ("HOUSEKEEPING", "Housekeeping", "administrative"),
    ("SECURITY", "Security", "administrative"),
];

/// Seed operational departments for the DEFAULT tenant.
/// Idempotent — skips departments that already exist.
pub(super) async fn seed_departments(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, dept_type) in DEPARTMENTS {
        sqlx::query(
            "INSERT INTO departments (tenant_id, code, name, department_type) \
             VALUES ($1, $2, $3, $4::department_type) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(dept_type)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} departments", DEPARTMENTS.len());
    Ok(())
}
