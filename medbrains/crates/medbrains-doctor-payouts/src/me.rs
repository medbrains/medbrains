//! "My earnings": a doctor's own ledger and statements, and only theirs —
//! every query is pinned to the caller, so another doctor's row is not found.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions::doctor_payouts::self_service;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::begin;
use crate::ledger::{LedgerLine, ledger_select};
use crate::statement_ops::{STATEMENT_SELECT, Statement};
use crate::statements::{DisputeInput, dispute};

#[derive(Debug, Deserialize)]
pub struct MyLedgerQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

/// GET /api/doctor-payouts/me/ledger
pub async fn my_ledger(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<MyLedgerQuery>,
) -> Result<Json<Vec<LedgerLine>>, AppError> {
    require_permission(&claims, self_service::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{} WHERE a.tenant_id = $1 AND a.doctor_id = $2 AND a.deleted_at IS NULL \
           AND a.service_date BETWEEN $3 AND $4 \
         ORDER BY a.service_date DESC, a.created_at DESC LIMIT 1000",
        ledger_select()
    );
    let rows = sqlx::query_as::<_, LedgerLine>(&sql)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .bind(q.from)
        .bind(q.to)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/doctor-payouts/me/statements
pub async fn my_statements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Statement>>, AppError> {
    require_permission(&claims, self_service::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{STATEMENT_SELECT} WHERE s.tenant_id = $1 AND s.doctor_id = $2 AND s.deleted_at IS NULL \
           AND s.status <> 'superseded' ORDER BY s.period_end DESC LIMIT 200"
    );
    let rows = sqlx::query_as::<_, Statement>(&sql)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/doctor-payouts/me/statements/{id}/dispute — your own draft only.
pub async fn dispute_my_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DisputeInput>,
) -> Result<Json<Statement>, AppError> {
    require_permission(&claims, self_service::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let out = dispute(&mut tx, id, &body.reason, claims.sub, Some(claims.sub)).await?;
    tx.commit().await?;
    Ok(Json(out))
}
