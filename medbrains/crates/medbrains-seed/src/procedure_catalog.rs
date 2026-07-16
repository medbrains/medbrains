use sqlx::PgPool;

/// `(code, name, category, base_price_inr, duration_minutes, requires_consent, requires_anaesthesia)`
const PROCEDURES: &[(&str, &str, &str, i32, i32, bool, bool)] = &[
    // ── Wound / dressing ──────────────────────────────────────
    ("DRESS_SIMPLE", "Simple dressing", "dressing", 150, 15, false, false),
    ("DRESS_LARGE", "Large / complex dressing", "dressing", 300, 25, false, false),
    ("DRESS_BURN", "Burn dressing", "dressing", 400, 30, false, false),
    ("SUTURE", "Wound suturing (toilet & suturing)", "minor_surgery", 600, 30, true, true),
    ("SUTURE_REMOVE", "Suture removal", "minor_surgery", 150, 10, false, false),
    ("INCISION_DRAIN", "Incision & drainage of abscess", "minor_surgery", 800, 30, true, true),
    ("FB_REMOVE", "Foreign body removal (superficial)", "minor_surgery", 500, 20, true, true),
    // ── Injections / IV ───────────────────────────────────────
    ("IV_CANNULA", "IV cannulation", "injection", 120, 10, false, false),
    ("INJ_IM", "Intramuscular injection", "injection", 80, 5, false, false),
    ("INJ_IV", "Intravenous injection", "injection", 100, 5, false, false),
    ("NEBULIZE", "Nebulization", "respiratory", 150, 15, false, false),
    ("OXYGEN", "Oxygen administration (per hour)", "respiratory", 100, 60, false, false),
    ("PHLEBOTOMY", "Phlebotomy / blood sampling", "diagnostic", 60, 5, false, false),
    // ── Tubes / catheters ─────────────────────────────────────
    ("URINARY_CATH", "Urinary catheterization", "minor_surgery", 400, 20, true, false),
    ("RYLES_TUBE", "Ryle's / nasogastric tube insertion", "minor_surgery", 300, 15, true, false),
    ("ENEMA", "Enema administration", "minor_surgery", 200, 20, false, false),
    // ── Cardiology / diagnostics ──────────────────────────────
    ("ECG", "Electrocardiogram (ECG)", "diagnostic", 200, 15, false, false),
    ("AUDIOMETRY", "Pure-tone audiometry", "diagnostic", 400, 30, false, false),
    ("VISION_TEST", "Visual acuity test", "diagnostic", 100, 10, false, false),
    ("TONOMETRY", "Tonometry (eye pressure)", "diagnostic", 150, 10, false, false),
    ("FUNDOSCOPY", "Fundoscopy", "diagnostic", 250, 15, false, false),
    // ── ENT ───────────────────────────────────────────────────
    ("EAR_SYRINGE", "Ear syringing / wax removal", "ent", 300, 20, false, false),
    ("NASAL_PACK", "Anterior nasal packing", "ent", 500, 20, true, true),
    ("FB_EAR_NOSE", "Foreign body removal (ear/nose)", "ent", 600, 25, true, true),
    // ── Orthopaedics ──────────────────────────────────────────
    ("POP_APPLY", "Plaster (POP) cast application", "orthopaedic", 700, 30, false, false),
    ("POP_REMOVE", "Plaster cast removal", "orthopaedic", 300, 20, false, false),
    ("SPLINT", "Splint application", "orthopaedic", 400, 20, false, false),
    ("JOINT_ASPIRATE", "Joint aspiration", "orthopaedic", 900, 30, true, true),
    ("INTRA_ARTICULAR", "Intra-articular injection", "orthopaedic", 800, 20, true, true),
    ("TRIGGER_INJ", "Trigger point injection", "orthopaedic", 500, 15, true, true),
    // ── Minor surgery / day-care ──────────────────────────────
    ("LIPOMA_EXC", "Lipoma excision", "minor_surgery", 2500, 45, true, true),
    ("CYST_EXC", "Sebaceous cyst excision", "minor_surgery", 2000, 40, true, true),
    ("SKIN_BIOPSY", "Skin punch biopsy", "minor_surgery", 1200, 30, true, true),
    ("CAUTERY_WART", "Electrocautery of wart", "minor_surgery", 800, 20, true, true),
    ("CRYOTHERAPY", "Cryotherapy", "minor_surgery", 700, 20, false, false),
    ("INGROWN_NAIL", "Ingrown toenail removal", "minor_surgery", 1500, 30, true, true),
    ("CORN_REMOVE", "Corn / callus removal", "minor_surgery", 400, 20, false, true),
    ("CIRCUMCISION", "Circumcision", "minor_surgery", 4000, 45, true, true),
    // ── Aspirations / taps ────────────────────────────────────
    ("PLEURAL_TAP", "Pleural aspiration (thoracocentesis)", "minor_surgery", 1500, 30, true, true),
    ("ASCITIC_TAP", "Ascitic tap (paracentesis)", "minor_surgery", 1500, 30, true, true),
    ("LUMBAR_PUNCT", "Lumbar puncture", "minor_surgery", 1800, 30, true, true),
    ("BM_ASPIRATE", "Bone marrow aspiration", "minor_surgery", 2500, 45, true, true),
    ("PROCTOSCOPY", "Proctoscopy", "diagnostic", 600, 20, true, false),
    // ── Obstetrics & gynaecology ──────────────────────────────
    ("PV_EXAM", "Per-vaginal / per-speculum examination", "gynaecology", 200, 15, true, false),
    ("PAP_SMEAR", "Pap smear collection", "gynaecology", 400, 15, true, false),
    ("IUCD_INSERT", "IUCD insertion", "gynaecology", 800, 30, true, false),
    ("IUCD_REMOVE", "IUCD removal", "gynaecology", 400, 20, true, false),
    ("ANTENATAL", "Antenatal check-up", "obstetrics", 300, 20, false, false),
    // ── Preventive ────────────────────────────────────────────
    ("VACCINATION", "Vaccination / immunization", "preventive", 150, 10, false, false),
    ("BLOOD_TRANSFUSE", "Blood transfusion administration", "minor_surgery", 600, 120, true, false),
];

/// Idempotent — skips procedures that already exist for the tenant.
pub(super) async fn seed_procedure_catalog(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, category, base_price, duration, consent, anaesthesia) in PROCEDURES {
        sqlx::query(
            "INSERT INTO procedure_catalog \
             (tenant_id, code, name, category, base_price, duration_minutes, \
              requires_consent, requires_anesthesia) \
             VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, $8) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(category)
        .bind(base_price)
        .bind(duration)
        .bind(consent)
        .bind(anaesthesia)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} procedures", PROCEDURES.len());
    Ok(())
}
