//! What every return shares, at the counter or online: the policy shown
//! before purchase and putting a sealed, in-date pack back on its batch.
//! The GST credit note number comes from
//! `medbrains_pharmacy_finance::note_series`, shared with the credit-notes
//! screen.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_any_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::return_rules::DEFAULT_RETURN_WINDOW_DAYS;

/// The next GST credit note number for a return against `invoice_id`, from the series the
/// credit-notes screen shares (`medbrains_pharmacy_finance::note_series`).
pub(crate) async fn next_number(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Option<Uuid>,
) -> Result<String, AppError> {
    medbrains_pharmacy_finance::note_series::next_number(tx, tenant_id, invoice_id, 'C').await
}

/// A pack going back on the shelf.
pub(crate) struct Restock<'a> {
    pub catalog_item_id: Uuid,
    pub batch_id: Option<Uuid>,
    pub quantity: i32,
    pub reference_id: Uuid,
    pub note: &'a str,
}

/// Back to its batch and the catalogue count, with a stock transaction.
pub(crate) async fn restock(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    r: &Restock<'_>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE pharmacy_catalog SET current_stock = current_stock + $1, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(r.quantity)
    .bind(r.catalog_item_id)
    .bind(claims.tenant_id)
    .execute(&mut **tx)
    .await?;
    if let Some(batch_id) = r.batch_id {
        sqlx::query(
            "UPDATE pharmacy_batches SET quantity_on_hand = quantity_on_hand + $1, \
                    quantity_dispensed = GREATEST(quantity_dispensed - $1, 0), updated_at = now() \
              WHERE id = $2 AND tenant_id = $3",
        )
        .bind(r.quantity)
        .bind(batch_id)
        .bind(claims.tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    sqlx::query(
        "INSERT INTO pharmacy_stock_transactions \
         (tenant_id, catalog_item_id, transaction_type, quantity, reference_id, notes, created_by) \
         VALUES ($1, $2, 'return', $3, $4, $5, $6)",
    )
    .bind(claims.tenant_id)
    .bind(r.catalog_item_id)
    .bind(r.quantity)
    .bind(r.reference_id)
    .bind(r.note)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The counter's return policy, shown before a sale is rung.
#[derive(Debug, Serialize)]
pub(crate) struct ReturnPolicy {
    pub window_days: i32,
    pub text: String,
}

/// `GET /api/pharmacy/pos/return-policy` — shown on the counter before
/// purchase (Consumer Protection Act 2019; E-Commerce Rules 2020 for the
/// online side).
pub(crate) async fn return_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReturnPolicy>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy::pos::CREATE,
            permissions::pharmacy::pos::VIEW,
        ],
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let window_days: i32 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT (value #>> '{}')::int FROM tenant_settings \
                           WHERE tenant_id = $1 AND category = 'pharmacy' \
                             AND key = 'return_window_days' AND deleted_at IS NULL), $2)",
    )
    .bind(claims.tenant_id)
    .bind(DEFAULT_RETURN_WINDOW_DAYS)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(ReturnPolicy {
        window_days,
        text: medbrains_core::pharmacy_returns::return_policy_text(i64::from(window_days)),
    }))
}
