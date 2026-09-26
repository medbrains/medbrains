//! Configured queues (RFCs/modules/RFC-MODULE-token-queues.md, P1a).
//!
//! A `queues` row sets how one module's queue at one place numbers and admits
//! tokens. A place with no row keeps the built-in behaviour, so a hospital
//! changes nothing until an administrator configures a queue.

use chrono::NaiveDate;
use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}

impl QueueConfig {
    /// The number printed on the slip for the `seq`-th token of the period.
    pub fn number(&self, seq: i32) -> String {
        let n = seq + self.start_at - 1;
        let width = usize::try_from(self.pad_width).unwrap_or(3);
        format!("{}-{n:0width$}", self.prefix)
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
            let period = if self.reset_rule == "daily" { " for today" } else { "" };
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
                reset_rule, max_tokens_per_period, lifecycle, valid_from, valid_until, status \
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

/// Why this queue cannot take another token right now, if it cannot.
pub async fn refusal(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue: &QueueConfig,
) -> Result<Option<String>, AppError> {
    // The database's date, the same one `token_date` is stamped with; the app
    // server's clock can sit on the other side of midnight.
    let today = sqlx::query_scalar!(r#"SELECT CURRENT_DATE AS "today!""#)
        .fetch_one(&mut **tx)
        .await?;
    if let Some(reason) = queue.closed_reason(today) {
        return Ok(Some(reason));
    }
    if queue.max_tokens_per_period.is_none() {
        return Ok(None);
    }
    let issued = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!" FROM tokens
            WHERE queue_id = $1 AND ($2 = 'never' OR token_date = CURRENT_DATE)"#,
        queue.id,
        queue.reset_rule,
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(queue.full_reason(issued))
}

/// The next position in this queue's numbering period.
pub async fn next_seq(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    queue: &QueueConfig,
) -> Result<i32, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COALESCE(MAX(seq), 0) + 1 AS "seq!" FROM tokens
            WHERE queue_id = $1 AND ($2 = 'never' OR token_date = CURRENT_DATE)"#,
        queue.id,
        queue.reset_rule,
    )
    .fetch_one(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::QueueConfig;
    use chrono::NaiveDate;
    use uuid::Uuid;

    fn queue() -> QueueConfig {
        QueueConfig {
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
        }
    }

    fn day(d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 9, d).unwrap_or_default()
    }

    #[test]
    fn numbering_starts_where_the_admin_said() {
        assert_eq!(queue().number(1), "GEN-100");
        let mut short = queue();
        short.start_at = 1;
        short.pad_width = 4;
        assert_eq!(short.number(7), "GEN-0007");
    }

    #[test]
    fn a_full_queue_says_how_full() {
        assert_eq!(queue().full_reason(59), None);
        assert_eq!(
            queue().full_reason(60).as_deref(),
            Some("General OPD is full for today — 60 of 60")
        );
    }

    #[test]
    fn a_camp_queue_runs_only_on_its_days() {
        let mut camp = queue();
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
        let mut paused = queue();
        paused.status = "paused".to_owned();
        assert!(paused.closed_reason(day(26)).is_some());
    }
}
