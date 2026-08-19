//! Money going the other way: discounts written off an invoice, refunds paid
//! back, and credit notes issued against a bill already raised.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. Every handler
//! here reduces what the patient owes or returns what they already paid, which
//! is why they share an approval and audit posture the invoice path does not
//! need: each one is somebody deciding to take less money than the bill says.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::billing::{CreditNote, InvoiceDiscount, InvoiceStatus, Refund};
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
use medbrains_server_services::billing::SeqResult;

// Shared crate surface, imported back rather than duplicated: the invoice-view
// gate, the field-access filters that decide who may see an amount, and the
// permission set that governs who may look at refunds.
use crate::{
    BILLING_REFUND_LIST_PERMISSIONS, ensure_invoice_view_access, filter_credit_note_amounts,
    filter_discount_amounts, filter_refund_amounts, resolve_billing_restricted_fields,
    validate_billing_amount_write_access,
};

// ══════════════════════════════════════════════════════════
//  Invoice Discounts
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AddDiscountRequest {
    pub discount_type: String,
    pub discount_value: Decimal,
    pub reason: Option<String>,
}

pub async fn list_discounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
) -> Result<Json<Vec<InvoiceDiscount>>, AppError> {
    require_permission(&claims, permissions::billing::invoices::VIEW)?;
    ensure_invoice_view_access(&state, &claims, invoice_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InvoiceDiscount>(
        "SELECT * FROM invoice_discounts \
         WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY created_at LIMIT 5000",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_discount_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(rows))
}

pub async fn add_discount(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(body): Json<AddDiscountRequest>,
) -> Result<Json<InvoiceDiscount>, AppError> {
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    // The path names the invoice and the invoice names the patient.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let discount = sqlx::query_as::<_, InvoiceDiscount>(
        "INSERT INTO invoice_discounts \
         (tenant_id, invoice_id, discount_type, discount_value, reason, approved_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(&body.discount_type)
    .bind(body.discount_value)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Recalculate discount_amount on the invoice
    sqlx::query(
        "UPDATE invoices SET \
         discount_amount = COALESCE((SELECT SUM(discount_value) \
           FROM invoice_discounts WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(discount))
}

pub async fn remove_discount(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((invoice_id, discount_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::invoices::UPDATE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::INVOICE,
        invoice_id,
    )
    .await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM invoice_discounts \
         WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3",
    )
    .bind(discount_id)
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.commit().await?;
        return Err(AppError::NotFound);
    }

    sqlx::query(
        "UPDATE invoices SET \
         discount_amount = COALESCE((SELECT SUM(discount_value) \
           FROM invoice_discounts WHERE invoice_id = $1 AND tenant_id = $2), 0), \
         updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Refunds
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRefundRequest {
    pub invoice_id: Uuid,
    pub payment_id: Option<Uuid>,
    pub amount: Decimal,
    pub reason: String,
    pub mode: String,
    pub reference_number: Option<String>,
}

async fn generate_refund_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'REFUND' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        // Fallback: use count-based number
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM refunds WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
        Ok(format!("RFD{:0>6}", count + 1))
    }
}

pub async fn list_refunds(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<Refund>>, AppError> {
    require_any_permission(&claims, BILLING_REFUND_LIST_PERMISSIONS)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM refunds WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let rows = sqlx::query_as::<_, Refund>(
        "SELECT * FROM refunds WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_refund_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRefundRequest>,
) -> Result<Json<Refund>, AppError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;
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

    #[derive(sqlx::FromRow)]
    struct RefundInvoiceGate {
        status: InvoiceStatus,
        paid_amount: Decimal,
    }

    let invoice = sqlx::query_as::<_, RefundInvoiceGate>(
        "SELECT status, paid_amount FROM invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if matches!(
        invoice.status,
        InvoiceStatus::Draft | InvoiceStatus::Cancelled | InvoiceStatus::Refunded
    ) {
        return Err(AppError::BadRequest(
            "Refunds can be processed only against paid or partially paid invoices".to_owned(),
        ));
    }
    if refund_amount > invoice.paid_amount {
        return Err(AppError::BadRequest(format!(
            "Refund exceeds refundable paid amount of {}",
            invoice.paid_amount
        )));
    }

    if let Some(payment_id) = body.payment_id {
        let payment_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM payments WHERE id = $1 AND invoice_id = $2 AND tenant_id = $3)",
        )
        .bind(payment_id)
        .bind(body.invoice_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !payment_exists {
            return Err(AppError::BadRequest(
                "Refund payment reference does not belong to this invoice".to_owned(),
            ));
        }
    }

    let refund_number = generate_refund_number(&mut tx, &claims.tenant_id).await?;

    let refund = sqlx::query_as::<_, Refund>(
        "INSERT INTO refunds \
         (tenant_id, invoice_id, payment_id, refund_number, amount, reason, \
          mode, reference_number, refunded_by, refunded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7::payment_mode, $8, $9, now()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.payment_id)
    .bind(&refund_number)
    .bind(refund_amount)
    .bind(&body.reason)
    .bind(&body.mode)
    .bind(&body.reference_number)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Update invoice paid_amount and status
    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount - $1, \
         status = CASE \
           WHEN paid_amount - $1 <= 0 THEN 'refunded'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(refund_amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_refund_amounts(refund, &restricted_fields)))
}

// ══════════════════════════════════════════════════════════
//  Credit Notes
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateCreditNoteRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ApplyCreditNoteRequest {
    pub invoice_id: Uuid,
}

async fn generate_credit_note_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'CREDIT_NOTE' \
         RETURNING current_val, prefix, pad_width",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(s) = seq {
        let pad = usize::try_from(s.pad_width).unwrap_or(6);
        Ok(format!("{}{:0>pad$}", s.prefix, s.current_val))
    } else {
        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM credit_notes WHERE tenant_id = $1")
                .bind(tenant_id)
                .fetch_one(&mut **tx)
                .await?;
        Ok(format!("CN{:0>6}", count + 1))
    }
}

pub async fn list_credit_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<CreditNote>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
            permissions::billing::credit::APPLY,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM credit_notes WHERE tenant_id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

    let rows = sqlx::query_as::<_, CreditNote>(
        "SELECT * FROM credit_notes WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let rows = rows
        .into_iter()
        .map(|row| filter_credit_note_amounts(row, &restricted_fields))
        .collect();
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let credit_amount = body.amount.round_dp(2);
    if credit_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Credit note amount must be greater than zero".to_owned(),
        ));
    }
    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "Credit note reason must contain at least 3 characters".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let source_invoice = sqlx::query_as::<_, (InvoiceStatus, Decimal)>(
        "SELECT status, paid_amount \
         FROM invoices \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Source invoice not found".to_owned()))?;

    if !matches!(
        source_invoice.0,
        InvoiceStatus::Paid | InvoiceStatus::PartiallyPaid
    ) || source_invoice.1 <= Decimal::ZERO
    {
        return Err(AppError::BadRequest(
            "Credit note can only be created from a paid or partially paid invoice".to_owned(),
        ));
    }
    if credit_amount > source_invoice.1 {
        return Err(AppError::BadRequest(format!(
            "Credit note amount exceeds refundable paid amount: {}",
            source_invoice.1
        )));
    }

    let cn_number = generate_credit_note_number(&mut tx, &claims.tenant_id).await?;

    let note = sqlx::query_as::<_, CreditNote>(
        "INSERT INTO credit_notes \
         (tenant_id, credit_note_number, invoice_id, amount, reason, status, created_by) \
         VALUES ($1, $2, $3, $4, $5, 'active', $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&cn_number)
    .bind(body.invoice_id)
    .bind(credit_amount)
    .bind(reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(note, &restricted_fields)))
}

pub async fn apply_credit_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApplyCreditNoteRequest>,
) -> Result<Json<CreditNote>, AppError> {
    require_permission(&claims, permissions::billing::credit::APPLY)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::CREDIT_NOTE,
        id,
    )
    .await?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let note = sqlx::query_as::<_, CreditNote>(
        "SELECT * FROM credit_notes \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let note_patient_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT patient_id FROM invoices WHERE id = $1 AND tenant_id = $2",
    )
    .bind(note.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Credit note source invoice not found".to_owned()))?;

    let target_invoice = sqlx::query_as::<_, (Uuid, InvoiceStatus, Decimal, Decimal)>(
        "SELECT patient_id, status, total_amount, paid_amount \
         FROM invoices \
         WHERE id = $1 AND tenant_id = $2 \
         FOR UPDATE",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Target invoice not found".to_owned()))?;

    if target_invoice.0 != note_patient_id {
        return Err(AppError::BadRequest(
            "Credit note can only be applied to the same patient".to_owned(),
        ));
    }

    if !matches!(
        target_invoice.1,
        InvoiceStatus::Issued | InvoiceStatus::PartiallyPaid
    ) {
        return Err(AppError::BadRequest(
            "Credit note can only be applied to an issued invoice with outstanding balance"
                .to_owned(),
        ));
    }

    let outstanding = (target_invoice.2 - target_invoice.3).round_dp(2);
    if outstanding <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Target invoice has no outstanding balance".to_owned(),
        ));
    }
    if note.amount > outstanding {
        return Err(AppError::BadRequest(format!(
            "Credit note amount exceeds invoice outstanding balance: {outstanding}"
        )));
    }

    let note = sqlx::query_as::<_, CreditNote>(
        "UPDATE credit_notes SET \
         status = 'used', \
         used_against_invoice_id = $1, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 AND status = 'active' \
         RETURNING *",
    )
    .bind(body.invoice_id)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

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
    .bind(note.amount)
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_note_amounts(note, &restricted_fields)))
}
