//! A counter sale paid on the card machine (#4874). The machine's approval
//! is a captured payment row with no bill; the sale takes it as its card
//! tender, and the row then names the sale — so one approval pays for one
//! sale, however many times the counter submits.

use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

/// Link the approved payment `txn_id` to `sale_id`, or refuse the sale.
pub(crate) async fn claim(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    txn_id: Uuid,
    sale_id: Uuid,
    amount: Decimal,
) -> Result<(), AppError> {
    let linked: Option<Uuid> = sqlx::query_scalar(
        "UPDATE payment_gateway_transactions SET pharmacy_pos_sale_id = $3, updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'captured' \
            AND pharmacy_pos_sale_id IS NULL AND invoice_id IS NULL \
            AND COALESCE((notes->>'approved_amount')::numeric, amount) = $4 \
          RETURNING id",
    )
    .bind(txn_id)
    .bind(tenant_id)
    .bind(sale_id)
    .bind(amount)
    .fetch_optional(&mut **tx)
    .await?;
    linked.map(|_| ()).ok_or_else(|| {
        AppError::Conflict(
            "That card payment is not approved, is for a different amount, or already paid \
             another sale"
                .to_owned(),
        )
    })
}
