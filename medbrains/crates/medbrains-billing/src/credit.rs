//! Patients and organisations allowed to owe: corporate clients billed on
//! account, credit patients allowed to leave without paying, and the write-off
//! for debt the hospital has stopped expecting.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. These belong
//! together because they are one arc: someone is permitted not to pay at the
//! counter, a balance accrues against an employer or a credit limit, and
//! eventually it is either collected or written off. Every handler here deals
//! with money the hospital has already earned and not yet received.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::billing::{
    AuditAction, BadDebtWriteOff, CorporateClient, CorporateEnrollment, CreditPatient,
    CreditPatientStatus, Invoice,
};
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
use medbrains_server_services::billing::SeqResult;

// Shared crate surface, imported back rather than duplicated: the audit trail,
// the field-access filters that decide who may see a balance, and the identity
// gate that decides whether a patient's name may appear on an aging report.
use crate::{
    can_view_patient_identity, filter_credit_aging_row, filter_credit_patient_amounts,
    log_billing_audit, resolve_billing_restricted_fields, validate_billing_amount_write_access,
};

// ══════════════════════════════════════════════════════════
//  Corporate Clients
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateCorporateRequest {
    pub code: String,
    pub name: String,
    pub gst_number: Option<String>,
    pub billing_address: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub agreed_discount_percent: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCorporateRequest {
    pub name: Option<String>,
    pub gst_number: Option<String>,
    pub billing_address: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub credit_limit: Option<Decimal>,
    pub credit_days: Option<i32>,
    pub agreed_discount_percent: Option<Decimal>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnrollmentRequest {
    pub patient_id: Uuid,
    pub employee_id: Option<String>,
    pub department: Option<String>,
}

pub async fn list_corporates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CorporateClient>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CorporateClient>(
        "SELECT * FROM corporate_clients WHERE tenant_id = $1 ORDER BY name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let corp = sqlx::query_as::<_, CorporateClient>(
        "SELECT * FROM corporate_clients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(corp))
}

pub async fn create_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCorporateRequest>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let corp = sqlx::query_as::<_, CorporateClient>(
        "INSERT INTO corporate_clients \
         (tenant_id, code, name, gst_number, billing_address, contact_email, \
          contact_phone, credit_limit, credit_days, agreed_discount_percent) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.gst_number)
    .bind(&body.billing_address)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .bind(body.credit_limit.unwrap_or(Decimal::ZERO))
    .bind(body.credit_days.unwrap_or(30))
    .bind(body.agreed_discount_percent.unwrap_or(Decimal::ZERO))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(corp))
}

pub async fn update_corporate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCorporateRequest>,
) -> Result<Json<CorporateClient>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CorporateClient>(
        "UPDATE corporate_clients SET \
         name = COALESCE($1, name), \
         gst_number = COALESCE($2, gst_number), \
         billing_address = COALESCE($3, billing_address), \
         contact_email = COALESCE($4, contact_email), \
         contact_phone = COALESCE($5, contact_phone), \
         credit_limit = COALESCE($6, credit_limit), \
         credit_days = COALESCE($7, credit_days), \
         agreed_discount_percent = COALESCE($8, agreed_discount_percent), \
         is_active = COALESCE($9, is_active), \
         updated_at = now() \
         WHERE id = $10 AND tenant_id = $11 RETURNING *",
    )
    .bind(&body.name)
    .bind(&body.gst_number)
    .bind(&body.billing_address)
    .bind(&body.contact_email)
    .bind(&body.contact_phone)
    .bind(body.credit_limit)
    .bind(body.credit_days)
    .bind(body.agreed_discount_percent)
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_enrollments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
) -> Result<Json<Vec<CorporateEnrollment>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CorporateEnrollment>(
        "SELECT * FROM corporate_enrollments \
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY enrolled_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
    Json(body): Json<CreateEnrollmentRequest>,
) -> Result<Json<CorporateEnrollment>, AppError> {
    require_permission(&claims, permissions::billing::corporate::ENROLL)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enr = sqlx::query_as::<_, CorporateEnrollment>(
        "INSERT INTO corporate_enrollments \
         (tenant_id, corporate_id, patient_id, employee_id, department) \
         VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .bind(body.patient_id)
    .bind(&body.employee_id)
    .bind(&body.department)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(enr))
}

pub async fn delete_enrollment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((corporate_id, enrollment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::corporate::UNENROLL)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query(
        "DELETE FROM corporate_enrollments \
         WHERE id = $1 AND corporate_id = $2 AND tenant_id = $3",
    )
    .bind(enrollment_id)
    .bind(corporate_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn list_corporate_invoices(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(corporate_id): Path<Uuid>,
) -> Result<Json<Vec<Invoice>>, AppError> {
    require_permission(&claims, permissions::billing::corporate::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Invoice>(
        "SELECT * FROM invoices \
         WHERE tenant_id = $1 AND corporate_id = $2 ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(corporate_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Bad Debt Write-Offs
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateWriteOffRequest {
    pub invoice_id: Uuid,
    pub amount: Decimal,
    pub reason: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApproveWriteOffRequest {
    pub approved: bool,
    pub notes: Option<String>,
}

async fn generate_write_off_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as::<_, SeqResult>(
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'WRITE_OFF' \
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
            "SELECT COUNT(*) FROM bad_debt_write_offs WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
        Ok(format!("WO{:0>6}", count + 1))
    }
}

pub async fn list_write_offs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(p): Query<medbrains_server_core::pagination::Pagination>,
) -> Result<Json<medbrains_server_core::pagination::Paginated<BadDebtWriteOff>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::write_off::CREATE,
            permissions::billing::write_off::APPROVE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM bad_debt_write_offs WHERE tenant_id = $1")
            .bind(claims.tenant_id)
            .fetch_one(&mut *tx)
            .await?;

    let rows = sqlx::query_as::<_, BadDebtWriteOff>(
        "SELECT * FROM bad_debt_write_offs WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(claims.tenant_id)
    .bind(p.limit())
    .bind(p.offset())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(medbrains_server_core::pagination::Paginated::new(
        rows, total, &p,
    )))
}

pub async fn create_write_off(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWriteOffRequest>,
) -> Result<Json<BadDebtWriteOff>, AppError> {
    require_permission(&claims, permissions::billing::write_off::CREATE)?;

    let reason = body.reason.trim();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "write-off reason must contain at least 3 characters".to_owned(),
        ));
    }
    if body.amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "write-off amount must be greater than zero".to_owned(),
        ));
    }
    let notes = body
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let Some((invoice_status, total_amount, paid_amount)) =
        sqlx::query_as::<_, (String, Decimal, Decimal)>(
            "SELECT status::text, total_amount, paid_amount \
             FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(body.invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
    else {
        return Err(AppError::NotFound);
    };

    if matches!(
        invoice_status.as_str(),
        "draft" | "paid" | "cancelled" | "refunded"
    ) {
        return Err(AppError::Conflict(
            "Only issued or partially paid invoices can be written off".to_owned(),
        ));
    }

    let outstanding = total_amount - paid_amount;
    if outstanding <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "Invoice has no outstanding balance to write off".to_owned(),
        ));
    }

    let reserved_write_offs = sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(amount), 0)::numeric \
         FROM bad_debt_write_offs \
         WHERE invoice_id = $1 AND tenant_id = $2 \
           AND status IN ('pending'::write_off_status, 'approved'::write_off_status)",
    )
    .bind(body.invoice_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let available_to_write_off = outstanding - reserved_write_offs;
    if available_to_write_off <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "Invoice outstanding balance is already reserved for write-off".to_owned(),
        ));
    }
    if body.amount > available_to_write_off {
        return Err(AppError::Conflict(format!(
            "write-off amount exceeds available outstanding balance: {available_to_write_off}"
        )));
    }

    let wo_number = generate_write_off_number(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, BadDebtWriteOff>(
        "INSERT INTO bad_debt_write_offs \
         (tenant_id, invoice_id, write_off_number, amount, reason, \
          status, requested_by, notes) \
         VALUES ($1, $2, $3, $4, $5, 'pending'::write_off_status, $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(&wo_number)
    .bind(body.amount)
    .bind(reason)
    .bind(claims.sub)
    .bind(&notes)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::WriteOffCreated,
        "write_off",
        row.id,
        Some(body.invoice_id),
        None,
        Some(body.amount),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_write_off(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApproveWriteOffRequest>,
) -> Result<Json<BadDebtWriteOff>, AppError> {
    require_permission(&claims, permissions::billing::write_off::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing = sqlx::query_as::<_, BadDebtWriteOff>(
        "SELECT * FROM bad_debt_write_offs \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending'::write_off_status \
         FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.requested_by == claims.sub {
        return Err(AppError::Conflict(
            "write-off requester cannot approve or reject the same write-off".to_owned(),
        ));
    }

    let new_status = if body.approved {
        "approved"
    } else {
        "rejected"
    };

    let row = sqlx::query_as::<_, BadDebtWriteOff>(
        "UPDATE bad_debt_write_offs SET \
         status = $1::write_off_status, approved_by = $2, approved_at = now(), \
         notes = COALESCE($3, notes), updated_at = now() \
         WHERE id = $4 AND tenant_id = $5 AND status = 'pending'::write_off_status \
         RETURNING *",
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(&body.notes)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Apply an APPROVED write-off to the invoice — a non-cash settlement of the balance.
    // (Previously approval never touched the invoice, so it still showed fully owing.)
    if body.approved {
        let outstanding: Decimal = sqlx::query_scalar(
            "SELECT (total_amount - paid_amount) FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(existing.invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(Decimal::ZERO)
        .round_dp(2);
        if existing.amount > outstanding {
            return Err(AppError::BadRequest(format!(
                "Write-off {} exceeds the invoice's outstanding balance {outstanding}",
                existing.amount
            )));
        }
        sqlx::query(
            "UPDATE invoices SET \
               paid_amount = paid_amount + $1, \
               written_off_amount = written_off_amount + $1, \
               status = CASE WHEN (total_amount - (paid_amount + $1)) <= 0.01 \
                             THEN 'paid'::invoice_status ELSE status END, \
               updated_at = now() \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(existing.amount)
        .bind(existing.invoice_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::WriteOffApproved,
        "write_off",
        row.id,
        Some(row.invoice_id),
        None,
        Some(row.amount),
        Some(serde_json::json!({ "approved": body.approved })),
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Credit Patients
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreditPatientQuery {
    pub status: Option<String>,
}

pub async fn list_credit_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<CreditPatientQuery>,
) -> Result<Json<Vec<CreditPatient>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditPatient>(
        "SELECT * FROM credit_patients WHERE tenant_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY updated_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| filter_credit_patient_amounts(row, &restricted_fields))
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
pub struct CreateCreditPatientRequest {
    pub patient_id: Uuid,
    pub credit_limit: Decimal,
    pub reason: Option<String>,
    pub notes: Option<String>,
}

pub async fn create_credit_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCreditPatientRequest>,
) -> Result<Json<CreditPatient>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    validate_billing_amount_write_access(&restricted_fields)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CreditPatient>(
        "INSERT INTO credit_patients \
         (tenant_id, patient_id, credit_limit, status, approved_by, reason, notes) \
         VALUES ($1, $2, $3, 'active', $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.credit_limit)
    .bind(claims.sub)
    .bind(body.reason.as_deref())
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_patient_amounts(row, &restricted_fields)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateCreditPatientRequest {
    pub credit_limit: Option<Decimal>,
    pub status: Option<CreditPatientStatus>,
    pub notes: Option<String>,
}

pub async fn update_credit_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCreditPatientRequest>,
) -> Result<Json<CreditPatient>, AppError> {
    require_permission(&claims, permissions::billing::credit::MANAGE)?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    if body.credit_limit.is_some() {
        validate_billing_amount_write_access(&restricted_fields)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CreditPatient>(
        "UPDATE credit_patients SET \
         credit_limit = COALESCE($3, credit_limit), \
         status = COALESCE($4, status), \
         notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.credit_limit)
    .bind(body.status)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(filter_credit_patient_amounts(row, &restricted_fields)))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CreditAgingRow {
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub credit_limit: Decimal,
    pub current_balance: Decimal,
    pub status: CreditPatientStatus,
    pub overdue_since: Option<chrono::DateTime<chrono::Utc>>,
    pub days_overdue: Option<i32>,
}

pub async fn report_credit_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CreditAgingRow>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
        ],
    )?;
    let restricted_fields = resolve_billing_restricted_fields(&state, &claims).await?;
    let can_reveal_patient_identity = can_view_patient_identity(&claims);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CreditAgingRow>(
        "SELECT cp.patient_id, \
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name, \
         cp.credit_limit, cp.current_balance, cp.status, cp.overdue_since, \
         CASE WHEN cp.overdue_since IS NOT NULL \
           THEN EXTRACT(DAY FROM now() - cp.overdue_since)::int \
           ELSE NULL END AS days_overdue \
         FROM credit_patients cp \
         JOIN patients p ON p.id = cp.patient_id AND p.tenant_id = cp.tenant_id \
         WHERE cp.tenant_id = $1 AND cp.current_balance > 0 \
         ORDER BY cp.current_balance DESC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|row| {
                filter_credit_aging_row(row, &restricted_fields, can_reveal_patient_identity)
            })
            .collect(),
    ))
}
