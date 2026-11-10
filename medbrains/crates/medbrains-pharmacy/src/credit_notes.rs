//! What every return shares, at the counter or online: the policy shown
//! before purchase, the GST credit note number, and putting a sealed,
//! in-date pack back on its batch.
//!
//! A credit note is numbered in the legal entity's own series for the
//! financial year — the entity on the bill, else the hospital's default,
//! else one hospital-wide series — at most 16 characters (CGST Act s.34;
//! CGST Rules 2017, Rules 46(b) and 53(1A)).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_core::pharmacy_returns::credit_note_number;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_any_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::return_rules::DEFAULT_RETURN_WINDOW_DAYS;

/// Prefix of the hospital-wide series, when no legal entity is set up.
const DEFAULT_PREFIX: &str = "CN";

/// The next credit note number for a return against `invoice_id`.
pub(crate) async fn next_number(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    invoice_id: Option<Uuid>,
) -> Result<String, AppError> {
    let entity: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT e.id, e.receipt_prefix FROM billing_entities e \
          WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND e.is_active \
            AND (e.id = (SELECT legal_entity_id FROM invoices WHERE id = $2 AND tenant_id = $1) \
                 OR e.is_default) \
          ORDER BY e.id = (SELECT legal_entity_id FROM invoices WHERE id = $2 AND tenant_id = $1) \
                   IS TRUE DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .fetch_optional(&mut **tx)
    .await?;
    let (key, prefix) = entity.map_or_else(
        || ("tenant".to_owned(), DEFAULT_PREFIX.to_owned()),
        |(id, prefix)| (id.to_string(), prefix),
    );
    let (fy, seq): (i32, i64) = sqlx::query_as(
        "WITH fy AS (SELECT CASE WHEN EXTRACT(MONTH FROM current_date) >= 4 \
                                 THEN EXTRACT(YEAR FROM current_date)::int \
                                 ELSE EXTRACT(YEAR FROM current_date)::int - 1 END AS y) \
         INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) \
         SELECT $1, 'CREDIT_NOTE:' || $2 || ':' || fy.y, $3, 1, 5 FROM fy \
         ON CONFLICT (tenant_id, seq_type) \
         DO UPDATE SET current_val = sequences.current_val + 1, updated_at = now(), \
                       deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
         RETURNING (SELECT y FROM fy), current_val::bigint",
    )
    .bind(tenant_id)
    .bind(key)
    .bind(&prefix)
    .fetch_one(&mut **tx)
    .await?;
    Ok(credit_note_number(&prefix, fy, seq))
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
