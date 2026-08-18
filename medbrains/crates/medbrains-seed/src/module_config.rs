use sqlx::PgPool;

/// `(code, name, description, status, depends_on)`
const MODULES: &[(&str, &str, &str, &str, &[&str])] = &[
    (
        "registration",
        "Patient Registration",
        "Patient demographics, UHID generation, identity management",
        "enabled",
        &[],
    ),
    (
        "opd",
        "OPD / Outpatient",
        "OPD visits, token queue, consultations, follow-ups",
        "enabled",
        &["registration"],
    ),
    (
        "ipd",
        "IPD / Inpatient",
        "Admissions, bed management, discharge, nursing tasks",
        "enabled",
        &["registration"],
    ),
    (
        "lab",
        "Laboratory (LIS)",
        "Lab orders, sample collection, result entry, reporting",
        "enabled",
        &["registration"],
    ),
    (
        "pharmacy",
        "Pharmacy",
        "Prescriptions, dispensing, stock management",
        "enabled",
        &["registration"],
    ),
    (
        "billing",
        "Billing & Finance",
        "Invoices, payments, refunds, TPA/insurance billing",
        "enabled",
        &["registration"],
    ),
    (
        "radiology",
        "Radiology (RIS)",
        "Radiology orders, imaging, reporting (DICOM)",
        "available",
        &["registration"],
    ),
    (
        "blood_bank",
        "Blood Bank",
        "Blood inventory, cross-matching, transfusion tracking",
        "available",
        &["registration", "lab"],
    ),
    (
        "ot",
        "Operation Theatre",
        "OT scheduling, checklists, anaesthesia records",
        "available",
        &["registration", "ipd"],
    ),
    (
        "emergency",
        "Emergency / Casualty",
        "Triage, trauma care, emergency protocols",
        "available",
        &["registration"],
    ),
    (
        "nursing",
        "Nursing Station",
        "Nursing assessments, vitals, medication administration",
        "available",
        &["registration", "ipd"],
    ),
    (
        "diet",
        "Diet & Nutrition",
        "Patient diet plans, kitchen management, meal tracking",
        "available",
        &["registration", "ipd"],
    ),
    (
        "hr",
        "Human Resources",
        "Staff records, attendance, payroll, leave management",
        "available",
        &[],
    ),
    (
        "inventory",
        "Inventory & Stores",
        "Central stores, indent requisitions, stock management",
        "enabled",
        &[],
    ),
    (
        "reports",
        "Reports & Analytics",
        "MIS reports, dashboards, data exports, compliance reports",
        "available",
        &[],
    ),
    // Seeded DISABLED on purpose: the patient companion ships hidden and an
    // operator opens it. `require_module_enabled` blocks only on an explicit
    // `disabled` — an absent row means enabled — so silence here would give
    // every new tenant a Health tab nobody licensed. Migration 0974 does the
    // same for tenants that already exist.
    //
    // Not `coming_soon`: that status reads right and enforces nothing.
    (
        "companion",
        "Patient Companion",
        "Daily health companion in the patient app — medication adherence, observations and connected bands",
        "disabled",
        &["registration"],
    ),
];

/// Seed module configuration for the DEFAULT tenant.
/// Idempotent — skips modules that already exist.
pub(super) async fn seed_module_config(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, description, status, depends_on) in MODULES {
        let deps: Vec<String> = depends_on.iter().map(|s| (*s).to_string()).collect();

        sqlx::query(
            "INSERT INTO module_config (tenant_id, code, name, description, status, depends_on) \
             VALUES ($1, $2, $3, $4, $5::module_status, $6) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(description)
        .bind(status)
        .bind(&deps)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} modules", MODULES.len());
    Ok(())
}
