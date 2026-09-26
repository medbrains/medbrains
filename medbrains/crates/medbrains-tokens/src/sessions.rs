//! When a queue gives out tokens (RFCs/modules/RFC-MODULE-token-queues.md, P1c).
//!
//! A queue with no sessions gives out tokens all day. With sessions, a token
//! is given out from `early_issue_minutes` before a session opens until it
//! closes. Sessions govern issuing only: waiting patients are never touched
//! when a session ends.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{Duration, NaiveDate, NaiveTime};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::queues::QueueConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueSession {
    pub label: String,
    /// ISO weekdays, 1 = Monday .. 7 = Sunday; empty means every day.
    pub days: Vec<i16>,
    pub opens: NaiveTime,
    pub closes: NaiveTime,
    /// Replaces the queue's prefix during this session.
    pub prefix: Option<String>,
}

/// The hospital's own date, time and weekday — never the server's.
#[derive(Debug, Clone, Copy)]
pub struct LocalClock {
    pub date: NaiveDate,
    pub time: NaiveTime,
    pub weekday: i16,
}

/// Where a new token falls: its numbering period and the prefix on its slip.
#[derive(Debug, PartialEq, Eq)]
pub struct Admission {
    pub period_key: String,
    pub prefix: String,
}

const WEEKDAYS: [&str; 7] = [
    "Mondays",
    "Tuesdays",
    "Wednesdays",
    "Thursdays",
    "Fridays",
    "Saturdays",
    "Sundays",
];

impl QueueSession {
    fn runs_on(&self, weekday: i16) -> bool {
        self.days.is_empty() || self.days.contains(&weekday)
    }
}

/// Admit a token now, or say in the desk's words why the queue is closed.
pub fn admit(
    queue: &QueueConfig,
    sessions: &[QueueSession],
    clock: LocalClock,
) -> Result<Admission, String> {
    if sessions.is_empty() {
        return Ok(Admission {
            period_key: period(queue, clock.date, None),
            prefix: queue.prefix.clone(),
        });
    }
    let early = Duration::minutes(i64::from(queue.early_issue_minutes));
    let mut today: Vec<&QueueSession> = sessions
        .iter()
        .filter(|s| s.runs_on(clock.weekday))
        .collect();
    today.sort_by_key(|s| s.opens);
    if today.is_empty() {
        let day = WEEKDAYS
            .get(usize::try_from(clock.weekday - 1).unwrap_or(0))
            .unwrap_or(&"today");
        return Err(format!("{} is not open on {day}", queue.name));
    }
    // `overflowing_sub` keeps an 00:30 session with a 60-minute lead from
    // wrapping to the previous evening.
    let from = |s: &QueueSession| {
        let (start, wrapped) = s.opens.overflowing_sub_signed(early);
        if wrapped == 0 { start } else { NaiveTime::MIN }
    };
    if let Some(open) = today
        .iter()
        .find(|s| clock.time >= from(s) && clock.time < s.closes)
    {
        return Ok(Admission {
            period_key: period(queue, clock.date, Some(open.opens)),
            prefix: open.prefix.clone().unwrap_or_else(|| queue.prefix.clone()),
        });
    }
    Err(today.iter().find(|s| from(s) > clock.time).map_or_else(
        || format!("{} has closed for today", queue.name),
        |next| {
            format!(
                "{} is closed — tokens from {}",
                queue.name,
                from(next).format("%H:%M")
            )
        },
    ))
}

fn period(queue: &QueueConfig, date: NaiveDate, session_opens: Option<NaiveTime>) -> String {
    match (queue.reset_rule.as_str(), session_opens) {
        ("never", _) => "all".to_owned(),
        ("session", Some(opens)) => format!("{date}@{}", opens.format("%H:%M")),
        _ => date.to_string(),
    }
}

/// The admin's mistakes, in words they can act on.
pub fn validate_sessions(reset_rule: &str, sessions: &mut [QueueSession]) -> Result<(), AppError> {
    let bad = |msg: String| Err(AppError::BadRequest(msg));
    if sessions.len() > 6 {
        return bad("A queue can have at most 6 sessions".to_owned());
    }
    for s in sessions.iter_mut() {
        s.prefix = s
            .prefix
            .as_deref()
            .map(|p| p.trim().to_uppercase())
            .filter(|p| !p.is_empty());
        if s.label.trim().is_empty() {
            return bad("Every session needs a name, like Morning".to_owned());
        }
        if s.closes <= s.opens {
            return bad(format!(
                "{} closes before it opens — a session ends on the day it starts",
                s.label
            ));
        }
        if s.days.iter().any(|d| !(1..=7).contains(d)) {
            return bad(format!(
                "{} has a day that is not Monday to Sunday",
                s.label
            ));
        }
        let prefix_ok =
            |p: &str| (1..=6).contains(&p.len()) && p.chars().all(|c| c.is_ascii_alphanumeric());
        if s.prefix.as_deref().is_some_and(|p| !prefix_ok(p)) {
            return bad(format!("{}'s prefix is 1 to 6 letters or digits", s.label));
        }
    }
    for (i, a) in sessions.iter().enumerate() {
        let shares_day = |b: &QueueSession| {
            a.days.is_empty() || b.days.is_empty() || a.days.iter().any(|d| b.days.contains(d))
        };
        if let Some(b) = sessions[i + 1..]
            .iter()
            .find(|b| shares_day(b) && a.opens < b.closes && b.opens < a.closes)
        {
            return bad(format!("{} and {} overlap", a.label, b.label));
        }
    }
    if reset_rule == "session" {
        let prefixes: std::collections::HashSet<_> = sessions
            .iter()
            .filter_map(|s| s.prefix.as_deref())
            .collect();
        if sessions.is_empty() || prefixes.len() != sessions.len() {
            return bad(
                "A queue that restarts its numbers each session needs sessions with different \
                 prefixes, like M and E — otherwise two waiting patients could hold the same number"
                    .to_owned(),
            );
        }
    }
    Ok(())
}

/// The hospital's clock, from its configured time zone.
pub async fn local_clock(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<LocalClock, AppError> {
    let row = sqlx::query!(
        r#"SELECT (now() AT TIME ZONE timezone)::date AS "date!",
                  (now() AT TIME ZONE timezone)::time AS "time!",
                  EXTRACT(ISODOW FROM now() AT TIME ZONE timezone)::smallint AS "weekday!"
             FROM tenants WHERE id = $1"#,
        tenant_id,
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(LocalClock {
        date: row.date,
        time: row.time,
        weekday: row.weekday,
    })
}

pub async fn read_sessions(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Uuid,
) -> Result<Vec<QueueSession>, AppError> {
    Ok(sqlx::query_as!(
        QueueSession,
        r#"SELECT label, days AS "days!", opens, closes, prefix
             FROM queue_sessions WHERE queue_id = $1 ORDER BY opens"#,
        queue_id,
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// `GET /api/queues/{id}/sessions`
pub async fn list_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<QueueSession>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sessions = read_sessions(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(sessions))
}

/// `PUT /api/queues/{id}/sessions` — replace the queue's hours. An empty list
/// gives tokens out all day again.
pub async fn replace_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut sessions): Json<Vec<QueueSession>>,
) -> Result<Json<Vec<QueueSession>>, AppError> {
    require_permission(&claims, permissions::front_office::queue::config::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let reset_rule = sqlx::query_scalar!(
        "SELECT reset_rule FROM queues WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    validate_sessions(&reset_rule, &mut sessions)?;
    sqlx::query!(
        "DELETE FROM queue_sessions WHERE queue_id = $1 AND tenant_id = $2",
        id,
        claims.tenant_id
    )
    .execute(&mut *tx)
    .await?;
    for s in &sessions {
        sqlx::query!(
            "INSERT INTO queue_sessions (tenant_id, queue_id, label, days, opens, closes, prefix) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
            claims.tenant_id,
            id,
            s.label.trim(),
            &s.days,
            s.opens,
            s.closes,
            s.prefix,
        )
        .execute(&mut *tx)
        .await?;
    }
    let saved = read_sessions(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(saved))
}

#[cfg(test)]
mod tests {
    use super::{LocalClock, QueueSession, admit, validate_sessions};
    use crate::queues::QueueConfig;
    use chrono::{NaiveDate, NaiveTime};

    fn at(h: u32, m: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(h, m, 0).unwrap_or_default()
    }

    /// Saturday 26 Sep 2026.
    fn saturday(h: u32, m: u32) -> LocalClock {
        LocalClock {
            date: NaiveDate::from_ymd_opt(2026, 9, 26).unwrap_or_default(),
            time: at(h, m),
            weekday: 6,
        }
    }

    fn session(
        label: &str,
        opens: NaiveTime,
        closes: NaiveTime,
        prefix: Option<&str>,
    ) -> QueueSession {
        QueueSession {
            label: label.to_owned(),
            days: vec![],
            opens,
            closes,
            prefix: prefix.map(str::to_owned),
        }
    }

    fn opd_hours() -> Vec<QueueSession> {
        vec![
            session("Morning", at(9, 0), at(13, 0), Some("M")),
            session("Evening", at(16, 0), at(19, 0), Some("E")),
        ]
    }

    #[test]
    fn no_hours_means_open_all_day() {
        let admitted = admit(&QueueConfig::for_tests(), &[], saturday(3, 0));
        assert_eq!(admitted.map(|a| a.prefix), Ok("GEN".to_owned()));
    }

    #[test]
    fn patients_lining_up_before_opening_get_tokens() {
        assert!(
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(8, 0)).is_ok(),
            "60 minutes early"
        );
        assert_eq!(
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(7, 59)),
            Err("General OPD is closed — tokens from 08:00".to_owned())
        );
    }

    #[test]
    fn between_sessions_the_desk_is_told_when_tokens_resume() {
        assert_eq!(
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(13, 30)),
            Err("General OPD is closed — tokens from 15:00".to_owned())
        );
        assert_eq!(
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(19, 0)),
            Err("General OPD has closed for today".to_owned())
        );
    }

    #[test]
    fn a_session_queue_numbers_each_session_under_its_own_prefix() {
        let mut q = QueueConfig::for_tests();
        q.reset_rule = "session".to_owned();
        let morning = admit(&q, &opd_hours(), saturday(10, 0));
        let evening = admit(&q, &opd_hours(), saturday(17, 0));
        assert_eq!(morning.as_ref().map(|a| a.prefix.as_str()), Ok("M"));
        assert_eq!(evening.as_ref().map(|a| a.prefix.as_str()), Ok("E"));
        assert_eq!(
            morning.map(|a| a.period_key),
            Ok("2026-09-26@09:00".to_owned())
        );
        assert_eq!(
            evening.map(|a| a.period_key),
            Ok("2026-09-26@16:00".to_owned())
        );
        // A daily queue keeps one period across both sessions.
        let daily_m =
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(10, 0)).map(|a| a.period_key);
        let daily_e =
            admit(&QueueConfig::for_tests(), &opd_hours(), saturday(17, 0)).map(|a| a.period_key);
        assert_eq!(daily_m, daily_e);
    }

    #[test]
    fn a_weekday_clinic_is_closed_at_the_weekend() {
        let mut wednesdays = opd_hours();
        for s in &mut wednesdays {
            s.days = vec![3];
        }
        assert_eq!(
            admit(&QueueConfig::for_tests(), &wednesdays, saturday(10, 0)),
            Err("General OPD is not open on Saturdays".to_owned())
        );
    }

    #[test]
    fn hours_that_cannot_work_are_refused() {
        let mut overlap = vec![
            session("Morning", at(9, 0), at(13, 0), None),
            session("Noon", at(12, 0), at(14, 0), None),
        ];
        assert!(validate_sessions("daily", &mut overlap).is_err());
        let mut overnight = vec![session("Night", at(20, 0), at(8, 0), None)];
        assert!(validate_sessions("daily", &mut overnight).is_err());
        let mut same_prefix = opd_hours();
        for s in &mut same_prefix {
            s.prefix = None;
        }
        assert!(
            validate_sessions("session", &mut same_prefix).is_err(),
            "M-005 twice"
        );
        assert!(validate_sessions("daily", &mut same_prefix).is_ok());
        assert!(validate_sessions("session", &mut opd_hours()).is_ok());
    }
}
