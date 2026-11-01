//! Leave rules the server decides, never the client: how many days a leave
//! takes, whether it clashes with leave already asked for, and the balance it
//! draws on.
//!
//! - **Days** are working days: weekly offs (`hr.weekly_offs`, default
//!   Sunday) and national or regional holidays are not counted. A restricted
//!   holiday is optional, so it is a working day. Maternity leave counts
//!   calendar days — the Maternity Benefit Act 1961 s.5(3) grants 26 *weeks*.
//! - **A half day** is 0.5, and only on a single date.
//! - **Balance** is drawn by the final approval, under a row lock, and given
//!   back when approved leave is cancelled. `leave_requests.balance_deducted`
//!   records what was drawn, so a cancel gives back that and nothing more.
//!   Loss of pay draws nothing, and nor does leave pulled from an HRMS — the
//!   HRMS's own balance already counts it.
//!
//! A leave's balance year is the year it starts in, as on the HR list.

use std::collections::HashSet;

use chrono::{Datelike, NaiveDate};
use medbrains_core::hr::LeaveType;
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::leave::Tx;

pub const SETTINGS_CATEGORY: &str = "hr";
pub const WEEKLY_OFFS_KEY: &str = "weekly_offs";
/// Days of the week as `0` = Sunday … `6` = Saturday.
pub const DEFAULT_WEEKLY_OFFS: [u32; 1] = [0];
/// One request covers at most a year; maternity (26 weeks) fits.
const MAX_SPAN_DAYS: i64 = 366;
/// Holidays in one window — a year's worth many times over.
const MAX_HOLIDAYS: i64 = 400;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Holiday {
    pub id: Uuid,
    pub holiday_date: NaiveDate,
    pub name: String,
    pub kind: String,
}

/// What a leave of these dates would take, and why.
#[derive(Debug, Serialize)]
pub struct LeaveDayCount {
    pub days: Decimal,
    /// True for leave counted in calendar days (maternity).
    pub counts_calendar_days: bool,
    pub weekly_offs: Vec<u32>,
    /// Every holiday in the range, restricted ones included.
    pub holidays: Vec<Holiday>,
}

/// Maternity Benefit Act 1961 s.5(3): the period is in weeks, so every day counts.
pub const fn counts_calendar_days(leave_type: LeaveType) -> bool {
    matches!(leave_type, LeaveType::Maternity)
}

const fn draws_balance(leave_type: LeaveType) -> bool {
    !matches!(leave_type, LeaveType::LossOfPay)
}

fn type_words(leave_type: LeaveType) -> String {
    serde_json::to_value(leave_type)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.replace('_', " ")))
        .unwrap_or_default()
}

/// `2.0` reads "2", `0.5` stays "0.5".
fn day_words(days: Decimal) -> String {
    days.normalize().to_string()
}

pub fn date_words(d: NaiveDate) -> String {
    d.format("%-d %b %Y").to_string()
}

fn span_words(start: NaiveDate, end: NaiveDate) -> String {
    if start == end {
        date_words(start)
    } else {
        format!("{} – {}", date_words(start), date_words(end))
    }
}

/// The days a leave takes. `off_days` are the closed holidays (not restricted).
pub fn count_days(
    leave_type: LeaveType,
    (start, end): (NaiveDate, NaiveDate),
    is_half_day: bool,
    weekly_offs: &[u32],
    off_days: &HashSet<NaiveDate>,
) -> Result<Decimal, AppError> {
    let refuse = |msg: &str| Err(AppError::BadRequest(msg.to_owned()));
    if end < start {
        return refuse("The last day must be on or after the first day.");
    }
    if (end - start).num_days() >= MAX_SPAN_DAYS {
        return refuse("One request can cover at most a year. Split it into two.");
    }
    if is_half_day && start != end {
        return refuse("A half day is a single date. Make the first and last day the same.");
    }
    let calendar = counts_calendar_days(leave_type);
    let counted = start
        .iter_days()
        .take_while(|d| *d <= end)
        .filter(|d| {
            calendar
                || !(weekly_offs.contains(&d.weekday().num_days_from_sunday())
                    || off_days.contains(d))
        })
        .count();
    if counted == 0 {
        return refuse("Every day you chose is a weekly off or a holiday, so no leave is needed.");
    }
    Ok(if is_half_day {
        Decimal::new(5, 1)
    } else {
        Decimal::from(counted)
    })
}

pub async fn load_weekly_offs(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<u32>, AppError> {
    let value: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(SETTINGS_CATEGORY)
    .bind(WEEKLY_OFFS_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    // ponytail: writes are validated on PUT; an unreadable value falls back to Sunday.
    Ok(value
        .and_then(|v| serde_json::from_value::<Vec<u32>>(v).ok())
        .map(|mut days| {
            days.retain(|d| *d < 7);
            days
        })
        .unwrap_or_else(|| DEFAULT_WEEKLY_OFFS.to_vec()))
}

pub async fn holidays_between(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Vec<Holiday>, AppError> {
    Ok(sqlx::query_as::<_, Holiday>(
        "SELECT id, holiday_date, name, kind FROM hr_holidays \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND holiday_date BETWEEN $2 AND $3 \
         ORDER BY holiday_date LIMIT $4",
    )
    .bind(tenant_id)
    .bind(from)
    .bind(to)
    .bind(MAX_HOLIDAYS)
    .fetch_all(&mut **tx)
    .await?)
}

pub async fn compute_days(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    leave_type: LeaveType,
    range: (NaiveDate, NaiveDate),
    is_half_day: bool,
) -> Result<LeaveDayCount, AppError> {
    let weekly_offs = load_weekly_offs(tx, tenant_id).await?;
    let holidays = holidays_between(tx, tenant_id, range.0, range.1).await?;
    let off_days: HashSet<NaiveDate> = holidays
        .iter()
        .filter(|h| h.kind != "restricted")
        .map(|h| h.holiday_date)
        .collect();
    let days = count_days(leave_type, range, is_half_day, &weekly_offs, &off_days)?;
    Ok(LeaveDayCount {
        days,
        counts_calendar_days: counts_calendar_days(leave_type),
        weekly_offs,
        holidays,
    })
}

/// Refuses leave that overlaps the employee's pending or approved leave.
/// Filing for one employee is serialised, so two requests sent at once
/// cannot both pass.
pub async fn refuse_overlap(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    employee_id: Uuid,
    (start, end): (NaiveDate, NaiveDate),
) -> Result<(), AppError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))")
        .bind(employee_id)
        .execute(&mut **tx)
        .await?;
    let clash: Option<(NaiveDate, NaiveDate, String)> = sqlx::query_as(
        "SELECT start_date, end_date, status::text FROM leave_requests \
         WHERE tenant_id = $1 AND employee_id = $2 AND deleted_at IS NULL \
           AND status IN ('pending_hod', 'pending_admin', 'approved') \
           AND start_date <= $4 AND end_date >= $3 \
         ORDER BY start_date LIMIT 1",
    )
    .bind(tenant_id)
    .bind(employee_id)
    .bind(start)
    .bind(end)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((s, e, status)) = clash else {
        return Ok(());
    };
    let state = if status == "approved" {
        "approved leave"
    } else {
        "leave waiting for approval"
    };
    Err(AppError::Conflict(format!(
        "These dates overlap {state} on {}. Change the dates, or cancel that leave first.",
        span_words(s, e)
    )))
}

fn no_balance(leave_type: LeaveType, year: i32) -> AppError {
    AppError::Conflict(format!(
        "No {} leave balance is set up for {year}. Ask HR to set it up.",
        type_words(leave_type)
    ))
}

/// Early refusal when filing: more days than the current balance.
pub async fn refuse_over_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    employee_id: Uuid,
    (leave_type, year): (LeaveType, i32),
    days: Decimal,
) -> Result<(), AppError> {
    if !draws_balance(leave_type) {
        return Ok(());
    }
    let balance: Option<Decimal> = sqlx::query_scalar(
        "SELECT balance FROM leave_balances \
         WHERE tenant_id = $1 AND employee_id = $2 AND leave_type = $3 AND year = $4 \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(employee_id)
    .bind(leave_type)
    .bind(year)
    .fetch_optional(&mut **tx)
    .await?;
    match balance {
        None => Err(no_balance(leave_type, year)),
        Some(b) if b < days => Err(AppError::Conflict(format!(
            "{} days available, you asked for {} ({} leave, {year}).",
            day_words(b),
            day_words(days),
            type_words(leave_type)
        ))),
        Some(_) => Ok(()),
    }
}

/// The leave being decided or cancelled — locked by the caller.
#[derive(Debug, sqlx::FromRow)]
pub struct LeaveTerms {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub leave_type: LeaveType,
    pub start_date: NaiveDate,
    pub days: Decimal,
    pub external_source: Option<String>,
    pub balance_deducted: Option<Decimal>,
}

/// What a draw or give-back did to the balance row, for the audit entry.
#[derive(Debug, Serialize)]
pub struct BalanceMove {
    pub balance_id: Uuid,
    pub days: Decimal,
    pub before: Decimal,
    pub after: Decimal,
}

/// Final approval: lock the balance row, refuse if it is short, draw the days.
pub async fn draw_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    leave: &LeaveTerms,
) -> Result<Option<BalanceMove>, AppError> {
    if !draws_balance(leave.leave_type) || leave.external_source.is_some() {
        return Ok(None);
    }
    let year = leave.start_date.year();
    let row: Option<(Uuid, Decimal)> = sqlx::query_as(
        "SELECT id, balance FROM leave_balances \
         WHERE tenant_id = $1 AND employee_id = $2 AND leave_type = $3 AND year = $4 \
           AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(leave.employee_id)
    .bind(leave.leave_type)
    .bind(year)
    .fetch_optional(&mut **tx)
    .await?;
    let (balance_id, before) = row.ok_or_else(|| no_balance(leave.leave_type, year))?;
    if before < leave.days {
        return Err(AppError::Conflict(format!(
            "Only {} days of {} leave are left for {year}; this leave needs {}. It cannot be approved.",
            day_words(before),
            type_words(leave.leave_type),
            day_words(leave.days)
        )));
    }
    sqlx::query("UPDATE leave_balances SET used = used + $2, balance = balance - $2 WHERE id = $1")
        .bind(balance_id)
        .bind(leave.days)
        .execute(&mut **tx)
        .await?;
    sqlx::query("UPDATE leave_requests SET balance_deducted = $2 WHERE id = $1")
        .bind(leave.id)
        .bind(leave.days)
        .execute(&mut **tx)
        .await?;
    Ok(Some(BalanceMove {
        balance_id,
        days: leave.days,
        before,
        after: before - leave.days,
    }))
}

/// Cancelling approved leave: give back exactly what its approval drew.
pub async fn give_back(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    leave: &LeaveTerms,
) -> Result<Option<BalanceMove>, AppError> {
    let Some(days) = leave.balance_deducted else {
        return Ok(None);
    };
    let row: Option<(Uuid, Decimal)> = sqlx::query_as(
        "UPDATE leave_balances SET used = used - $5, balance = balance + $5 \
         WHERE tenant_id = $1 AND employee_id = $2 AND leave_type = $3 AND year = $4 \
           AND deleted_at IS NULL \
         RETURNING id, balance",
    )
    .bind(tenant_id)
    .bind(leave.employee_id)
    .bind(leave.leave_type)
    .bind(leave.start_date.year())
    .bind(days)
    .fetch_optional(&mut **tx)
    .await?;
    sqlx::query("UPDATE leave_requests SET balance_deducted = NULL WHERE id = $1")
        .bind(leave.id)
        .execute(&mut **tx)
        .await?;
    Ok(row.map(|(balance_id, after)| BalanceMove {
        balance_id,
        days,
        before: after - days,
        after,
    }))
}

#[cfg(test)]
mod tests {
    use super::{HashSet, LeaveType, NaiveDate, count_days};
    use rust_decimal::Decimal;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default()
    }

    /// 2032-11-01 is a Monday.
    #[test]
    fn working_days_skip_the_weekly_off_and_holidays() {
        let holidays: HashSet<_> = [d("2032-11-03")].into();
        let days = count_days(
            LeaveType::Casual,
            (d("2032-11-01"), d("2032-11-05")),
            false,
            &[0],
            &holidays,
        );
        assert_eq!(days.ok(), Some(Decimal::from(4)), "Mon–Fri less Wednesday");
        let week = count_days(
            LeaveType::Casual,
            (d("2032-11-01"), d("2032-11-07")),
            false,
            &[0],
            &holidays,
        );
        assert_eq!(
            week.ok(),
            Some(Decimal::from(5)),
            "Saturday counts, Sunday does not"
        );
    }

    #[test]
    fn maternity_counts_every_calendar_day() {
        let holidays: HashSet<_> = [d("2032-11-03")].into();
        let days = count_days(
            LeaveType::Maternity,
            (d("2032-11-01"), d("2032-11-07")),
            false,
            &[0],
            &holidays,
        );
        assert_eq!(days.ok(), Some(Decimal::from(7)));
    }

    #[test]
    fn a_half_day_is_one_date_and_half_a_day() {
        let none = HashSet::new();
        let one = (d("2032-11-02"), d("2032-11-02"));
        assert_eq!(
            count_days(LeaveType::Casual, one, true, &[0], &none).ok(),
            Some(Decimal::new(5, 1))
        );
        let two = (d("2032-11-02"), d("2032-11-03"));
        assert!(count_days(LeaveType::Casual, two, true, &[0], &none).is_err());
    }

    #[test]
    fn nothing_to_take_backwards_or_too_long_is_refused() {
        let none = HashSet::new();
        let sunday = (d("2032-11-07"), d("2032-11-07"));
        assert!(count_days(LeaveType::Casual, sunday, false, &[0], &none).is_err());
        let backwards = (d("2032-11-05"), d("2032-11-01"));
        assert!(count_days(LeaveType::Casual, backwards, false, &[0], &none).is_err());
        let long = (d("2032-01-01"), d("2033-01-01"));
        assert!(count_days(LeaveType::Maternity, long, false, &[0], &none).is_err());
    }
}
