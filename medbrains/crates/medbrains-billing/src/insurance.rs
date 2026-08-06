//! Insurance and third-party payers: claims against an insurer, TPA rate cards,
//! dual-insurance / reimbursement splits, co-pay calculation, and TPA
//! bank-statement reconciliation.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. This is the
//! money that arrives from someone other than the patient. It settles on its own
//! timetable, against its own rate cards, and reconciles against a bank
//! statement rather than a counter — which is why it reads nothing like the
//! invoice path it sits beside.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{InsuranceClaim, Invoice, InvoiceStatus, TpaRateCard};
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
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Insurance Claims
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInsuranceClaimRequest {
    pub invoice_id: Uuid,
    pub patient_id: Uuid,
    pub insurance_provider: String,
    pub policy_number: Option<String>,
    pub claim_type: String,
    pub pre_auth_amount: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub notes: Option<String>,
    pub scheme_type: Option<String>,
    pub co_pay_percent: Option<Decimal>,
    pub deductible_amount: Option<Decimal>,
    pub member_id: Option<String>,
    pub scheme_card_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInsuranceClaimRequest {
    pub status: Option<String>,
    pub claim_number: Option<String>,
    pub approved_amount: Option<Decimal>,
    pub settled_amount: Option<Decimal>,
    pub notes: Option<String>,
}

pub async fn list_insurance_claims(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InsuranceClaim>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(claim))
}

pub async fn create_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInsuranceClaimRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::corporate::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ClaimInvoiceGate {
        patient_id: Uuid,
        status: InvoiceStatus,
    }

    let invoice = sqlx::query_as::<_, ClaimInvoiceGate>(
        "SELECT patient_id, status FROM invoices WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if invoice.patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "Insurance claim patient must match the selected invoice".to_owned(),
        ));
    }

    if !matches!(
        invoice.status,
        InvoiceStatus::Issued | InvoiceStatus::PartiallyPaid | InvoiceStatus::Paid
    ) {
        return Err(AppError::BadRequest(
            "Insurance claim can be created only for issued, partially paid, or paid invoices"
                .to_owned(),
        ));
    }

    let insurance_provider = body.insurance_provider.trim();
    if insurance_provider.len() < 2 {
        return Err(AppError::BadRequest(
            "Insurance provider is required".to_owned(),
        ));
    }

    let claim_type = body.claim_type.trim();
    if claim_type.is_empty() {
        return Err(AppError::BadRequest("Claim type is required".to_owned()));
    }

    if body
        .pre_auth_amount
        .is_some_and(|amount| amount < Decimal::ZERO)
    {
        return Err(AppError::BadRequest(
            "Pre-auth amount cannot be negative".to_owned(),
        ));
    }

    if body
        .deductible_amount
        .is_some_and(|amount| amount < Decimal::ZERO)
    {
        return Err(AppError::BadRequest(
            "Deductible amount cannot be negative".to_owned(),
        ));
    }

    if body
        .co_pay_percent
        .is_some_and(|percent| percent < Decimal::ZERO || percent > Decimal::from(100))
    {
        return Err(AppError::BadRequest(
            "Co-pay percent must be between 0 and 100".to_owned(),
        ));
    }

    let scheme = body
        .scheme_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("private");
    let policy_number = body
        .policy_number
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let tpa_name = body
        .tpa_name
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let member_id = body
        .member_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let scheme_card_number = body
        .scheme_card_number
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "INSERT INTO insurance_claims \
         (tenant_id, invoice_id, patient_id, insurance_provider, policy_number, \
          claim_type, status, pre_auth_amount, tpa_name, notes, created_by, \
          scheme_type, co_pay_percent, deductible_amount, member_id, scheme_card_number) \
         VALUES ($1, $2, $3, $4, $5, $6, 'initiated', $7, $8, $9, $10, \
          $11::insurance_scheme_type, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.patient_id)
    .bind(insurance_provider)
    .bind(policy_number)
    .bind(claim_type)
    .bind(body.pre_auth_amount.map(|amount| amount.round_dp(2)))
    .bind(tpa_name)
    .bind(notes)
    .bind(claims.sub)
    .bind(scheme)
    .bind(body.co_pay_percent.map(|percent| percent.round_dp(2)))
    .bind(body.deductible_amount.map(|amount| amount.round_dp(2)))
    .bind(member_id)
    .bind(scheme_card_number)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(claim))
}

pub async fn update_insurance_claim(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateInsuranceClaimRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Revenue-integrity gate: settlement amounts must stay sane, otherwise the
    // patient-responsible residual (co-pay + disallowed items), computed
    // everywhere as `invoice.total − settled`, can silently collapse and never
    // get billed. Bound the amounts to the existing claim + its invoice total.
    #[derive(sqlx::FromRow)]
    struct ClaimSettleGate {
        invoice_total: Decimal,
        approved_amount: Option<Decimal>,
        settled_amount: Option<Decimal>,
    }

    let gate = sqlx::query_as::<_, ClaimSettleGate>(
        "SELECT i.total_amount AS invoice_total, ic.approved_amount, ic.settled_amount \
         FROM insurance_claims ic \
         JOIN invoices i ON i.id = ic.invoice_id AND i.tenant_id = ic.tenant_id \
         WHERE ic.id = $1 AND ic.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if body
        .approved_amount
        .is_some_and(|amount| amount < Decimal::ZERO)
        || body
            .settled_amount
            .is_some_and(|amount| amount < Decimal::ZERO)
    {
        return Err(AppError::BadRequest(
            "Approved and settled amounts cannot be negative".to_owned(),
        ));
    }

    // Effective amounts after this update (incoming value wins, else current).
    let effective_approved = body.approved_amount.or(gate.approved_amount);
    let effective_settled = body.settled_amount.or(gate.settled_amount);

    // The insurer cannot approve more than the hospital billed.
    if let Some(approved) = effective_approved {
        if approved > gate.invoice_total {
            return Err(AppError::BadRequest(format!(
                "Approved amount {approved} exceeds the invoice total {}",
                gate.invoice_total
            )));
        }
    }

    // The insurer cannot settle (pay) more than it sanctioned (approved).
    if let (Some(settled), Some(approved)) = (effective_settled, effective_approved) {
        if settled > approved {
            return Err(AppError::BadRequest(format!(
                "Settled amount {settled} cannot exceed the approved amount {approved}"
            )));
        }
    }

    // Handle settled_at based on status
    let set_settled = body.status.as_deref() == Some("settled")
        || body.status.as_deref() == Some("partially_settled");

    // Closing a claim as settled with no settled amount would treat the insurer
    // as having paid nothing while still marking the claim done — leaving the
    // residual uncollected. Require an explicit settled amount to settle.
    if set_settled && effective_settled.is_none() {
        return Err(AppError::BadRequest(
            "A settled amount is required to mark the claim settled".to_owned(),
        ));
    }

    let claim = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET \
         status = COALESCE($1, status), \
         claim_number = COALESCE($2, claim_number), \
         approved_amount = COALESCE($3, approved_amount), \
         settled_amount = COALESCE($4, settled_amount), \
         notes = COALESCE($5, notes), \
         submitted_at = CASE WHEN $1 = 'claim_submitted' THEN now() ELSE submitted_at END, \
         settled_at = CASE WHEN $6 THEN now() ELSE settled_at END, \
         updated_at = now() \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING *",
    )
    .bind(&body.status)
    .bind(&body.claim_number)
    .bind(body.approved_amount)
    .bind(body.settled_amount)
    .bind(&body.notes)
    .bind(set_settled)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(claim))
}

// ══════════════════════════════════════════════════════════
//  TPA Rate Cards
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateTpaRateCardRequest {
    pub tpa_name: String,
    pub insurance_provider: String,
    pub rate_plan_id: Uuid,
    pub scheme_type: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTpaRateCardRequest {
    pub tpa_name: Option<String>,
    pub insurance_provider: Option<String>,
    pub rate_plan_id: Option<Uuid>,
    pub scheme_type: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub is_active: Option<bool>,
}

pub async fn list_tpa_rate_cards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TpaRateCard>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, TpaRateCard>(
        "SELECT * FROM tpa_rate_cards WHERE tenant_id = $1 ORDER BY tpa_name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTpaRateCardRequest>,
) -> Result<Json<TpaRateCard>, AppError> {
    require_permission(&claims, permissions::billing::corporate::CREATE)?;

    let scheme = body.scheme_type.as_deref().unwrap_or("private");
    let tpa_name = body.tpa_name.trim().to_owned();
    let insurance_provider = body.insurance_provider.trim().to_owned();
    if tpa_name.is_empty() {
        return Err(AppError::BadRequest("TPA name is required".to_owned()));
    }
    if insurance_provider.is_empty() {
        return Err(AppError::BadRequest(
            "insurance provider is required".to_owned(),
        ));
    }
    if let (Some(valid_from), Some(valid_to)) = (body.valid_from, body.valid_to) {
        if valid_to < valid_from {
            return Err(AppError::BadRequest(
                "valid to date must be after valid from date".to_owned(),
            ));
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rate_plan_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
             SELECT 1 FROM rate_plans \
             WHERE id = $1 AND tenant_id = $2 AND is_active = true \
         )",
    )
    .bind(body.rate_plan_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !rate_plan_exists {
        return Err(AppError::BadRequest(
            "rate plan must be an active tenant rate plan".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, TpaRateCard>(
        "INSERT INTO tpa_rate_cards \
         (tenant_id, tpa_name, insurance_provider, rate_plan_id, \
          scheme_type, valid_from, valid_to) \
         VALUES ($1, $2, $3, $4, $5::insurance_scheme_type, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&tpa_name)
    .bind(&insurance_provider)
    .bind(body.rate_plan_id)
    .bind(scheme)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTpaRateCardRequest>,
) -> Result<Json<TpaRateCard>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    if let (Some(valid_from), Some(valid_to)) = (body.valid_from, body.valid_to) {
        if valid_to < valid_from {
            return Err(AppError::BadRequest(
                "valid to date must be after valid from date".to_owned(),
            ));
        }
    }
    if let Some(rate_plan_id) = body.rate_plan_id {
        let rate_plan_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS( \
                 SELECT 1 FROM rate_plans \
                 WHERE id = $1 AND tenant_id = $2 AND is_active = true \
             )",
        )
        .bind(rate_plan_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !rate_plan_exists {
            return Err(AppError::BadRequest(
                "rate plan must be an active tenant rate plan".to_owned(),
            ));
        }
    }
    let tpa_name = body
        .tpa_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let insurance_provider = body
        .insurance_provider
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let row = sqlx::query_as::<_, TpaRateCard>(
        "UPDATE tpa_rate_cards SET \
         tpa_name = COALESCE($1, tpa_name), \
         insurance_provider = COALESCE($2, insurance_provider), \
         rate_plan_id = COALESCE($3, rate_plan_id), \
         valid_from = COALESCE($4, valid_from), \
         valid_to = COALESCE($5, valid_to), \
         is_active = COALESCE($6, is_active), \
         updated_at = now() \
         WHERE id = $7 AND tenant_id = $8 \
         RETURNING *",
    )
    .bind(tpa_name)
    .bind(insurance_provider)
    .bind(body.rate_plan_id)
    .bind(body.valid_from)
    .bind(body.valid_to)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_tpa_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM tpa_rate_cards WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Dual Insurance / Reimbursement
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct DualInsuranceResult {
    pub primary_claim: Option<InsuranceClaim>,
    pub secondary_claim: Option<InsuranceClaim>,
    pub patient_responsibility: Decimal,
    pub coordination_notes: String,
}

pub async fn coordinate_dual_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<DualInsuranceResult>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    // Get primary insurance
    let primary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = false \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let primary_settled = primary
        .as_ref()
        .and_then(|p| p.approved_amount)
        .unwrap_or(Decimal::ZERO);

    let remaining = invoice.total_amount - primary_settled;
    let patient_responsibility;
    let mut secondary_claim: Option<InsuranceClaim> = None;
    let coordination_notes;

    if remaining > Decimal::ZERO {
        // Check for secondary insurance on patient
        let secondary_ins = sqlx::query_scalar::<_, Option<String>>(
            "SELECT provider_name FROM patient_insurance \
             WHERE patient_id = $1 AND tenant_id = $2 AND priority = 2 AND is_active = true \
             LIMIT 1",
        )
        .bind(invoice.patient_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

        if let Some(provider) = secondary_ins {
            // Create secondary claim for the remainder
            let claim = sqlx::query_as::<_, InsuranceClaim>(
                "INSERT INTO insurance_claims \
                 (tenant_id, invoice_id, patient_id, insurance_provider, \
                  claim_type, status, is_secondary, primary_claim_id, \
                  claim_amount, coordination_of_benefits, created_by, scheme_type) \
                 VALUES ($1, $2, $3, $4, 'cashless', 'claim_submitted', true, $5, $6, \
                  'Secondary payer for remaining balance after primary', $7, 'private') \
                 RETURNING *",
            )
            .bind(claims.tenant_id)
            .bind(invoice_id)
            .bind(invoice.patient_id)
            .bind(&provider)
            .bind(primary.as_ref().map(|p| p.id))
            .bind(remaining)
            .bind(claims.sub)
            .fetch_one(&mut *tx)
            .await?;

            secondary_claim = Some(claim);
            patient_responsibility = Decimal::ZERO;
            coordination_notes = format!(
                "Primary: {primary_settled}, Secondary claim: {remaining}, \
                 Patient: 0",
            );
        } else {
            patient_responsibility = remaining;
            coordination_notes = format!(
                "Primary: {primary_settled}, No secondary insurance. \
                 Patient: {remaining}",
            );
        }
    } else {
        patient_responsibility = Decimal::ZERO;
        coordination_notes = format!("Primary covers full amount: {primary_settled}");
    }

    tx.commit().await?;

    Ok(Json(DualInsuranceResult {
        primary_claim: primary,
        secondary_claim,
        patient_responsibility,
        coordination_notes,
    }))
}

pub async fn get_dual_insurance_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<DualInsuranceResult>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice_id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let primary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = false \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let secondary = sqlx::query_as::<_, InsuranceClaim>(
        "SELECT * FROM insurance_claims \
         WHERE invoice_id = $1 AND tenant_id = $2 AND is_secondary = true \
         ORDER BY created_at LIMIT 1",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    let settled = primary
        .as_ref()
        .and_then(|p| p.settled_amount)
        .unwrap_or(Decimal::ZERO)
        + secondary
            .as_ref()
            .and_then(|s| s.settled_amount)
            .unwrap_or(Decimal::ZERO);
    let patient_responsibility = (invoice.total_amount - settled).max(Decimal::ZERO);

    tx.commit().await?;

    Ok(Json(DualInsuranceResult {
        primary_claim: primary,
        secondary_claim: secondary,
        patient_responsibility,
        coordination_notes: String::new(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct ReimbursementDocsRequest {
    pub documents: serde_json::Value,
}

pub async fn generate_reimbursement_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
    Json(body): Json<ReimbursementDocsRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET reimbursement_docs = $3 \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .bind(&body.documents)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_reimbursement_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(claim_id): Path<Uuid>,
    Json(body): Json<ReimbursementDocsRequest>,
) -> Result<Json<InsuranceClaim>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, InsuranceClaim>(
        "UPDATE insurance_claims SET reimbursement_docs = $3 \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(claim_id)
    .bind(claims.tenant_id)
    .bind(&body.documents)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/copay/calculate
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CopayCalculationRequest {
    pub invoice_id: Uuid,
}

pub async fn copay_calculation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CopayCalculationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch invoice total
    let invoice =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(body.invoice_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    // Fetch insurance verification for the patient
    let verification = sqlx::query_as::<_, (Option<Decimal>, Option<Decimal>)>(
        "SELECT co_pay_percent, out_of_pocket_max \
         FROM insurance_verifications \
         WHERE patient_id = $1 AND tenant_id = $2 \
           AND status = 'active' \
         ORDER BY verified_at DESC LIMIT 1",
    )
    .bind(invoice.patient_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let total = invoice.total_amount;

    match verification {
        Some((copay_pct, max_coverage)) => {
            let copay = copay_pct
                .map(|pct| total * pct / Decimal::from(100))
                .unwrap_or_default();
            let max_cov = max_coverage.unwrap_or(total);
            let insurance_pays = (total - copay).min(max_cov);
            let patient_pays = total - insurance_pays;

            Ok(Json(serde_json::json!({
                "invoice_id": body.invoice_id,
                "invoice_total": total,
                "copay_percent": copay_pct,
                "max_coverage": max_coverage,
                "insurance_pays": insurance_pays,
                "patient_pays": patient_pays,
                "has_insurance_verification": true,
            })))
        }
        None => Ok(Json(serde_json::json!({
            "invoice_id": body.invoice_id,
            "invoice_total": total,
            "insurance_pays": Decimal::ZERO,
            "patient_pays": total,
            "has_insurance_verification": false,
            "message": "No active insurance verification found",
        }))),
    }
}

// ══════════════════════════════════════════════════════════════════
//  TPA bank-statement reconciliation (priority #4)
// ══════════════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct AutoMatchResponse {
    pub processed: i64,
    pub matched: i64,
    pub variance_flagged: i64,
    pub still_unmatched: i64,
}

/// Walk every `unmatched` credit on `bank_transactions` and try to
/// match it to one or more `insurance_claims`. Match strategies, in
/// priority order (first hit wins per credit):
///
/// 1. **Reference number == claim_number** (exact UTR match).
/// 2. **Description contains a known claim_number** (regex extract).
/// 3. **Approved-amount window** — credit ± 1 INR matches a claim
///    with `approved_amount` and `status='approved'` for a known TPA
///    name appearing in the description. Lower confidence so we flag
///    `recon_status='discrepancy'` for human review.
///
/// Variance: when matched, if `credit_amount < approved_amount`, set
/// `variance_amount = approved_amount - credit_amount` and
/// `recon_status='discrepancy'` so the cashier follows up with the TPA.
pub async fn auto_match_bank_transactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoMatchResponse>, AppError> {
    require_permission(&claims, permissions::billing::bank_recon::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Pull unmatched credits only (debits aren't TPA settlements).
    let unmatched: Vec<UnmatchedCredit> = sqlx::query_as::<_, UnmatchedCredit>(
        "SELECT id, transaction_date, credit_amount, reference_number, description \
         FROM bank_transactions \
         WHERE tenant_id = $1 AND recon_status = 'unmatched' AND credit_amount > 0",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut matched = 0i64;
    let mut variance_flagged = 0i64;
    let processed = unmatched.len() as i64;

    for txn in &unmatched {
        // Strategy 1 — exact reference match against claim_number.
        let claim_by_ref: Option<(Uuid, Decimal, Option<Decimal>)> =
            if let Some(reference) = &txn.reference_number {
                sqlx::query_as(
                    "SELECT id, COALESCE(approved_amount, 0)::NUMERIC, settled_amount \
                     FROM insurance_claims \
                     WHERE tenant_id = $1 AND claim_number = $2 LIMIT 1",
                )
                .bind(claims.tenant_id)
                .bind(reference)
                .fetch_optional(&mut *tx)
                .await?
            } else {
                None
            };

        // Strategy 2 — description contains claim_number (CLM-XXXX pattern).
        let claim = if claim_by_ref.is_some() {
            claim_by_ref
        } else if let Some(desc) = &txn.description {
            let candidate = extract_claim_number_from_description(desc);
            if let Some(num) = candidate {
                sqlx::query_as(
                    "SELECT id, COALESCE(approved_amount, 0)::NUMERIC, settled_amount \
                     FROM insurance_claims \
                     WHERE tenant_id = $1 AND claim_number = $2 LIMIT 1",
                )
                .bind(claims.tenant_id)
                .bind(num)
                .fetch_optional(&mut *tx)
                .await?
            } else {
                None
            }
        } else {
            None
        };

        // Strategy 3 — amount window (low confidence, flag discrepancy).
        let (claim, low_confidence) = if claim.is_some() {
            (claim, false)
        } else {
            let by_amount: Option<(Uuid, Decimal, Option<Decimal>)> = sqlx::query_as(
                "SELECT id, approved_amount::NUMERIC, settled_amount \
                     FROM insurance_claims \
                     WHERE tenant_id = $1 AND status = 'approved' \
                       AND approved_amount IS NOT NULL \
                       AND ABS(approved_amount - $2) < 1 \
                     ORDER BY submitted_at DESC LIMIT 1",
            )
            .bind(claims.tenant_id)
            .bind(txn.credit_amount)
            .fetch_optional(&mut *tx)
            .await?;
            (by_amount, true)
        };

        let Some((claim_id, approved, prior_settled)) = claim else {
            continue;
        };

        let variance = approved - txn.credit_amount;
        let new_recon_status = if variance.abs() < Decimal::ONE && !low_confidence {
            "matched"
        } else {
            variance_flagged += 1;
            "discrepancy"
        };

        let new_settled = prior_settled.unwrap_or(Decimal::ZERO) + txn.credit_amount;

        // Update the bank_transaction row.
        sqlx::query(
            "UPDATE bank_transactions \
             SET matched_claim_id = $1, recon_status = $2::recon_status, \
                 variance_amount = $3, matched_at = now(), matched_by = $4, \
                 auto_match_score = $5 \
             WHERE id = $6 AND tenant_id = $7",
        )
        .bind(claim_id)
        .bind(new_recon_status)
        .bind(variance)
        .bind(claims.sub)
        .bind::<f32>(if low_confidence { 0.5 } else { 1.0 })
        .bind(txn.id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        // Insert allocation row.
        sqlx::query(
            "INSERT INTO bank_transaction_claim_allocations \
             (tenant_id, bank_transaction_id, claim_id, allocated_amount, created_by) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (bank_transaction_id, claim_id) DO NOTHING",
        )
        .bind(claims.tenant_id)
        .bind(txn.id)
        .bind(claim_id)
        .bind(txn.credit_amount)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;

        // Update the claim's settled_amount.
        sqlx::query(
            "UPDATE insurance_claims \
             SET settled_amount = $1, settled_at = COALESCE(settled_at, now()), \
                 status = CASE WHEN ABS($1 - approved_amount) < 1 THEN 'settled' \
                              ELSE status END, \
                 updated_at = now() \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(new_settled)
        .bind(claim_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        matched += 1;
    }

    tx.commit().await?;

    Ok(Json(AutoMatchResponse {
        processed,
        matched,
        variance_flagged,
        still_unmatched: processed - matched,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct UnmatchedCredit {
    id: Uuid,
    #[allow(dead_code)]
    transaction_date: NaiveDate,
    credit_amount: Decimal,
    reference_number: Option<String>,
    description: Option<String>,
}

fn extract_claim_number_from_description(desc: &str) -> Option<String> {
    // Common claim-number shapes: "CLM-2026-12345" or "CLAIM 123456".
    // We accept any alphanumeric token of length 6-30 prefixed by
    // "CLM" or "CLAIM" (case-insensitive).
    let upper = desc.to_uppercase();
    for prefix in ["CLM-", "CLM ", "CLAIM-", "CLAIM "] {
        if let Some(start) = upper.find(prefix) {
            let after = &desc[start + prefix.len()..];
            let candidate: String = after
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '-')
                .collect();
            if candidate.len() >= 4 {
                return Some(format!("{}{}", &prefix.replace(' ', ""), candidate));
            }
        }
    }
    None
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PayerAgingBucket {
    pub tpa_name: Option<String>,
    pub bucket_0_30: Decimal,
    pub bucket_30_60: Decimal,
    pub bucket_60_90: Decimal,
    pub bucket_90_plus: Decimal,
    pub total_outstanding: Decimal,
    pub claim_count: i64,
}

/// `GET /api/billing/insurance-receivables/aging` — outstanding
/// per-payer broken into 0-30 / 30-60 / 60-90 / 90+ day buckets.
/// Outstanding = approved - settled, only for claims still 'approved'
/// (not 'settled').
pub async fn insurance_receivables_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PayerAgingBucket>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::bank_recon::LIST,
            permissions::billing::bank_recon::MANAGE,
        ],
    )?;

    let rows = sqlx::query_as::<_, PayerAgingBucket>(
        "SELECT \
            tpa_name, \
            COALESCE(SUM(CASE WHEN age_days <= 30 THEN outstanding ELSE 0 END), 0) \
                AS bucket_0_30, \
            COALESCE(SUM(CASE WHEN age_days BETWEEN 31 AND 60 THEN outstanding ELSE 0 END), 0) \
                AS bucket_30_60, \
            COALESCE(SUM(CASE WHEN age_days BETWEEN 61 AND 90 THEN outstanding ELSE 0 END), 0) \
                AS bucket_60_90, \
            COALESCE(SUM(CASE WHEN age_days > 90 THEN outstanding ELSE 0 END), 0) \
                AS bucket_90_plus, \
            COALESCE(SUM(outstanding), 0) AS total_outstanding, \
            COUNT(*) AS claim_count \
         FROM ( \
             SELECT \
                 tpa_name, \
                 COALESCE(approved_amount, 0) - COALESCE(settled_amount, 0) AS outstanding, \
                 EXTRACT(DAY FROM now() - submitted_at)::INT AS age_days \
             FROM insurance_claims \
             WHERE tenant_id = $1 \
               AND status NOT IN ('settled', 'rejected', 'cancelled') \
               AND approved_amount IS NOT NULL \
               AND COALESCE(approved_amount, 0) > COALESCE(settled_amount, 0) \
         ) sub \
         GROUP BY tpa_name \
         ORDER BY total_outstanding DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}
