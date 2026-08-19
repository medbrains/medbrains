//! Read-only money reporting: revenue by department and period, doctor
//! revenue share, the insurance panel summary, and the reconciliation report.
//!
//! Split out of `lib.rs` as a pure move — no behaviour change. Nothing here
//! writes. These are the aggregate questions finance asks of the transactions
//! the rest of the crate records, and keeping them apart makes it obvious which
//! handlers can change money and which can only count it.
//!
//! No handler here carries a record check and none should. The authorization
//! ledger flags them because its PHI scan counts any handler touching a table
//! the gate has a ParentLink for, and `invoices` is linked — which is right
//! for a handler that returns an invoice and wrong for one that returns
//! `sum(total)` grouped by month. They are the "aggregate" exemption.
//!
//! If a report is ever changed to emit a patient id, name or UHID it stops
//! being an aggregate and needs `patient_filter`, not this note.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::NaiveDate;
use medbrains_core::billing::DayEndClose;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// Shared with the cash-closing path that produces the figures this reports on.
use crate::cash_closing::PaymentModeTotal;

// ══════════════════════════════════════════════════════════
//  Revenue Reports
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ReportDateRange {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct BillingSummaryReport {
    pub total_invoiced: Decimal,
    pub total_collected: Decimal,
    pub total_outstanding: Decimal,
    pub total_refunded: Decimal,
    pub total_discounts: Decimal,
    pub invoice_count: i64,
    pub payment_modes: Vec<PaymentModeSummary>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PaymentModeSummary {
    pub mode: String,
    pub total: Decimal,
    pub count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentRevenueRow {
    pub department: String,
    pub total_revenue: Decimal,
    pub invoice_count: i64,
}

#[derive(Debug, Serialize)]
pub struct CollectionEfficiencyReport {
    pub overall_rate: Decimal,
    pub months: Vec<MonthlyEfficiency>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MonthlyEfficiency {
    pub month: String,
    pub invoiced: Decimal,
    pub collected: Decimal,
    pub rate: Decimal,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AgingBucket {
    pub bucket: String,
    pub count: i64,
    pub total_amount: Decimal,
}

#[derive(Debug, Serialize)]
pub struct DailySummary {
    pub date: NaiveDate,
    pub invoices_created: i64,
    pub invoices_issued: i64,
    pub total_billed: Decimal,
    pub total_collected: Decimal,
    pub payments: Vec<PaymentModeSummary>,
}

#[derive(Debug, Deserialize)]
pub struct DailyReportQuery {
    pub date: NaiveDate,
}

pub async fn report_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<BillingSummaryReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(Debug, sqlx::FromRow)]
    struct Summary {
        total_invoiced: Option<Decimal>,
        total_collected: Option<Decimal>,
        total_outstanding: Option<Decimal>,
        invoice_count: Option<i64>,
    }

    let s = sqlx::query_as::<_, Summary>(
        "SELECT \
           COALESCE(SUM(total_amount), 0) AS total_invoiced, \
           COALESCE(SUM(paid_amount), 0) AS total_collected, \
           COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding, \
           COUNT(*) AS invoice_count \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let total_refunded = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(amount), 0) FROM refunds \
         WHERE tenant_id = $1 AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let total_discounts = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(discount_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day')",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_one(&mut *tx)
    .await?;

    let payment_modes = sqlx::query_as::<_, PaymentModeSummary>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at >= $2::date \
           AND paid_at < ($3::date + interval '1 day') \
         GROUP BY mode ORDER BY total DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(BillingSummaryReport {
        total_invoiced: s.total_invoiced.unwrap_or(Decimal::ZERO),
        total_collected: s.total_collected.unwrap_or(Decimal::ZERO),
        total_outstanding: s.total_outstanding.unwrap_or(Decimal::ZERO),
        total_refunded: total_refunded.unwrap_or(Decimal::ZERO),
        total_discounts: total_discounts.unwrap_or(Decimal::ZERO),
        invoice_count: s.invoice_count.unwrap_or(0),
        payment_modes,
    }))
}

pub async fn report_department_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<Vec<DepartmentRevenueRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DepartmentRevenueRow>(
        "SELECT \
           COALESCE(ii.charge_code, 'Other') AS department, \
           COALESCE(SUM(ii.total_price), 0) AS total_revenue, \
           COUNT(DISTINCT ii.invoice_id) AS invoice_count \
         FROM invoice_items ii \
         JOIN invoices inv ON inv.id = ii.invoice_id AND inv.tenant_id = ii.tenant_id \
         WHERE ii.tenant_id = $1 \
           AND inv.status != 'cancelled'::invoice_status \
           AND inv.created_at >= $2::date \
           AND inv.created_at < ($3::date + interval '1 day') \
         GROUP BY ii.charge_code ORDER BY total_revenue DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn report_collection_efficiency(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<CollectionEfficiencyReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let months = sqlx::query_as::<_, MonthlyEfficiency>(
        "SELECT \
           to_char(created_at, 'YYYY-MM') AS month, \
           COALESCE(SUM(total_amount), 0) AS invoiced, \
           COALESCE(SUM(paid_amount), 0) AS collected, \
           CASE WHEN SUM(total_amount) > 0 \
             THEN ROUND(SUM(paid_amount) * 100 / SUM(total_amount), 2) \
             ELSE 0 END AS rate \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status != 'cancelled'::invoice_status \
           AND created_at >= $2::date \
           AND created_at < ($3::date + interval '1 day') \
         GROUP BY to_char(created_at, 'YYYY-MM') ORDER BY month LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    let overall_invoiced: Decimal = months.iter().map(|m| m.invoiced).sum();
    let overall_collected: Decimal = months.iter().map(|m| m.collected).sum();
    let overall_rate = if overall_invoiced > Decimal::ZERO {
        (overall_collected * Decimal::from(100) / overall_invoiced).round_dp(2)
    } else {
        Decimal::ZERO
    };

    tx.commit().await?;

    Ok(Json(CollectionEfficiencyReport {
        overall_rate,
        months,
    }))
}

pub async fn report_aging(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AgingBucket>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AgingBucket>(
        "SELECT \
           CASE \
             WHEN now() - issued_at <= interval '30 days' THEN '0-30 days' \
             WHEN now() - issued_at <= interval '60 days' THEN '31-60 days' \
             WHEN now() - issued_at <= interval '90 days' THEN '61-90 days' \
             ELSE '90+ days' \
           END AS bucket, \
           COUNT(*) AS count, \
           COALESCE(SUM(total_amount - paid_amount), 0) AS total_amount \
         FROM invoices \
         WHERE tenant_id = $1 \
           AND status IN ('issued'::invoice_status, 'partially_paid'::invoice_status) \
           AND issued_at IS NOT NULL \
         GROUP BY bucket ORDER BY bucket LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn report_daily(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<DailyReportQuery>,
) -> Result<Json<DailySummary>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let invoices_created = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND created_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let invoices_issued = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let total_billed = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(total_amount), 0) FROM invoices \
         WHERE tenant_id = $1 AND issued_at::date = $2 \
           AND status != 'cancelled'::invoice_status",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let total_collected = sqlx::query_scalar::<_, Option<Decimal>>(
        "SELECT COALESCE(SUM(amount), 0) FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_one(&mut *tx)
    .await?;

    let payments = sqlx::query_as::<_, PaymentModeSummary>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count \
         FROM payments \
         WHERE tenant_id = $1 AND paid_at::date = $2 \
         GROUP BY mode ORDER BY total DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(DailySummary {
        date: params.date,
        invoices_created,
        invoices_issued,
        total_billed: total_billed.unwrap_or(Decimal::ZERO),
        total_collected: total_collected.unwrap_or(Decimal::ZERO),
        payments,
    }))
}

// ══════════════════════════════════════════════════════════
//  Doctor Revenue Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorRevenueRow {
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub total_revenue: Decimal,
    pub item_count: i64,
}

pub async fn report_doctor_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<Vec<DoctorRevenueRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorRevenueRow>(
        "SELECT ii.ordering_doctor_id AS doctor_id, \
         u.full_name AS doctor_name, \
         COALESCE(SUM(ii.total_price), 0) AS total_revenue, \
         COUNT(*) AS item_count \
         FROM invoice_items ii \
         JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
         LEFT JOIN users u ON u.id = ii.ordering_doctor_id \
         WHERE ii.tenant_id = $1 \
           AND i.issued_at >= $2::date AND i.issued_at < ($3::date + 1) \
           AND i.status NOT IN ('draft'::invoice_status, 'cancelled'::invoice_status) \
         GROUP BY ii.ordering_doctor_id, u.full_name \
         ORDER BY total_revenue DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Insurance Panel Summary
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InsurancePanelRow {
    pub insurance_provider: String,
    pub total_claims: i64,
    pub total_claimed: Decimal,
    pub total_approved: Decimal,
    pub total_settled: Decimal,
    pub pending_count: i64,
}

pub async fn report_insurance_panel(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<InsurancePanelRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, InsurancePanelRow>(
        "SELECT insurance_provider, \
         COUNT(*) AS total_claims, \
         COALESCE(SUM(pre_auth_amount), 0) AS total_claimed, \
         COALESCE(SUM(approved_amount), 0) AS total_approved, \
         COALESCE(SUM(settled_amount), 0) AS total_settled, \
         COUNT(*) FILTER (WHERE status NOT IN ('settled', 'partially_settled', 'claim_rejected')) AS pending_count \
         FROM insurance_claims WHERE tenant_id = $1 \
         GROUP BY insurance_provider ORDER BY total_claims DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Reconciliation Report
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct ReconciliationReport {
    pub date: NaiveDate,
    pub system_cash: Decimal,
    pub system_card: Decimal,
    pub system_upi: Decimal,
    pub system_total: Decimal,
    pub day_close: Option<DayEndClose>,
    pub variance: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct ReconciliationQuery {
    pub date: NaiveDate,
}

pub async fn report_reconciliation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReconciliationQuery>,
) -> Result<Json<ReconciliationReport>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // System computed totals
    let mode_totals = sqlx::query_as::<_, PaymentModeTotal>(
        "SELECT mode::text AS mode, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt \
         FROM payments WHERE tenant_id = $1 AND paid_at::date = $2 GROUP BY mode",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_all(&mut *tx)
    .await?;

    let mut system_cash = Decimal::ZERO;
    let mut system_card = Decimal::ZERO;
    let mut system_upi = Decimal::ZERO;
    let mut system_total = Decimal::ZERO;

    for mt in &mode_totals {
        system_total += mt.total;
        match mt.mode.as_str() {
            "cash" => system_cash = mt.total,
            "card" => system_card = mt.total,
            "upi" => system_upi = mt.total,
            _ => {}
        }
    }

    let day_close = sqlx::query_as::<_, DayEndClose>(
        "SELECT * FROM day_end_closes \
         WHERE tenant_id = $1 AND close_date = $2 LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(params.date)
    .fetch_optional(&mut *tx)
    .await?;

    let variance = day_close
        .as_ref()
        .map_or(Decimal::ZERO, |dc| dc.actual_cash - system_cash);

    tx.commit().await?;

    Ok(Json(ReconciliationReport {
        date: params.date,
        system_cash,
        system_card,
        system_upi,
        system_total,
        day_close,
        variance,
    }))
}
