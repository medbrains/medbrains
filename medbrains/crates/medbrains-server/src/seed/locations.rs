use sqlx::PgPool;

/// Insert a single location row and return its ID.
async fn insert_loc(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: uuid::Uuid,
    parent_id: Option<uuid::Uuid>,
    level: &str,
    code: &str,
    name: &str,
    attrs: &str,
) -> Result<uuid::Uuid, Box<dyn std::error::Error>> {
    let id: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO locations (tenant_id, parent_id, level, code, name, attributes) \
         VALUES ($1, $2, $3::location_level, $4, $5, $6::jsonb) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(parent_id)
    .bind(level)
    .bind(code)
    .bind(name)
    .bind(attrs)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

/// Seed buildings, floors, wings, rooms, and beds under the given campus.
async fn seed_buildings(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: uuid::Uuid,
    campus: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    // ── Building: Main Hospital Block ─────────────────────────
    let blk_main = insert_loc(
        tx,
        tenant_id,
        Some(campus),
        "building",
        "BLK-MAIN",
        "Main Hospital Block",
        r#"{"floors": 5, "year_built": 1985}"#,
    )
    .await?;

    // Ground Floor
    let gf = insert_loc(
        tx,
        tenant_id,
        Some(blk_main),
        "floor",
        "BLK-MAIN-GF",
        "Ground Floor",
        "{}",
    )
    .await?;
    let gf_a = insert_loc(
        tx,
        tenant_id,
        Some(gf),
        "wing",
        "BLK-MAIN-GF-A",
        "Wing A — Reception & OPD",
        "{}",
    )
    .await?;
    for i in 1..=6 {
        insert_loc(
            tx,
            tenant_id,
            Some(gf_a),
            "room",
            &format!("OPD-{i:02}"),
            &format!("OPD Consultation Room {i}"),
            "{}",
        )
        .await?;
    }
    let gf_b = insert_loc(
        tx,
        tenant_id,
        Some(gf),
        "wing",
        "BLK-MAIN-GF-B",
        "Wing B — Emergency",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(gf_b),
        "room",
        "ER-TRIAGE",
        "ER Triage",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(gf_b),
        "room",
        "ER-RESUS",
        "ER Resuscitation Bay",
        "{}",
    )
    .await?;
    let er_obs = insert_loc(
        tx,
        tenant_id,
        Some(gf_b),
        "room",
        "ER-OBS",
        "ER Observation Ward",
        "{}",
    )
    .await?;
    for i in 1..=4 {
        insert_loc(
            tx,
            tenant_id,
            Some(er_obs),
            "bed",
            &format!("ER-OBS-B{i}"),
            &format!("ER Obs Bed {i}"),
            "{}",
        )
        .await?;
    }

    // First Floor — General Wards
    let f1 = insert_loc(
        tx,
        tenant_id,
        Some(blk_main),
        "floor",
        "BLK-MAIN-F1",
        "First Floor",
        "{}",
    )
    .await?;
    let f1_male = insert_loc(
        tx,
        tenant_id,
        Some(f1),
        "wing",
        "BLK-MAIN-F1-M",
        "Male General Ward",
        "{}",
    )
    .await?;
    let f1_mr = insert_loc(
        tx,
        tenant_id,
        Some(f1_male),
        "room",
        "GW-M-01",
        "Male Ward Room 1",
        "{}",
    )
    .await?;
    for i in 1..=6 {
        insert_loc(
            tx,
            tenant_id,
            Some(f1_mr),
            "bed",
            &format!("GW-M-01-B{i}"),
            &format!("Male Ward Bed {i}"),
            "{}",
        )
        .await?;
    }
    let f1_female = insert_loc(
        tx,
        tenant_id,
        Some(f1),
        "wing",
        "BLK-MAIN-F1-F",
        "Female General Ward",
        "{}",
    )
    .await?;
    let f1_fr = insert_loc(
        tx,
        tenant_id,
        Some(f1_female),
        "room",
        "GW-F-01",
        "Female Ward Room 1",
        "{}",
    )
    .await?;
    for i in 1..=6 {
        insert_loc(
            tx,
            tenant_id,
            Some(f1_fr),
            "bed",
            &format!("GW-F-01-B{i}"),
            &format!("Female Ward Bed {i}"),
            "{}",
        )
        .await?;
    }

    // Second Floor — ICU & Private
    let f2 = insert_loc(
        tx,
        tenant_id,
        Some(blk_main),
        "floor",
        "BLK-MAIN-F2",
        "Second Floor",
        "{}",
    )
    .await?;
    let f2_icu = insert_loc(
        tx,
        tenant_id,
        Some(f2),
        "wing",
        "BLK-MAIN-F2-ICU",
        "Intensive Care Unit",
        "{}",
    )
    .await?;
    let icu_room = insert_loc(
        tx,
        tenant_id,
        Some(f2_icu),
        "room",
        "ICU-01",
        "ICU Main",
        "{}",
    )
    .await?;
    for i in 1..=8 {
        insert_loc(
            tx,
            tenant_id,
            Some(icu_room),
            "bed",
            &format!("ICU-01-B{i}"),
            &format!("ICU Bed {i}"),
            r#"{"type": "icu"}"#,
        )
        .await?;
    }
    let f2_pvt = insert_loc(
        tx,
        tenant_id,
        Some(f2),
        "wing",
        "BLK-MAIN-F2-PVT",
        "Private Rooms",
        "{}",
    )
    .await?;
    for i in 1..=4 {
        let rm = insert_loc(
            tx,
            tenant_id,
            Some(f2_pvt),
            "room",
            &format!("PVT-{i:02}"),
            &format!("Private Room {i}"),
            "{}",
        )
        .await?;
        insert_loc(
            tx,
            tenant_id,
            Some(rm),
            "bed",
            &format!("PVT-{i:02}-B1"),
            &format!("Private Room {i} Bed"),
            r#"{"type": "private"}"#,
        )
        .await?;
    }

    // ── Building: Diagnostic Block ────────────────────────────
    let blk_diag = insert_loc(
        tx,
        tenant_id,
        Some(campus),
        "building",
        "BLK-DIAG",
        "Diagnostic Block",
        r#"{"floors": 3, "year_built": 2010}"#,
    )
    .await?;

    let dg_gf = insert_loc(
        tx,
        tenant_id,
        Some(blk_diag),
        "floor",
        "BLK-DIAG-GF",
        "Ground Floor — Lab",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_gf),
        "room",
        "LAB-COLLECT",
        "Sample Collection Room",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_gf),
        "room",
        "LAB-HAEM",
        "Haematology Lab",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_gf),
        "room",
        "LAB-BIOCHEM",
        "Biochemistry Lab",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_gf),
        "room",
        "LAB-MICRO",
        "Microbiology Lab",
        "{}",
    )
    .await?;

    let dg_f1 = insert_loc(
        tx,
        tenant_id,
        Some(blk_diag),
        "floor",
        "BLK-DIAG-F1",
        "First Floor — Radiology",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_f1),
        "room",
        "RAD-XRAY-01",
        "X-Ray Room 1",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_f1),
        "room",
        "RAD-CT-01",
        "CT Scan Room",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(dg_f1),
        "room",
        "RAD-USG-01",
        "Ultrasound Room",
        "{}",
    )
    .await?;

    // ── Building: Admin Block ─────────────────────────────────
    let blk_admin = insert_loc(
        tx,
        tenant_id,
        Some(campus),
        "building",
        "BLK-ADMIN",
        "Administrative Block",
        r#"{"floors": 2, "year_built": 2005}"#,
    )
    .await?;

    let adm_gf = insert_loc(
        tx,
        tenant_id,
        Some(blk_admin),
        "floor",
        "BLK-ADMIN-GF",
        "Ground Floor — Pharmacy & Billing",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_gf),
        "room",
        "PHARM-DISP",
        "Pharmacy Dispensing Counter",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_gf),
        "room",
        "PHARM-STORE",
        "Pharmacy Store Room",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_gf),
        "room",
        "BILLING-01",
        "Billing Counter 1",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_gf),
        "room",
        "BILLING-02",
        "Billing Counter 2",
        "{}",
    )
    .await?;

    let adm_f1 = insert_loc(
        tx,
        tenant_id,
        Some(blk_admin),
        "floor",
        "BLK-ADMIN-F1",
        "First Floor — Administration",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_f1),
        "room",
        "ADM-OFFICE",
        "Administrative Office",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_f1),
        "room",
        "ADM-RECORDS",
        "Medical Records Room",
        "{}",
    )
    .await?;
    insert_loc(
        tx,
        tenant_id,
        Some(adm_f1),
        "room",
        "ADM-CONF",
        "Conference Room",
        "{}",
    )
    .await?;

    Ok(())
}

/// Seed a hierarchical hospital location tree for the DEFAULT tenant.
///
/// Layout: 1 campus → 3 buildings → floors → wings → rooms → beds.
/// Parents are inserted first, then child rows query back the parent ID.
pub(super) async fn seed_locations(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM locations WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_one(pool)
        .await?;

    if count > 0 {
        tracing::debug!("Locations already seeded ({count} rows), skipping");
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    let campus = insert_loc(
        &mut tx,
        tenant_id,
        None,
        "campus",
        "ACMS-MAIN",
        "Alagappa Medical College — Main Campus",
        r#"{"address": "Karaikudi, Tamil Nadu", "phone": "+91-4565-225000"}"#,
    )
    .await?;

    seed_buildings(&mut tx, tenant_id, campus).await?;

    tx.commit().await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM locations WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_one(pool)
        .await?;

    tracing::info!("Seeded {total} location rows (campus → buildings → floors → rooms → beds)");
    Ok(())
}
