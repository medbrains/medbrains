//! Billing → Insurance settlements: insurer money posted against bills, by
//! hand, under maker-checker.
//!
//! Every settlement — typed in here, an NHCX payment notice, a bank-statement
//! match, a claim marked settled, a historical import, the one-time backfill —
//! files a pending posting through `file_claim_settlement` (migration 1227).
//! Nothing reaches a bill until a second person approves it; see
//! `claim_settlement_post` for what approving, rejecting and reversing do.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
    },
    pagination::{Paginated, Pagination},
    state::AppState,
};

use crate::claim_settlement_post as post;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ClaimSettlementPosting {
    pub id: Uuid,
    pub insurance_claim_id: Uuid,
    pub invoice_id: Uuid,
    pub patient_id: Uuid,
    pub source: String,
    pub source_ref: String,
    pub payer: Option<String>,
    pub settled_amount: Decimal,
    pub tds_amount: Decimal,
    pub payment_reference: Option<String>,
    pub settlement_date: Option<NaiveDate>,
    pub deductions: serde_json::Value,
    pub deduction_total: Decimal,
    pub notes: Option<String>,
    pub status: String,
    pub needs_review: bool,
    pub review_reason: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub recorded_by_name: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub decided_by: Option<Uuid>,
    pub decided_by_name: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub reject_reason: Option<String>,
    pub posted_amount: Option<Decimal>,
    pub excess_amount: Option<Decimal>,
    pub payment_id: Option<Uuid>,
    pub write_off_id: Option<Uuid>,
    pub reversed_at: Option<DateTime<Utc>>,
    pub reversal_reason: Option<String>,
    pub claim_number: Option<String>,
    pub claim_status: String,
    pub claim_amount: Option<Decimal>,
    pub approved_amount: Option<Decimal>,
    pub invoice_number: String,
    pub invoice_total: Decimal,
    pub invoice_paid: Decimal,
    pub patient_name: String,
    pub uhid: String,
}

/// The queue's one query: the posting with its claim, bill, patient and the
/// two people, joined once — never a lookup per row.
pub(crate) const POSTING_SELECT: &str = "SELECT s.id, s.insurance_claim_id, s.invoice_id, \
        s.patient_id, s.source, s.source_ref, s.payer, s.settled_amount, s.tds_amount, \
        s.payment_reference, s.settlement_date, s.deductions, s.deduction_total, s.notes, \
        s.status, s.needs_review, s.review_reason, s.recorded_by, ru.full_name AS recorded_by_name, \
        s.recorded_at, s.decided_by, du.full_name AS decided_by_name, s.decided_at, \
        s.reject_reason, s.posted_amount, s.excess_amount, s.payment_id, s.write_off_id, \
        s.reversed_at, s.reversal_reason, c.claim_number, c.status AS claim_status, \
        c.claim_amount, c.approved_amount, i.invoice_number, i.total_amount AS invoice_total, \
        i.paid_amount AS invoice_paid, \
        btrim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid \
   FROM claim_settlement_postings s \
   JOIN insurance_claims c ON c.id = s.insurance_claim_id AND c.tenant_id = s.tenant_id \
   JOIN invoices i ON i.id = s.invoice_id AND i.tenant_id = s.tenant_id \
   JOIN patients p ON p.id = s.patient_id AND p.tenant_id = s.tenant_id \
   LEFT JOIN users ru ON ru.id = s.recorded_by \
   LEFT JOIN users du ON du.id = s.decided_by";

#[derive(Debug, Deserialize)]
pub struct ListSettlementsQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// `GET /api/billing/claim-settlements` — the queue, newest first.
pub async fn list_claim_settlements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListSettlementsQuery>,
) -> Result<Json<Paginated<ClaimSettlementPosting>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::claims::settlement::RECORD,
            permissions::billing::claims::settlement::APPROVE,
        ],
    )?;
    let visible =
        medbrains_authz_gate::require_patient_billing_filter(&state, &claims, None).await?;
    let page = Pagination {
        page: q.page,
        limit: q.limit,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let filter = "s.tenant_id = $1 AND s.deleted_at IS NULL \
        AND ($2::text IS NULL OR s.status = $2) \
        AND ($3::uuid[] IS NULL OR s.patient_id = ANY($3))";
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM claim_settlement_postings s WHERE {filter}"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .fetch_one(&mut *tx)
    .await?;
    let rows = sqlx::query_as::<_, ClaimSettlementPosting>(&format!(
        "{POSTING_SELECT} WHERE {filter} ORDER BY s.needs_review DESC, s.recorded_at DESC \
         LIMIT $4 OFFSET $5"
    ))
    .bind(claims.tenant_id)
    .bind(&q.status)
    .bind(&visible)
    .bind(page.limit())
    .bind(page.offset())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Paginated::new(rows, total, &page)))
}

/// One line the insurer took off the claim.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deduction {
    pub reason: String,
    pub amount: Decimal,
    /// `patient` (stays owing on the patient) or `write_off` (the hospital
    /// absorbs it, e.g. a tariff disallowance it may not bill the patient).
    pub treatment: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordSettlementRequest {
    pub insurance_claim_id: Uuid,
    pub settled_amount: Decimal,
    pub tds_amount: Option<Decimal>,
    pub payment_reference: String,
    pub settlement_date: NaiveDate,
    #[serde(default)]
    pub deductions: Vec<Deduction>,
    pub notes: Option<String>,
}

/// `POST /api/billing/claim-settlements` — the desk records what the insurer
/// paid. It files a pending posting; the bill is untouched until approval.
pub async fn record_claim_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordSettlementRequest>,
) -> Result<Json<ClaimSettlementPosting>, AppError> {
    require_permission(&claims, permissions::billing::claims::settlement::RECORD)?;
    crate::require_amount_write(&state, &claims).await?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INSURANCE_CLAIM,
        body.insurance_claim_id,
    )
    .await?;
    post::validate_record(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id = post::record(&mut tx, &claims, &body).await?;
    let row = post::fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ApproveSettlementRequest {
    /// Approve a posting worth more than the bill has open: post what the
    /// bill can take and leave the excess on the posting for review.
    #[serde(default)]
    pub accept_excess: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReasonRequest {
    pub reason: String,
}

/// `PUT /api/billing/claim-settlements/{id}/approve`
pub async fn approve_claim_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveSettlementRequest>,
) -> Result<Json<ClaimSettlementPosting>, AppError> {
    require_permission(&claims, permissions::billing::claims::settlement::APPROVE)?;
    decide(
        &state,
        &claims,
        id,
        post::Decision::Approve(body.accept_excess),
    )
    .await
}

/// `PUT /api/billing/claim-settlements/{id}/reject`
pub async fn reject_claim_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReasonRequest>,
) -> Result<Json<ClaimSettlementPosting>, AppError> {
    require_permission(&claims, permissions::billing::claims::settlement::APPROVE)?;
    decide(
        &state,
        &claims,
        id,
        post::Decision::Reject(post::reason(&body.reason)?),
    )
    .await
}

/// `PUT /api/billing/claim-settlements/{id}/reverse`
pub async fn reverse_claim_settlement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReasonRequest>,
) -> Result<Json<ClaimSettlementPosting>, AppError> {
    require_permission(&claims, permissions::billing::claims::settlement::REVERSE)?;
    decide(
        &state,
        &claims,
        id,
        post::Decision::Reverse(post::reason(&body.reason)?),
    )
    .await
}

async fn decide(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
    decision: post::Decision,
) -> Result<Json<ClaimSettlementPosting>, AppError> {
    crate::require_amount_write(state, claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let claim_id: Uuid = sqlx::query_scalar(
        "SELECT insurance_claim_id FROM claim_settlement_postings \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::INSURANCE_CLAIM,
        claim_id,
    )
    .await?;
    post::apply(&mut tx, claims, id, decision).await?;
    let row = post::fetch(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct BackfillRequest {
    /// Count what would be filed without filing it.
    pub dry_run: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BackfillResult {
    pub dry_run: bool,
    pub claims: i64,
    pub amount: Decimal,
    pub filed: i64,
}

/// `POST /api/billing/claim-settlements/backfill` — one pending posting for
/// every claim settled before postings existed. Never approves anything.
pub async fn backfill_claim_settlements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BackfillRequest>,
) -> Result<Json<BackfillResult>, AppError> {
    require_permission(&claims, permissions::billing::claims::settlement::BACKFILL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let out = file_backfill(&mut tx, &claims, body.dry_run).await?;
    tx.commit().await?;
    Ok(Json(out))
}

/// One pending posting per claim settled before postings existed.
async fn file_backfill(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    dry_run: bool,
) -> Result<BackfillResult, AppError> {
    // ponytail: one statement over every settled claim; bounded by the
    // tenant's claim count, batch by date range if that ever reaches millions.
    let due = "FROM insurance_claims c \
        WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
          AND c.status IN ('settled', 'partially_settled') AND COALESCE(c.settled_amount, 0) > 0 \
          AND NOT EXISTS (SELECT 1 FROM claim_settlement_postings s \
                           WHERE s.insurance_claim_id = c.id AND s.tenant_id = c.tenant_id \
                             AND s.deleted_at IS NULL)";
    let (count, amount): (i64, Decimal) = sqlx::query_as(&format!(
        "SELECT COUNT(*), COALESCE(SUM(c.settled_amount), 0) {due}"
    ))
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let filed = if dry_run {
        0
    } else {
        sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(file_claim_settlement(c.tenant_id, c.id, 'backfill', 'claim', \
                    c.settled_amount, 0, NULL, c.settled_at::date, $2)) {due}"
        ))
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_one(&mut **tx)
        .await?
    };
    Ok(BackfillResult {
        dry_run,
        claims: count,
        amount,
        filed,
    })
}
