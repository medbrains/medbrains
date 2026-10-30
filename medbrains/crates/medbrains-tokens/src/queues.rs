//! Configured queues (RFCs/modules/RFC-MODULE-token-queues.md, P1a).
//!
//! A `queues` row sets how one module's queue at one place numbers and admits
//! tokens. A place with no row keeps the built-in behaviour, so a hospital
//! changes nothing until an administrator configures a queue.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::sessions::{self, Admission};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QueueConfig {
    pub id: Uuid,
    pub name: String,
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub scope_label: Option<String>,
    pub prefix: String,
    pub start_at: i32,
    pub pad_width: i16,
    pub reset_rule: String,
    pub max_tokens_per_period: Option<i32>,
    pub lifecycle: String,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub status: String,
    /// How long before a session opens its tokens are given out.
    pub early_issue_minutes: i16,
    /// What a public board may show besides the number: `number` or `initials`.
    pub board_shows: String,
    /// Languages a call is spoken in, in order (`en`, `hi`, `ta`).
    pub voice_languages: Vec<String>,
    /// How many times each call is spoken.
    pub announce_repeat: i16,
    /// `recycle` only: how many numbers go round, from `start_at`.
    pub number_pool_size: Option<i32>,
    /// `recycle` only: how long after its last holder finished a number may
    /// be given out again.
    pub reuse_cooloff_minutes: i32,
}

impl QueueConfig {
    /// The number printed on the slip for the `seq`-th token of the period.
    pub fn number(&self, prefix: &str, seq: i32) -> String {
        let n = seq + self.start_at - 1;
        let width = usize::try_from(self.pad_width).unwrap_or(3);
        format!("{prefix}-{n:0width$}")
    }

    /// Every number a recycling queue gives out, lowest first.
    pub fn pool_numbers(&self, prefix: &str) -> Vec<String> {
        (1..=self.number_pool_size.unwrap_or(0))
            .map(|seq| self.number(prefix, seq))
            .collect()
    }

    /// Why a recycling queue has no number to give, in the desk's words.
    pub fn pool_exhausted_reason(&self, next_free: Option<&str>) -> String {
        let pool = self.number_pool_size.unwrap_or(0);
        next_free.map_or_else(
            || format!("All {pool} numbers of {} are in use", self.name),
            |at| {
                format!(
                    "All {pool} numbers of {} are in use or cooling off — next free at {at}",
                    self.name
                )
            },
        )
    }

    /// Why this queue takes no tokens today, in the desk's words — before
    /// counting how many it already has.
    pub fn closed_reason(&self, today: NaiveDate) -> Option<String> {
        if self.status == "paused" {
            return Some(format!("{} is paused — no new tokens", self.name));
        }
        let before = self.valid_from.is_some_and(|from| today < from);
        let after = self.valid_until.is_some_and(|until| today > until);
        if before || after {
            return Some(match (self.valid_from, self.valid_until) {
                (Some(from), Some(until)) => format!(
                    "{} runs {} to {} only",
                    self.name,
                    from.format("%d %b"),
                    until.format("%d %b")
                ),
                _ => format!("{} is not running today", self.name),
            });
        }
        None
    }

    /// Whether the period's limit is reached, and the desk's message if so.
    pub fn full_reason(&self, issued: i64) -> Option<String> {
        let max = self.max_tokens_per_period?;
        (issued >= i64::from(max)).then(|| {
            let period = match self.reset_rule.as_str() {
                "daily" | "recycle" => " for today",
                "session" => " for this session",
                _ => "",
            };
            format!("{} is full{period} — {issued} of {max}", self.name)
        })
    }
}

/// The live (not closed) queue for a module at a place, if one is configured.
pub async fn live_queue(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    (module, scope, scope_id): (&str, &str, Option<Uuid>),
) -> Result<Option<QueueConfig>, AppError> {
    Ok(sqlx::query_as!(
        QueueConfig,
        "SELECT id, name, module, scope, scope_id, scope_label, prefix, start_at, pad_width, \
                reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status, \
                early_issue_minutes, board_shows, voice_languages, announce_repeat, \
                number_pool_size, reuse_cooloff_minutes \
           FROM queues \
          WHERE tenant_id = $1 AND module = $2 AND scope = $3 \
            AND scope_id IS NOT DISTINCT FROM $4 AND status <> 'closed'",
        tenant_id,
        module,
        scope,
        scope_id,
    )
    .fetch_optional(&mut **tx)
    .await?)
}

/// Admit a token to this queue now — its numbering period and prefix — or
/// say, in the desk's words, why the queue cannot take one: paused, outside
/// its dates or hours, or full for the period.
pub async fn admit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    queue: &QueueConfig,
) -> Result<Result<Admission, String>, AppError> {
    // The hospital's clock: the app server's, and the database's UTC date, can
    // sit on the other side of the hospital's midnight.
    let clock = sessions::local_clock(tx, tenant_id).await?;
    if let Some(reason) = queue.closed_reason(clock.date) {
        return Ok(Err(reason));
    }
    let hours = sessions::read_sessions(tx, queue.id).await?;
    let admission = match sessions::admit(queue, &hours, clock) {
        Ok(admission) => admission,
        Err(reason) => return Ok(Err(reason)),
    };
    if queue.max_tokens_per_period.is_some() {
        let issued = issued_in(tx, queue.id, &admission.period_key).await?;
        if let Some(reason) = queue.full_reason(issued) {
            return Ok(Err(reason));
        }
    }
    Ok(Ok(admission))
}

async fn issued_in(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Uuid,
    period_key: &str,
) -> Result<i64, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!" FROM tokens WHERE queue_id = $1 AND period_key = $2"#,
        queue_id,
        period_key,
    )
    .fetch_one(&mut **tx)
    .await?)
}

/// The number a recycling queue gives out next, or why there is none.
///
/// The lowest in its pool that nobody holds and whose last holder finished at
/// least the cool-off ago. Callers hold the queue's advisory lock.
///
/// A number is held by a token that is still in the queue, by today's no-show
/// (the desk can still requeue it), and by a completed token whose patient was
/// sent on and will be returned to it (`return_to_referrer` reopens that very
/// token). Held is checked across the tenant, not this queue alone: a visit
/// carries its first number into unconfigured queues.
///
/// The cool-off is at most a day, so two days of tokens cover every holder:
/// the day-end rollover expires anything older that was still live.
pub async fn recycled_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    queue: &QueueConfig,
    prefix: &str,
) -> Result<Result<String, String>, AppError> {
    let pool = queue.pool_numbers(prefix);
    let row = sqlx::query!(
        r#"WITH usage AS (
               SELECT t.number,
                      bool_or(t.status IN ('waiting', 'on_hold', 'called', 'serving')
                           OR (t.status = 'no_show' AND t.token_date = CURRENT_DATE)
                           OR (t.status = 'completed' AND t.patient_id IS NOT NULL
                               AND EXISTS (
                                   SELECT 1 FROM tokens r
                                    WHERE r.tenant_id = t.tenant_id
                                      AND r.patient_id = t.patient_id
                                      AND r.referred_from_module = t.module
                                      AND r.referred_from_scope = t.scope
                                      AND r.referred_from_scope_id IS NOT DISTINCT FROM t.scope_id
                                      AND r.token_date = CURRENT_DATE
                                      AND r.status IN ('waiting', 'on_hold', 'called', 'serving')))
                      ) AS held,
                      MAX(COALESCE(t.completed_at, t.updated_at))
                          + make_interval(mins => $3) AS free_at
                 FROM tokens t
                WHERE t.tenant_id = $1 AND t.number = ANY($2)
                  AND t.token_date >= CURRENT_DATE - 2
                GROUP BY t.number
           )
           SELECT (SELECT p.number FROM unnest($2::text[]) WITH ORDINALITY AS p(number, ord)
                     LEFT JOIN usage u ON u.number = p.number
                    WHERE u.number IS NULL OR (NOT u.held AND u.free_at <= now())
                    ORDER BY p.ord LIMIT 1) AS number,
                  (SELECT to_char(MIN(u.free_at)
                                  AT TIME ZONE (SELECT timezone FROM tenants WHERE id = $1),
                                  'HH24:MI')
                     FROM usage u WHERE NOT u.held) AS next_free"#,
        tenant_id,
        &pool,
        queue.reuse_cooloff_minutes,
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(row
        .number
        .ok_or_else(|| queue.pool_exhausted_reason(row.next_free.as_deref())))
}

/// The next position in this queue's numbering period.
pub async fn next_seq(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Uuid,
    period_key: &str,
) -> Result<i32, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COALESCE(MAX(seq), 0) + 1 AS "seq!" FROM tokens
            WHERE queue_id = $1 AND period_key = $2"#,
        queue_id,
        period_key,
    )
    .fetch_one(&mut **tx)
    .await?)
}

/// Whether a configured queue offers this lane.
pub async fn offers_category(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue_id: Option<Uuid>,
    code: &str,
) -> Result<bool, AppError> {
    let Some(queue_id) = queue_id else {
        return Ok(false);
    };
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM queue_categories
                          WHERE queue_id = $1 AND code = $2 AND is_active) AS "offered!""#,
        queue_id,
        code,
    )
    .fetch_one(&mut **tx)
    .await?)
}

#[cfg(test)]
impl QueueConfig {
    /// A general OPD queue: GEN from 100, 60 a day, tokens an hour early.
    pub(crate) fn for_tests() -> Self {
        Self {
            id: Uuid::nil(),
            name: "General OPD".to_owned(),
            module: "opd".to_owned(),
            scope: "department".to_owned(),
            scope_id: None,
            scope_label: None,
            prefix: "GEN".to_owned(),
            start_at: 100,
            pad_width: 3,
            reset_rule: "daily".to_owned(),
            max_tokens_per_period: Some(60),
            lifecycle: "permanent".to_owned(),
            valid_from: None,
            valid_until: None,
            status: "active".to_owned(),
            early_issue_minutes: 60,
            board_shows: "number".to_owned(),
            voice_languages: vec!["en".to_owned()],
            announce_repeat: 1,
            number_pool_size: None,
            reuse_cooloff_minutes: 30,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::QueueConfig;
    use chrono::NaiveDate;

    fn day(d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, d).unwrap_or_default()
    }

    #[test]
    fn numbering_starts_where_the_admin_said() {
        assert_eq!(QueueConfig::for_tests().number("GEN", 1), "GEN-100");
        let mut short = QueueConfig::for_tests();
        short.start_at = 1;
        short.pad_width = 4;
        assert_eq!(short.number("GEN", 7), "GEN-0007");
    }

    #[test]
    fn a_recycling_pool_runs_from_the_first_number() {
        let mut pharmacy = QueueConfig::for_tests();
        pharmacy.name = "Pharmacy pickup".to_owned();
        pharmacy.start_at = 1;
        pharmacy.pad_width = 2;
        pharmacy.number_pool_size = Some(99);
        let pool = pharmacy.pool_numbers("P");
        assert_eq!(pool.len(), 99);
        assert_eq!(pool.first().map(String::as_str), Some("P-01"));
        assert_eq!(pool.last().map(String::as_str), Some("P-99"));
        assert_eq!(
            pharmacy.pool_exhausted_reason(Some("14:05")),
            "All 99 numbers of Pharmacy pickup are in use or cooling off — next free at 14:05"
        );
        assert_eq!(
            pharmacy.pool_exhausted_reason(None),
            "All 99 numbers of Pharmacy pickup are in use"
        );
    }

    #[test]
    fn a_full_queue_says_how_full() {
        assert_eq!(QueueConfig::for_tests().full_reason(59), None);
        assert_eq!(
            QueueConfig::for_tests().full_reason(60).as_deref(),
            Some("General OPD is full for today — 60 of 60")
        );
    }

    #[test]
    fn a_camp_queue_runs_only_on_its_days() {
        let mut camp = QueueConfig::for_tests();
        camp.name = "Village camp".to_owned();
        camp.lifecycle = "temporary".to_owned();
        camp.valid_from = Some(day(27));
        camp.valid_until = Some(day(28));
        assert_eq!(camp.closed_reason(day(27)), None);
        assert_eq!(
            camp.closed_reason(day(29)).as_deref(),
            Some("Village camp runs 27 Sep to 28 Sep only")
        );
    }

    #[test]
    fn a_paused_queue_takes_nobody() {
        let mut paused = QueueConfig::for_tests();
        paused.status = "paused".to_owned();
        assert!(paused.closed_reason(day(26)).is_some());
    }
}
