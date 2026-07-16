use sqlx::PgPool;

/// `(code, name, rate_percent, applicability, description)`
const TAX_CATEGORIES: &[(&str, &str, &str, &str, &str)] = &[
    (
        "healthcare_exempt",
        "Healthcare Services (Exempt)",
        "0.00",
        "exempt",
        "GST-exempt healthcare services per Notification 12/2017",
    ),
    (
        "pharma_general",
        "Pharmacy — General Drugs (12%)",
        "12.00",
        "taxable",
        "Standard GST rate for pharmaceutical products",
    ),
    (
        "pharma_lifesaving",
        "Pharmacy — Life-Saving Drugs (5%)",
        "5.00",
        "taxable",
        "Reduced GST rate for essential / life-saving medicines",
    ),
    (
        "premium_room",
        "Premium Room Charges (5%)",
        "5.00",
        "taxable",
        "GST on room rent exceeding INR 5,000/day",
    ),
    (
        "equipment_consumables",
        "Equipment & Consumables (18%)",
        "18.00",
        "taxable",
        "Standard GST rate for medical equipment and consumables",
    ),
];

/// Seed tax categories for the DEFAULT tenant.
/// Idempotent — skips categories that already exist.
pub(super) async fn seed_tax_categories(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, rate, applicability, description) in TAX_CATEGORIES {
        sqlx::query(
            "INSERT INTO tax_categories \
             (tenant_id, code, name, rate_percent, applicability, description) \
             VALUES ($1, $2, $3, $4::numeric, $5::tax_applicability, $6) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(rate)
        .bind(applicability)
        .bind(description)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} tax categories", TAX_CATEGORIES.len());
    Ok(())
}
