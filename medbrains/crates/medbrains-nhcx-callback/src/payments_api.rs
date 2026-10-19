//! NHCX payments for finance: every payment a payer reported, per claim,
//! flagged when it names no claim here or differs from what the payer
//! approved; a claim's own payments for its drawer; and posting an
//! unmatched payment to the claim it pays.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::payments;

const MAX_ROWS: i64 = 200;

const COLUMNS: &str = "a.id, a.notice_id, n.sender_code, p.participant_name AS payer_name, \
     n.payment_reference, n.payment_date, n.received_at, a.claim_reference, a.insurance_claim_id, \
     c.claim_number, a.gross_amount, a.tds_amount, a.net_amount, a.approved_amount, a.is_mismatch, \
     a.status, a.posted_at, a.bank_transaction_id IS NOT NULL AS bank_matched, \
     n.nhcx_status AS ack_status";
const FROM: &str = "FROM nhcx_payment_allocations a \
     JOIN nhcx_payment_notices n ON n.id = a.notice_id AND n.tenant_id = a.tenant_id \
     LEFT JOIN insurance_claims c ON c.id = a.insurance_claim_id AND c.tenant_id = a.tenant_id \
     LEFT JOIN nhcx_participants p ON p.tenant_id = n.tenant_id \
          AND p.participant_code = n.sender_code";

/// One claim's share of a payer's payment.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NhcxPayment {
    pub id: Uuid,
    pub notice_id: Uuid,
    pub sender_code: String,
    pub payer_name: Option<String>,
    /// UTR / bank reference.
    pub payment_reference: Option<String>,
    pub payment_date: Option<NaiveDate>,
    pub received_at: DateTime<Utc>,
    /// How the payer named the claim.
    pub claim_reference: Option<String>,
    pub insurance_claim_id: Option<Uuid>,
    pub claim_number: Option<String>,
    /// Approved amount paid, before TDS.
    pub gross_amount: Decimal,
    pub tds_amount: Decimal,
    /// What reached the bank.
    pub net_amount: Decimal,
    /// The claim's approved amount when posted.
    pub approved_amount: Option<Decimal>,
    pub is_mismatch: bool,
    /// `posted` or `unmatched`.
    pub status: String,
    pub posted_at: Option<DateTime<Utc>>,
    /// Whether the bank statement's credit has been matched to it.
    pub bank_matched: bool,
    /// Whether the acknowledgement reached the payer.
    pub ack_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentsQuery {
    /// `open` (default) — unmatched or mismatched; `all` — everything.
    pub filter: Option<String>,
}

/// `GET /api/insurance/nhcx/payments`
///
/// # Errors
/// 403 without `insurance.nhcx.payments`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PaymentsQuery>,
) -> Result<Json<Vec<NhcxPayment>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::PAYMENTS)?;
    let only_open = q.filter.as_deref() != Some("all");
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NhcxPayment>(&format!(
        "SELECT {COLUMNS} {FROM} \
          WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
            AND (NOT $2 OR a.status = 'unmatched' OR a.is_mismatch) \
          ORDER BY n.received_at DESC, a.created_at LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(only_open)
    .bind(MAX_ROWS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn claim_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    claim_id: Uuid,
) -> Result<(Uuid, Option<String>), AppError> {
    sqlx::query_as(
        "SELECT patient_id, nhcx_recipient_code FROM insurance_claims \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(claim_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// `GET /api/billing/insurance-claims/{id}/nhcx/payments`
///
/// # Errors
/// 403 without `insurance.nhcx.payments` or access to the patient; 404 for
/// an unknown claim.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn claim_payments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<NhcxPayment>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::PAYMENTS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (patient_id, _) = claim_patient(&mut tx, claims.tenant_id, id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    let rows = sqlx::query_as::<_, NhcxPayment>(&format!(
        "SELECT {COLUMNS} {FROM} \
          WHERE a.tenant_id = $1 AND a.insurance_claim_id = $2 AND a.deleted_at IS NULL \
          ORDER BY n.received_at DESC LIMIT $3"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(MAX_ROWS)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct PostPaymentRequest {
    pub insurance_claim_id: Uuid,
}

/// `POST /api/insurance/nhcx/payments/{id}/post` — post a payment that
/// named no claim here to the claim it pays.
///
/// # Errors
/// 403 without `insurance.nhcx.payments` or access to the patient; 404 for
/// an unknown payment or claim; 400 for a claim sent to another payer; 409
/// once posted.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn post_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PostPaymentRequest>,
) -> Result<Json<NhcxPayment>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::PAYMENTS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sender: String = sqlx::query_scalar(
        "SELECT n.sender_code FROM nhcx_payment_allocations a \
           JOIN nhcx_payment_notices n ON n.id = a.notice_id \
          WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let claim_id = body.insurance_claim_id;
    let (patient_id, payer) = claim_patient(&mut tx, claims.tenant_id, claim_id).await?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    if payer.as_deref() != Some(sender.as_str()) {
        return Err(AppError::BadRequest(
            "that claim was not sent to the payer who made this payment".into(),
        ));
    }
    payments::post(&mut tx, claims.tenant_id, (id, claim_id), Some(claims.sub)).await?;
    let values = serde_json::json!({ "allocation_id": id, "insurance_claim_id": claim_id });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "nhcx_payment_posted",
            entity_type: "insurance_claim",
            entity_id: Some(claim_id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    let row = sqlx::query_as::<_, NhcxPayment>(&format!(
        "SELECT {COLUMNS} {FROM} WHERE a.id = $1 AND a.tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
