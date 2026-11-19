//! `GET /api/opd/reports/summary?from=&to=` — the OPD reports screen inside the OPD app.
//!
//! A clinic running only Registration + OPD has no Reports app, and management still needs the
//! numbers. Counts only, never a patient identifier. The definitions are the daily report's
//! (`deploy/standalone/medbrains-daily-report`), so the 21:00 email and this screen agree:
//!
//! - **OPD visit**: an `opd` encounter on its `encounter_date`, not deleted, not cancelled, not a
//!   simulator row (`is_dummy`).
//! - **Registration**: a patient by `created_at` in the hospital's time zone, not deleted, not a
//!   merged duplicate.
//! - **Repeat patient**: a patient seen that day who had any earlier real visit (any type);
//!   **new patient**: one seen that day who had none. Both count patients once per day.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Longest range one request may ask for: a year, leap day included.
const MAX_RANGE_DAYS: i64 = 366;

/// The range, inclusive, as hospital-local dates.
#[derive(Debug, Deserialize)]
pub struct OpdReportQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

/// The range's four tiles: the sum of its day rows.
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
pub struct OpdReportTotals {
    pub visits: i64,
    pub registrations: i64,
    pub new_patients: i64,
    pub repeat_patients: i64,
}

/// One day of the range; a day with no visits is a row of zeros, not a gap.
#[derive(Debug, Serialize)]
pub struct OpdReportDay {
    pub date: NaiveDate,
    pub visits: i64,
    pub registrations: i64,
    pub new: i64,
    pub repeat: i64,
}

/// Visits by doctor; a visit with no doctor yet is one row with no id.
#[derive(Debug, Serialize)]
pub struct OpdReportDoctor {
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub visits: i64,
}

#[derive(Debug, Serialize)]
pub struct OpdReportSummary {
    pub totals: OpdReportTotals,
    pub by_day: Vec<OpdReportDay>,
    pub by_doctor: Vec<OpdReportDoctor>,
}

#[derive(Debug, Serialize)]
pub struct OpdReportResponse {
    pub data: OpdReportSummary,
}

/// Refuses a range that runs backwards or is longer than [`MAX_RANGE_DAYS`].
fn check_range(q: &OpdReportQuery) -> Result<(), AppError> {
    let days = (q.to - q.from).num_days() + 1;
    if days < 1 {
        return Err(AppError::BadRequest(
            "The end date is before the start date.".into(),
        ));
    }
    if days > MAX_RANGE_DAYS {
        return Err(AppError::BadRequest(
            "Choose a range of a year or less.".into(),
        ));
    }
    Ok(())
}

/// Adds the day rows up into the four tiles, so the tiles always equal the table.
fn sum_days(days: &[OpdReportDay]) -> OpdReportTotals {
    days.iter()
        .fold(OpdReportTotals::default(), |t, d| OpdReportTotals {
            visits: t.visits + d.visits,
            registrations: t.registrations + d.registrations,
            new_patients: t.new_patients + d.new,
            repeat_patients: t.repeat_patients + d.repeat,
        })
}

/// The range's OPD counts by day (every day, zeros included) and by doctor, in one query.
pub async fn get_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<OpdReportQuery>,
) -> Result<Json<OpdReportResponse>, AppError> {
    require_permission(&claims, permissions::opd::REPORTS_VIEW)?;
    // authz: role-only — counts by day and by doctor for management; no patient
    // identifier or clinical field leaves the query (DECISIONS 2026-11-19).
    check_range(&q)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let rows = sqlx::query!(
        r#"WITH tz AS (SELECT timezone AS tz FROM tenants WHERE id = $1),
        opd AS (
            SELECT e.patient_id, e.doctor_id, e.encounter_date FROM encounters e
             WHERE e.tenant_id = $1 AND e.encounter_type = 'opd' AND e.deleted_at IS NULL
               AND NOT e.is_dummy AND e.status::text <> 'cancelled'
               AND e.encounter_date BETWEEN $2 AND $3
        ), seen AS (
            SELECT DISTINCT o.patient_id, o.encounter_date AS d,
                   EXISTS (SELECT 1 FROM encounters l
                            WHERE l.tenant_id = $1 AND l.patient_id = o.patient_id
                              AND l.deleted_at IS NULL AND NOT l.is_dummy
                              AND l.status::text <> 'cancelled'
                              AND l.encounter_date < o.encounter_date) AS is_repeat
              FROM opd o
        ), regs AS (
            SELECT timezone(tz.tz, p.created_at)::date AS d, count(*) AS n FROM patients p, tz
             WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND NOT p.is_merged
               AND p.created_at >= timezone(tz.tz, $2::date::timestamp)
               AND p.created_at < timezone(tz.tz, ($3::date + 1)::timestamp)
             GROUP BY 1
        )
        SELECT 0 AS "ord!", g.d::date AS day, NULL::uuid AS doctor_id, NULL::text AS doctor_name,
               (SELECT count(*) FROM opd WHERE opd.encounter_date = g.d) AS "visits!",
               coalesce((SELECT n FROM regs WHERE regs.d = g.d), 0) AS "registrations!",
               (SELECT count(*) FROM seen WHERE seen.d = g.d AND NOT is_repeat) AS "new!",
               (SELECT count(*) FROM seen WHERE seen.d = g.d AND is_repeat) AS "repeat!"
          FROM generate_series($2::date, $3::date, interval '1 day') AS g(d)
        UNION ALL
        SELECT 1, NULL, o.doctor_id, u.full_name, count(*), 0, 0, 0
          FROM opd o LEFT JOIN users u ON u.id = o.doctor_id
         GROUP BY o.doctor_id, u.full_name
        ORDER BY 1, 2, 5 DESC, 4"#,
        claims.tenant_id,
        q.from,
        q.to,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let (mut by_day, mut by_doctor) = (Vec::new(), Vec::new());
    for r in rows {
        match r.day {
            Some(date) if r.ord == 0 => by_day.push(OpdReportDay {
                date,
                visits: r.visits,
                registrations: r.registrations,
                new: r.new,
                repeat: r.repeat,
            }),
            _ => by_doctor.push(OpdReportDoctor {
                doctor_id: r.doctor_id,
                doctor_name: r.doctor_name,
                visits: r.visits,
            }),
        }
    }
    let totals = sum_days(&by_day);
    Ok(Json(OpdReportResponse {
        data: OpdReportSummary {
            totals,
            by_day,
            by_doctor,
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::{OpdReportQuery, check_range};
    use chrono::NaiveDate;

    fn q(from: (i32, u32, u32), to: (i32, u32, u32)) -> OpdReportQuery {
        let d = |(y, m, d)| NaiveDate::from_ymd_opt(y, m, d).unwrap_or_default();
        OpdReportQuery {
            from: d(from),
            to: d(to),
        }
    }

    #[test]
    fn a_range_is_one_day_to_a_leap_year() {
        assert!(check_range(&q((2026, 11, 17), (2026, 11, 17))).is_ok());
        assert!(check_range(&q((2024, 1, 1), (2024, 12, 31))).is_ok());
        assert!(check_range(&q((2024, 1, 1), (2025, 1, 1))).is_err());
        assert!(check_range(&q((2026, 11, 17), (2026, 11, 16))).is_err());
    }
}
