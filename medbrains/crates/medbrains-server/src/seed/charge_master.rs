use sqlx::PgPool;

/// `(code, name, category, base_price, tax_percent)`
const CHARGES: &[(&str, &str, &str, &str, &str)] = &[
    // ── Registration ────────────────────────────────────────────
    (
        "REG_NEW",
        "New Patient Registration",
        "Registration",
        "100.00",
        "0.00",
    ),
    (
        "REG_REVISIT",
        "Revisit Registration",
        "Registration",
        "50.00",
        "0.00",
    ),
    (
        "REG_EMERGENCY",
        "Emergency Registration",
        "Registration",
        "200.00",
        "0.00",
    ),
    // ── Consultation ────────────────────────────────────────────
    (
        "CON_GENERAL",
        "General Consultation",
        "Consultation",
        "300.00",
        "0.00",
    ),
    (
        "CON_SPECIALIST",
        "Specialist Consultation",
        "Consultation",
        "500.00",
        "0.00",
    ),
    (
        "CON_SUPER_SPEC",
        "Super-Specialist Consultation",
        "Consultation",
        "1000.00",
        "0.00",
    ),
    (
        "CON_FOLLOWUP",
        "Follow-Up Consultation",
        "Consultation",
        "200.00",
        "0.00",
    ),
    (
        "CON_TELE",
        "Teleconsultation",
        "Consultation",
        "300.00",
        "0.00",
    ),
    (
        "CON_EMERGENCY",
        "Emergency Consultation",
        "Consultation",
        "800.00",
        "0.00",
    ),
    // ── Room Charges (per day) ──────────────────────────────────
    (
        "ROOM_GEN",
        "General Ward (per day)",
        "Room Charges",
        "500.00",
        "0.00",
    ),
    (
        "ROOM_SEMI",
        "Semi-Private Room (per day)",
        "Room Charges",
        "1500.00",
        "0.00",
    ),
    (
        "ROOM_PVT",
        "Private Room (per day)",
        "Room Charges",
        "3000.00",
        "0.00",
    ),
    (
        "ROOM_DELUXE",
        "Deluxe Room (per day)",
        "Room Charges",
        "5000.00",
        "0.00",
    ),
    (
        "ROOM_SUITE",
        "Suite (per day)",
        "Room Charges",
        "10000.00",
        "5.00",
    ),
    (
        "ROOM_ICU",
        "ICU Bed (per day)",
        "Room Charges",
        "8000.00",
        "0.00",
    ),
    (
        "ROOM_NICU",
        "NICU Bed (per day)",
        "Room Charges",
        "7000.00",
        "0.00",
    ),
    (
        "ROOM_HDU",
        "HDU Bed (per day)",
        "Room Charges",
        "5000.00",
        "0.00",
    ),
    (
        "ROOM_ISO",
        "Isolation Room (per day)",
        "Room Charges",
        "4000.00",
        "0.00",
    ),
    (
        "ROOM_DAYCARE",
        "Daycare / Observation (per day)",
        "Room Charges",
        "1000.00",
        "0.00",
    ),
    // ── Procedures ──────────────────────────────────────────────
    (
        "PROC_DRESSING",
        "Wound Dressing (Minor)",
        "Procedures",
        "200.00",
        "0.00",
    ),
    (
        "PROC_SUTURING",
        "Suturing (Minor)",
        "Procedures",
        "500.00",
        "0.00",
    ),
    (
        "PROC_CATHETER",
        "Urinary Catheterization",
        "Procedures",
        "400.00",
        "0.00",
    ),
    (
        "PROC_RYLES",
        "Ryle's Tube Insertion",
        "Procedures",
        "300.00",
        "0.00",
    ),
    (
        "PROC_IV_LINE",
        "IV Line Insertion",
        "Procedures",
        "200.00",
        "0.00",
    ),
    (
        "PROC_CENTRAL",
        "Central Line Insertion",
        "Procedures",
        "3000.00",
        "0.00",
    ),
    (
        "PROC_LUMBAR",
        "Lumbar Puncture",
        "Procedures",
        "2000.00",
        "0.00",
    ),
    (
        "PROC_PLEURAL",
        "Pleural Tap / Thoracocentesis",
        "Procedures",
        "2500.00",
        "0.00",
    ),
    (
        "PROC_ASCITIC",
        "Ascitic Fluid Tap (Paracentesis)",
        "Procedures",
        "2000.00",
        "0.00",
    ),
    (
        "PROC_BIOPSY",
        "Biopsy (Skin / Tissue)",
        "Procedures",
        "3000.00",
        "0.00",
    ),
    (
        "PROC_NEBULIZE",
        "Nebulization (per session)",
        "Procedures",
        "100.00",
        "0.00",
    ),
    ("PROC_ECG", "ECG (12-Lead)", "Procedures", "200.00", "0.00"),
    (
        "PROC_ECHO",
        "Echocardiography (2D Echo)",
        "Procedures",
        "1500.00",
        "0.00",
    ),
    (
        "PROC_XRAY",
        "X-Ray (per view)",
        "Procedures",
        "300.00",
        "0.00",
    ),
    (
        "PROC_USG",
        "Ultrasound (USG)",
        "Procedures",
        "800.00",
        "0.00",
    ),
    (
        "PROC_CT",
        "CT Scan (Plain)",
        "Procedures",
        "3000.00",
        "0.00",
    ),
    (
        "PROC_CT_CON",
        "CT Scan (With Contrast)",
        "Procedures",
        "5000.00",
        "0.00",
    ),
    ("PROC_MRI", "MRI (Plain)", "Procedures", "6000.00", "0.00"),
    (
        "PROC_MRI_CON",
        "MRI (With Contrast)",
        "Procedures",
        "8000.00",
        "0.00",
    ),
    // ── Nursing Charges ─────────────────────────────────────────
    (
        "NUR_INJECTION",
        "Injection Administration",
        "Nursing",
        "50.00",
        "0.00",
    ),
    (
        "NUR_IV_DRIP",
        "IV Drip Administration",
        "Nursing",
        "100.00",
        "0.00",
    ),
    (
        "NUR_BLOOD_TX",
        "Blood Transfusion Charges",
        "Nursing",
        "500.00",
        "0.00",
    ),
    (
        "NUR_MONITOR",
        "Monitoring Charges (per day)",
        "Nursing",
        "300.00",
        "0.00",
    ),
    (
        "NUR_OXYGEN",
        "Oxygen Administration (per hour)",
        "Nursing",
        "50.00",
        "0.00",
    ),
    (
        "NUR_VENTILATOR",
        "Ventilator Charges (per day)",
        "Nursing",
        "5000.00",
        "0.00",
    ),
    // ── OT Charges ──────────────────────────────────────────────
    (
        "OT_MINOR",
        "OT Charges — Minor Surgery",
        "OT Charges",
        "5000.00",
        "0.00",
    ),
    (
        "OT_MAJOR",
        "OT Charges — Major Surgery",
        "OT Charges",
        "15000.00",
        "0.00",
    ),
    (
        "OT_SUPER_MAJ",
        "OT Charges — Super-Major Surgery",
        "OT Charges",
        "30000.00",
        "0.00",
    ),
    (
        "OT_ANAES_LOCAL",
        "Anaesthesia — Local",
        "OT Charges",
        "1000.00",
        "0.00",
    ),
    (
        "OT_ANAES_SPINAL",
        "Anaesthesia — Spinal",
        "OT Charges",
        "3000.00",
        "0.00",
    ),
    (
        "OT_ANAES_GA",
        "Anaesthesia — General",
        "OT Charges",
        "5000.00",
        "0.00",
    ),
    // ── Certificates & Documentation ────────────────────────────
    (
        "CERT_MED",
        "Medical Certificate",
        "Certificates",
        "100.00",
        "0.00",
    ),
    (
        "CERT_FIT",
        "Fitness Certificate",
        "Certificates",
        "100.00",
        "0.00",
    ),
    (
        "CERT_DEATH",
        "Death Certificate (Copy)",
        "Certificates",
        "50.00",
        "0.00",
    ),
    (
        "CERT_BIRTH",
        "Birth Certificate (Copy)",
        "Certificates",
        "50.00",
        "0.00",
    ),
    (
        "CERT_DISCHARGE_COPY",
        "Discharge Summary (Copy)",
        "Certificates",
        "50.00",
        "0.00",
    ),
    // ── Miscellaneous ───────────────────────────────────────────
    (
        "MISC_AMBULANCE",
        "Ambulance Charges (Basic)",
        "Miscellaneous",
        "1000.00",
        "0.00",
    ),
    (
        "MISC_AMB_ADV",
        "Ambulance Charges (Advanced / ICU)",
        "Miscellaneous",
        "3000.00",
        "0.00",
    ),
    (
        "MISC_DIET",
        "Patient Diet Charges (per day)",
        "Miscellaneous",
        "200.00",
        "0.00",
    ),
    (
        "MISC_ATTENDANT",
        "Attendant Cot Charges (per day)",
        "Miscellaneous",
        "100.00",
        "0.00",
    ),
    (
        "MISC_CONSUMABLES",
        "Consumables & Disposables",
        "Miscellaneous",
        "500.00",
        "18.00",
    ),
];

/// Seed charge master for the DEFAULT tenant.
/// Idempotent — skips charges that already exist.
pub(super) async fn seed_charge_master(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, category, base_price, tax_percent) in CHARGES {
        sqlx::query(
            "INSERT INTO charge_master \
             (tenant_id, code, name, category, base_price, tax_percent) \
             VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(category)
        .bind(base_price)
        .bind(tax_percent)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} charge master items", CHARGES.len());
    Ok(())
}
