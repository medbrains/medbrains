//! Pharmacy cash drawer lifecycle — open shift, close shift, variance.
//!
//! Per RFCs/sprints/SPRINT-pharmacy-finance.md items #1, #2, #3.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims,
    middleware::authorization::require_permission, state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CashDrawer {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub pharmacy_location_id: Uuid,
    pub cashier_user_id: Uuid,
    pub opened_at: DateTime<Utc>,
    pub opening_float: Decimal,
    pub closed_at: Option<DateTime<Utc>>,
    pub expected_close_amount: Option<Decimal>,
    pub actual_close_amount: Option<Decimal>,
    pub variance: Option<Decimal>,
    pub variance_reason: Option<String>,
    pub variance_signed_record_id: Option<Uuid>,
    pub status: String,
    pub notes: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct OpenDrawerRequest {
    pub pharmacy_location_id: Uuid,
    pub opening_float: Decimal,
    pub notes: Option<String>,
}

pub async fn open_drawer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OpenDrawerRequest>,
) -> Result<Json<CashDrawer>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::OPEN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Reject if cashier already has an open drawer.
    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM pharmacy_cash_drawers \
         WHERE tenant_id = $1 AND cashier_user_id = $2 AND status = 'open'",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "cashier already has an open drawer — close current shift first".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, CashDrawer>(
        "INSERT INTO pharmacy_cash_drawers \
         (tenant_id, pharmacy_location_id, cashier_user_id, opening_float, notes) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_location_id)
    .bind(claims.sub)
    .bind(body.opening_float)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CloseDrawerRequest {
    pub actual_close_amount: Decimal,
    pub variance_reason: Option<String>,
    pub notes: Option<String>,
}

pub async fn close_drawer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CloseDrawerRequest>,
) -> Result<Json<CashDrawer>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::CLOSE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Compute expected_close_amount from drawer's opening_float +
    // sum of cash payments - sum of cash refunds - approved petty cash.
    // Simplified version: opening_float + payments - refunds.
    // Production: extend with petty cash + cash float movements.
    let drawer: Option<(Decimal,)> = sqlx::query_as(
        "SELECT opening_float FROM pharmacy_cash_drawers \
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let opening_float = drawer
        .ok_or(AppError::NotFound)?
        .0;

    // Fold in cash payments + refunds for this drawer's window.
    // This is a placeholder — actual aggregation needs join to
    // pharmacy_payments + pharmacy_petty_cash_vouchers + cash_float_movements.
    let expected_close = opening_float;

    let row = sqlx::query_as::<_, CashDrawer>(
        "UPDATE pharmacy_cash_drawers SET \
           closed_at = now(), \
           expected_close_amount = $3, \
           actual_close_amount = $4, \
           variance_reason = $5, \
           notes = COALESCE($6, notes), \
           status = CASE \
             WHEN ABS($4 - $3) > 100 THEN 'variance_pending_signoff' \
             ELSE 'closed' \
           END, \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(expected_close)
    .bind(body.actual_close_amount)
    .bind(&body.variance_reason)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn get_my_active_drawer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<CashDrawer>>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CashDrawer>(
        "SELECT * FROM pharmacy_cash_drawers \
         WHERE tenant_id = $1 AND cashier_user_id = $2 AND status = 'open' \
         ORDER BY opened_at DESC \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListDrawersQuery {
    pub status: Option<String>,
    pub cashier_user_id: Option<Uuid>,
    pub pharmacy_location_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_drawers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListDrawersQuery>,
) -> Result<Json<Vec<CashDrawer>>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(100).min(500);

    let rows = sqlx::query_as::<_, CashDrawer>(
        "SELECT * FROM pharmacy_cash_drawers \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
           AND ($3::uuid IS NULL OR cashier_user_id = $3) \
           AND ($4::uuid IS NULL OR pharmacy_location_id = $4) \
         ORDER BY opened_at DESC \
         LIMIT $5",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .bind(q.cashier_user_id)
    .bind(q.pharmacy_location_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
