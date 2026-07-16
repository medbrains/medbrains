use sqlx::PgPool;

/// `(code, name, is_default)`
const PAYMENT_METHODS: &[(&str, &str, bool)] = &[
    ("cash", "Cash", true),
    ("credit_card", "Credit Card", false),
    ("debit_card", "Debit Card", false),
    ("upi", "UPI", false),
    ("net_banking", "Net Banking", false),
    ("insurance_tpa", "Insurance / TPA", false),
    ("cheque", "Cheque", false),
    ("corporate", "Corporate / Credit", false),
];

/// Seed payment methods for the DEFAULT tenant.
/// Idempotent — skips methods that already exist.
pub(super) async fn seed_payment_methods(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, is_default) in PAYMENT_METHODS {
        sqlx::query(
            "INSERT INTO payment_methods (tenant_id, code, name, is_default) \
             VALUES ($1, $2, $3, $4) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(is_default)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} payment methods", PAYMENT_METHODS.len());
    Ok(())
}
