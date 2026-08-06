//! Concessions: a bill reduced on compassionate or policy grounds, and the
//! auto-rules that grant some of them without anyone asking.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. A concession is
//! the one billing write that is a *judgement* rather than a calculation, which
//! is why it alone carries an approve/reject cycle. That workflow is what
//! separates it from the discounts and credit notes it superficially resembles.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::billing::{BillingConcession, ConcessionStatus, InvoiceStatus};
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
use medbrains_server_services::billing::recalculate_invoice_totals;

// ══════════════════════════════════════════════════════════
//  Concession request / response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListConcessionsQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ConcessionListResponse {
    pub concessions: Vec<BillingConcession>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateConcessionRequest {
    pub invoice_id: Option<Uuid>,
    pub invoice_item_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub concession_type: String,
    pub original_amount: Decimal,
    pub concession_percent: Option<Decimal>,
    pub concession_amount: Decimal,
    pub final_amount: Decimal,
    pub reason: Option<String>,
    pub source_module: Option<String>,
    pub source_entity_id: Option<Uuid>,
}

#[derive(Debug, sqlx::FromRow)]
struct ConcessionInvoiceContext {
    patient_id: Uuid,
    status: InvoiceStatus,
}

#[derive(Debug, sqlx::FromRow)]
struct ConcessionInvoiceItemContext {
    invoice_id: Uuid,
    total_price: Decimal,
}

#[derive(Debug, Serialize)]
pub struct AutoConcessionRulesResponse {
    pub rules: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAutoRulesRequest {
    pub rules: serde_json::Value,
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/concessions
// ══════════════════════════════════════════════════════════

pub async fn list_concessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListConcessionsQuery>,
) -> Result<Json<ConcessionListResponse>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::concessions::LIST,
            permissions::billing::concessions::APPROVE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut where_clauses = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx = 2u32;

    if params.status.is_some() {
        where_clauses.push(format!("status = ${bind_idx}::concession_status"));
        bind_idx += 1;
    }
    if params.patient_id.is_some() {
        where_clauses.push(format!("patient_id = ${bind_idx}"));
        bind_idx += 1;
    }

    let where_str = where_clauses.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM billing_concessions WHERE {where_str}");
    let list_sql = format!(
        "SELECT * FROM billing_concessions WHERE {where_str} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );

    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    let mut list_q = sqlx::query_as::<_, BillingConcession>(&list_sql).bind(claims.tenant_id);

    if let Some(ref status) = params.status {
        count_q = count_q.bind(status);
        list_q = list_q.bind(status);
    }
    if let Some(pid) = params.patient_id {
        count_q = count_q.bind(pid);
        list_q = list_q.bind(pid);
    }

    list_q = list_q.bind(per_page).bind(offset);

    let total = count_q.fetch_one(&mut *tx).await?;
    let concessions = list_q.fetch_all(&mut *tx).await?;

    tx.commit().await?;
    Ok(Json(ConcessionListResponse {
        concessions,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/billing/concessions
// ══════════════════════════════════════════════════════════

pub async fn create_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateConcessionRequest>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let concession_type = body.concession_type.trim().to_owned();
    if concession_type.is_empty() {
        return Err(AppError::BadRequest(
            "concession type is required".to_owned(),
        ));
    }

    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| value.chars().count() >= 3)
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            AppError::BadRequest("concession reason must contain at least 3 characters".to_owned())
        })?;

    if body.original_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "original amount must be greater than zero".to_owned(),
        ));
    }
    if body.concession_amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "concession amount must be greater than zero".to_owned(),
        ));
    }
    if body.final_amount < Decimal::ZERO {
        return Err(AppError::BadRequest(
            "final amount cannot be negative".to_owned(),
        ));
    }
    if body.concession_amount > body.original_amount {
        return Err(AppError::BadRequest(
            "concession amount cannot exceed original amount".to_owned(),
        ));
    }
    if body.original_amount - body.concession_amount != body.final_amount {
        return Err(AppError::BadRequest(
            "final amount must equal original amount minus concession amount".to_owned(),
        ));
    }
    if body
        .concession_percent
        .is_some_and(|percent| percent < Decimal::ZERO || percent > Decimal::from(100))
    {
        return Err(AppError::BadRequest(
            "concession percent must be between 0 and 100".to_owned(),
        ));
    }

    let item_context = if let Some(item_id) = body.invoice_item_id {
        Some(
            sqlx::query_as::<_, ConcessionInvoiceItemContext>(
                "SELECT invoice_id, total_price \
                 FROM invoice_items \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(item_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::BadRequest("invoice item not found".to_owned()))?,
        )
    } else {
        None
    };

    if body.invoice_id.is_some() && item_context.is_none() {
        return Err(AppError::BadRequest(
            "invoice-linked concessions must specify an invoice item".to_owned(),
        ));
    }

    let effective_invoice_id = match (&item_context, body.invoice_id) {
        (Some(item), Some(invoice_id)) if item.invoice_id != invoice_id => {
            return Err(AppError::BadRequest(
                "invoice item does not belong to the supplied invoice".to_owned(),
            ));
        }
        (Some(item), _) => Some(item.invoice_id),
        (None, invoice_id) => invoice_id,
    };

    if let Some(item) = &item_context {
        if item.total_price != body.original_amount {
            return Err(AppError::BadRequest(
                "original amount must match the linked invoice item total".to_owned(),
            ));
        }
    }

    if let Some(invoice_id) = effective_invoice_id {
        let invoice_context = sqlx::query_as::<_, ConcessionInvoiceContext>(
            "SELECT patient_id, status \
             FROM invoices \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(invoice_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("invoice not found".to_owned()))?;

        if invoice_context.patient_id != body.patient_id {
            return Err(AppError::BadRequest(
                "concession patient does not match invoice patient".to_owned(),
            ));
        }
        if matches!(
            invoice_context.status,
            InvoiceStatus::Paid | InvoiceStatus::Cancelled | InvoiceStatus::Refunded
        ) {
            return Err(AppError::BadRequest(
                "paid, cancelled, or refunded invoices require refund/credit-note workflow"
                    .to_owned(),
            ));
        }
    } else {
        let patient_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS( \
                SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2 \
             )",
        )
        .bind(body.patient_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !patient_exists {
            return Err(AppError::BadRequest("patient not found".to_owned()));
        }
    }

    let source_module = body
        .source_module
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let row = sqlx::query_as::<_, BillingConcession>(
        "INSERT INTO billing_concessions \
         (tenant_id, invoice_id, invoice_item_id, patient_id, concession_type, \
          original_amount, concession_percent, concession_amount, final_amount, \
          reason, status, requested_by, source_module, source_entity_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, \
                 'pending'::concession_status, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(effective_invoice_id)
    .bind(body.invoice_item_id)
    .bind(body.patient_id)
    .bind(&concession_type)
    .bind(body.original_amount)
    .bind(body.concession_percent)
    .bind(body.concession_amount)
    .bind(body.final_amount)
    .bind(&reason)
    .bind(claims.sub)
    .bind(&source_module)
    .bind(body.source_entity_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/{id}/approve
// ══════════════════════════════════════════════════════════

pub async fn approve_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current = sqlx::query_as::<_, BillingConcession>(
        "SELECT * FROM billing_concessions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if current.status != ConcessionStatus::Pending {
        return Err(AppError::Conflict(
            "only pending concessions can be approved".to_owned(),
        ));
    }
    if current.requested_by == claims.sub {
        return Err(AppError::BadRequest(
            "concession requester cannot approve the same concession".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, BillingConcession>(
        "UPDATE billing_concessions SET \
         status = 'approved'::concession_status, \
         approved_by = $2, approved_at = now() \
         WHERE id = $1 AND tenant_id = $3 AND status = 'pending'::concession_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Apply to invoice if linked
    if let (Some(inv_id), Some(item_id)) = (row.invoice_id, row.invoice_item_id) {
        sqlx::query(
            "UPDATE invoice_items SET total_price = $2 \
             WHERE id = $1 AND tenant_id = $3",
        )
        .bind(item_id)
        .bind(row.final_amount)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        recalculate_invoice_totals(&mut tx, inv_id, claims.tenant_id).await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/{id}/reject
// ══════════════════════════════════════════════════════════

pub async fn reject_concession(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<BillingConcession>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let current = sqlx::query_as::<_, BillingConcession>(
        "SELECT * FROM billing_concessions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if current.status != ConcessionStatus::Pending {
        return Err(AppError::Conflict(
            "only pending concessions can be rejected".to_owned(),
        ));
    }
    if current.requested_by == claims.sub {
        return Err(AppError::BadRequest(
            "concession requester cannot reject the same concession".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, BillingConcession>(
        "UPDATE billing_concessions SET \
         status = 'rejected'::concession_status, \
         approved_by = $2, approved_at = now() \
         WHERE id = $1 AND tenant_id = $3 AND status = 'pending'::concession_status \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  GET /api/billing/concessions/auto-rules
// ══════════════════════════════════════════════════════════

pub async fn get_auto_concession_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<AutoConcessionRulesResponse>, AppError> {
    require_permission(&claims, permissions::billing::concessions::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let val = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'billing' AND key = 'auto_concession_rules'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoConcessionRulesResponse {
        rules: val.unwrap_or(serde_json::Value::Array(vec![])),
    }))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/billing/concessions/auto-rules
// ══════════════════════════════════════════════════════════

pub async fn update_auto_concession_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateAutoRulesRequest>,
) -> Result<Json<AutoConcessionRulesResponse>, AppError> {
    require_permission(&claims, permissions::billing::concessions::APPROVE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'billing', 'auto_concession_rules', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = EXCLUDED.value",
    )
    .bind(claims.tenant_id)
    .bind(&body.rules)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(AutoConcessionRulesResponse { rules: body.rules }))
}
