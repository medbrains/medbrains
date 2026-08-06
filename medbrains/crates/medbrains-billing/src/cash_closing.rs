//! Day-end cash closing: counting what the counter actually took against what
//! the system says it should have, and recording the difference.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. This is the one
//! place in billing where the source of truth is a physical drawer rather than
//! a row. Everything else here records what should have happened; this records
//! what did, and forces someone to sign for the gap.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::{AuditAction, DayEndClose};
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

// The audit trail every billing write appends to stays in `lib.rs`.
use crate::log_billing_audit;

// ══════════════════════════════════════════════════════════
//  Day-End Cash Closing
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateDayCloseRequest {
    pub close_date: NaiveDate,
    pub actual_cash: Decimal,
    pub notes: Option<String>,
    /// When set, the tally counts only payments tagged to this counter.
    pub counter_id: Option<String>,
    pub shift: Option<String>,
    /// Note-count by denomination, e.g. {"500": 4, "100": 7}.
    pub denominations: Option<serde_json::Value>,
    /// Card / UPI figures from the POS / bank settlement report.
    #[serde(default)]
    pub actual_card: Decimal,
    #[serde(default)]
    pub actual_upi: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct ListDayClosesQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

pub async fn list_day_closes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListDayClosesQuery>,
) -> Result<Json<Vec<DayEndClose>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::billing::day_close::CREATE,
            permissions::billing::day_close::VERIFY,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = match (params.from, params.to) {
        (Some(from), Some(to)) => {
            sqlx::query_as::<_, DayEndClose>(
                "SELECT * FROM day_end_closes \
                 WHERE tenant_id = $1 AND close_date >= $2 AND close_date <= $3 \
                 ORDER BY close_date DESC LIMIT 5000",
            )
            .bind(claims.tenant_id)
            .bind(from)
            .bind(to)
            .fetch_all(&mut *tx)
            .await?
        }
        _ => {
            sqlx::query_as::<_, DayEndClose>(
                "SELECT * FROM day_end_closes \
                 WHERE tenant_id = $1 ORDER BY close_date DESC LIMIT 30",
            )
            .bind(claims.tenant_id)
            .fetch_all(&mut *tx)
            .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct PaymentModeTotal {
    pub(crate) mode: String,
    pub(crate) total: Decimal,
    pub(crate) cnt: i64,
}

pub async fn create_day_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDayCloseRequest>,
) -> Result<Json<DayEndClose>, AppError> {
    require_permission(&claims, permissions::billing::day_close::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Auto-calculate expected totals from payments on this date,
    // scoped to the counter when one is given (NULL counter filter =
    // tally everything, preserving pre-counter behaviour).
    let counter_filter = body
        .counter_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let mode_totals = sqlx::query_as::<_, PaymentModeTotal>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2 \
           AND ($3::text IS NULL OR counter_id = $3) \
         GROUP BY mode",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .bind(counter_filter.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    let mut expected_cash = Decimal::ZERO;
    let mut total_card = Decimal::ZERO;
    let mut total_upi = Decimal::ZERO;
    let mut total_cheque = Decimal::ZERO;
    let mut total_bank = Decimal::ZERO;
    let mut total_insurance = Decimal::ZERO;
    let mut payments_count: i64 = 0;

    for mt in &mode_totals {
        payments_count += mt.cnt;
        match mt.mode.as_str() {
            "cash" => expected_cash = mt.total,
            "card" => total_card = mt.total,
            "upi" => total_upi = mt.total,
            "cheque" => total_cheque = mt.total,
            "bank_transfer" => total_bank = mt.total,
            "insurance" => total_insurance = mt.total,
            _ => {}
        }
    }

    let total_collected =
        expected_cash + total_card + total_upi + total_cheque + total_bank + total_insurance;
    let cash_difference = body.actual_cash - expected_cash;
    // Settlement reconciliation: a non-zero figure means the desk
    // entered a POS/bank total to match against the system.
    let card_difference = body.actual_card - total_card;
    let upi_difference = body.actual_upi - total_upi;

    let invoices_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2 \
           AND status != 'cancelled'::invoice_status",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?;

    let refunds_total = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT SUM(amount) FROM refunds \
         WHERE tenant_id = $1 AND refunded_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(Decimal::ZERO);

    let advances_total = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT SUM(amount) FROM patient_advances \
         WHERE tenant_id = $1 AND created_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(Decimal::ZERO);

    let inv_count_i32 = i32::try_from(invoices_count).unwrap_or(0);
    let pay_count_i32 = i32::try_from(payments_count).unwrap_or(0);

    let shift_label = body
        .shift
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let row = sqlx::query_as::<_, DayEndClose>(
        "INSERT INTO day_end_closes \
         (tenant_id, close_date, cashier_id, expected_cash, actual_cash, cash_difference, \
          total_card, total_upi, total_cheque, total_bank_transfer, total_insurance, \
          total_collected, invoices_count, payments_count, refunds_total, advances_total, \
          status, notes, counter_id, shift, denominations, actual_card, actual_upi, \
          card_difference, upi_difference) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, \
          'open'::day_close_status, $17, $18, $19, $20, $21, $22, $23, $24) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.close_date)
    .bind(claims.sub)
    .bind(expected_cash)
    .bind(body.actual_cash)
    .bind(cash_difference)
    .bind(total_card)
    .bind(total_upi)
    .bind(total_cheque)
    .bind(total_bank)
    .bind(total_insurance)
    .bind(total_collected)
    .bind(inv_count_i32)
    .bind(pay_count_i32)
    .bind(refunds_total)
    .bind(advances_total)
    .bind(&body.notes)
    .bind(counter_filter.as_deref())
    .bind(shift_label.as_deref())
    .bind(&body.denominations)
    .bind(body.actual_card)
    .bind(body.actual_upi)
    .bind(card_difference)
    .bind(upi_difference)
    .fetch_one(&mut *tx)
    .await?;

    log_billing_audit(
        &mut tx,
        claims.tenant_id,
        AuditAction::DayClosed,
        "day_close",
        row.id,
        None,
        None,
        Some(total_collected),
        None,
        claims.sub,
    )
    .await;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize, Default)]
pub struct VerifyDayCloseRequest {
    pub verification_notes: Option<String>,
}

pub async fn verify_day_close(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<VerifyDayCloseRequest>>,
) -> Result<Json<DayEndClose>, AppError> {
    require_permission(&claims, permissions::billing::day_close::VERIFY)?;
    let body = body.map(|Json(body)| body).unwrap_or_default();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let existing = sqlx::query_as::<_, DayEndClose>(
        "SELECT * FROM day_end_closes WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Any cash, card or UPI variance leaves the close in discrepancy.
    let balanced = existing.cash_difference == Decimal::ZERO
        && existing.card_difference == Decimal::ZERO
        && existing.upi_difference == Decimal::ZERO;
    let new_status = if balanced { "verified" } else { "discrepancy" };

    let row = sqlx::query_as::<_, DayEndClose>(
        "UPDATE day_end_closes SET \
         status = $1::day_close_status, verified_by = $2, verified_at = now(), \
         verification_notes = COALESCE($5, verification_notes), updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(new_status)
    .bind(claims.sub)
    .bind(id)
    .bind(claims.tenant_id)
    .bind(
        body.verification_notes
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
