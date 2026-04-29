//! Pharmacy petty cash + cash float movements.
//!
//! Per RFCs/sprints/SPRINT-pharmacy-finance.md.

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
pub struct PettyCashVoucher {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub cash_drawer_id: Option<Uuid>,
    pub category: String,
    pub amount: Decimal,
    pub paid_to: String,
    pub supporting_bill_url: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub status: String,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePettyCashRequest {
    pub cash_drawer_id: Option<Uuid>,
    pub category: String,
    pub amount: Decimal,
    pub paid_to: String,
    pub supporting_bill_url: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_petty_cash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePettyCashRequest>,
) -> Result<Json<PettyCashVoucher>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::petty_cash::RECORD)?;
    if body.amount <= Decimal::ZERO {
        return Err(AppError::BadRequest("amount must be > 0".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PettyCashVoucher>(
        "INSERT INTO pharmacy_petty_cash_vouchers \
         (tenant_id, cash_drawer_id, category, amount, paid_to, supporting_bill_url, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.cash_drawer_id)
    .bind(&body.category)
    .bind(body.amount)
    .bind(&body.paid_to)
    .bind(&body.supporting_bill_url)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct PettyCashDecisionRequest {
    pub approved: bool,
    pub notes: Option<String>,
}

pub async fn decide_petty_cash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PettyCashDecisionRequest>,
) -> Result<Json<PettyCashVoucher>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::petty_cash::RECORD)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let new_status = if body.approved { "approved" } else { "rejected" };
    let row = sqlx::query_as::<_, PettyCashVoucher>(
        "UPDATE pharmacy_petty_cash_vouchers SET \
           status = $3, approved_by = $4, approved_at = now(), \
           notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ListPettyCashQuery {
    pub status: Option<String>,
    pub cash_drawer_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_petty_cash(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListPettyCashQuery>,
) -> Result<Json<Vec<PettyCashVoucher>>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::petty_cash::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(100).min(500);
    let rows = sqlx::query_as::<_, PettyCashVoucher>(
        "SELECT * FROM pharmacy_petty_cash_vouchers \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR status = $2) \
           AND ($3::uuid IS NULL OR cash_drawer_id = $3) \
         ORDER BY created_at DESC LIMIT $4",
    )
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .bind(q.cash_drawer_id)
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

// ── pharmacy_cash_float_movements ───────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FloatMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub movement_type: String,
    pub source_drawer_id: Option<Uuid>,
    pub destination_drawer_id: Option<Uuid>,
    pub amount: Decimal,
    pub reason: String,
    pub approved_by: Option<Uuid>,
    pub moved_by: Uuid,
    pub moved_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFloatMovementRequest {
    pub movement_type: String,
    pub source_drawer_id: Option<Uuid>,
    pub destination_drawer_id: Option<Uuid>,
    pub amount: Decimal,
    pub reason: String,
}

pub async fn create_float_movement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFloatMovementRequest>,
) -> Result<Json<FloatMovement>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::OPEN)?;
    if body.source_drawer_id.is_none() && body.destination_drawer_id.is_none() {
        return Err(AppError::BadRequest(
            "at least one of source or destination drawer required".to_owned(),
        ));
    }
    if body.amount <= Decimal::ZERO {
        return Err(AppError::BadRequest("amount must be > 0".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, FloatMovement>(
        "INSERT INTO pharmacy_cash_float_movements \
         (tenant_id, movement_type, source_drawer_id, destination_drawer_id, \
          amount, reason, moved_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.movement_type)
    .bind(body.source_drawer_id)
    .bind(body.destination_drawer_id)
    .bind(body.amount)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_float_movements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<FloatMovement>>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, FloatMovement>(
        "SELECT * FROM pharmacy_cash_float_movements \
         WHERE tenant_id = $1 ORDER BY moved_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
