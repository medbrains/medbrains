//! Closing a counter's business day: the Z-report, the cash count against
//! what the drawers should hold, and the lock that stops anything else being
//! dated to that day. Reopening is a supervisor's audited correction.

use std::collections::BTreeMap;

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_kernel::authz::is_bypass_role;
use medbrains_kernel::{Actor, AppError, Claims, require_permission};
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::day_close_report::{ZReport, z_report_in_tx};
use crate::day_close_rules::{self, REASON_MIN_CHARS};

/// How far back the list of counter days reaches.
const LIST_DAYS: i32 = 31;
const LIST_LIMIT: i64 = 200;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct DayCloseRow {
    pub id: Uuid,
    pub pharmacy_location_id: Uuid,
    pub business_date: NaiveDate,
    pub status: String,
    pub totals: Value,
    pub expected_cash: Decimal,
    pub counted_cash: Decimal,
    pub denominations: Value,
    pub variance: Decimal,
    pub variance_reason: Option<String>,
    pub petty_cash_total: Decimal,
    pub float_carried_forward: Decimal,
    pub closed_by_name: Option<String>,
    pub closed_at: DateTime<Utc>,
    pub reopened_by_name: Option<String>,
    pub reopened_at: Option<DateTime<Utc>>,
    pub reopen_reason: Option<String>,
}

const CLOSE_SELECT: &str = "\
    SELECT c.id, c.pharmacy_location_id, c.business_date, c.status, c.totals, \
           c.expected_cash, c.counted_cash, c.denominations, c.variance, c.variance_reason, \
           c.petty_cash_total, c.float_carried_forward, cu.full_name AS closed_by_name, \
           c.closed_at, ru.full_name AS reopened_by_name, c.reopened_at, c.reopen_reason \
      FROM pharmacy_day_closes c \
      LEFT JOIN users cu ON cu.id = c.closed_by \
      LEFT JOIN users ru ON ru.id = c.reopened_by \
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL";

async fn close_row(
    tx: &mut medbrains_kernel::Tx,
    tenant_id: Uuid,
    location: Uuid,
    date: NaiveDate,
) -> Result<Option<DayCloseRow>, AppError> {
    Ok(sqlx::query_as::<_, DayCloseRow>(&format!(
        "{CLOSE_SELECT} AND c.pharmacy_location_id = $2 AND c.business_date = $3"
    ))
    .bind(tenant_id)
    .bind(location)
    .bind(date)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Whether the token carries a permission. Pure: the claims are already in
/// hand, so there is no fault to tell apart from a refusal.
fn holds(claims: &Claims, permission: &str) -> bool {
    is_bypass_role(claims) || claims.permissions.iter().any(|p| p == permission)
}

/// Why this caller cannot close this day now, if they cannot.
async fn close_refusal(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    report: &ZReport,
    close: Option<&DayCloseRow>,
) -> Result<Option<String>, AppError> {
    let today: NaiveDate = sqlx::query_scalar("SELECT tenant_local_date($1, now())")
        .bind(claims.tenant_id)
        .fetch_one(&mut **tx)
        .await?;
    let worked_it = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pharmacy_cash_drawers WHERE tenant_id = $1 \
               AND pharmacy_location_id = $2 AND business_date = $3 \
               AND cashier_user_id = $4 AND deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .bind(report.pharmacy_location_id)
    .bind(report.business_date)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if close.is_some_and(|c| c.status == "closed") {
        Some("This day is already closed".to_owned())
    } else if report.business_date > today {
        Some("A day cannot be closed before it starts".to_owned())
    } else if report.drawers.is_empty() {
        Some("No drawer was opened at this counter that day".to_owned())
    } else if report.open_drawers > 0 {
        Some(format!(
            "{} drawer(s) are still open: each cashier closes their drawer first",
            report.open_drawers
        ))
    } else if !holds(claims, permissions::pharmacy::day_close::CLOSE) {
        Some("Your role cannot close a counter day".to_owned())
    } else if !worked_it && !holds(claims, permissions::pharmacy::day_close::REOPEN) {
        Some(
            "Only a cashier who worked this counter that day, or a supervisor, can close it"
                .to_owned(),
        )
    } else {
        None
    })
}

#[derive(Debug, Deserialize)]
pub struct DayQuery {
    pub pharmacy_location_id: Uuid,
    pub business_date: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct DayReport {
    pub report: ZReport,
    pub close: Option<DayCloseRow>,
    /// Why the signed-in user cannot close this day now; `None` means they can.
    pub close_refusal: Option<String>,
}

/// `GET /api/pharmacy/day-close/report`
pub async fn get_day_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DayQuery>,
) -> Result<Json<DayReport>, AppError> {
    require_permission(&claims, permissions::pharmacy::day_close::VIEW)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let report = z_report_in_tx(
        &mut tx,
        claims.tenant_id,
        q.pharmacy_location_id,
        q.business_date,
    )
    .await?;
    let close = close_row(
        &mut tx,
        claims.tenant_id,
        q.pharmacy_location_id,
        q.business_date,
    )
    .await?;
    let close_refusal = close_refusal(&mut tx, &claims, &report, close.as_ref()).await?;
    tx.commit().await?;
    Ok(Json(DayReport {
        report,
        close,
        close_refusal,
    }))
}

/// One counter on one day, closed or still waiting to be.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CounterDay {
    pub pharmacy_location_id: Uuid,
    pub location_name: Option<String>,
    pub business_date: NaiveDate,
    pub drawers: i64,
    pub open_drawers: i64,
    pub close_id: Option<Uuid>,
    /// `open` (never closed), `closed` or `reopened`.
    pub status: String,
    pub variance: Option<Decimal>,
    pub closed_by_name: Option<String>,
    pub closed_at: Option<DateTime<Utc>>,
}

/// `GET /api/pharmacy/day-close` — the last month's counter days, newest first.
pub async fn list_counter_days(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CounterDay>>, AppError> {
    require_permission(&claims, permissions::pharmacy::day_close::VIEW)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query_as::<_, CounterDay>(
        "SELECT d.pharmacy_location_id, sl.name AS location_name, d.business_date, \
                COUNT(*) AS drawers, COUNT(*) FILTER (WHERE d.status = 'open') AS open_drawers, \
                c.id AS close_id, COALESCE(c.status, 'open') AS status, c.variance, \
                cu.full_name AS closed_by_name, c.closed_at \
           FROM pharmacy_cash_drawers d \
           LEFT JOIN store_locations sl ON sl.id = d.pharmacy_location_id \
                                       AND sl.tenant_id = d.tenant_id \
           LEFT JOIN pharmacy_day_closes c ON c.tenant_id = d.tenant_id \
                 AND c.pharmacy_location_id = d.pharmacy_location_id \
                 AND c.business_date = d.business_date AND c.deleted_at IS NULL \
           LEFT JOIN users cu ON cu.id = c.closed_by \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
            AND d.business_date >= tenant_local_date($1, now()) - $2::int \
          GROUP BY d.pharmacy_location_id, sl.name, d.business_date, c.id, c.status, \
                   c.variance, cu.full_name, c.closed_at \
          ORDER BY d.business_date DESC, sl.name LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(LIST_DAYS)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CloseDayRequest {
    pub pharmacy_location_id: Uuid,
    pub business_date: NaiveDate,
    /// Pieces counted per denomination, e.g. `{"500": 3, "100": 7}`.
    pub denominations: BTreeMap<String, i64>,
    pub variance_reason: Option<String>,
    #[serde(default)]
    pub float_carried_forward: Decimal,
}

/// `POST /api/pharmacy/day-close`
pub async fn close_day(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CloseDayRequest>,
) -> Result<Json<DayCloseRow>, AppError> {
    require_permission(&claims, permissions::pharmacy::day_close::CLOSE)?;
    let counted = day_close_rules::counted_total(&body.denominations)?;
    day_close_rules::check_float(body.float_carried_forward, counted)?;

    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    // Lock the day's drawers: none opens, closes or moves while it is counted.
    sqlx::query(
        "SELECT id FROM pharmacy_cash_drawers WHERE tenant_id = $1 \
            AND pharmacy_location_id = $2 AND business_date = $3 AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_location_id)
    .bind(body.business_date)
    .execute(&mut *tx)
    .await?;
    let report = z_report_in_tx(
        &mut tx,
        claims.tenant_id,
        body.pharmacy_location_id,
        body.business_date,
    )
    .await?;
    let existing = close_row(
        &mut tx,
        claims.tenant_id,
        body.pharmacy_location_id,
        body.business_date,
    )
    .await?;
    if let Some(refusal) = close_refusal(&mut tx, &claims, &report, existing.as_ref()).await? {
        return Err(AppError::Conflict(refusal));
    }
    let expected = report.summary.expected_cash;
    let reason =
        day_close_rules::variance_reason(counted - expected, body.variance_reason.as_deref())?;
    let totals = serde_json::to_value(&report)
        .map_err(|e| AppError::Internal(format!("day-close totals: {e}")))?;
    let denominations = serde_json::to_value(&body.denominations)
        .map_err(|e| AppError::Internal(format!("day-close denominations: {e}")))?;

    // A reopened day is closed again on its own row: one row per counter day.
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_day_closes \
           (tenant_id, pharmacy_location_id, business_date, totals, expected_cash, counted_cash, \
            denominations, variance_reason, petty_cash_total, float_carried_forward, closed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         ON CONFLICT (tenant_id, pharmacy_location_id, business_date) WHERE deleted_at IS NULL \
         DO UPDATE SET status = 'closed', totals = EXCLUDED.totals, \
           expected_cash = EXCLUDED.expected_cash, counted_cash = EXCLUDED.counted_cash, \
           denominations = EXCLUDED.denominations, variance_reason = EXCLUDED.variance_reason, \
           petty_cash_total = EXCLUDED.petty_cash_total, \
           float_carried_forward = EXCLUDED.float_carried_forward, \
           closed_by = EXCLUDED.closed_by, closed_at = now() \
         WHERE pharmacy_day_closes.status = 'reopened' \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_location_id)
    .bind(body.business_date)
    .bind(totals)
    .bind(expected)
    .bind(counted)
    .bind(denominations)
    .bind(reason)
    .bind(report.summary.petty_cash_total)
    .bind(body.float_carried_forward)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This day is already closed".to_owned()))?;

    sqlx::query(
        "UPDATE pharmacy_cash_drawers SET day_close_id = $4 WHERE tenant_id = $1 \
            AND pharmacy_location_id = $2 AND business_date = $3 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(body.pharmacy_location_id)
    .bind(body.business_date)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    let row = close_row(
        &mut tx,
        claims.tenant_id,
        body.pharmacy_location_id,
        body.business_date,
    )
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct ReopenDayRequest {
    pub reason: String,
}

/// `POST /api/pharmacy/day-close/{id}/reopen`
pub async fn reopen_day(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReopenDayRequest>,
) -> Result<Json<DayCloseRow>, AppError> {
    require_permission(&claims, permissions::pharmacy::day_close::REOPEN)?;
    let reason = body.reason.trim();
    if reason.chars().count() < REASON_MIN_CHARS {
        return Err(AppError::BadRequest(
            "Say why the day is being reopened".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let reopened: Option<(Uuid, NaiveDate)> = sqlx::query_as(
        "UPDATE pharmacy_day_closes SET status = 'reopened', reopened_by = $3, \
                reopened_at = now(), reopen_reason = $4 \
          WHERE id = $1 AND tenant_id = $2 AND status = 'closed' AND deleted_at IS NULL \
          RETURNING pharmacy_location_id, business_date",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(reason)
    .fetch_optional(&mut *tx)
    .await?;
    let (location, date) = reopened
        .ok_or_else(|| AppError::Conflict("Only a closed day can be reopened".to_owned()))?;
    let row = close_row(&mut tx, claims.tenant_id, location, date)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
