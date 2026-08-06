//! Money taken before the bill exists: advance receipts, their adjustment
//! against later invoices, and interim billing for a stay still in progress.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. An advance is a
//! liability, not revenue: the hospital is holding the patient's money and owes
//! either treatment or a refund. That is the opposite direction from an invoice,
//! and it is why advances carry their own numbering sequence and their own
//! balance to draw down.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::billing::{
    AdvanceAdjustment, AdvanceStatus, AuditAction, Invoice, InvoiceStatus, PatientAdvance,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{require_any_permission, require_permission},
    },
    state::AppState,
};
use medbrains_server_services::billing::{
    SeqResult, admission_id_for_encounter_in_tx, generate_invoice_number,
    recalculate_invoice_totals,
};

// Shared with the invoicing side of the crate rather than duplicated: the audit
// trail every billing write appends to, and the field-level access helpers that
// decide who may see an amount.
use crate::{
    filter_advance_amounts, log_billing_audit, resolve_billing_restricted_fields,
    validate_billing_amount_write_access,
};

// ══════════════════════════════════════════════════════════
//  Advance number generation
// ══════════════════════════════════════════════════════════

async fn generate_advance_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'ADVANCE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM patient_advances WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(format!("ADV{:0>6}", count + 1))
    }
}

// ══════════════════════════════════════════════════════════
//  Patient Advances
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListAdvancesQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAdvanceRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub amount: Decimal,
    pub payment_mode: String,
    pub reference_number: Option<String>,
    pub purpose: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdjustAdvanceRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefundAdvanceRequest {
    pub amount: Decimal,
    pub reason: String,
    pub mode: Option<String>,
    pub reference_number: Option<String>,
}

pub async fn list_advances(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAdvancesQuery>,
) -> Result<Json<Vec<PatientAdvance>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::advances::LIST,
            permissions::billing::advances::ADJUST,
            permissions::billing::advances::REFUND,
        ],
    )?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pid) = params.patient_id {
        sqlx::query_as::<_, PatientAdvance>(
            "SELECT * FROM patient_advances \
             WHERE tenant_id = $1 AND patient_id = $2 ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(pid)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PatientAdvance>(
            "SELECT * FROM patient_advances \
             WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_advance_amounts(row, &restricted_fields))
            .collect(),
    ))
}

pub async fn create_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAdvanceRequest>,
) -> Result<Json<PatientAdvance>, AppError> {
    require_permission(&claims, permissions::billing::advances::CREATE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let advance_amount = body.amount.round_dp(2);
    if advance_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Advance amount must be greater than zero".to_owned(),
        ));
    }

    if let Some(encounter_id) = body.encounter_id {
        let encounter_patient_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        )
        .bind(encounter_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

        if encounter_patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "Advance encounter does not belong to patient".to_owned(),
            ));
        }
    }

    let adv_number = generate_advance_number(&mut tx, &claims.tenant_id).await?;
    let purpose = body.purpose.as_deref().unwrap_or("general");

    let advance = sqlx::query_as::<_, PatientAdvance>(
        "INSERT INTO patient_advances \
         (tenant_id, patient_id, encounter_id, advance_number, amount, balance, \
          payment_mode, reference_number, purpose, status, received_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $5, $6::payment_mode, $7, \
          $8::advance_purpose, 'active'::advance_status, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&adv_number)
    .bind(advance_amount)
    .bind(&body.payment_mode)
    .bind(&body.reference_number)
    .bind(purpose)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::AdvanceCollected,
        "patient_advance",
        advance.id,
        None,
        Some(advance.patient_id),
        Some(advance_amount),
        Some(serde_json::json!({
            "advance_number": advance.advance_number,
            "purpose": purpose,
            "payment_mode": body.payment_mode,
            "balance": advance.balance,
        })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(filter_advance_amounts(advance, &restricted_fields)))
}

pub async fn adjust_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AdjustAdvanceRequest>,
) -> Result<Json<AdvanceAdjustment>, AppError> {
    require_permission(&claims, permissions::billing::advances::ADJUST)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let adjustment_amount = body.amount.round_dp(2);
    if adjustment_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Adjustment amount must be greater than zero".to_owned(),
        ));
    }

    let advance = sqlx::query_as::<_, PatientAdvance>(
        "SELECT * FROM patient_advances WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if !matches!(
        advance.status,
        AdvanceStatus::Active | AdvanceStatus::PartiallyUsed
    ) || advance.balance <= Decimal::ZERO
    {
        return Err(AppError::BadRequest(
            "Advance has no usable balance".to_owned(),
        ));
    }

    if advance.balance < adjustment_amount {
        return Err(AppError::BadRequest(
            "Adjustment amount exceeds advance balance".to_owned(),
        ));
    }

    #[derive(sqlx::FromRow)]
    struct AdvanceInvoiceGate {
        patient_id: Uuid,
        status: InvoiceStatus,
        total_amount: Decimal,
        paid_amount: Decimal,
    }

    let invoice = sqlx::query_as::<_, AdvanceInvoiceGate>(
        "SELECT patient_id, status, total_amount, paid_amount \
         FROM invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if invoice.patient_id != advance.patient_id {
        return Err(AppError::BadRequest(
            "Advance can be adjusted only against the same patient's invoice".to_owned(),
        ));
    }

    if !matches!(
        invoice.status,
        InvoiceStatus::Issued | InvoiceStatus::PartiallyPaid
    ) {
        return Err(AppError::BadRequest(
            "Advance can be adjusted only against issued invoices with an outstanding balance"
                .to_owned(),
        ));
    }

    let outstanding = (invoice.total_amount - invoice.paid_amount).round_dp(2);
    if outstanding <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Invoice has no outstanding balance".to_owned(),
        ));
    }
    if adjustment_amount > outstanding {
        return Err(AppError::BadRequest(format!(
            "Adjustment exceeds outstanding invoice balance of {outstanding}"
        )));
    }

    // Deduct balance
    let new_balance = (advance.balance - adjustment_amount).round_dp(2);
    let new_status = if new_balance == Decimal::ZERO {
        "fully_used"
    } else {
        "partially_used"
    };

    sqlx::query(
        "UPDATE patient_advances SET balance = $1, status = $2::advance_status, \
         updated_at = now() WHERE id = $3 AND tenant_id = $4",
    )
    .bind(new_balance)
    .bind(new_status)
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    // Create adjustment record
    let adj = sqlx::query_as::<_, AdvanceAdjustment>(
        "INSERT INTO advance_adjustments \
         (tenant_id, advance_id, invoice_id, amount_adjusted, adjusted_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.invoice_id)
    .bind(adjustment_amount)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Apply as payment to the invoice
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(adjustment_amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::AdvanceAdjusted,
        "advance_adjustment",
        adj.id,
        Some(body.invoice_id),
        Some(advance.patient_id),
        Some(adjustment_amount),
        Some(serde_json::json!({
            "advance_id": id,
            "advance_number": advance.advance_number,
            "balance_after": new_balance,
            "advance_status_after": new_status,
            "invoice_outstanding_before": outstanding,
        })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(adj))
}

pub async fn refund_advance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RefundAdvanceRequest>,
) -> Result<Json<PatientAdvance>, AppError> {
    require_permission(&claims, permissions::billing::advances::REFUND)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let refund_amount = body.amount.round_dp(2);
    if refund_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Refund amount must be greater than zero".to_owned(),
        ));
    }
    if body.reason.trim().is_empty() {
        return Err(AppError::BadRequest("Refund reason is required".to_owned()));
    }

    let advance = sqlx::query_as::<_, PatientAdvance>(
        "SELECT * FROM patient_advances WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if !matches!(
        advance.status,
        AdvanceStatus::Active | AdvanceStatus::PartiallyUsed
    ) || advance.balance <= Decimal::ZERO
    {
        return Err(AppError::BadRequest(
            "Advance has no refundable balance".to_owned(),
        ));
    }

    if advance.balance < refund_amount {
        return Err(AppError::BadRequest(
            "Refund amount exceeds advance balance".to_owned(),
        ));
    }

    let new_balance = (advance.balance - refund_amount).round_dp(2);
    let new_status = if new_balance == Decimal::ZERO {
        "refunded"
    } else if matches!(advance.status, AdvanceStatus::Active) {
        "active"
    } else {
        "partially_used"
    };

    let updated = sqlx::query_as::<_, PatientAdvance>(
        "UPDATE patient_advances SET balance = $1, \
         status = $2::advance_status, updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 RETURNING *",
    )
    .bind(new_balance)
    .bind(new_status)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::AdvanceRefunded,
        "patient_advance",
        id,
        None,
        Some(advance.patient_id),
        Some(refund_amount),
        Some(serde_json::json!({
            "advance_number": advance.advance_number,
            "reason": body.reason.trim(),
            "mode": body.mode.as_deref().unwrap_or("cash"),
            "reference_number": body.reference_number,
            "balance_after": new_balance,
            "advance_status_after": new_status,
        })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(filter_advance_amounts(updated, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  Interim Billing
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateInterimInvoiceRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub notes: Option<String>,
}

pub async fn create_interim_invoice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateInterimInvoiceRequest>,
) -> Result<Json<Invoice>, AppError> {
    require_permission(&claims, permissions::billing::invoices::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(Debug, sqlx::FromRow)]
    struct InterimEncounterContext {
        patient_id: Uuid,
        created_at: chrono::DateTime<chrono::Utc>,
    }

    let encounter = sqlx::query_as::<_, InterimEncounterContext>(
        "SELECT patient_id, created_at FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Encounter not found".to_owned()))?;

    if encounter.patient_id != body.patient_id {
        return Err(AppError::BadRequest(
            "Encounter patient does not match selected patient".to_owned(),
        ));
    }

    // Find the last interim invoice for this encounter
    #[derive(Debug, sqlx::FromRow)]
    struct LastInterim {
        sequence_number: Option<i32>,
        billing_period_end: Option<chrono::DateTime<chrono::Utc>>,
    }

    let last = sqlx::query_as::<_, LastInterim>(
        "SELECT sequence_number, billing_period_end FROM invoices \
         WHERE tenant_id = $1 AND encounter_id = $2 AND is_interim = true \
         ORDER BY sequence_number DESC NULLS LAST LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .fetch_optional(&mut *tx)
    .await?;

    let seq_num = last.as_ref().and_then(|l| l.sequence_number).unwrap_or(0) + 1;
    // Falls back to encounter creation time as the first period start.
    let period_start = last
        .and_then(|l| l.billing_period_end)
        .unwrap_or(encounter.created_at);
    let period_end = chrono::Utc::now();

    let inv_number = generate_invoice_number(&mut tx, &claims.tenant_id).await?;
    let admission_id =
        admission_id_for_encounter_in_tx(&mut tx, &claims.tenant_id, Some(body.encounter_id))
            .await?;

    // Copy unbilled items from current draft (if any), or create empty interim
    let invoice = sqlx::query_as::<_, Invoice>(
        "INSERT INTO invoices \
         (tenant_id, invoice_number, patient_id, encounter_id, admission_id, status, \
          subtotal, tax_amount, discount_amount, total_amount, paid_amount, \
          cgst_amount, sgst_amount, igst_amount, cess_amount, \
          is_interim, billing_period_start, billing_period_end, \
          sequence_number, notes) \
         VALUES ($1, $2, $3, $4, $5, 'issued'::invoice_status, \
          0, 0, 0, 0, 0, 0, 0, 0, 0, \
          true, $6, $7, $8, $9) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&inv_number)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(admission_id)
    .bind(period_start)
    .bind(period_end)
    .bind(seq_num)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // Move items from current draft to interim
    let draft_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM invoices \
         WHERE tenant_id = $1 AND encounter_id = $2 \
           AND status = 'draft'::invoice_status AND is_interim = false \
         LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(draft) = draft_id {
        sqlx::query(
            "UPDATE invoice_items SET invoice_id = $1 \
             WHERE invoice_id = $2 AND tenant_id = $3",
        )
        .bind(invoice.id)
        .bind(draft)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        recalculate_invoice_totals(&mut tx, invoice.id, claims.tenant_id).await?;

        // Delete the now-empty draft
        sqlx::query("DELETE FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(draft)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;
    }

    // Re-fetch the invoice with updated totals
    let updated =
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2")
            .bind(invoice.id)
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;
    Ok(Json(updated))
}
