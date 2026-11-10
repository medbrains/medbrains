//! Runs that are waiting.
//!
//! A suspended run lives here rather than in memory, which is the whole point:
//! a wait that a deploy can erase is not a wait, it is a run that quietly never
//! finishes.

use super::Database;
use chrono::{DateTime, Utc};
use r8r_core::{SuspendedAt, Suspension};
use r8r_workflow::interfaces::Items;
use rusqlite::{OptionalExtension, Row, params};

/// A run that stopped part-way, and everything needed to continue it.
#[derive(Debug, Clone)]
pub struct WaitingRun {
    pub execution_id: String,
    pub workflow_id: String,
    pub suspended: SuspendedAt,
    pub created_at: String,
}

#[derive(Debug)]
pub struct WaitRepository<'a> {
    pub(super) db: &'a Database,
}

const COLUMNS: &str = "execution_id, workflow_id, node_id, node_name, reason, \
                       resume_at, needs_approval, items, created_at";

impl WaitRepository<'_> {
    /// Write down a run that has stopped.
    pub fn suspend(
        &self,
        execution_id: &str,
        workflow_id: &str,
        suspended: &SuspendedAt,
    ) -> rusqlite::Result<()> {
        self.db.conn().execute(
            "INSERT OR REPLACE INTO execution_wait
                 (execution_id, workflow_id, node_id, node_name, reason,
                  resume_at, needs_approval, items, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                execution_id,
                workflow_id,
                suspended.node_id,
                suspended.node_name,
                suspended.suspension.reason,
                suspended.suspension.resume_at.map(|at| at.to_rfc3339()),
                i64::from(suspended.suspension.needs_approval),
                serde_json::to_string(&suspended.suspension.items).unwrap_or_else(|_| "[]".into()),
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn find(&self, execution_id: &str) -> rusqlite::Result<Option<WaitingRun>> {
        let conn = self.db.conn();
        let sql = format!("SELECT {COLUMNS} FROM execution_wait WHERE execution_id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_row(params![execution_id], from_row).optional()
    }

    /// Everything currently waiting, newest first.
    pub fn list(&self, workflow_id: Option<&str>) -> rusqlite::Result<Vec<WaitingRun>> {
        let conn = self.db.conn();
        let sql = format!(
            "SELECT {COLUMNS} FROM execution_wait
              WHERE (?1 IS NULL OR workflow_id = ?1)
              ORDER BY created_at DESC"
        );
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_map(params![workflow_id], from_row)?.collect()
    }

    /// Runs whose moment has come.
    ///
    /// Approval waits are excluded in the query rather than filtered after, so
    /// there is no path by which one is woken by the passage of time.
    pub fn due(&self, now: DateTime<Utc>) -> rusqlite::Result<Vec<WaitingRun>> {
        let conn = self.db.conn();
        let sql = format!(
            "SELECT {COLUMNS} FROM execution_wait
              WHERE needs_approval = 0 AND resume_at IS NOT NULL AND resume_at <= ?1
              ORDER BY resume_at"
        );
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_map(params![now.to_rfc3339()], from_row)?
            .collect()
    }

    /// Forget a wait once its run has been continued.
    pub fn clear(&self, execution_id: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "DELETE FROM execution_wait WHERE execution_id = ?1",
            params![execution_id],
        )
    }
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<WaitingRun> {
    let resume_at: Option<String> = row.get(5)?;
    let items: String = row.get(7)?;

    Ok(WaitingRun {
        execution_id: row.get(0)?,
        workflow_id: row.get(1)?,
        suspended: SuspendedAt {
            node_id: row.get(2)?,
            node_name: row.get(3)?,
            suspension: Suspension {
                reason: row.get(4)?,
                resume_at: resume_at.and_then(|at| {
                    DateTime::parse_from_rfc3339(&at)
                        .ok()
                        .map(|at| at.with_timezone(&Utc))
                }),
                needs_approval: row.get::<_, i64>(6)? != 0,
                items: serde_json::from_str::<Items>(&items).unwrap_or_default(),
            },
        },
        created_at: row.get(8)?,
    })
}
