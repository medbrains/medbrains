//! Billed and collected per day over a date range — the series behind "which
//! were our strong and weak days". Every day in the range is a row, zero when
//! nothing happened, so a chart reads from an honest baseline. Read-only.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Serialize;

use crate::reports::ReportDateRange;

/// Longest range one request may span.
const MAX_DAYS: i64 = 366;

/// One day's billing.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DailyRevenueRow {
    /// `YYYY-MM-DD`.
    pub date: String,
    /// Invoiced that day (cancelled and deleted invoices excluded).
    pub billed: Decimal,
    /// Payments received that day.
    pub collected: Decimal,
    pub invoice_count: i64,
}

/// `GET /api/billing/reports/daily-revenue?from=&to=` — one row per day.
///
/// # Errors
/// 403 without `billing.reports.view`; 400 for a reversed or over-long range.
pub async fn report_daily_revenue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ReportDateRange>,
) -> Result<Json<Vec<DailyRevenueRow>>, AppError> {
    require_permission(&claims, permissions::billing::reports::VIEW)?;
    let span = (params.to - params.from).num_days();
    if !(0..MAX_DAYS).contains(&span) {
        return Err(AppError::BadRequest(format!(
            "from must not be after to, and the range must be under {MAX_DAYS} days"
        )));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, DailyRevenueRow>(
        "WITH days AS ( \
           SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day \
         ), billed AS ( \
           SELECT created_at::date AS day, SUM(total_amount) AS billed, COUNT(*) AS invoices \
           FROM invoices \
           WHERE tenant_id = $1 AND status != 'cancelled'::invoice_status \
             AND deleted_at IS NULL \
             AND created_at >= $2::date AND created_at < ($3::date + interval '1 day') \
           GROUP BY 1 \
         ), paid AS ( \
           SELECT paid_at::date AS day, SUM(amount) AS collected \
           FROM payments \
           WHERE tenant_id = $1 AND deleted_at IS NULL \
             AND paid_at >= $2::date AND paid_at < ($3::date + interval '1 day') \
           GROUP BY 1 \
         ) \
         SELECT days.day::text AS date, \
                COALESCE(b.billed, 0) AS billed, \
                COALESCE(p.collected, 0) AS collected, \
                COALESCE(b.invoices, 0)::bigint AS invoice_count \
         FROM days \
         LEFT JOIN billed b ON b.day = days.day \
         LEFT JOIN paid p ON p.day = days.day \
         ORDER BY days.day",
    )
    .bind(claims.tenant_id)
    .bind(params.from)
    .bind(params.to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}
