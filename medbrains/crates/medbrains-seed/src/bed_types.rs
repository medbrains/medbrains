use sqlx::PgPool;

/// `(code, name, daily_rate, description)`
const BED_TYPES: &[(&str, &str, &str, &str)] = &[
    (
        "general_ward",
        "General Ward",
        "500.00",
        "Multi-bed shared ward",
    ),
    (
        "semi_private",
        "Semi-Private Room",
        "1500.00",
        "Two-bed shared room",
    ),
    (
        "private_room",
        "Private Room",
        "3000.00",
        "Single-bed private room",
    ),
    (
        "deluxe_room",
        "Deluxe Room",
        "5000.00",
        "Single-bed with premium amenities",
    ),
    (
        "suite",
        "Suite",
        "10000.00",
        "Luxury suite with attendant area",
    ),
    ("icu", "ICU Bed", "8000.00", "Intensive Care Unit bed"),
    (
        "nicu",
        "NICU Bed",
        "7000.00",
        "Neonatal Intensive Care Unit",
    ),
    (
        "picu",
        "PICU Bed",
        "7000.00",
        "Pediatric Intensive Care Unit",
    ),
    ("ccu", "CCU Bed", "8000.00", "Coronary Care Unit bed"),
    ("hdu", "HDU Bed", "5000.00", "High Dependency Unit bed"),
    (
        "isolation",
        "Isolation Room",
        "4000.00",
        "Negative pressure isolation room",
    ),
    (
        "daycare",
        "Daycare / Observation",
        "1000.00",
        "Short-stay observation bed",
    ),
];

/// Seed bed types for the DEFAULT tenant.
/// Idempotent — skips types that already exist.
pub(super) async fn seed_bed_types(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, daily_rate, description) in BED_TYPES {
        sqlx::query(
            "INSERT INTO bed_types (tenant_id, code, name, daily_rate, description) \
             VALUES ($1, $2, $3, $4::numeric, $5) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(daily_rate)
        .bind(description)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} bed types", BED_TYPES.len());
    Ok(())
}
