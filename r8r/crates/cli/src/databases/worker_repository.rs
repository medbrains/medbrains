//! Who is running, and who gets to do the work that must happen once.
//!
//! Both halves of running more than one r8r against one database. A worker
//! says it is alive; anything it was doing when it stopped saying so can be
//! recovered by somebody else. A lease says which worker owns a job that must
//! not be done twice.

use super::Database;
use chrono::{DateTime, Duration, Utc};
use rusqlite::params;

/// How long a worker may go without a heartbeat before it is presumed gone.
///
/// Generous on purpose: a worker paused by a slow query or a stop-the-world
/// moment is still running the workflow it is in the middle of, and declaring
/// it dead would let another worker recover a run that has not finished.
pub const HEARTBEAT_TIMEOUT_SECS: i64 = 60;

/// How long a lease is held before it has to be renewed.
///
/// Shorter than the heartbeat timeout so that a leader which dies is replaced
/// promptly, and long enough that renewing it is not most of what the leader
/// does.
pub const LEASE_SECS: i64 = 30;

/// The lease held by whichever worker fires schedule triggers.
pub const SCHEDULER_LEASE: &str = "scheduler";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Worker {
    pub id: String,
    pub hostname: String,
    pub started_at: String,
    pub seen_at: String,
    /// Whether this worker has said anything recently enough to be believed.
    pub alive: bool,
}

#[derive(Debug)]
pub struct WorkerRepository<'a> {
    pub(super) db: &'a Database,
}

impl WorkerRepository<'_> {
    /// Announce this worker, or update it if it is already known.
    pub fn register(&self, id: &str, hostname: &str) -> rusqlite::Result<()> {
        let now = Utc::now().to_rfc3339();
        self.db.conn().execute(
            "INSERT INTO worker_entity (id, hostname, started_at, seen_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(id) DO UPDATE SET seen_at = ?3, hostname = ?2",
            params![id, hostname, now],
        )?;
        Ok(())
    }

    /// Say this worker is still alive.
    pub fn heartbeat(&self, id: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE worker_entity SET seen_at = ?2 WHERE id = ?1",
            params![id, Utc::now().to_rfc3339()],
        )
    }

    /// Every worker this database has heard from, most recently seen first.
    pub fn list(&self) -> rusqlite::Result<Vec<Worker>> {
        let cutoff = Self::cutoff(Utc::now());
        let conn = self.db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, hostname, started_at, seen_at FROM worker_entity
             ORDER BY seen_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let seen_at: String = row.get("seen_at")?;
            Ok(Worker {
                id: row.get("id")?,
                hostname: row.get("hostname")?,
                started_at: row.get("started_at")?,
                alive: seen_at.as_str() >= cutoff.as_str(),
                seen_at,
            })
        })?;
        rows.collect()
    }

    /// Forget workers that stopped reporting long ago.
    ///
    /// Only ones well past the timeout, so that a worker being recovered from
    /// is still visible while that is happening — a run that says it was
    /// interrupted is easier to understand next to the worker it died on.
    pub fn forget_stale(&self) -> rusqlite::Result<usize> {
        let cutoff = (Utc::now() - Duration::seconds(HEARTBEAT_TIMEOUT_SECS * 60)).to_rfc3339();
        self.db.conn().execute(
            "DELETE FROM worker_entity WHERE seen_at < ?1",
            params![cutoff],
        )
    }

    /// Take a lease, or renew one this worker already holds.
    ///
    /// Returns whether this worker holds it now. The whole decision is one
    /// statement so that two workers racing cannot both be told yes: `SQLite`
    /// serialises the writes, and the `WHERE` clause is what makes the second
    /// one a no-op rather than an overwrite.
    pub fn claim_lease(&self, name: &str, worker_id: &str) -> rusqlite::Result<bool> {
        let now = Utc::now();
        let expires = (now + Duration::seconds(LEASE_SECS)).to_rfc3339();

        let taken = self.db.conn().execute(
            "INSERT INTO lease_entity (name, worker_id, expires_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(name) DO UPDATE SET worker_id = ?2, expires_at = ?3
               WHERE lease_entity.worker_id = ?2 OR lease_entity.expires_at < ?4",
            params![name, worker_id, expires, now.to_rfc3339()],
        )?;

        Ok(taken > 0)
    }

    /// Give up a lease, so another worker can take it without waiting it out.
    pub fn release_lease(&self, name: &str, worker_id: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "DELETE FROM lease_entity WHERE name = ?1 AND worker_id = ?2",
            params![name, worker_id],
        )
    }

    /// Who holds a lease right now, if anybody.
    pub fn lease_holder(&self, name: &str) -> rusqlite::Result<Option<String>> {
        let now = Utc::now().to_rfc3339();
        let conn = self.db.conn();
        let mut stmt = conn
            .prepare("SELECT worker_id FROM lease_entity WHERE name = ?1 AND expires_at >= ?2")?;
        let mut rows = stmt.query_map(params![name, now], |row| row.get::<_, String>(0))?;
        rows.next().transpose()
    }

    /// Workers that have stopped reporting, whose runs are nobody's now.
    pub fn dead_ids(&self) -> rusqlite::Result<Vec<String>> {
        let cutoff = Self::cutoff(Utc::now());
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT id FROM worker_entity WHERE seen_at < ?1")?;
        let rows = stmt.query_map(params![cutoff], |row| row.get::<_, String>(0))?;
        rows.collect()
    }

    fn cutoff(now: DateTime<Utc>) -> String {
        (now - Duration::seconds(HEARTBEAT_TIMEOUT_SECS)).to_rfc3339()
    }
}
