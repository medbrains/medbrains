//! Statements: prepare for a period, review line by line, adjust with a
//! reason (a new version), dispute, and approve (someone else).

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions::doctor_payouts::statements;
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{require_any_permission, require_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::ledger::{LedgerLine, ledger_select};
use crate::statement_ops::{self, Prepare, STATEMENT_SELECT, Statement};
use crate::{Tx, begin};

#[derive(Debug, Deserialize)]
pub struct StatementQuery {
    pub status: Option<String>,
    pub kind: Option<String>,
}

/// GET /api/doctor-payouts/statements — readable by whoever prepares or
/// approves them.
pub async fn list_statements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<StatementQuery>,
) -> Result<Json<Vec<Statement>>, AppError> {
    require_any_permission(&claims, &[statements::PREPARE, statements::APPROVE])?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{STATEMENT_SELECT} WHERE s.tenant_id = $1 AND s.deleted_at IS NULL \
           AND ($2::text IS NULL OR s.status = $2) AND ($3::text IS NULL OR s.kind = $3) \
         ORDER BY s.created_at DESC LIMIT 500"
    );
    let rows = sqlx::query_as::<_, Statement>(&sql)
        .bind(claims.tenant_id)
        .bind(q.status.as_deref().filter(|s| !s.is_empty()))
        .bind(q.kind.as_deref().filter(|s| !s.is_empty()))
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize)]
pub struct StatementDetail {
    pub statement: Statement,
    pub lines: Vec<LedgerLine>,
}

pub async fn detail(tx: &mut Tx<'_>, id: Uuid) -> Result<StatementDetail, AppError> {
    let statement = statement_ops::fetch(tx, id).await?;
    let sql = format!(
        "{} JOIN doctor_payout_statement_lines l ON l.accrual_id = a.id \
          WHERE l.statement_id = $1 ORDER BY a.service_date, a.created_at LIMIT 20000",
        ledger_select()
    );
    let lines = sqlx::query_as::<_, LedgerLine>(&sql)
        .bind(id)
        .fetch_all(&mut **tx)
        .await?;
    Ok(StatementDetail { statement, lines })
}

/// GET /api/doctor-payouts/statements/{id}
pub async fn get_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StatementDetail>, AppError> {
    require_any_permission(&claims, &[statements::PREPARE, statements::APPROVE])?;
    let mut tx = begin(&state, &claims).await?;
    let out = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct PrepareInput {
    pub doctor_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
}

/// POST /api/doctor-payouts/statements
pub async fn prepare_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PrepareInput>,
) -> Result<Json<StatementDetail>, AppError> {
    require_permission(&claims, statements::PREPARE)?;
    if body.period_end < body.period_start {
        return Err(AppError::BadRequest(
            "The period ends before it starts".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let ask = Prepare {
        tenant_id: claims.tenant_id,
        doctor_id: body.doctor_id,
        from: body.period_start,
        to: body.period_end,
        same_day: false,
        actor: claims.sub,
    };
    let id = statement_ops::prepare(&mut tx, &ask).await?;
    let out = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct AdjustInput {
    /// Signed: a negative amount takes money off.
    pub amount: Decimal,
    pub reason: String,
}

/// POST /api/doctor-payouts/statements/{id}/adjust — an adjustment row in the
/// ledger and a new version of the statement carrying it. Whoever adjusts
/// becomes the preparer, so they cannot then approve it either.
pub async fn adjust_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdjustInput>,
) -> Result<Json<StatementDetail>, AppError> {
    require_permission(&claims, statements::PREPARE)?;
    let reason = body.reason.trim();
    if reason.len() < 5 || body.amount == Decimal::ZERO {
        return Err(AppError::BadRequest(
            "An adjustment needs a non-zero amount and a reason".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let old = statement_ops::lock(&mut tx, id).await?;
    if !matches!(old.status.as_str(), "draft" | "disputed") {
        return Err(AppError::Conflict(
            "Only a draft or disputed statement can be adjusted".to_owned(),
        ));
    }
    let row = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO doctor_payout_accruals (tenant_id, doctor_id, referral_doctor_id, agreement_id, \
         event, role, service_date, amount, reason, created_by) \
         VALUES ($1, $2, $3, $4, 'adjustment', $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(old.doctor_id)
    .bind(old.referral_doctor_id)
    .bind(old.agreement_id)
    .bind(if old.referral_doctor_id.is_some() { "referrer" } else { "primary" })
    .bind(old.period_end)
    .bind(body.amount)
    .bind(reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let new_id =
        statement_ops::reissue(&mut tx, claims.tenant_id, &old, Some(row), claims.sub).await?;
    let out = detail(&mut tx, new_id).await?;
    if out.statement.incentive_amount.unwrap_or_default() <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "That adjustment leaves nothing payable; record it on the next statement instead"
                .to_owned(),
        ));
    }
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct DisputeInput {
    pub reason: String,
}

/// Mark a draft disputed. `owner` limits it to that doctor's statements.
pub async fn dispute(
    tx: &mut Tx<'_>,
    id: Uuid,
    reason: &str,
    actor: Uuid,
    owner: Option<Uuid>,
) -> Result<Statement, AppError> {
    let reason = reason.trim();
    if reason.len() < 5 {
        return Err(AppError::BadRequest(
            "Say what is wrong with the statement".to_owned(),
        ));
    }
    let s = statement_ops::lock(tx, id).await?;
    if owner.is_some_and(|o| s.doctor_id != Some(o)) {
        return Err(AppError::NotFound);
    }
    if s.status != "draft" {
        return Err(AppError::Conflict(
            "Only a draft statement can be disputed".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE incentive_calculations SET status = 'disputed', disputed_reason = $2, disputed_by = $3, \
         disputed_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(reason)
    .bind(actor)
    .execute(&mut **tx)
    .await?;
    statement_ops::fetch(tx, id).await
}

/// POST /api/doctor-payouts/statements/{id}/dispute
pub async fn dispute_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DisputeInput>,
) -> Result<Json<Statement>, AppError> {
    require_permission(&claims, statements::PREPARE)?;
    let mut tx = begin(&state, &claims).await?;
    let out = dispute(&mut tx, id, &body.reason, claims.sub, None).await?;
    tx.commit().await?;
    Ok(Json(out))
}

/// POST /api/doctor-payouts/statements/{id}/approve
pub async fn approve_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Statement>, AppError> {
    require_permission(&claims, statements::APPROVE)?;
    let mut tx = begin(&state, &claims).await?;
    let out = statement_ops::approve(&mut tx, claims.tenant_id, id, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(out))
}
