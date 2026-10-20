//! The accrual ledger screen, and the line shape every other screen reuses.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions::doctor_payouts::ledger;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{PATIENT_MASK_SQL, begin};

/// One ledger row as a person reads it: the patient masked.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LedgerLine {
    pub id: Uuid,
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub event: String,
    pub basis: Option<String>,
    pub role: String,
    pub service_date: NaiveDate,
    pub description: Option<String>,
    pub invoice_number: Option<String>,
    pub patient: Option<String>,
    pub payer_class: Option<String>,
    pub line_amount: Decimal,
    pub base_amount: Decimal,
    pub share_amount: Decimal,
    pub fraction: Decimal,
    pub amount: Decimal,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `SELECT ... FROM doctor_payout_accruals a ...`; callers add the WHERE.
pub fn ledger_select() -> String {
    format!(
        "SELECT a.id, a.doctor_id, u.full_name AS doctor_name, a.event, a.basis, a.role, \
                a.service_date, ii.description, i.invoice_number, \
                CASE WHEN p.id IS NULL THEN NULL ELSE {PATIENT_MASK_SQL} END AS patient, \
                a.payer_class, a.line_amount, a.base_amount, a.share_amount, a.fraction, a.amount, \
                a.reason, a.created_at \
           FROM doctor_payout_accruals a \
           LEFT JOIN users u ON u.id = a.doctor_id \
           LEFT JOIN invoice_items ii ON ii.id = a.invoice_item_id \
           LEFT JOIN invoices i ON i.id = a.invoice_id \
           LEFT JOIN patients p ON p.id = i.patient_id"
    )
}

#[derive(Debug, Deserialize)]
pub struct LedgerQuery {
    pub doctor_id: Option<Uuid>,
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub event: Option<String>,
}

/// GET /api/doctor-payouts/ledger
pub async fn list_ledger(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<LedgerQuery>,
) -> Result<Json<Vec<LedgerLine>>, AppError> {
    require_permission(&claims, ledger::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{} WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.service_date BETWEEN $2 AND $3 \
           AND ($4::uuid IS NULL OR a.doctor_id = $4) AND ($5::text IS NULL OR a.event = $5) \
         ORDER BY a.service_date DESC, a.created_at DESC LIMIT 1000",
        ledger_select()
    );
    let rows = sqlx::query_as::<_, LedgerLine>(&sql)
        .bind(claims.tenant_id)
        .bind(q.from)
        .bind(q.to)
        .bind(q.doctor_id)
        .bind(q.event.as_deref().filter(|e| !e.is_empty()))
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
