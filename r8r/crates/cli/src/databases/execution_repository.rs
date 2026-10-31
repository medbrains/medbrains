use super::Database;
use r8r_workflow::interfaces::{ExecutionStatus, Items, RunResult};
use rusqlite::{Row, params};
use serde_json::{Value, json};

/// Row shape for the executions list — deliberately without the payload, which
/// can be megabytes and is only needed when you open a single execution.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionSummary {
    pub id: String,
    pub workflow_id: String,
    pub workflow_name: String,
    pub status: String,
    pub mode: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub ms: i64,
    pub error: Option<String>,
    /// The execution this one is a retry of, if it is one.
    pub retry_of: Option<String>,
    /// 1 for an original run, n for the nth attempt at the same work.
    pub attempt: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredExecution {
    #[serde(flatten)]
    pub summary: ExecutionSummary,
    /// The full `RunResult`, i.e. per-node input/output for the run.
    pub data: serde_json::Value,
}

/// What links a retry to the run it replaces.
#[derive(Debug, Clone)]
pub struct Lineage {
    pub retry_of: String,
    pub attempt: i64,
}

/// Everything an execution row is opened with.
///
/// A struct rather than nine positional strings, because six of them are
/// `&str` and swapping two would compile — a workflow id in the name column
/// reads as a corrupted row long after whoever wrote it has moved on.
#[derive(Debug)]
pub struct Opening<'a> {
    pub id: &'a str,
    pub workflow_id: &'a str,
    pub workflow_name: &'a str,
    pub mode: &'a str,
    pub started_at: &'a str,
    pub input: &'a Items,
    /// Set when this run replaces an earlier one.
    pub lineage: Option<&'a Lineage>,
    /// Which worker is running it, for telling an interrupted run apart from
    /// one another worker is still in the middle of.
    pub worker_id: &'a str,
}

#[derive(Debug)]
pub struct ExecutionRepository<'a> {
    pub(super) db: &'a Database,
}

/// Hard ceiling on a page of executions, so a bad `limit` cannot ask `SQLite`
/// for the whole table.
const MAX_PAGE: usize = 500;
const MAX_PAGE_I64: i64 = 500;

const SUMMARY_COLUMNS: &str = "id, workflow_id, workflow_name, status, mode, \
                               started_at, finished_at, ms, error, retry_of, attempt";

/// How many times the same work may be put through before r8r stops offering
/// to try again.
///
/// A run that has already failed this many times is telling you something an
/// attempt will not fix, and an automation replaying it forever would turn one
/// broken workflow into permanent load.
pub const MAX_ATTEMPTS: i64 = 5;

impl ExecutionRepository<'_> {
    /// Executions, newest first.
    ///
    /// `status` filters the list, which is what makes a dead-letter view a
    /// query rather than a separate table: the failures already live here.
    pub fn list(
        &self,
        workflow_id: Option<&str>,
        status: Option<&str>,
        limit: usize,
    ) -> rusqlite::Result<Vec<ExecutionSummary>> {
        let conn = self.db.conn();
        let limit = i64::try_from(limit.min(MAX_PAGE)).unwrap_or(MAX_PAGE_I64);

        let sql = format!(
            "SELECT {SUMMARY_COLUMNS} FROM execution_entity
              WHERE (?1 IS NULL OR workflow_id = ?1)
                AND (?2 IS NULL OR status = ?2)
              ORDER BY started_at DESC LIMIT ?3"
        );
        let mut stmt = conn.prepare(&sql)?;
        stmt.query_map(params![workflow_id, status, limit], summary_from_row)?
            .collect()
    }

    /// One run, with the per-node detail the console and the canvas replay
    /// from.
    pub fn find(&self, id: &str) -> rusqlite::Result<Option<StoredExecution>> {
        let conn = self.db.conn();
        let sql = format!("SELECT {SUMMARY_COLUMNS}, data FROM execution_entity WHERE id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(StoredExecution {
                summary: summary_from_row(row)?,
                data: serde_json::from_str(&row.get::<_, String>(11)?).unwrap_or_default(),
            })
        })?;
        rows.next().transpose()
    }

    /// Open an execution before the workflow starts.
    ///
    /// Written up front rather than on completion, because a run that never
    /// completes is exactly the one worth knowing about. Until this existed a
    /// crash mid-run left no row at all: no failure, no record, and nothing to
    /// retry — the run simply vanished.
    ///
    /// The trigger input is stored so an interrupted run can be retried. It is
    /// the same payload the finished row would have carried, so nothing extra
    /// reaches disk.
    pub fn start(&self, opening: &Opening<'_>) -> rusqlite::Result<()> {
        self.db.conn().execute(
            "INSERT INTO execution_entity
               (id, workflow_id, workflow_name, status, mode, started_at, ms, data,
                retry_of, attempt, worker_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9, ?10)",
            params![
                opening.id,
                opening.workflow_id,
                opening.workflow_name,
                ExecutionStatus::Running.as_str(),
                opening.mode,
                opening.started_at,
                json!({ "input": opening.input }).to_string(),
                opening.lineage.map(|l| l.retry_of.as_str()),
                opening.lineage.map_or(1, |l| l.attempt),
                opening.worker_id,
            ],
        )?;
        Ok(())
    }

    /// Close an execution with what happened.
    pub fn finish(&self, id: &str, ms: u64, result: &RunResult) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE execution_entity
                SET status = ?2, finished_at = ?3, ms = ?4, error = ?5, data = ?6
              WHERE id = ?1",
            params![
                id,
                result.status.as_str(),
                chrono::Utc::now().to_rfc3339(),
                i64::try_from(ms).unwrap_or(i64::MAX),
                result.error,
                serde_json::to_string(result).unwrap_or_else(|_| "{}".into()),
            ],
        )
    }

    /// Close out runs this worker was in the middle of when it last stopped.
    ///
    /// Called at startup. Anything still marked running under *this* worker's
    /// id cannot be running, because this worker has only just started — so it
    /// was interrupted by a restart, a crash or a deploy. Saying so is the
    /// point: an operator can see what did not finish and decide whether to
    /// retry it.
    ///
    /// Scoped to one worker because it is no longer safe to assume this
    /// process is the only one. Another worker's running rows may be exactly
    /// that — running — and closing them would report a healthy execution as
    /// dead while it carried on writing.
    pub fn close_own_interrupted(&self, worker_id: &str, reason: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE execution_entity
                SET status = ?1, finished_at = ?2, error = ?3
              WHERE status = ?4 AND worker_id = ?5",
            params![
                ExecutionStatus::Error.as_str(),
                chrono::Utc::now().to_rfc3339(),
                reason,
                ExecutionStatus::Running.as_str(),
                worker_id,
            ],
        )
    }

    /// Close out runs from before workers had names.
    ///
    /// Every run opened from now on is stamped, so a running row with no
    /// worker can only predate that — which means whatever was running it is
    /// long gone, whoever notices first.
    pub fn close_unowned(&self, reason: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE execution_entity
                SET status = ?1, finished_at = ?2, error = ?3
              WHERE status = ?4 AND worker_id IS NULL",
            params![
                ExecutionStatus::Error.as_str(),
                chrono::Utc::now().to_rfc3339(),
                reason,
                ExecutionStatus::Running.as_str(),
            ],
        )
    }

    /// Close out runs left behind by workers that have stopped reporting.
    ///
    /// Swept periodically rather than at startup, because the worker that died
    /// is usually not the one that notices. A run whose worker is gone would
    /// otherwise sit marked running for ever, and show in the executions list
    /// as something still in progress that nobody is progressing.
    ///
    /// Rows with no worker at all are included: they predate worker ids, so
    /// whatever was running them is long gone.
    pub fn close_abandoned(&self, dead: &[String], reason: &str) -> rusqlite::Result<usize> {
        let mut closed = self.close_unowned(reason)?;

        // Bounded loop (Power of 10 rule 2): one statement per dead worker,
        // and the worker table is swept of long-gone entries.
        for worker in dead {
            closed = closed.saturating_add(self.close_own_interrupted(worker, reason)?);
        }
        Ok(closed)
    }

    /// What a retry of `id` would be: which run it replaces, and which attempt
    /// it is.
    ///
    /// Returns `None` when the work has already been through [`MAX_ATTEMPTS`],
    /// so the decision to stop lives with the data rather than with each
    /// caller remembering to check.
    pub fn lineage_for_retry(&self, id: &str) -> rusqlite::Result<Option<Lineage>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT attempt FROM execution_entity WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], |row| row.get::<_, i64>(0))?;

        let Some(previous) = rows.next().transpose()? else {
            return Ok(None);
        };
        if previous >= MAX_ATTEMPTS {
            return Ok(None);
        }

        Ok(Some(Lineage {
            retry_of: id.to_owned(),
            attempt: previous + 1,
        }))
    }

    /// End a run that will never continue.
    pub fn mark_cancelled(&self, id: &str, reason: &str) -> rusqlite::Result<usize> {
        self.db.conn().execute(
            "UPDATE execution_entity
                SET status = ?2, finished_at = ?3, error = ?4
              WHERE id = ?1",
            params![
                id,
                ExecutionStatus::Canceled.as_str(),
                chrono::Utc::now().to_rfc3339(),
                reason,
            ],
        )
    }

    /// The items a run was started with, so it can be retried as it was.
    pub fn trigger_input(&self, id: &str) -> rusqlite::Result<Option<Items>> {
        let conn = self.db.conn();
        let mut stmt = conn.prepare("SELECT data FROM execution_entity WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], |row| row.get::<_, String>(0))?;

        let Some(data) = rows.next().transpose()? else {
            return Ok(None);
        };
        let parsed: Value = serde_json::from_str(&data).unwrap_or(Value::Null);

        // A run that finished stores its full result; the trigger's own output
        // is what it was handed, so either shape can answer the question.
        let input = parsed
            .get("input")
            .cloned()
            .or_else(|| {
                parsed
                    .get("runs")?
                    .as_array()?
                    .first()?
                    .get("output")?
                    .get("main")
                    .cloned()
            })
            .and_then(|value| serde_json::from_value::<Items>(value).ok());

        Ok(input)
    }

    pub fn delete(&self, id: &str) -> rusqlite::Result<usize> {
        self.db
            .conn()
            .execute("DELETE FROM execution_entity WHERE id = ?1", params![id])
    }

    /// Keep only the newest `keep` executions of a workflow. Without this the
    /// database grows without bound on a busy schedule trigger.
    ///
    /// Returns the ids that went, because a pruned run may have left files
    /// beside the database. Reporting only a count would leave those on disk
    /// for ever with nothing pointing at them.
    pub fn prune(&self, workflow_id: &str, keep: usize) -> rusqlite::Result<Vec<String>> {
        let conn = self.db.conn();
        let limit = i64::try_from(keep).unwrap_or(i64::MAX);

        let doomed: Vec<String> = {
            let mut stmt = conn.prepare(
                "SELECT id FROM execution_entity
                  WHERE workflow_id = ?1
                    AND id NOT IN (
                        SELECT id FROM execution_entity
                         WHERE workflow_id = ?1
                         ORDER BY started_at DESC LIMIT ?2
                    )",
            )?;
            let rows = stmt.query_map(params![workflow_id, limit], |row| row.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };

        if doomed.is_empty() {
            return Ok(doomed);
        }

        conn.execute(
            "DELETE FROM execution_entity
              WHERE workflow_id = ?1
                AND id NOT IN (
                    SELECT id FROM execution_entity
                     WHERE workflow_id = ?1
                     ORDER BY started_at DESC LIMIT ?2
                )",
            params![workflow_id, limit],
        )?;

        Ok(doomed)
    }
}

fn summary_from_row(row: &Row<'_>) -> rusqlite::Result<ExecutionSummary> {
    Ok(ExecutionSummary {
        id: row.get(0)?,
        workflow_id: row.get(1)?,
        workflow_name: row.get(2)?,
        status: row.get(3)?,
        mode: row.get(4)?,
        started_at: row.get(5)?,
        finished_at: row.get(6)?,
        ms: row.get(7)?,
        error: row.get(8)?,
        retry_of: row.get(9)?,
        attempt: row.get(10)?,
    })
}
