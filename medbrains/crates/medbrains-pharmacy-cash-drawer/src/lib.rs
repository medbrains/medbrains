//! Pharmacy cash drawer lifecycle — open shift, close shift, variance.
//!
//! Per RFCs/sprints/SPRINT-pharmacy-finance.md items #1, #2, #3.

use axum::routing::{get, post, put};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub mod day_close;
pub mod day_close_report;
pub mod day_close_rules;

use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{require_any_permission, require_permission},
    middleware::field_access,
    state::AppState,
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

const BILLING_AMOUNT_FIELD: &str = "billing.amount";

async fn resolve_pharmacy_finance_restricted_fields(
    state: &AppState,
    claims: &Claims,
) -> Result<HashMap<String, FieldAccessLevel>, AppError> {
    field_access::resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role)
        .await
}

fn can_write_pharmacy_finance_amount(restricted: &HashMap<String, FieldAccessLevel>) -> bool {
    restricted
        .get(BILLING_AMOUNT_FIELD)
        .copied()
        .unwrap_or(FieldAccessLevel::Edit)
        == FieldAccessLevel::Edit
}

fn validate_pharmacy_finance_amount_write_access(
    restricted: &HashMap<String, FieldAccessLevel>,
) -> Result<(), AppError> {
    if can_write_pharmacy_finance_amount(restricted) {
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Cannot write restricted pharmacy finance amount fields".to_owned(),
    ))
}

pub async fn open_drawer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OpenDrawerRequest>,
) -> Result<Json<CashDrawer>, AppError> {
    require_permission(&claims, permissions::pharmacy_finance::cash_drawer::OPEN)?;
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;
    validate_pharmacy_finance_amount_write_access(&restricted_fields)?;

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
    let day_closed: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_day_closes WHERE tenant_id = $1 \
            AND pharmacy_location_id = $2 AND status = 'closed' AND deleted_at IS NULL \
            AND business_date = tenant_local_date($1, now()))",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_location_id)
    .fetch_one(&mut *tx)
    .await?;
    if day_closed {
        return Err(AppError::Conflict(
            "Today is already closed at this counter; a supervisor must reopen it".to_owned(),
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
    let restricted_fields = resolve_pharmacy_finance_restricted_fields(&state, &claims).await?;
    validate_pharmacy_finance_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // What the drawer should hold — the same function the day close sums.
    let expected_close: Option<Decimal> = sqlx::query_scalar::<_, Decimal>(
        "SELECT pharmacy_drawer_expected_cash(d.id) FROM pharmacy_cash_drawers d \
          WHERE d.id = $1 AND d.tenant_id = $2 AND d.status = 'open' FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let expected_close = expected_close.ok_or(AppError::NotFound)?;

    let row = sqlx::query_as::<_, CashDrawer>(
        "UPDATE pharmacy_cash_drawers SET \
           closed_at = now(), \
           expected_close_amount = $3, \
           actual_close_amount = $4, \
           variance_reason = $5, \
           notes = COALESCE($6, notes), \
           status = CASE \
             WHEN ABS($4::numeric - $3::numeric) > 100 THEN 'variance_pending_signoff' \
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
    require_any_permission(
        &claims,
        &[
            permissions::pharmacy_finance::cash_drawer::VIEW,
            permissions::pharmacy_finance::cash_drawer::OPEN,
            permissions::pharmacy_finance::cash_drawer::CLOSE,
        ],
    )?;

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
         WHERE tenant_id = $1 AND deleted_at IS NULL \
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

/// `pharmacy_cash_drawer` routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/pharmacy/cash-drawers",
            get(list_drawers).post(open_drawer),
        )
        .route(
            "/api/pharmacy/cash-drawers/me/active",
            get(get_my_active_drawer),
        )
        .route("/api/pharmacy/cash-drawers/{id}/close", put(close_drawer))
        .route(
            "/api/pharmacy/day-close",
            get(day_close::list_counter_days).post(day_close::close_day),
        )
        .route(
            "/api/pharmacy/day-close/report",
            get(day_close::get_day_report),
        )
        .route(
            "/api/pharmacy/day-close/{id}/reopen",
            post(day_close::reopen_day),
        )
}
