//! Remembering which inbound requests have already been handled.
//!
//! A sender that does not get a timely 2xx retries — that is correct of them,
//! and it means the same event can arrive any number of times. Replaying the
//! original response makes those retries harmless: the caller sees exactly what
//! it would have seen, and the workflow runs once.
//!
//! Records expire. The window only has to outlast a sender's retry schedule,
//! and keeping them forever would mean keeping every response body forever —
//! which here can contain clinical data.

use super::Database;
use chrono::{DateTime, Duration, Utc};
use rusqlite::{OptionalExtension, params};
use serde_json::Value;

/// How long a handled request is remembered.
///
/// Long enough to cover any sane retry schedule — most give up within minutes
/// and the stubborn ones back off over hours.
pub const DEFAULT_WINDOW_HOURS: i64 = 24;

/// What was returned the first time.
#[derive(Debug, Clone)]
pub struct RecordedResponse {
    pub status: u16,
    pub body: Value,
    pub execution_id: Option<String>,
    pub first_seen: DateTime<Utc>,
}

#[derive(Debug)]
pub struct IdempotencyRepository<'a> {
    pub(super) db: &'a Database,
}

impl IdempotencyRepository<'_> {
    /// What this key returned before, if it is still within the window.
    ///
    /// An expired record is treated as absent rather than deleted here: the
    /// read path stays a read, and [`Self::prune`] does the forgetting.
    pub fn recall(
        &self,
        workflow_id: &str,
        key: &str,
        window_hours: i64,
    ) -> rusqlite::Result<Option<RecordedResponse>> {
        let cutoff = (Utc::now() - Duration::hours(window_hours.clamp(1, 24 * 30))).to_rfc3339();

        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT status, response, execution_id, created_at
               FROM idempotency_entity
              WHERE workflow_id = ?1 AND key = ?2 AND created_at >= ?3",
        )?;

        stmt.query_row(params![workflow_id, key, cutoff], |row| {
            let status: i64 = row.get(0)?;
            let body: String = row.get(1)?;
            let created: String = row.get(3)?;

            Ok(RecordedResponse {
                status: u16::try_from(status).unwrap_or(200),
                body: serde_json::from_str(&body).unwrap_or(Value::Null),
                execution_id: row.get(2)?,
                first_seen: DateTime::parse_from_rfc3339(&created)
                    .map_or_else(|_| Utc::now(), |stamp| stamp.with_timezone(&Utc)),
            })
        })
        .optional()
    }

    /// Record what this key returned.
    ///
    /// `INSERT OR REPLACE` rather than `INSERT`: two copies of the same request
    /// can be in flight at once, and the loser overwriting an identical row is
    /// harmless — whereas failing the request because it lost a race is not.
    pub fn remember(
        &self,
        workflow_id: &str,
        key: &str,
        status: u16,
        body: &Value,
        execution_id: Option<&str>,
    ) -> rusqlite::Result<()> {
        self.db.conn().execute(
            "INSERT OR REPLACE INTO idempotency_entity
                 (workflow_id, key, status, response, execution_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                workflow_id,
                key,
                i64::from(status),
                body.to_string(),
                execution_id,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Forget everything older than the window.
    pub fn prune(&self, window_hours: i64) -> rusqlite::Result<usize> {
        let cutoff = (Utc::now() - Duration::hours(window_hours.clamp(1, 24 * 30))).to_rfc3339();
        self.db.conn().execute(
            "DELETE FROM idempotency_entity WHERE created_at < ?1",
            params![cutoff],
        )
    }
}
