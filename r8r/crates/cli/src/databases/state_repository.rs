//! What a workflow remembers between runs.

use super::Database;
use chrono::Utc;
use rusqlite::params;
use serde_json::{Map, Value};

/// How many values one workflow may remember.
///
/// This is a watermark and a cursor or two, not a store. A cap keeps a
/// misbehaving workflow from turning it into one.
pub const MAX_KEYS: usize = 64;

/// The longest a single remembered value may be.
pub const MAX_VALUE_BYTES: usize = 64 * 1024;

/// Should this value be written?
///
/// Oversized or excess values are dropped with a warning rather than failing
/// the write: the rest of the workflow's state is worth keeping, and a run that
/// already succeeded should not be reported broken afterwards.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn worth_writing(workflow_id: &str, key: &str, value: &Value, held: usize) -> bool {
    if value.to_string().len() > MAX_VALUE_BYTES {
        tracing::warn!(
            workflow = %workflow_id,
            %key,
            "not remembering a value larger than the limit"
        );
        return false;
    }

    if held >= MAX_KEYS {
        tracing::warn!(
            workflow = %workflow_id,
            %key,
            "this workflow already remembers as much as it may"
        );
        return false;
    }

    true
}

#[derive(Debug)]
pub struct StateRepository<'a> {
    pub(super) db: &'a Database,
}

impl StateRepository<'_> {
    /// Everything this workflow remembers.
    pub fn load(&self, workflow_id: &str) -> rusqlite::Result<Map<String, Value>> {
        let conn = self.db.conn();
        let mut stmt =
            conn.prepare("SELECT key, value FROM workflow_state WHERE workflow_id = ?1")?;

        let rows = stmt.query_map(params![workflow_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut state = Map::new();
        for row in rows {
            let (key, raw) = row?;
            // Stored as JSON so a number stays a number; anything unreadable
            // falls back to text rather than losing the value.
            state.insert(
                key,
                serde_json::from_str(&raw).unwrap_or(Value::String(raw)),
            );
        }
        Ok(state)
    }

    /// Write values a successful run asked to remember.
    ///
    /// Oversized values are dropped with a warning rather than failing the
    /// write: the rest of the workflow's state is worth keeping, and a run that
    /// already succeeded should not be reported as broken afterwards.
    pub fn commit(
        &self,
        workflow_id: &str,
        values: &Map<String, Value>,
    ) -> rusqlite::Result<usize> {
        if values.is_empty() {
            return Ok(0);
        }

        let now = Utc::now().to_rfc3339();
        let mut conn = self.db.conn();
        let tx = conn.transaction()?;

        let counted: i64 = tx.query_row(
            "SELECT COUNT(*) FROM workflow_state WHERE workflow_id = ?1",
            params![workflow_id],
            |row| row.get(0),
        )?;
        let existing = usize::try_from(counted).unwrap_or(MAX_KEYS);

        let mut written = 0;
        for (key, value) in values {
            if !worth_writing(workflow_id, key, value, existing + written) {
                continue;
            }

            tx.execute(
                "INSERT INTO workflow_state (workflow_id, key, value, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (workflow_id, key)
                 DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![workflow_id, key, value.to_string(), now],
            )?;
            written += 1;
        }

        tx.commit()?;
        Ok(written)
    }

    /// Forget one value — how a backfill is started: reset the watermark and
    /// let the next run cover everything again.
    pub fn forget(&self, workflow_id: &str, key: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "DELETE FROM workflow_state WHERE workflow_id = ?1 AND key = ?2",
            params![workflow_id, key],
        )
    }

    /// Forget everything this workflow remembers.
    pub fn clear(&self, workflow_id: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "DELETE FROM workflow_state WHERE workflow_id = ?1",
            params![workflow_id],
        )
    }
}
