use sqlx::PgPool;

/// `(code, name, service_type, description)`
const SERVICES: &[(&str, &str, &str, &str)] = &[
    // ── Consultation ────────────────────────────────────────────
    (
        "SVC_CON_GEN",
        "General Consultation",
        "consultation",
        "General physician OPD consultation",
    ),
    (
        "SVC_CON_SPEC",
        "Specialist Consultation",
        "consultation",
        "Specialist OPD consultation",
    ),
    (
        "SVC_CON_SSPEC",
        "Super-Specialist Consultation",
        "consultation",
        "Super-specialist consultation",
    ),
    (
        "SVC_CON_FOLLOW",
        "Follow-Up Visit",
        "consultation",
        "Follow-up OPD consultation",
    ),
    (
        "SVC_CON_TELE",
        "Teleconsultation",
        "consultation",
        "Remote video / phone consultation",
    ),
    (
        "SVC_CON_ER",
        "Emergency Consultation",
        "consultation",
        "Emergency department consultation",
    ),
    // ── Procedures ──────────────────────────────────────────────
    (
        "SVC_PROC_MINOR",
        "Minor Procedure",
        "procedure",
        "Minor bedside procedures (dressing, suturing)",
    ),
    (
        "SVC_PROC_MAJOR",
        "Major Procedure",
        "procedure",
        "Major procedures under anaesthesia",
    ),
    (
        "SVC_PROC_BIOPSY",
        "Biopsy",
        "procedure",
        "Tissue biopsy for histopathology",
    ),
    (
        "SVC_PROC_ENDO",
        "Endoscopy",
        "procedure",
        "Upper / lower GI endoscopy",
    ),
    // ── Investigation ───────────────────────────────────────────
    (
        "SVC_INV_LAB",
        "Laboratory Investigation",
        "investigation",
        "Blood, urine, stool, culture tests",
    ),
    (
        "SVC_INV_XRAY",
        "X-Ray Imaging",
        "investigation",
        "Plain radiography",
    ),
    (
        "SVC_INV_USG",
        "Ultrasound Imaging",
        "investigation",
        "Ultrasonography",
    ),
    (
        "SVC_INV_CT",
        "CT Scan",
        "investigation",
        "Computed tomography (plain / contrast)",
    ),
    (
        "SVC_INV_MRI",
        "MRI Scan",
        "investigation",
        "Magnetic resonance imaging",
    ),
    (
        "SVC_INV_ECG",
        "ECG",
        "investigation",
        "12-lead electrocardiogram",
    ),
    (
        "SVC_INV_ECHO",
        "Echocardiography",
        "investigation",
        "2D echocardiogram",
    ),
    // ── Surgery ─────────────────────────────────────────────────
    (
        "SVC_SURG_MINOR",
        "Minor Surgery",
        "surgery",
        "Minor surgical procedure under local anaesthesia",
    ),
    (
        "SVC_SURG_MAJOR",
        "Major Surgery",
        "surgery",
        "Major surgery under general / regional anaesthesia",
    ),
    (
        "SVC_SURG_SUPER",
        "Super-Major Surgery",
        "surgery",
        "Complex multi-hour surgical procedure",
    ),
    (
        "SVC_SURG_DAY",
        "Day-Care Surgery",
        "surgery",
        "Same-day discharge surgical procedure",
    ),
    // ── Therapy ─────────────────────────────────────────────────
    (
        "SVC_THER_PHYSIO",
        "Physiotherapy Session",
        "therapy",
        "Physical rehabilitation session",
    ),
    (
        "SVC_THER_OT",
        "Occupational Therapy",
        "therapy",
        "Occupational therapy session",
    ),
    (
        "SVC_THER_SPEECH",
        "Speech Therapy",
        "therapy",
        "Speech and language therapy session",
    ),
    (
        "SVC_THER_DIALYSIS",
        "Dialysis Session",
        "therapy",
        "Haemodialysis / peritoneal dialysis",
    ),
    (
        "SVC_THER_CHEMO",
        "Chemotherapy Session",
        "therapy",
        "Cancer chemotherapy administration",
    ),
    // ── Nursing ─────────────────────────────────────────────────
    (
        "SVC_NUR_CARE",
        "Nursing Care",
        "nursing",
        "General nursing care (per day)",
    ),
    (
        "SVC_NUR_ICU",
        "ICU Nursing Care",
        "nursing",
        "ICU-level nursing care (per day)",
    ),
    (
        "SVC_NUR_BLOOD",
        "Blood Transfusion",
        "nursing",
        "Blood / blood product transfusion",
    ),
    // ── Support ─────────────────────────────────────────────────
    (
        "SVC_SUP_AMBULANCE",
        "Ambulance Service",
        "support",
        "Patient transport via ambulance",
    ),
    (
        "SVC_SUP_DIET",
        "Dietary Service",
        "support",
        "Patient diet and nutrition",
    ),
    (
        "SVC_SUP_CSSD",
        "CSSD Sterilization",
        "support",
        "Instrument sterilization service",
    ),
    // ── Administrative ──────────────────────────────────────────
    (
        "SVC_ADM_REG",
        "Patient Registration",
        "administrative",
        "New patient registration and UHID",
    ),
    (
        "SVC_ADM_MRD",
        "Medical Records Service",
        "administrative",
        "Record retrieval and management",
    ),
    (
        "SVC_ADM_INSURANCE",
        "Insurance Processing",
        "administrative",
        "TPA / insurance claim processing",
    ),
];

/// Seed services for the DEFAULT tenant.
/// Idempotent — skips services that already exist.
pub(super) async fn seed_services(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, service_type, description) in SERVICES {
        sqlx::query(
            "INSERT INTO services (tenant_id, code, name, service_type, description) \
             VALUES ($1, $2, $3, $4::service_type, $5) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(service_type)
        .bind(description)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} services", SERVICES.len());
    Ok(())
}
